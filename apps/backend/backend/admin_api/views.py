"""
Admin API — Dashboard endpoints

Provides three read-only aggregation endpoints for the admin dashboard:
  GET /api/admin/dashboard/stats/         → system-wide counts
  GET /api/admin/dashboard/activity/      → unified activity feed
  GET /api/admin/dashboard/quick-actions/ → context-aware action items

All endpoints require IsAdminRole permission.
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from django.utils import timezone
from django.shortcuts import get_object_or_404
from datetime import timedelta

from users.permissions import IsAdminRole
from users.models import User
from ratings.models import Season
from tournaments.models import Tournament, TournamentParticipant
from matches.models import Match


def compute_delta(current: int, previous: int) -> dict:
    if previous == 0:
        return {"value": None, "direction": "neutral"}
    pct = round(((current - previous) / previous) * 100, 1)
    return {
        "value": abs(pct),
        "direction": "up" if pct > 0 else ("down" if pct < 0 else "neutral"),
    }


# ──────────────────────────────────────────────────────────────────────────────
# STEP 2 — Stats
# ──────────────────────────────────────────────────────────────────────────────

class DashboardStatsView(APIView):
    """
    GET /api/admin/dashboard/stats/

    Returns live aggregated counts across seasons, tournaments,
    players, matches, and registrations.
    """
    permission_classes = [IsAdminRole]

    def get(self, request):
        now = timezone.now()
        today = now.date()
        thirty_days_ago = now - timedelta(days=30)
        sixty_days_ago = now - timedelta(days=60)

        # ── Seasons ──────────────────────────────────────────────────────────
        seasons_qs = Season.objects.filter(is_deleted=False)
        seasons_total = seasons_qs.count()
        seasons_active = seasons_qs.filter(is_active=True).count()
        seasons_upcoming = seasons_qs.filter(start_date__gt=now).count()
        seasons_archived = seasons_qs.filter(ended_at__isnull=False).count()

        # ── Tournaments ───────────────────────────────────────────────────────
        tournaments_qs = Tournament.objects.filter(is_deleted=False)
        tournaments_total = tournaments_qs.count()
        tournaments_upcoming = tournaments_qs.filter(status='UPCOMING').count()
        tournaments_registration_open = tournaments_qs.filter(status='REGISTRATION').count()
        tournaments_in_progress = tournaments_qs.filter(status='IN_PROGRESS').count()
        tournaments_completed = tournaments_qs.filter(status='COMPLETED').count()

        # ── Players ───────────────────────────────────────────────────────────
        players_total = User.objects.filter(role='PLAYER', is_active=True).count()

        # Active this month: distinct union of player1 + player2 in recent matches
        recent_qs = Match.objects.filter(created_at__gte=thirty_days_ago)
        p1_ids = set(recent_qs.values_list('player1_id', flat=True))
        p2_ids = set(recent_qs.values_list('player2_id', flat=True))
        players_active_this_month = len(p1_ids | p2_ids)

        # ── Matches ───────────────────────────────────────────────────────────
        matches_total = Match.objects.count()
        matches_in_progress = Match.objects.filter(status='IN_PROGRESS').count()
        matches_completed_today = Match.objects.filter(
            status='COMPLETED', completed_at__date=today
        ).count()
        matches_completed_this_month = Match.objects.filter(
            status='COMPLETED', completed_at__gte=thirty_days_ago
        ).count()

        # ── Registrations ─────────────────────────────────────────────────────
        registrations_pending = TournamentParticipant.objects.filter(
            status='PENDING'
        ).count()
        registrations_total_this_month = TournamentParticipant.objects.filter(
            registered_at__gte=thirty_days_ago
        ).count()

        # ── Previous-period deltas (60→30 days ago vs 30→now) ─────────────────
        prev_matches_qs = Match.objects.filter(
            created_at__range=(sixty_days_ago, thirty_days_ago)
        )
        prev_p1_ids = set(prev_matches_qs.values_list('player1_id', flat=True))
        prev_p2_ids = set(prev_matches_qs.values_list('player2_id', flat=True))
        prev_active_players = len(prev_p1_ids | prev_p2_ids)

        prev_completed_matches = Match.objects.filter(
            status='COMPLETED',
            completed_at__range=(sixty_days_ago, thirty_days_ago)
        ).count()

        prev_registrations = TournamentParticipant.objects.filter(
            registered_at__range=(sixty_days_ago, thirty_days_ago)
        ).count()

        prev_tournaments = Tournament.objects.filter(
            is_deleted=False,
            created_at__range=(sixty_days_ago, thirty_days_ago)
        ).count()
        curr_tournaments_created = Tournament.objects.filter(
            is_deleted=False,
            created_at__gte=thirty_days_ago
        ).count()

        return Response({
            'seasons': {
                'total': seasons_total,
                'active': seasons_active,
                'upcoming': seasons_upcoming,
                'archived': seasons_archived,
            },
            'tournaments': {
                'total': tournaments_total,
                'upcoming': tournaments_upcoming,
                'registration_open': tournaments_registration_open,
                'in_progress': tournaments_in_progress,
                'completed': tournaments_completed,
            },
            'players': {
                'total': players_total,
                'active_this_month': players_active_this_month,
            },
            'matches': {
                'total': matches_total,
                'in_progress': matches_in_progress,
                'completed_today': matches_completed_today,
                'completed_this_month': matches_completed_this_month,
            },
            'registrations': {
                'pending': registrations_pending,
                'total_this_month': registrations_total_this_month,
            },
            'deltas': {
                'active_players': compute_delta(players_active_this_month, prev_active_players),
                'completed_matches': compute_delta(matches_completed_this_month, prev_completed_matches),
                'registrations': compute_delta(registrations_total_this_month, prev_registrations),
                'tournaments': compute_delta(curr_tournaments_created, prev_tournaments),
            },
        })


# ──────────────────────────────────────────────────────────────────────────────
# STEP 3 — Activity
# ──────────────────────────────────────────────────────────────────────────────

class DashboardActivityView(APIView):
    """
    GET /api/admin/dashboard/activity/?limit=20

    Returns a unified chronological feed of recent system events
    merged from seasons, tournaments, matches, and registrations.
    Sorted by timestamp descending, sliced to ?limit (max 50).
    """
    permission_classes = [IsAdminRole]

    def get(self, request):
        try:
            limit = min(int(request.query_params.get('limit', 20)), 50)
        except (ValueError, TypeError):
            limit = 20

        activities = []

        # ── Season events ─────────────────────────────────────────────────────
        for season in Season.objects.filter(is_deleted=False).order_by('-created_at')[:limit]:
            activities.append({
                'id': f'season_{season.id}_created',
                'type': 'SEASON_CREATED',
                'title': 'New season created',
                'description': f"'{season.name}' season was created",
                'timestamp': season.created_at.isoformat(),
                'actor': 'Admin',
                'metadata': {
                    'object_id': season.id,
                    'object_type': 'Season',
                    'url': '/admin/season-management',
                },
            })

        for season in (
            Season.objects
            .filter(is_deleted=False, is_active=True, ended_at__isnull=True)
            .order_by('-start_date')[:limit]
        ):
            activities.append({
                'id': f'season_{season.id}_started',
                'type': 'SEASON_STARTED',
                'title': 'Season started',
                'description': f"'{season.name}' season is now active",
                'timestamp': season.start_date.isoformat(),
                'actor': 'Admin',
                'metadata': {
                    'object_id': season.id,
                    'object_type': 'Season',
                    'url': '/admin/season-management',
                },
            })

        for season in (
            Season.objects
            .filter(is_deleted=False, ended_at__isnull=False)
            .order_by('-ended_at')[:limit]
        ):
            activities.append({
                'id': f'season_{season.id}_ended',
                'type': 'SEASON_ENDED',
                'title': 'Season ended',
                'description': f"'{season.name}' season was archived",
                'timestamp': season.ended_at.isoformat(),
                'actor': 'Admin',
                'metadata': {
                    'object_id': season.id,
                    'object_type': 'Season',
                    'url': '/admin/season-management',
                },
            })

        # ── Tournament events ─────────────────────────────────────────────────
        for t in (
            Tournament.objects
            .filter(is_deleted=False)
            .select_related('organizer')
            .order_by('-created_at')[:limit]
        ):
            activities.append({
                'id': f'tournament_{t.id}_created',
                'type': 'TOURNAMENT_CREATED',
                'title': 'Tournament created',
                'description': f"'{t.name}' tournament was created",
                'timestamp': t.created_at.isoformat(),
                'actor': t.organizer.username if t.organizer else 'Admin',
                'metadata': {
                    'object_id': t.id,
                    'object_type': 'Tournament',
                    'url': f'/admin/tournaments/{t.id}',
                },
            })

        for t in (
            Tournament.objects
            .filter(is_deleted=False, status='IN_PROGRESS')
            .select_related('organizer')
            .order_by('-updated_at')[:limit]
        ):
            activities.append({
                'id': f'tournament_{t.id}_started',
                'type': 'TOURNAMENT_STARTED',
                'title': 'Tournament started',
                'description': f"'{t.name}' is now in progress",
                'timestamp': t.updated_at.isoformat(),
                'actor': t.organizer.username if t.organizer else 'Admin',
                'metadata': {
                    'object_id': t.id,
                    'object_type': 'Tournament',
                    'url': f'/admin/tournaments/{t.id}',
                },
            })

        for t in (
            Tournament.objects
            .filter(is_deleted=False, status='COMPLETED')
            .select_related('organizer')
            .order_by('-updated_at')[:limit]
        ):
            activities.append({
                'id': f'tournament_{t.id}_completed',
                'type': 'TOURNAMENT_COMPLETED',
                'title': 'Tournament completed',
                'description': f"'{t.name}' has been completed",
                'timestamp': t.updated_at.isoformat(),
                'actor': t.organizer.username if t.organizer else 'Admin',
                'metadata': {
                    'object_id': t.id,
                    'object_type': 'Tournament',
                    'url': f'/admin/tournaments/{t.id}',
                },
            })

        # ── Match events ──────────────────────────────────────────────────────
        for match in (
            Match.objects
            .filter(status='COMPLETED')
            .select_related('player1', 'player2', 'referee')
            .order_by('-completed_at')[:limit]
        ):
            score = f"{match.player1_games_won} – {match.player2_games_won}"
            activities.append({
                'id': f'match_{match.id}_completed',
                'type': 'MATCH_COMPLETED',
                'title': 'Match completed',
                'description': f"{match.player1.username} vs {match.player2.username} — {score}",
                'timestamp': match.completed_at.isoformat(),
                'actor': match.referee.username if match.referee else 'Admin',
                'metadata': {
                    'object_id': match.id,
                    'object_type': 'Match',
                    'url': None,
                },
            })

        # ── Registration events ───────────────────────────────────────────────
        for reg in (
            TournamentParticipant.objects
            .select_related('player', 'tournament')
            .order_by('-registered_at')[:limit]
        ):
            activities.append({
                'id': f'registration_{reg.id}_registered',
                'type': 'PLAYER_REGISTERED',
                'title': 'Player registered',
                'description': f"{reg.player.username} registered for '{reg.tournament.name}'",
                'timestamp': reg.registered_at.isoformat(),
                'actor': reg.player.username,
                'metadata': {
                    'object_id': reg.id,
                    'object_type': 'Player',
                    'url': f'/admin/tournaments/{reg.tournament_id}',
                },
            })

        # Sort descending by timestamp, slice to limit
        activities.sort(key=lambda x: x['timestamp'], reverse=True)
        activities = activities[:limit]

        return Response({
            'activities': activities,
            'total': len(activities),
        })


# ──────────────────────────────────────────────────────────────────────────────
# STEP 4 — Quick Actions
# ──────────────────────────────────────────────────────────────────────────────

class DashboardQuickActionsView(APIView):
    """
    GET /api/admin/dashboard/quick-actions/

    Returns dynamic quick action items driven by current system state.
    Only includes actions whose conditions are currently true.
    Sorted by priority (ascending).
    """
    permission_classes = [IsAdminRole]

    def get(self, request):
        actions = []

        # 1. create_season — no active season running
        if not Season.objects.filter(is_deleted=False, is_active=True).exists():
            actions.append({
                'id': 'create_season',
                'label': 'Create New Season',
                'description': 'No active season is currently running',
                'route': '/admin/season-management',
                'priority': 1,
                'badge': None,
            })

        # 2. open_registrations — UPCOMING tournaments exist
        upcoming_count = Tournament.objects.filter(
            is_deleted=False, status='UPCOMING'
        ).count()
        if upcoming_count:
            actions.append({
                'id': 'open_registrations',
                'label': 'Open Tournament Registrations',
                'description': f'{upcoming_count} tournament(s) awaiting registration',
                'route': '/admin/tournament-overview',
                'priority': 2,
                'badge': upcoming_count,
            })

        # 3. pending_registrations — PENDING participants exist
        pending_count = TournamentParticipant.objects.filter(
            status='PENDING'
        ).count()
        if pending_count:
            actions.append({
                'id': 'pending_registrations',
                'label': 'Review Pending Registrations',
                'description': f'{pending_count} player registration(s) awaiting approval',
                'route': '/admin/tournament-overview',
                'priority': 3,
                'badge': pending_count,
            })

        # 4. live_matches — IN_PROGRESS matches exist
        live_count = Match.objects.filter(status='IN_PROGRESS').count()
        if live_count:
            actions.append({
                'id': 'live_matches',
                'label': 'Score Live Matches',
                'description': f'{live_count} match(es) currently in progress',
                'route': '/admin/tournament-overview',
                'priority': 4,
                'badge': live_count,
            })

        # 5. complete_tournaments — IN_PROGRESS tournaments with all matches done
        completable = 0
        for t in Tournament.objects.filter(is_deleted=False, status='IN_PROGRESS'):
            total_matches = t.matches.count()
            if total_matches > 0:
                completed_matches = t.matches.filter(status='COMPLETED').count()
                if total_matches == completed_matches:
                    completable += 1

        if completable:
            actions.append({
                'id': 'complete_tournaments',
                'label': 'Complete Tournaments',
                'description': f'{completable} tournament(s) ready to be completed',
                'route': '/admin/tournament-overview',
                'priority': 5,
                'badge': completable,
            })

        return Response({'actions': actions})


# ──────────────────────────────────────────────────────────────────────────────
# Admin User Management
# ──────────────────────────────────────────────────────────────────────────────

class UpdateUserRoleView(APIView):
    """
    PATCH /api/admin/users/<id>/role/
    Body: {"role": "PLAYER"|"MODERATOR"|"ADMIN"}
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def patch(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        role = request.data.get('role')
        if role not in ['PLAYER', 'MODERATOR', 'ADMIN']:
            return Response({'error': 'Invalid role. Must be PLAYER, MODERATOR, or ADMIN.'}, status=status.HTTP_400_BAD_REQUEST)
        user.role = role
        user.save(update_fields=['role'])
        return Response({'message': f'Role updated to {role}', 'id': user.id, 'role': user.role})


class DeactivateUserView(APIView):
    """
    POST /api/admin/users/<id>/deactivate/
    Body: {"reason": "..."}
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def post(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        user.is_active = False
        user.save(update_fields=['is_active'])
        return Response({'message': 'User deactivated successfully.'})


class ReactivateUserView(APIView):
    """
    POST /api/admin/users/<id>/reactivate/
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def post(self, request, pk):
        user = get_object_or_404(User.objects.filter(), pk=pk)
        user.is_active = True
        user.save(update_fields=['is_active'])
        return Response({'message': 'User reactivated successfully.'})


class ResetUserPasswordView(APIView):
    """
    POST /api/admin/users/<id>/reset-password/
    Generates a new secure password and emails it to the user.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def post(self, request, pk):
        from users.serializers import AdminUserCreateSerializer
        from django.core.mail import send_mail
        from django.conf import settings
        import logging
        logger = logging.getLogger(__name__)

        user = get_object_or_404(User, pk=pk)
        raw_password = AdminUserCreateSerializer.generate_password()
        user.set_password(raw_password)
        user.save()

        site_url = getattr(settings, 'SITE_URL', 'http://localhost:4200')
        subject = "PingMaster — Your Password Has Been Reset"
        message = (
            f"Hi {user.first_name or user.username},\n\n"
            f"Your password has been reset by an administrator.\n\n"
            f"  Username: {user.username}\n"
            f"  New Password: {raw_password}\n\n"
            f"Please log in and change this password immediately.\n\n"
            f"{site_url}\n\n"
            f"— The PingMaster Team\n"
        )
        try:
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )
            return Response({'message': f'Password reset and sent to {user.email}.'})
        except Exception as e:
            logger.warning(f"Password reset email failed for {user.email}: {e}")
            return Response({
                'message': 'Password reset successfully but email delivery failed.',
                'error': str(e),
            }, status=status.HTTP_207_MULTI_STATUS)
