"""
Views for Ratings App
"""

from rest_framework import generics, status, permissions
from rest_framework.exceptions import ValidationError
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q, Min, Max, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import timedelta

from .models import Season, RatingHistory, LeagueStanding
from .serializers import (
    SeasonSerializer, SeasonCreateSerializer, RatingHistorySerializer,
    RatingHistoryDetailSerializer, LeagueStandingSerializer,
    UserRatingStatsSerializer
)
from users.models import User
from users.permissions import IsAdminRole


class SeasonPageSize(PageNumberPagination):
    page_size = 100


class SeasonListCreateView(generics.ListCreateAPIView):
    """
    List all seasons or create a new season
    GET /api/ratings/seasons/
    GET /api/ratings/seasons/?include_deleted=true  (admin only — includes soft-deleted)
    POST /api/ratings/seasons/ (admin only)
    """
    pagination_class = SeasonPageSize
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        include_deleted = self.request.query_params.get('include_deleted', 'false').lower() == 'true'
        is_admin = getattr(self.request.user, 'role', None) == 'ADMIN' or getattr(self.request.user, 'is_staff', False)
        if include_deleted and is_admin:
            return Season.objects.all().order_by('-start_date', '-id')
        return Season.objects.filter(is_deleted=False).order_by('-start_date', '-id')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return SeasonCreateSerializer
        return SeasonSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdminRole()]
        return [permissions.IsAuthenticated()]


class SeasonDetailView(generics.RetrieveUpdateAPIView):
    """
    Get or update season details
    GET /api/ratings/seasons/{id}/
    PUT/PATCH /api/ratings/seasons/{id}/ (admin only)
    """
    queryset = Season.objects.filter(is_deleted=False)
    serializer_class = SeasonSerializer

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH']:
            return [IsAdminRole()]
        return [permissions.IsAuthenticated()]

    def perform_update(self, serializer):
        """Auto-deactivate any other active season when setting is_active=True."""
        if serializer.validated_data.get('is_active', False):
            Season.objects.filter(is_active=True).exclude(
                id=self.get_object().id
            ).update(is_active=False)
        serializer.save()


class ActiveSeasonView(APIView):
    """
    Get the current active season
    GET /api/ratings/seasons/active/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        season = Season.objects.filter(
            start_date__lte=now,
            end_date__gte=now,
            is_active=True,
            is_deleted=False
        ).first()

        if not season:
            return Response({
                'error': 'No active season found'
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = SeasonSerializer(season)
        return Response(serializer.data, status=status.HTTP_200_OK)


class RatingHistoryListView(generics.ListAPIView):
    """
    Get rating history (all or filtered by user)
    GET /api/ratings/history/
    Query params: user_id, season_id, limit
    """
    serializer_class = RatingHistorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = RatingHistory.objects.all().select_related(
            'user', 'opponent', 'match', 'season'
        )

        # Filter by user
        user_id = self.request.query_params.get('user_id', None)
        if user_id:
            queryset = queryset.filter(user_id=user_id)

        # Filter by season
        season_id = self.request.query_params.get('season_id', None)
        if season_id:
            get_object_or_404(Season, id=season_id, is_deleted=False)
            queryset = queryset.filter(season_id=season_id)

        # Limit results
        limit = self.request.query_params.get('limit', None)
        if limit:
            try:
                limit = int(limit)
                queryset = queryset[:limit]
            except ValueError:
                pass

        return queryset.order_by('-created_at')


class UserRatingHistoryView(generics.ListAPIView):
    """
    Get rating history for a specific user
    GET /api/ratings/history/{user_id}/
    """
    serializer_class = RatingHistorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user_id = self.kwargs.get('user_id')
        return RatingHistory.objects.filter(
            user_id=user_id
        ).select_related('user', 'opponent', 'match', 'season').order_by('-created_at')


class LeagueStandingsView(generics.ListAPIView):
    """
    Get league standings
    GET /api/ratings/standings/
    Query params: season_id, league (AMATEUR/PRO)
    """
    serializer_class = LeagueStandingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = LeagueStanding.objects.all().select_related('user', 'season')

        # Filter by season — accept both ?season= and ?season_id= (season_id takes precedence)
        season_id = (
            self.request.query_params.get('season_id') or
            self.request.query_params.get('season')
        )
        if season_id:
            if not str(season_id).isdigit():
                raise ValidationError({'season': 'Must be a valid integer.'})
            queryset = queryset.filter(season_id=season_id)
        else:
            # Get active season
            now = timezone.now()
            active_season = Season.objects.filter(
                start_date__lte=now,
                end_date__gte=now,
                is_active=True,
                is_deleted=False
            ).first()
            if active_season:
                queryset = queryset.filter(season=active_season)

        # Filter by league
        league = self.request.query_params.get('league', None)
        if league:
            queryset = queryset.filter(league=league.upper())

        return queryset.order_by('-rating', '-wins')


class UserRatingStatsView(APIView):
    """
    Get detailed rating statistics for a user
    GET /api/ratings/stats/{user_id}/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_id):
        user = get_object_or_404(User, id=user_id)

        # Get rating history
        history = RatingHistory.objects.filter(user=user)

        # Get player profile
        profile = getattr(user, 'player_profile', None)
        if not profile:
            return Response({'error': 'User has no player profile'}, status=status.HTTP_404_NOT_FOUND)

        # Calculate statistics
        stats = {
            'current_rating': profile.current_rating,
            'highest_rating': profile.highest_rating,
            'lowest_rating': history.aggregate(Min('new_rating'))['new_rating__min'] or profile.current_rating,
            'league': profile.league,
        }

        # Rating change in last 30 days
        thirty_days_ago = timezone.now() - timedelta(days=30)
        recent_history = history.filter(created_at__gte=thirty_days_ago)
        if recent_history.exists():
            first_rating = recent_history.order_by('created_at').first().old_rating
            stats['rating_change_30_days'] = profile.current_rating - first_rating
        else:
            stats['rating_change_30_days'] = 0

        # Total rating gained and lost
        stats['total_rating_gained'] = history.filter(
            rating_change__gt=0
        ).aggregate(Sum('rating_change'))['rating_change__sum'] or 0

        stats['total_rating_lost'] = abs(history.filter(
            rating_change__lt=0
        ).aggregate(Sum('rating_change'))['rating_change__sum'] or 0)

        # League changes
        league_changes = history.filter(league_changed=True)
        stats['league_changes'] = league_changes.count()
        stats['promotions'] = league_changes.filter(
            old_league='AMATEUR', new_league='PRO'
        ).count()
        stats['demotions'] = league_changes.filter(
            old_league='PRO', new_league='AMATEUR'
        ).count()

        serializer = UserRatingStatsSerializer(stats)
        return Response(serializer.data, status=status.HTTP_200_OK)


class RatingChartDataView(APIView):
    """
    Get rating chart data for visualization
    GET /api/ratings/chart/{user_id}/
    Query params: season_id, days (default 30)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_id):
        user = get_object_or_404(User, id=user_id)

        # Get time range
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now() - timedelta(days=days)

        # Get rating history
        queryset = RatingHistory.objects.filter(
            user=user,
            created_at__gte=start_date
        ).order_by('created_at')

        # Filter by season if provided
        season_id = request.query_params.get('season_id', None)
        if season_id:
            get_object_or_404(Season, id=season_id, is_deleted=False)
            queryset = queryset.filter(season_id=season_id)

        # Build chart data
        chart_data = {
            'labels': [],
            'ratings': [],
            'wins': [],
            'losses': []
        }

        for record in queryset:
            chart_data['labels'].append(record.created_at.strftime('%Y-%m-%d %H:%M'))
            chart_data['ratings'].append(record.new_rating)
            chart_data['wins'].append(1 if record.was_winner else 0)
            chart_data['losses'].append(0 if record.was_winner else 1)

        return Response(chart_data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminRole])
def update_league_standings(request):
    """
    Manually update league standings for current season
    POST /api/ratings/standings/update/
    Admin only - typically run automatically after matches
    """
    season_id = request.data.get('season_id', None)

    if season_id:
        season = get_object_or_404(Season, id=season_id)
    else:
        # Get active season
        now = timezone.now()
        season = Season.objects.filter(
            start_date__lte=now,
            end_date__gte=now,
            is_active=True,
            is_deleted=False
        ).first()

        if not season:
            return Response({
                'error': 'No active season found'
            }, status=status.HTTP_404_NOT_FOUND)

    # Get all users with matches in this season
    users = User.objects.filter(
        Q(matches_as_player1__season=season) | Q(matches_as_player2__season=season)
    ).distinct()

    standings_updated = 0

    for user in users:
        profile = getattr(user, 'player_profile', None)
        if not profile:
            continue

        # Get or create standing
        standing, created = LeagueStanding.objects.get_or_create(
            user=user,
            season=season,
            league=profile.league,
            defaults={
                'rating': profile.current_rating,
                'matches_played': profile.total_matches,
                'wins': profile.wins,
                'losses': profile.losses,
                'rank': 0
            }
        )

        # Update values
        standing.rating = profile.current_rating
        standing.league = profile.league
        standing.matches_played = profile.total_matches
        standing.wins = profile.wins
        standing.losses = profile.losses
        standing.save()

        standings_updated += 1

    # Update ranks within each league
    for league in ['AMATEUR', 'PRO']:
        standings = LeagueStanding.objects.filter(
            season=season,
            league=league
        ).order_by('-rating')

        for rank, standing in enumerate(standings, start=1):
            standing.rank = rank
            standing.save()

    return Response({
        'message': 'League standings updated successfully',
        'season': season.name,
        'standings_updated': standings_updated
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminRole])
def end_season(request, pk):
    """
    End/Archive a season
    POST /api/ratings/seasons/{id}/end/
    Admin only
    """
    season = get_object_or_404(Season, id=pk, is_deleted=False)

    if season.ended_at:
        return Response({
            'error': 'Season is already archived'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Archive the season
    season.ended_at = timezone.now()
    season.ended_by = request.user
    season.is_active = False
    season.save()
    
    return Response({
        'id': season.id,
        'name': season.name,
        'start_date': season.start_date,
        'end_date': season.end_date,
        'is_active': season.is_active,
        'ended_at': season.ended_at,
        'ended_by': request.user.id,
        'message': f'Season "{season.name}" has been archived successfully'
    }, status=status.HTTP_200_OK)


class SeasonDeletedListView(generics.ListAPIView):
    """
    List all soft-deleted seasons
    GET /api/ratings/seasons/deleted/
    Admin only
    """
    serializer_class = SeasonSerializer
    permission_classes = [IsAdminRole]
    pagination_class = None

    def get_queryset(self):
        return Season.objects.filter(is_deleted=True).order_by('-deleted_at')


class SeasonSoftDeleteView(APIView):
    """
    Soft delete a season
    POST /api/ratings/seasons/{id}/delete/
    Admin only
    """
    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        season = get_object_or_404(Season, id=pk, is_deleted=False)

        # Check for blocking tournaments
        from tournaments.models import Tournament
        blocking_count = Tournament.objects.filter(
            season=season,
            is_deleted=False
        ).exclude(status__in=['CANCELLED', 'COMPLETED']).count()

        if blocking_count > 0:
            return Response({
                'error': 'Cannot delete season with active tournaments.',
                'blocking_tournaments': blocking_count
            }, status=status.HTTP_400_BAD_REQUEST)

        season.is_deleted = True
        season.deleted_at = timezone.now()
        season.deleted_by = request.user
        season.is_active = False
        season.save()

        return Response({
            'id': season.id,
            'name': season.name,
            'deleted_at': season.deleted_at,
            'message': f'Season "{season.name}" deleted successfully'
        }, status=status.HTTP_200_OK)


class SeasonRestoreView(APIView):
    """
    Restore a soft-deleted season
    POST /api/ratings/seasons/{id}/restore/
    Admin only
    """
    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        season = get_object_or_404(Season, id=pk)

        if not season.is_deleted:
            return Response({
                'error': 'Season is not deleted.'
            }, status=status.HTTP_400_BAD_REQUEST)

        season.is_deleted = False
        season.deleted_at = None
        season.deleted_by = None
        season.save()

        return Response({
            'id': season.id,
            'name': season.name,
            'message': f'Season "{season.name}" restored successfully'
        }, status=status.HTTP_200_OK)


class RecalculateELOView(APIView):
    """
    Trigger a full ELO recalculation of season standings from match history.
    POST /api/ratings/seasons/{pk}/recalculate-elo/
    Admin only
    """
    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        season = get_object_or_404(Season, id=pk, is_deleted=False)
        from .elo_recalculation import ELORatingRecalculationService
        result = ELORatingRecalculationService().recalculate_all_for_season(season.id)
        return Response(result, status=status.HTTP_200_OK)
