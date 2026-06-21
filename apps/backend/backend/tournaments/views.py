"""
Views for Tournaments App
"""

from rest_framework import generics, serializers, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q, Count, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
import random
import math

from .models import (
    Tournament, TournamentParticipant, TournamentRound,
    TournamentBracket, TournamentGroup, TournamentGroupStanding,
    AwardTier, PlayerAward, TournamentRoundFormat
)
from .serializers import (
    TournamentSerializer, TournamentDetailSerializer, TournamentCreateSerializer,
    TournamentParticipantSerializer, TournamentRoundSerializer,
    TournamentBracketSerializer, TournamentGroupSerializer,
    TournamentGroupStandingSerializer, TournamentStatsSerializer,
    AwardTierSerializer, PlayerAwardSerializer, TournamentRoundFormatSerializer
)
from .round_formats import get_format_for_tournament_round, get_default_format_for_round
from users.models import User
from matches.models import Match


class TournamentListCreateView(generics.ListCreateAPIView):
    """
    List all tournaments or create a new tournament
    GET /api/tournaments/
    POST /api/tournaments/ (authenticated)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return TournamentCreateSerializer
        return TournamentSerializer

    def get_queryset(self):
        queryset = Tournament.objects.filter(is_deleted=False).select_related('organizer')

        # Filter by status
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())

        # Filter by format
        format_filter = self.request.query_params.get('format', None)
        if format_filter:
            queryset = queryset.filter(tournament_format=format_filter.upper())

        # Filter upcoming/ongoing
        show = self.request.query_params.get('show', None)
        if show == 'upcoming':
            queryset = queryset.filter(status='UPCOMING')
        elif show == 'ongoing':
            queryset = queryset.filter(status='IN_PROGRESS')
        elif show == 'completed':
            queryset = queryset.filter(status='COMPLETED')

        return queryset.order_by('-start_date')


class TournamentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Get, update, or delete tournament details
    GET /api/tournaments/{id}/
    PUT/PATCH /api/tournaments/{id}/ (admin/organizer only)
    DELETE /api/tournaments/{id}/ (admin/organizer only)
    """
    queryset = Tournament.objects.filter(is_deleted=False)
    serializer_class = TournamentDetailSerializer

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            # Only organizer or admin can update/delete
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]

    def update(self, request, *args, **kwargs):
        tournament = self.get_object()
        # Check if user is organizer or admin
        is_admin = request.user.role == 'ADMIN' or request.user.is_staff
        if tournament.organizer != request.user and not is_admin:
            return Response({
                'error': 'Only the organizer or admin can update the tournament'
            }, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        tournament = self.get_object()
        # Check if user is organizer or admin
        is_admin = request.user.role == 'ADMIN' or request.user.is_staff
        if tournament.organizer != request.user and not is_admin:
            return Response({
                'error': 'Only the organizer or admin can delete the tournament'
            }, status=status.HTTP_403_FORBIDDEN)

        if tournament.status == 'IN_PROGRESS':
            return Response({
                'error': 'Cannot delete a tournament that is in progress.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if tournament.awards_distributed:
            return Response({
                'error': 'Cannot delete a tournament with distributed awards. Reset awards first.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if tournament.is_deleted:
            return Response({
                'error': 'Tournament is already deleted.'
            }, status=status.HTTP_400_BAD_REQUEST)

        tournament.is_deleted = True
        tournament.deleted_at = timezone.now()
        tournament.deleted_by = request.user
        tournament.save()

        return Response({
            'id': tournament.id,
            'name': tournament.name,
            'deleted_at': tournament.deleted_at,
            'message': 'Tournament deleted successfully'
        }, status=status.HTTP_200_OK)


class TournamentRegisterView(APIView):
    """
    Register for a tournament
    POST /api/tournaments/{id}/register/
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        tournament = get_object_or_404(Tournament, pk=pk, is_deleted=False)
        user = request.user

        # Check if tournament is open for registration
        if tournament.status not in ['UPCOMING', 'REGISTRATION']:
            return Response({
                'error': 'Tournament is not open for registration'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check registration deadline (only enforced if a deadline is set)
        if tournament.registration_deadline and timezone.now() > tournament.registration_deadline:
            return Response({
                'error': 'Registration deadline has passed'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check if tournament is full
        participants_count = tournament.participants.filter(status='CONFIRMED').count()
        if participants_count >= tournament.max_participants:
            return Response({
                'error': 'Tournament is full'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check if already registered
        existing = TournamentParticipant.objects.filter(

            tournament=tournament,
            player=user
        ).first()

        if existing:
            if existing.status == 'CONFIRMED':
                return Response({
                    'error': 'You are already registered'
                }, status=status.HTTP_400_BAD_REQUEST)
            else:
                # Confirm existing registration
                existing.status = 'CONFIRMED'
                existing.confirmed_at = timezone.now()
                existing.save()
                return Response({
                    'message': 'Registration confirmed',
                    'participant': TournamentParticipantSerializer(existing).data
                }, status=status.HTTP_200_OK)

        # Create new participant
        participant = TournamentParticipant.objects.create(
            tournament=tournament,
            player=user,
            status='CONFIRMED',
            confirmed_at=timezone.now()
        )

        return Response({
            'message': 'Successfully registered for tournament',
            'participant': TournamentParticipantSerializer(participant).data
        }, status=status.HTTP_201_CREATED)


class TournamentUnregisterView(APIView):
    """
    Unregister from a tournament
    POST /api/tournaments/{id}/unregister/
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        tournament = get_object_or_404(Tournament, pk=pk, is_deleted=False)
        user = request.user

        # Can only unregister before tournament starts
        if tournament.status not in ['UPCOMING', 'REGISTRATION']:
            return Response({
                'error': 'Cannot unregister after tournament has started'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Find participant
        participant = TournamentParticipant.objects.filter(

            tournament=tournament,
            player=user
        ).first()

        if not participant:
            return Response({
                'error': 'You are not registered for this tournament'
            }, status=status.HTTP_400_BAD_REQUEST)

        participant.delete()

        return Response({
            'message': 'Successfully unregistered from tournament'
        }, status=status.HTTP_200_OK)


class TournamentStartView(APIView):
    """
    Start a tournament and generate brackets
    POST /api/tournaments/{id}/start/
    Organizer/admin only
    """
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        tournament = get_object_or_404(Tournament, pk=pk, is_deleted=False)

        # Check permissions
        if tournament.organizer != request.user and request.user.role != 'ADMIN':
            return Response({
                'error': 'Only the organizer or admin can start the tournament'
            }, status=status.HTTP_403_FORBIDDEN)

        # Check tournament status
        if tournament.status not in ['UPCOMING', 'REGISTRATION']:
            return Response({
                'error': 'Tournament has already started or is completed'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check minimum participants
        participants = tournament.participants.filter(status='CONFIRMED')
        if participants.count() < tournament.min_participants:
            return Response({
                'error': f'Need at least {tournament.min_participants} participants'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Generate seeding based on rating
        participants = list(participants.order_by('-player__player_profile__current_rating'))
        for index, participant in enumerate(participants, start=1):
            participant.seed = index
            participant.save()

        # Clear any stale bracket data from failed previous attempts
        TournamentRound.objects.filter(tournament=tournament).delete()

        # Generate brackets based on format
        if tournament.tournament_format in ['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION']:
            self._generate_elimination_bracket(tournament, participants)
        elif tournament.tournament_format == 'ROUND_ROBIN':
            self._generate_round_robin(tournament, participants)
        elif tournament.tournament_format == 'GROUP_KNOCKOUT':
            self._generate_group_knockout(tournament, participants)

        # Close registration for MANUAL mode tournaments
        if tournament.registration_mode == 'MANUAL' and not tournament.registration_closed_at:
            tournament.registration_closed_at = timezone.now()

        # Update tournament status
        tournament.status = 'IN_PROGRESS'
        tournament.save()

        return Response({
            'message': 'Tournament started successfully',
            'tournament': TournamentDetailSerializer(tournament).data
        }, status=status.HTTP_200_OK)

    def _generate_elimination_bracket(self, tournament, participants):
        """Generate single elimination bracket with full round structure,
        winner_advances_to links, and linked Match records for Round 1."""
        num_participants = len(participants)
        num_rounds = math.ceil(math.log2(num_participants))

        # --- Build all rounds first so we can link winner_advances_to ---
        rounds = []
        for round_num in range(1, num_rounds + 1):
            if round_num == num_rounds:
                round_label = 'Final'
            elif round_num == num_rounds - 1:
                round_label = 'Semi-Final'
            elif round_num == num_rounds - 2:
                round_label = 'Quarter-Final'
            else:
                round_label = f'Round {round_num}'

            round_obj = TournamentRound.objects.create(
                tournament=tournament,
                round_number=round_num,
                name=round_label
            )
            rounds.append(round_obj)

        # --- Create bracket slots for every round ---
        # Round r has ceil(num_participants / 2^r) slots
        all_brackets = {}  # (round_num, position) -> TournamentBracket

        for r_idx, round_obj in enumerate(rounds):
            num_slots = math.ceil(num_participants / (2 ** (r_idx + 1)))
            for pos in range(1, num_slots + 1):
                bracket = TournamentBracket.objects.create(
                    tournament=tournament,
                    round=round_obj,
                    bracket_position=pos,
                    player1=None,
                    player2=None
                )
                all_brackets[(round_obj.round_number, pos)] = bracket

        # --- Assign players to Round 1 slots ---
        for i in range(0, num_participants, 2):
            slot_pos = (i // 2) + 1
            bracket = all_brackets.get((1, slot_pos))
            if not bracket:
                continue
            bracket.player1 = participants[i].player
            bracket.player2 = participants[i + 1].player if (i + 1) < num_participants else None
            bracket.save()

        # --- Wire winner_advances_to for all rounds except the final ---
        for r_idx in range(num_rounds - 1):
            current_round_num = r_idx + 1
            next_round_num = r_idx + 2
            num_slots = math.ceil(num_participants / (2 ** (r_idx + 1)))
            for pos in range(1, num_slots + 1):
                current_bracket = all_brackets.get((current_round_num, pos))
                next_pos = math.ceil(pos / 2)
                next_bracket = all_brackets.get((next_round_num, next_pos))
                if current_bracket and next_bracket:
                    current_bracket.winner_advances_to = next_bracket
                    current_bracket.save()

        # --- Create Match records for Round 1 slots with two known players ---
        round1_format = get_format_for_tournament_round(tournament, 1)
        round1_brackets = [
            b for (rn, _), b in all_brackets.items() if rn == 1
        ]
        for bracket in round1_brackets:
            if bracket.player1 and bracket.player2:
                match = Match.objects.create(
                    player1=bracket.player1,
                    player2=bracket.player2,
                    tournament=tournament,
                    status='SCHEDULED',
                    match_format=round1_format,
                    is_rated=tournament.is_rated,
                )
                bracket.match = match
                bracket.save()

    def _generate_round_robin(self, tournament, participants):
        """Generate round robin schedule"""
        # Create single round
        round_obj = TournamentRound.objects.create(
            tournament=tournament,
            round_number=1,
            name='Round Robin'
        )

        # Create single group
        group = TournamentGroup.objects.create(
            tournament=tournament,
            name='Group A'
        )

        # Create group standings
        for participant in participants:
            TournamentGroupStanding.objects.create(
                group=group,
                player=participant.player
            )

        # Generate all vs all matches — create a Match record for each slot
        # so the admin can start them from the bracket view
        match_format = get_format_for_tournament_round(tournament, 1)
        bracket_position = 1
        for i, p1 in enumerate(participants):
            for p2 in participants[i + 1:]:
                bracket = TournamentBracket.objects.create(
                    tournament=tournament,
                    round=round_obj,
                    bracket_position=bracket_position,
                    player1=p1.player,
                    player2=p2.player
                )
                match = Match.objects.create(
                    player1=p1.player,
                    player2=p2.player,
                    tournament=tournament,
                    status='SCHEDULED',
                    match_format=match_format,
                    is_rated=tournament.is_rated,
                )
                bracket.match = match
                bracket.save()
                bracket_position += 1

    def _generate_group_knockout(self, tournament, participants):
        """Generate group stage + knockout"""
        # For MVP, implement basic 2-group structure
        num_participants = len(participants)
        group_size = num_participants // 2

        # Create group stage round
        group_round = TournamentRound.objects.create(
            tournament=tournament,
            round_number=1,
            name='Group Stage'
        )

        # Create two groups
        groups = [
            TournamentGroup.objects.create(
                tournament=tournament,
                name='Group A'
            ),
            TournamentGroup.objects.create(
                tournament=tournament,
                name='Group B'
            )
        ]

        # Assign participants to groups (snake seeding)
        for i, participant in enumerate(participants):
            group = groups[i % 2]
            TournamentGroupStanding.objects.create(
                group=group,
                player=participant.player
            )


class TournamentRoundFormatsView(APIView):
    """
    GET  /api/tournaments/<pk>/round-formats/  — list saved configs
    PUT  /api/tournaments/<pk>/round-formats/  — replace all configs (admin only)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        tournament = get_object_or_404(Tournament, pk=pk)
        formats = TournamentRoundFormat.objects.filter(tournament=tournament)
        return Response(TournamentRoundFormatSerializer(formats, many=True).data)

    def put(self, request, pk):
        from users.permissions import IsAdminRole
        tournament = get_object_or_404(Tournament, pk=pk)
        if not request.user.role == 'ADMIN':
            return Response({'error': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = TournamentRoundFormatSerializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)

        TournamentRoundFormat.objects.filter(tournament=tournament).delete()
        created = []
        for item in serializer.validated_data:
            rf = TournamentRoundFormat.objects.create(
                tournament=tournament,
                **item,
            )
            created.append(rf)
        return Response(TournamentRoundFormatSerializer(created, many=True).data)


class TournamentRoundFormatsPreviewView(APIView):
    """
    GET /api/tournaments/round-formats/preview/
    ?format=SINGLE_ELIMINATION&max_players=8
    Returns default round format configs without saving anything.
    Used by the wizard before a tournament is created.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # NOTE: do NOT use 'format' as a query param — DRF intercepts it for
        # content negotiation and returns 404 for unknown renderer names.
        tournament_format = request.query_params.get('tournament_format', 'SINGLE_ELIMINATION')
        try:
            max_players = int(request.query_params.get('max_players', 8))
        except (ValueError, TypeError):
            max_players = 8

        if tournament_format in ('ROUND_ROBIN', 'SWISS'):
            total_rounds = 1
        else:
            total_rounds = max(1, math.ceil(math.log2(max(2, max_players))))

        rounds = []
        for r in range(1, total_rounds + 1):
            rounds_from_end = total_rounds - r
            if rounds_from_end == 0:
                name = 'Final'
            elif rounds_from_end == 1:
                name = 'Semi Finals'
            elif rounds_from_end == 2:
                name = 'Quarter Finals'
            elif tournament_format == 'GROUP_KNOCKOUT' and r == 1:
                name = 'Group Stage'
            else:
                name = f'Round {r}'

            fmt = get_default_format_for_round(tournament_format, r, total_rounds)
            rounds.append({
                'round_number': r,
                'round_name': name,
                'match_format': fmt,
            })

        return Response(rounds)


class TournamentBracketView(APIView):
    """
    Get tournament bracket
    GET /api/tournaments/{id}/bracket/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        tournament = get_object_or_404(Tournament, pk=pk, is_deleted=False)

        rounds = TournamentRound.objects.filter(
            tournament=tournament
        ).prefetch_related('brackets').order_by('round_number')

        bracket_data = []
        for round_obj in rounds:
            brackets = TournamentBracketSerializer(
                round_obj.brackets.all().order_by('bracket_position'),
                many=True
            ).data

            bracket_data.append({
                'round': TournamentRoundSerializer(round_obj).data,
                'brackets': brackets
            })

        return Response({
            'tournament_id': tournament.id,
            'tournament_name': tournament.name,
            'format': tournament.tournament_format,
            'rounds': bracket_data
        }, status=status.HTTP_200_OK)


class TournamentStandingsView(APIView):
    """
    Get tournament standings (for round robin/group formats)
    GET /api/tournaments/{id}/standings/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        tournament = get_object_or_404(Tournament, pk=pk, is_deleted=False)

        groups = TournamentGroup.objects.filter(
            tournament=tournament
        ).prefetch_related('standings')

        standings_data = []
        for group in groups:
            all_standings = list(group.standings.all().order_by('-points', '-wins'))
            standings_list = []
            for i, standing in enumerate(all_standings):
                data = TournamentGroupStandingSerializer(standing).data
                data['advances'] = i < 2   # top 2 per group advance to knockout
                standings_list.append(data)

            standings_data.append({
                'group': TournamentGroupSerializer(group).data,
                'standings': standings_list,
            })

        return Response({
            'tournament_id': tournament.id,
            'tournament_name': tournament.name,
            'groups': standings_data
        }, status=status.HTTP_200_OK)


class TournamentParticipantsView(generics.ListAPIView):
    """
    Get tournament participants
    GET /api/tournaments/{id}/participants/
    """
    serializer_class = TournamentParticipantSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        tournament_id = self.kwargs.get('pk')
        return TournamentParticipant.objects.filter(

            tournament_id=tournament_id,
            status='CONFIRMED'
        ).select_related('player').order_by('seed')


class AdminRemoveParticipantView(APIView):
    """
    Admin: remove a participant from a tournament.
    DELETE /api/tournaments/{id}/participants/{pid}/
    """
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk, pid):
        if not (request.user.is_staff or getattr(request.user, 'role', None) == 'ADMIN'):
            return Response({'error': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)

        tournament = get_object_or_404(Tournament, pk=pk, is_deleted=False)
        participant = get_object_or_404(TournamentParticipant, pk=pid, tournament=tournament)
        participant.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserTournamentStatsView(APIView):
    """
    Get tournament statistics for a user
    GET /api/tournaments/stats/{user_id}/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_id):
        user = get_object_or_404(User, id=user_id)

        # Get participated tournaments
        participations = TournamentParticipant.objects.filter(

            player=user,
            status='CONFIRMED'
        )

        # Calculate statistics
        stats = {
            'total_tournaments': participations.count(),
            'tournaments_participated': participations.filter(
                tournament__status='COMPLETED'
            ).count(),
            'tournaments_won': participations.filter(
                final_rank=1
            ).count(),
            'current_tournaments': participations.filter(
                tournament__status='IN_PROGRESS'
            ).count(),
        }

        # Best placement
        best = participations.filter(
            final_rank__isnull=False
        ).order_by('final_rank').first()
        stats['best_placement'] = best.final_rank if best else None

        # Match statistics in tournaments
        tournament_matches = Match.objects.filter(
            tournament__isnull=False,
            status='COMPLETED'
        ).filter(
            Q(player1=user) | Q(player2=user)
        )

        stats['total_matches'] = tournament_matches.count()
        stats['total_wins'] = tournament_matches.filter(winner=user).count()

        if stats['total_matches'] > 0:
            stats['win_rate'] = round(
                (stats['total_wins'] / stats['total_matches']) * 100, 2
            )
        else:
            stats['win_rate'] = 0.0

        serializer = TournamentStatsSerializer(stats)
        return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def user_tournaments(request, user_id):
    """
    Get tournaments user is participating in
    GET /api/tournaments/user/{user_id}/
    """
    user = get_object_or_404(User, id=user_id)

    participations = TournamentParticipant.objects.filter(

        player=user,
        status='CONFIRMED'
    ).select_related('tournament')

    tournaments = [p.tournament for p in participations]
    serializer = TournamentSerializer(tournaments, many=True)

    return Response(serializer.data, status=status.HTTP_200_OK)


class TournamentCompleteView(APIView):
    """
    Mark a tournament as completed.
    POST /api/tournaments/{id}/complete/
    Admin/organizer only.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        tournament = get_object_or_404(Tournament, pk=pk, is_deleted=False)

        # Only organizer or admin can complete
        if not (request.user == tournament.organizer or request.user.is_staff):
            return Response(
                {'error': 'Only the organizer or an admin can complete this tournament'},
                status=status.HTTP_403_FORBIDDEN
            )

        if tournament.status != 'IN_PROGRESS':
            return Response(
                {'error': f'Cannot complete a tournament with status "{tournament.status}". '
                          f'Tournament must be IN_PROGRESS.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.utils import timezone as tz
        tournament.status = 'COMPLETED'
        tournament.end_date = tz.now().date()
        tournament.save()

        # Assign final ranks from bracket results
        assign_final_ranks(tournament)

        return Response({
            'message': 'Tournament marked as completed',
            'tournament': TournamentDetailSerializer(tournament).data
        }, status=status.HTTP_200_OK)


# ── Awards ────────────────────────────────────────────────────────────────────

def assign_final_ranks(tournament):
    """
    Set final_rank on TournamentParticipant records using bracket results.
    - Rank 1/2  : winner/loser of the final (highest-round completed match)
    - Rank 3+   : losers of each prior round, processed from semi-final downward
    - Remaining : unranked ELIMINATED/CONFIRMED participants, ordered by seed
    Safe to call multiple times — only sets ranks that are still NULL.
    """
    completed_brackets = TournamentBracket.objects.filter(
        tournament=tournament,
        match__isnull=False,
        match__status='COMPLETED',
    ).select_related('round', 'match').order_by('-round__round_number', 'bracket_position')

    if not completed_brackets.exists():
        return

    max_round = completed_brackets.values_list('round__round_number', flat=True).first()

    # Process rounds from final down to round 1
    next_rank = 1
    for rnd in range(max_round, 0, -1):
        round_brackets = [b for b in completed_brackets if b.round.round_number == rnd]
        for bracket in round_brackets:
            m = bracket.match
            if not m or not m.winner_id:
                continue
            loser_id = m.player2_id if m.winner_id == m.player1_id else m.player1_id

            if rnd == max_round:
                # Final: explicitly set rank 1 and rank 2
                TournamentParticipant.objects.filter(
                    tournament=tournament, player_id=m.winner_id
                ).update(final_rank=1)
                TournamentParticipant.objects.filter(
                    tournament=tournament, player_id=loser_id
                ).update(final_rank=2)
                next_rank = 3
            else:
                # Earlier rounds: assign next_rank to the loser (tie ranks within same round are fine)
                TournamentParticipant.objects.filter(
                    tournament=tournament, player_id=loser_id, final_rank__isnull=True
                ).update(final_rank=next_rank)

        if rnd < max_round:
            next_rank += len(round_brackets)

    # Any remaining ELIMINATED/CONFIRMED participants without a rank get sequential ranks
    unranked = TournamentParticipant.objects.filter(
        tournament=tournament,
        final_rank__isnull=True,
    ).order_by('seed', 'id')
    for p in unranked:
        p.final_rank = next_rank
        p.save(update_fields=['final_rank'])
        next_rank += 1


def _is_admin(user):
    """Helper: check if the user is an admin."""
    return user.role == 'ADMIN' or user.is_staff


class AwardTierListCreateView(generics.ListCreateAPIView):
    """
    List and create award tiers for a tournament.
    GET  /api/tournaments/:pk/award-tiers/
    POST /api/tournaments/:pk/award-tiers/
    Admin only.
    """
    serializer_class = AwardTierSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return AwardTier.objects.filter(tournament_id=self.kwargs['pk'])

    def perform_create(self, serializer):
        tournament = get_object_or_404(Tournament, pk=self.kwargs['pk'], is_deleted=False)

        if not _is_admin(self.request.user):
            raise permissions.exceptions.PermissionDenied('Admin access required.')

        if tournament.awards_distributed:
            raise serializers.ValidationError(
                'Cannot add tiers after awards have been distributed.'
            )

        serializer.save(tournament=tournament)

    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)


class AwardTierDetailView(generics.UpdateAPIView, generics.DestroyAPIView):
    """
    Update or delete a single award tier.
    PUT    /api/tournaments/:pk/award-tiers/:tid/
    DELETE /api/tournaments/:pk/award-tiers/:tid/
    Admin only. Blocked when awards_distributed = True.
    """
    serializer_class = AwardTierSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return get_object_or_404(
            AwardTier,
            pk=self.kwargs['tid'],
            tournament_id=self.kwargs['pk']
        )

    def _check_access(self, request):
        if not _is_admin(request.user):
            return Response({'error': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
        tier = self.get_object()
        if tier.tournament.awards_distributed:
            return Response(
                {'error': 'Cannot modify tiers after awards have been distributed.'},
                status=status.HTTP_409_CONFLICT
            )
        return None

    def update(self, request, *args, **kwargs):
        error = self._check_access(request)
        if error:
            return error
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        error = self._check_access(request)
        if error:
            return error
        return super().destroy(request, *args, **kwargs)


class DistributeAwardsView(APIView):
    """
    Distribute awards to all eligible tournament participants.
    POST /api/tournaments/:pk/distribute-awards/
    Admin only.

    Eligibility: TournamentParticipant.status = CONFIRMED AND final_rank IS NOT NULL.
    Stacking: a player can match multiple tiers and receive multiple PlayerAward records.
    Players with no matching tier receive no record.
    Credits points to player.player_profile.current_rating.
    """
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        if not _is_admin(request.user):
            return Response({'error': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)

        tournament = get_object_or_404(Tournament, pk=pk, is_deleted=False)

        if tournament.awards_distributed:
            return Response(
                {'error': 'Awards have already been distributed for this tournament.'},
                status=status.HTTP_409_CONFLICT
            )

        tiers = list(tournament.award_tiers.select_related('user').all())
        if not tiers:
            return Response(
                {'error': 'No award tiers configured for this tournament.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Ensure final ranks are set from bracket results before distributing
        assign_final_ranks(tournament)

        eligible = TournamentParticipant.objects.filter(
            tournament=tournament,
            status__in=['CONFIRMED', 'ELIMINATED'],
            final_rank__isnull=False
        ).select_related('player', 'player__player_profile')

        if not eligible.exists():
            return Response(
                {'error': 'No final rankings found. Complete all matches before distributing awards.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        awards_created = 0

        for participant in eligible:
            player = participant.player
            total_points = 0

            for tier in tiers:
                matched = False

                if tier.tier_type == AwardTier.POSITION:
                    matched = participant.final_rank == tier.position
                elif tier.tier_type == AwardTier.ALL_PARTICIPANTS:
                    matched = True
                elif tier.tier_type == AwardTier.SPECIFIC_USER:
                    matched = tier.user_id == player.id

                if matched:
                    # Idempotency: skip if this player already has an award for this tier
                    already_exists = PlayerAward.objects.filter(
                        tournament=tournament,
                        player=player,
                        award_tier=tier,
                    ).exists()
                    if already_exists:
                        continue
                    PlayerAward.objects.create(
                        tournament=tournament,
                        player=player,
                        award_tier=tier,
                        points_awarded=tier.points
                    )
                    total_points += tier.points
                    awards_created += 1

            if total_points > 0:
                profile = player.player_profile
                profile.current_rating += total_points
                profile.save(update_fields=['current_rating'])

                # Also update LeagueStanding if this tournament belongs to a season
                if tournament.season_id:
                    from ratings.models import LeagueStanding
                    try:
                        standing = LeagueStanding.objects.get(
                            user=player, season_id=tournament.season_id
                        )
                        standing.rating += total_points
                        standing.save(update_fields=['rating', 'updated_at'])
                    except LeagueStanding.DoesNotExist:
                        pass  # Player has no standing in this season yet

        tournament.awards_distributed = True
        tournament.save(update_fields=['awards_distributed'])

        return Response({
            'message': f'Awards distributed successfully. {awards_created} award record(s) created.',
            'awards_created': awards_created,
        }, status=status.HTTP_200_OK)


class ResetAwardsView(APIView):
    """
    Reverse a previously run award distribution.
    POST /api/tournaments/:pk/reset-awards/
    Admin only.

    Decrements player.player_profile.current_rating by the exact points awarded,
    deletes all PlayerAward records for this tournament, and sets awards_distributed = False.
    """
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        if not _is_admin(request.user):
            return Response({'error': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)

        tournament = get_object_or_404(Tournament, pk=pk, is_deleted=False)

        if not tournament.awards_distributed:
            return Response(
                {'error': 'Awards have not been distributed for this tournament.'},
                status=status.HTTP_409_CONFLICT
            )

        player_awards = PlayerAward.objects.filter(
            tournament=tournament
        ).select_related('player', 'player__player_profile')

        # Aggregate points to reverse per player
        reversal_map = {}
        for award in player_awards:
            reversal_map.setdefault(award.player_id, {'player': award.player, 'points': 0})
            reversal_map[award.player_id]['points'] += award.points_awarded

        for entry in reversal_map.values():
            profile = entry['player'].player_profile
            profile.current_rating = max(0, profile.current_rating - entry['points'])
            profile.save(update_fields=['current_rating'])

        deleted_count, _ = player_awards.delete()

        tournament.awards_distributed = False
        tournament.save(update_fields=['awards_distributed'])

        return Response({
            'message': f'Awards reset successfully. {deleted_count} award record(s) removed.',
            'records_deleted': deleted_count,
        }, status=status.HTTP_200_OK)


class PlayerAwardsListView(generics.ListAPIView):
    """
    List all distributed player awards for a tournament.
    GET /api/tournaments/:pk/player-awards/
    Admin only.
    """
    serializer_class = PlayerAwardSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return PlayerAward.objects.filter(
            tournament_id=self.kwargs['pk']
        ).select_related('player', 'award_tier').order_by('player__username', 'awarded_at')

    def list(self, request, *args, **kwargs):
        if not _is_admin(request.user):
            return Response({'error': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
        return super().list(request, *args, **kwargs)


class TournamentRestoreView(APIView):
    """
    Restore a soft-deleted tournament
    POST /api/tournaments/{id}/restore/
    Admin or organizer only
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        tournament = get_object_or_404(Tournament, pk=pk)

        if not tournament.is_deleted:
            return Response({
                'error': 'Tournament is not deleted.'
            }, status=status.HTTP_400_BAD_REQUEST)

        is_admin = request.user.role == 'ADMIN' or request.user.is_staff
        if tournament.organizer != request.user and not is_admin:
            return Response({
                'error': 'Only the organizer or admin can restore the tournament.'
            }, status=status.HTTP_403_FORBIDDEN)

        tournament.is_deleted = False
        tournament.deleted_at = None
        tournament.deleted_by = None
        tournament.save()

        return Response({
            'id': tournament.id,
            'name': tournament.name,
            'message': 'Tournament restored successfully'
        }, status=status.HTTP_200_OK)
