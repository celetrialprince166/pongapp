from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q, Avg, Max, Min, Count
from django.shortcuts import get_object_or_404
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import Match, Game, MatchEvent
from .serializers import (
    MatchListSerializer, MatchDetailSerializer, MatchCreateSerializer,
    AddPointSerializer, CompleteMatchSerializer, GameSerializer,
    MatchEventSerializer, MatchStatsSerializer, MatchScoreboardSerializer
)
from .services import MatchResultService
from users.models import User
from users.permissions import IsAdminRole, IsRefereeRole


def _broadcast_match_update(match):
    """Broadcast current match state to all connected WebSocket clients for this match."""
    channel_layer = get_channel_layer()
    if not channel_layer:
        return
    try:
        match_data = MatchListSerializer(match).data
        async_to_sync(channel_layer.group_send)(
            f'match_{match.id}',
            {
                'type': 'match_update',
                'match': match_data,
            }
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"WebSocket broadcast failed for match {match.id}: {e}")
        # Never raise — scoring must succeed even without Redis


def _advance_bracket(match, winner):
    """
    After a tournament match completes, advance the winner into the next
    bracket slot and create a Match record once both players are known.
    """
    from tournaments.models import TournamentBracket

    try:
        bracket_slot = TournamentBracket.objects.get(match=match)
    except TournamentBracket.DoesNotExist:
        return  # Not a tournament match

    # Record winner on the current bracket slot
    bracket_slot.winner = winner
    bracket_slot.save()

    next_slot = bracket_slot.winner_advances_to
    if next_slot is None:
        # This was the final — nothing to advance
        return

    # Place winner in the correct player slot of the next bracket
    if next_slot.player1 is None:
        next_slot.player1 = winner
    else:
        next_slot.player2 = winner
    next_slot.save()

    # Once both players are known, create the match for the next slot
    if next_slot.player1 and next_slot.player2 and next_slot.match is None:
        from tournaments.round_formats import get_format_for_tournament_round
        next_match_format = get_format_for_tournament_round(
            match.tournament, next_slot.round.round_number
        ) if match.tournament else match.match_format
        new_match = Match.objects.create(
            player1=next_slot.player1,
            player2=next_slot.player2,
            tournament=match.tournament,
            status='SCHEDULED',
            match_format=next_match_format,
            is_rated=match.is_rated,
        )
        next_slot.match = new_match
        next_slot.save()


class MatchListCreateView(generics.ListCreateAPIView):
    """
    List all matches or create a new match
    GET /api/matches/
    POST /api/matches/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return MatchCreateSerializer
        return MatchListSerializer

    def get_queryset(self):
        queryset = Match.objects.all().select_related(
            'player1', 'player2', 'winner', 'referee', 'season'
        )

        # Filter by status
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())

        # Filter by player
        player_id = self.request.query_params.get('player_id', None)
        if player_id:
            queryset = queryset.filter(
                Q(player1_id=player_id) | Q(player2_id=player_id)
            )

        # Filter by rated/unrated
        is_rated = self.request.query_params.get('is_rated', None)
        if is_rated is not None:
            queryset = queryset.filter(is_rated=is_rated.lower() == 'true')

        # Filter by season
        season_id = self.request.query_params.get('season_id', None)
        if season_id:
            queryset = queryset.filter(season_id=season_id)

        return queryset.order_by('-created_at')


class MatchDetailView(generics.RetrieveAPIView):
    """
    Get match details
    GET /api/matches/{id}/
    """
    queryset = Match.objects.all()
    serializer_class = MatchDetailSerializer
    permission_classes = [permissions.IsAuthenticated]


class MatchStartView(APIView):
    """
    Start a match
    POST /api/matches/{id}/start/
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        match = get_object_or_404(Match, pk=pk)

        # Check permissions (referee or admin)
        if not (request.user.role in ['ADMIN', 'REFEREE'] or match.referee == request.user):
            return Response({
                'error': 'Only the referee or admin can start the match'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            service = MatchResultService()
            service.start_match(match)

            return Response({
                'message': 'Match started successfully',
                'match': MatchDetailSerializer(match).data
            }, status=status.HTTP_200_OK)

        except ValueError as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


class MatchAddPointView(APIView):
    """
    Add a point to a player in the current game
    POST /api/matches/{id}/add-point/
    Body: {"player_id": 1}
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        match = get_object_or_404(Match, pk=pk)

        # Check permissions (referee or admin)
        if not (request.user.role in ['ADMIN', 'REFEREE'] or match.referee == request.user):
            return Response({
                'error': 'Only the referee or admin can score points'
            }, status=status.HTTP_403_FORBIDDEN)

        # Validate match status
        if match.status != 'IN_PROGRESS':
            return Response({
                'error': 'Match is not in progress'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Accept either 'player_id' or 'player' key for backward compatibility
        raw_data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        if 'player' in raw_data and 'player_id' not in raw_data:
            raw_data['player_id'] = raw_data.pop('player')

        # Validate and get player
        serializer = AddPointSerializer(data=raw_data, context={'match': match})
        serializer.is_valid(raise_exception=True)

        player_id = serializer.validated_data['player_id']
        player = User.objects.get(id=player_id)

        # RACE_TO formats: directly increment match point counters (no Game objects)
        if match.match_format.startswith('RACE_TO'):
            if player == match.player1:
                match.player1_games_won += 1
            else:
                match.player2_games_won += 1
            match.save(update_fields=['player1_games_won', 'player2_games_won', 'updated_at'])

            MatchEvent.objects.create(
                match=match,
                event_type='POINT',
                player=player,
                player1_score=match.player1_games_won,
                player2_score=match.player2_games_won
            )

            match_complete = self._check_match_completion(match)
            _broadcast_match_update(match)
            return Response({
                'game': None,
                'match_score': {
                    'player1_games_won': match.player1_games_won,
                    'player2_games_won': match.player2_games_won,
                },
                'match_complete': match_complete
            }, status=status.HTTP_200_OK)

        # BEST_OF formats: game-based scoring
        current_game = match.games.filter(is_completed=False).first()
        if not current_game:
            # Create new game
            current_game = Game.objects.create(
                match=match,
                game_number=match.games.count() + 1
            )

        # Add point
        current_game.add_point(player)

        # Create match event
        MatchEvent.objects.create(
            match=match,
            game=current_game,
            event_type='POINT',
            player=player,
            player1_score=current_game.player1_score,
            player2_score=current_game.player2_score
        )

        # Check if match is complete
        match.refresh_from_db()
        match_complete = self._check_match_completion(match)

        response_data = {
            'game': GameSerializer(current_game).data,
            'match_score': {
                'player1_games_won': match.player1_games_won,
                'player2_games_won': match.player2_games_won,
            },
            'match_complete': match_complete
        }

        _broadcast_match_update(match)
        return Response(response_data, status=status.HTTP_200_OK)

    def _check_match_completion(self, match):
        """Check if match is complete based on format"""
        if match.match_format.startswith('BEST_OF'):
            required_wins = {
                'BEST_OF_3': 2,
                'BEST_OF_5': 3,
                'BEST_OF_7': 4,
            }
            required = required_wins.get(match.match_format, 2)
            return (match.player1_games_won >= required or
                    match.player2_games_won >= required)

        if match.match_format.startswith('RACE_TO'):
            target = match.target_score
            if not target:
                return False
            return (match.player1_games_won >= target or
                    match.player2_games_won >= target)

        return False


class MatchCompleteView(APIView):
    """
    Complete a match
    POST /api/matches/{id}/complete/
    Body: {"winner_id": 1}  — optional; winner auto-determined from games_won if omitted
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        match = get_object_or_404(Match, pk=pk)

        # Check permissions (referee or admin)
        if not (request.user.role in ['ADMIN', 'REFEREE'] or match.referee == request.user):
            return Response({
                'error': 'Only the referee or admin can complete the match'
            }, status=status.HTTP_403_FORBIDDEN)

        # Determine winner: use explicit winner_id if provided, else auto-determine
        winner_id = request.data.get('winner_id')
        if winner_id:
            if int(winner_id) not in [match.player1.id, match.player2.id]:
                return Response({'error': 'Winner must be one of the players'}, status=status.HTTP_400_BAD_REQUEST)
            winner = User.objects.get(id=winner_id)
        else:
            # Auto-determine from games_won tally
            if match.player1_games_won > match.player2_games_won:
                winner = match.player1
            elif match.player2_games_won > match.player1_games_won:
                winner = match.player2
            else:
                return Response(
                    {'error': 'Cannot auto-determine winner: games won are tied. Provide winner_id.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        try:
            service = MatchResultService()
            result = service.complete_match(match, winner)

            # Advance bracket if this is a tournament match
            match.refresh_from_db()
            _advance_bracket(match, winner)

            # Push final state to all connected live-scoring clients
            _broadcast_match_update(match)

            return Response({
                'message': 'Match completed successfully',
                'result': result
            }, status=status.HTTP_200_OK)

        except ValueError as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


class MatchCorrectView(APIView):
    """
    Admin: correct match scores at game level.
    PUT /api/matches/{id}/correct/
    Body:
    {
        "games": [
            {"game_number": 1, "player1_score": 11, "player2_score": 6},
            {"game_number": 2, "player1_score": 11, "player2_score": 9}
        ],
        "reason": "Score entered incorrectly"   // optional
    }
    """
    permission_classes = [IsAdminRole]

    def put(self, request, pk):
        match = get_object_or_404(Match, pk=pk)

        if match.status == 'CANCELLED':
            return Response({'error': 'Cannot correct a cancelled match.'}, status=status.HTTP_400_BAD_REQUEST)

        games_data = request.data.get('games')
        if not games_data or not isinstance(games_data, list):
            return Response({'error': '"games" array is required.'}, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('reason', '')

        # Process each game
        for game_entry in games_data:
            game_number = game_entry.get('game_number')
            p1_score = game_entry.get('player1_score')
            p2_score = game_entry.get('player2_score')

            if game_number is None or p1_score is None or p2_score is None:
                return Response(
                    {'error': 'Each game entry must have game_number, player1_score, player2_score.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            game, _ = Game.objects.get_or_create(
                match=match,
                game_number=game_number,
                defaults={'player1_score': 0, 'player2_score': 0}
            )
            game.player1_score = int(p1_score)
            game.player2_score = int(p2_score)

            # Determine game winner: first to 11 with 2-point margin
            max_score = max(game.player1_score, game.player2_score)
            score_diff = abs(game.player1_score - game.player2_score)
            if max_score >= 11 and score_diff >= 2:
                game.is_completed = True
                if not game.completed_at:
                    from django.utils import timezone
                    game.completed_at = timezone.now()
                if game.player1_score > game.player2_score:
                    game.winner = match.player1
                else:
                    game.winner = match.player2
            else:
                game.is_completed = False
                game.winner = None

            game.save()

        # Recalculate match games_won from game records
        completed_games = match.games.filter(is_completed=True)
        p1_won = completed_games.filter(winner=match.player1).count()
        p2_won = completed_games.filter(winner=match.player2).count()
        match.player1_games_won = p1_won
        match.player2_games_won = p2_won

        # Determine match winner
        required_wins = {'BEST_OF_3': 2, 'BEST_OF_5': 3, 'BEST_OF_7': 4}
        required = required_wins.get(match.match_format, 2)

        if p1_won >= required:
            winner = match.player1
        elif p2_won >= required:
            winner = match.player2
        else:
            winner = None

        if winner:
            match.winner = winner
            match.status = 'COMPLETED'
            if not match.completed_at:
                from django.utils import timezone
                match.completed_at = timezone.now()
        match.save()

        # Log correction event
        MatchEvent.objects.create(
            match=match,
            event_type='GAME_END',
            player=request.user,
            player1_score=p1_won,
            player2_score=p2_won,
        )

        # Advance bracket if winner determined
        if winner:
            _advance_bracket(match, winner)

        from .serializers import MatchDetailSerializer
        return Response({
            'message': 'Match corrected successfully',
            'winner': winner.id if winner else None,
            'player1_games_won': match.player1_games_won,
            'player2_games_won': match.player2_games_won,
            'match': MatchDetailSerializer(match).data,
        }, status=status.HTTP_200_OK)


class MatchCancelView(APIView):
    """
    Cancel a match
    POST /api/matches/{id}/cancel/
    Body: {"reason": "Player unavailable"} (optional)
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        match = get_object_or_404(Match, pk=pk)

        # Check permissions (players, referee, or admin)
        if not (request.user.role in ['ADMIN', 'REFEREE'] or
                match.referee == request.user or
                request.user in [match.player1, match.player2]):
            return Response({
                'error': 'You do not have permission to cancel this match'
            }, status=status.HTTP_403_FORBIDDEN)

        reason = request.data.get('reason', None)

        try:
            service = MatchResultService()
            service.cancel_match(match, reason)

            return Response({
                'message': 'Match cancelled successfully',
                'match': MatchDetailSerializer(match).data
            }, status=status.HTTP_200_OK)

        except ValueError as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


class MatchScoreboardView(APIView):
    """
    Get live scoreboard for a match
    GET /api/matches/{id}/scoreboard/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        match = get_object_or_404(Match, pk=pk)

        # Get current game
        current_game = match.games.filter(is_completed=False).first()
        current_game_data = None
        if current_game:
            current_game_data = {
                'game_number': current_game.game_number,
                'player1_score': current_game.player1_score,
                'player2_score': current_game.player2_score,
                'is_deuce': current_game.is_deuce,
            }

        scoreboard = {
            'match_id': match.id,
            'player1_username': match.player1.username,
            'player2_username': match.player2.username,
            'player1_games_won': match.player1_games_won,
            'player2_games_won': match.player2_games_won,
            'current_game': current_game_data,
            'status': match.status,
            'is_rated': match.is_rated,
        }

        return Response(scoreboard, status=status.HTTP_200_OK)


class UserMatchHistoryView(generics.ListAPIView):
    """
    Get match history for a user
    GET /api/users/{id}/matches/
    """
    serializer_class = MatchListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user_id = self.kwargs.get('pk')
        return Match.objects.filter(
            Q(player1_id=user_id) | Q(player2_id=user_id),
            status='COMPLETED'
        ).select_related('player1', 'player2', 'winner').order_by('-completed_at')


class MatchStatsView(APIView):
    """
    Get match statistics
    GET /api/matches/stats/
    Query params: season_id, player_id
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        queryset = Match.objects.all()

        # Filter by season
        season_id = request.query_params.get('season_id', None)
        if season_id:
            queryset = queryset.filter(season_id=season_id)

        # Filter by player
        player_id = request.query_params.get('player_id', None)
        if player_id:
            queryset = queryset.filter(
                Q(player1_id=player_id) | Q(player2_id=player_id)
            )

        # Calculate statistics
        total_matches = queryset.count()
        completed = queryset.filter(status='COMPLETED').count()
        in_progress = queryset.filter(status='IN_PROGRESS').count()
        scheduled = queryset.filter(status='SCHEDULED').count()
        cancelled = queryset.filter(status='CANCELLED').count()
        rated_matches = queryset.filter(is_rated=True).count()
        unrated_matches = queryset.filter(is_rated=False).count()

        # Duration statistics (only for completed matches)
        completed_matches = queryset.filter(
            status='COMPLETED',
            started_at__isnull=False,
            completed_at__isnull=False
        )

        durations = []
        for match in completed_matches:
            duration = match.duration_minutes
            if duration:
                durations.append(duration)

        stats = {
            'total_matches': total_matches,
            'completed': completed,
            'in_progress': in_progress,
            'scheduled': scheduled,
            'cancelled': cancelled,
            'rated_matches': rated_matches,
            'unrated_matches': unrated_matches,
            'average_duration': sum(durations) / len(durations) if durations else 0,
            'longest_match': max(durations) if durations else 0,
            'shortest_match': min(durations) if durations else 0,
        }

        serializer = MatchStatsSerializer(stats)
        return Response(serializer.data, status=status.HTTP_200_OK)


class LiveMatchesView(generics.ListAPIView):
    """
    Get all matches currently in progress
    GET /api/matches/live/
    """
    serializer_class = MatchListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Match.objects.filter(
            status='IN_PROGRESS'
        ).select_related('player1', 'player2', 'referee').order_by('-started_at')


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def head_to_head(request, player1_id, player2_id):
    """
    Get head-to-head statistics between two players
    GET /api/matches/head-to-head/{player1_id}/{player2_id}/
    """
    matches = Match.objects.filter(
        Q(player1_id=player1_id, player2_id=player2_id) |
        Q(player1_id=player2_id, player2_id=player1_id),
        status='COMPLETED'
    ).select_related('player1', 'player2', 'winner')

    total_matches = matches.count()

    # Count wins for each player
    player1_wins = matches.filter(winner_id=player1_id).count()
    player2_wins = matches.filter(winner_id=player2_id).count()

    # Get recent matches
    recent_matches = matches.order_by('-completed_at')[:5]

    stats = {
        'player1_id': player1_id,
        'player2_id': player2_id,
        'total_matches': total_matches,
        'player1_wins': player1_wins,
        'player2_wins': player2_wins,
        'recent_matches': MatchListSerializer(recent_matches, many=True).data
    }

    return Response(stats, status=status.HTTP_200_OK)
