"""
Views for Challenges App
"""

from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q, Count, F
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction

from .models import Challenge, ChallengeHistory
from .serializers import (
    ChallengeSerializer, ChallengeDetailSerializer, ChallengeCreateSerializer,
    ChallengeResponseSerializer, ChallengeHistorySerializer,
    ChallengeStatsSerializer
)
from users.models import User


def _get_match_format_and_target(challenge):
    """Convert challenge format + format_value to Match format enum and target_score."""
    if challenge.match_format == 'BEST_OF':
        v = challenge.format_value or 3
        if v <= 3:
            return 'BEST_OF_3', None
        elif v <= 5:
            return 'BEST_OF_5', None
        else:
            return 'BEST_OF_7', None
    elif challenge.match_format == 'RACE_TO':
        v = challenge.format_value or 11
        if v <= 5:
            return 'RACE_TO_5', 5
        elif v <= 11:
            return 'RACE_TO_11', 11
        else:
            return 'RACE_TO_21', 21
    return 'BEST_OF_3', None
from matches.models import Match
from ratings.models import Season


class ChallengeListCreateView(generics.ListCreateAPIView):
    """
    List all challenges or create a new challenge
    GET /api/challenges/
    POST /api/challenges/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ChallengeCreateSerializer
        return ChallengeSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = Challenge.objects.filter(
            Q(challenger=user) | Q(challenged=user)
        ).select_related('challenger', 'challenged', 'season', 'match')

        # Filter by status
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())

        # Filter by season
        season_id = self.request.query_params.get('season_id', None)
        if season_id:
            queryset = queryset.filter(season_id=season_id)

        # Auto-expire pending challenges
        expired_challenges = queryset.filter(
            status='PENDING',
            expires_at__lt=timezone.now()
        )
        for challenge in expired_challenges:
            challenge.status = 'EXPIRED'
            challenge.save()

        return queryset.order_by('-created_at')


class ChallengeDetailView(generics.RetrieveAPIView):
    """
    Get challenge details
    GET /api/challenges/{id}/
    """
    serializer_class = ChallengeDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Challenge.objects.filter(
            Q(challenger=user) | Q(challenged=user)
        ).select_related('challenger', 'challenged', 'season', 'match')


class ChallengeSentView(generics.ListAPIView):
    """
    Get challenges sent by current user
    GET /api/challenges/sent/
    """
    serializer_class = ChallengeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Challenge.objects.filter(
            challenger=self.request.user
        ).select_related('challenged', 'season', 'match').order_by('-created_at')


class ChallengeReceivedView(generics.ListAPIView):
    """
    Get challenges received by current user
    GET /api/challenges/received/
    """
    serializer_class = ChallengeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Challenge.objects.filter(
            challenged=self.request.user
        ).select_related('challenger', 'season', 'match')

        # Auto-expire pending challenges
        expired_challenges = queryset.filter(
            status='PENDING',
            expires_at__lt=timezone.now()
        )
        for challenge in expired_challenges:
            challenge.status = 'EXPIRED'
            challenge.save()

        return queryset.order_by('-created_at')


class ChallengeAcceptView(APIView):
    """
    Accept a challenge
    POST /api/challenges/{id}/accept/
    """
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        challenge = get_object_or_404(Challenge, pk=pk)

        # Verify user is the challenged player
        if challenge.challenged != request.user:
            return Response({
                'error': 'Only the challenged player can accept'
            }, status=status.HTTP_403_FORBIDDEN)

        # Validate challenge can be accepted
        serializer = ChallengeResponseSerializer(
            data={'action': 'accept'},
            context={'challenge': challenge}
        )
        serializer.is_valid(raise_exception=True)

        # Get or create current season
        season = challenge.season
        if not season:
            season = Season.objects.filter(is_active=True).first()

        # Create match for the challenge — preserve format from challenge
        fmt, target = _get_match_format_and_target(challenge)
        match = Match.objects.create(
            player1=challenge.challenger,
            player2=challenge.challenged,
            match_format=fmt,
            target_score=target,
            is_rated=True,
            is_admin_refereed=False,  # Players can self-score
            season=season,
            challenge=challenge,
            status='SCHEDULED'
        )

        # Update challenge status
        challenge.status = 'ACCEPTED'
        challenge.match = match
        challenge.responded_at = timezone.now()
        challenge.save()

        return Response({
            'message': 'Challenge accepted successfully',
            'challenge': ChallengeSerializer(challenge).data,
            'match_id': match.id
        }, status=status.HTTP_200_OK)


class ChallengeDeclineView(APIView):
    """
    Decline a challenge
    POST /api/challenges/{id}/decline/
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        challenge = get_object_or_404(Challenge, pk=pk)

        # Verify user is the challenged player
        if challenge.challenged != request.user:
            return Response({
                'error': 'Only the challenged player can decline'
            }, status=status.HTTP_403_FORBIDDEN)

        # Check if challenge is forced (top 7 cannot decline)
        if challenge.is_forced:
            return Response({
                'error': 'Cannot decline a forced challenge (you are in top 7)'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Validate challenge can be declined
        serializer = ChallengeResponseSerializer(
            data={'action': 'decline'},
            context={'challenge': challenge}
        )
        serializer.is_valid(raise_exception=True)

        # Update challenge status
        challenge.status = 'DECLINED'
        challenge.responded_at = timezone.now()
        challenge.save()

        # Update history stats
        if challenge.season:
            history, _ = ChallengeHistory.objects.get_or_create(
                user=challenge.challenged,
                season=challenge.season,
            )
            ChallengeHistory.objects.filter(pk=history.pk).update(
                challenges_declined=F('challenges_declined') + 1
            )

        return Response({
            'message': 'Challenge declined',
            'challenge': ChallengeSerializer(challenge).data
        }, status=status.HTTP_200_OK)


class ChallengeCancelView(APIView):
    """
    Cancel a challenge (challenger only, before acceptance)
    POST /api/challenges/{id}/cancel/
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        challenge = get_object_or_404(Challenge, pk=pk)

        # Verify user is the challenger
        if challenge.challenger != request.user:
            return Response({
                'error': 'Only the challenger can cancel'
            }, status=status.HTTP_403_FORBIDDEN)

        # Can only cancel pending challenges
        if challenge.status != 'PENDING':
            return Response({
                'error': 'Can only cancel pending challenges'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Update challenge status
        challenge.status = 'CANCELLED'
        challenge.responded_at = timezone.now()
        challenge.save()

        return Response({
            'message': 'Challenge cancelled',
            'challenge': ChallengeSerializer(challenge).data
        }, status=status.HTTP_200_OK)


class ChallengeHistoryView(generics.ListAPIView):
    """
    Get challenge history
    GET /api/challenges/history/
    Query params: user_id, season_id
    """
    serializer_class = ChallengeHistorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = ChallengeHistory.objects.all().select_related('user', 'season')

        # Filter by user
        user_id = self.request.query_params.get('user_id', None)
        if user_id:
            queryset = queryset.filter(user_id=user_id)

        # Filter by season
        season_id = self.request.query_params.get('season_id', None)
        if season_id:
            queryset = queryset.filter(season_id=season_id)

        return queryset.order_by('-updated_at')


class UserChallengeStatsView(APIView):
    """
    Get challenge statistics for a user
    GET /api/challenges/stats/{user_id}/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_id):
        user = get_object_or_404(User, id=user_id)

        # Get challenges
        sent = Challenge.objects.filter(challenger=user)
        received = Challenge.objects.filter(challenged=user)

        # Get history aggregate record for this user
        history_obj = ChallengeHistory.objects.filter(user=user).first()

        # Calculate statistics
        stats = {
            'total_challenges_sent': sent.count(),
            'total_challenges_received': received.count(),
            'challenges_won': history_obj.challenges_won if history_obj else 0,
            'challenges_lost': history_obj.challenges_lost if history_obj else 0,
            'challenges_accepted': received.filter(status__in=['ACCEPTED', 'COMPLETED']).count(),
            'challenges_declined': received.filter(status='DECLINED').count(),
            'challenges_expired': sent.filter(status='EXPIRED').count() +
                                 received.filter(status='EXPIRED').count(),
        }

        # Calculate rates
        total_completed = stats['challenges_won'] + stats['challenges_lost']
        if total_completed > 0:
            stats['win_rate'] = round((stats['challenges_won'] / total_completed) * 100, 2)
        else:
            stats['win_rate'] = 0.0

        total_received = stats['total_challenges_received']
        if total_received > 0:
            stats['acceptance_rate'] = round(
                (stats['challenges_accepted'] / total_received) * 100, 2
            )
        else:
            stats['acceptance_rate'] = 0.0

        serializer = ChallengeStatsSerializer(stats)
        return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def pending_challenges_count(request):
    """
    Get count of pending challenges for current user
    GET /api/challenges/pending-count/
    """
    user = request.user

    # Auto-expire old challenges first
    expired = Challenge.objects.filter(
        challenged=user,
        status='PENDING',
        expires_at__lt=timezone.now()
    )
    expired.update(status='EXPIRED')

    # Count pending challenges
    count = Challenge.objects.filter(
        challenged=user,
        status='PENDING'
    ).count()

    return Response({
        'pending_challenges': count
    }, status=status.HTTP_200_OK)
