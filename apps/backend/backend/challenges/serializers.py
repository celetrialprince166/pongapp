"""
Serializers for Challenges App
"""

from rest_framework import serializers
from django.utils import timezone
from datetime import timedelta

from .models import Challenge, ChallengeHistory
from users.serializers import UserSerializer
from matches.serializers import MatchListSerializer


class ChallengeSerializer(serializers.ModelSerializer):
    """
    Serializer for Challenge model
    """
    challenger_username = serializers.CharField(source='challenger.username', read_only=True)
    challenged_username = serializers.CharField(source='challenged.username', read_only=True)
    season_name = serializers.CharField(source='season.name', read_only=True)
    time_remaining = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()

    class Meta:
        model = Challenge
        fields = [
            'id', 'challenger', 'challenger_username', 'challenged',
            'challenged_username', 'status', 'message', 'is_forced',
            'season', 'season_name', 'match', 'match_type', 'match_format',
            'format_value', 'created_at', 'expires_at',
            'time_remaining', 'is_expired', 'responded_at'
        ]
        read_only_fields = ['id', 'created_at', 'responded_at', 'is_forced']

    def get_time_remaining(self, obj):
        """Calculate time remaining before expiry"""
        if obj.status == 'PENDING':
            remaining = obj.expires_at - timezone.now()
            if remaining.total_seconds() > 0:
                hours = int(remaining.total_seconds() // 3600)
                minutes = int((remaining.total_seconds() % 3600) // 60)
                return f"{hours}h {minutes}m"
        return "Expired"

    def get_is_expired(self, obj):
        """Check if challenge is expired"""
        return obj.status == 'PENDING' and timezone.now() > obj.expires_at


class ChallengeDetailSerializer(serializers.ModelSerializer):
    """
    Detailed serializer for Challenge with nested objects
    """
    challenger = UserSerializer(read_only=True)
    challenged = UserSerializer(read_only=True)
    match = MatchListSerializer(read_only=True)

    class Meta:
        model = Challenge
        fields = [
            'id', 'challenger', 'challenged', 'status', 'message',
            'is_forced', 'season', 'match', 'match_type', 'match_format',
            'format_value', 'created_at', 'expires_at',
            'responded_at'
        ]
        read_only_fields = ['id', 'created_at', 'responded_at']


class ChallengeCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating challenges
    """
    class Meta:
        model = Challenge
        fields = [
            'id', 'challenged', 'message', 'season',
            'match_type', 'match_format', 'format_value'
        ]
        read_only_fields = ['id']

    def validate(self, data):
        """Validate challenge creation"""
        challenger = self.context.get('request').user
        challenged = data.get('challenged')
        season = data.get('season')

        # Cannot challenge yourself
        if challenger == challenged:
            raise serializers.ValidationError("You cannot challenge yourself")

        # Check if there's already a pending challenge between these players
        existing_challenge = Challenge.objects.filter(
            challenger=challenger,
            challenged=challenged,
            status='PENDING'
        ).first()

        if existing_challenge:
            raise serializers.ValidationError(
                "You already have a pending challenge with this player"
            )

        # Check challenge limit for season
        if season:
            season_challenges = Challenge.objects.filter(
                challenger=challenger,
                season=season
            ).count()

            if season_challenges >= season.max_challenges_per_player:
                raise serializers.ValidationError(
                    f"You have reached the maximum of {season.max_challenges_per_player} "
                    f"challenges for this season"
                )

        # Check if challenged player is in top 7 (forced acceptance)
        from ratings.models import LeagueStanding
        if season:
            top_7 = LeagueStanding.objects.filter(
                season=season
            ).order_by('rank')[:7].values_list('user_id', flat=True)

            if challenged.id in top_7:
                data['is_forced'] = True

        return data

    def create(self, validated_data):
        """Create challenge with challenger from request"""
        validated_data['challenger'] = self.context.get('request').user
        validated_data['expires_at'] = timezone.now() + timedelta(hours=24)
        return super().create(validated_data)


class ChallengeResponseSerializer(serializers.Serializer):
    """
    Serializer for accepting/declining challenges
    """
    action = serializers.ChoiceField(choices=['accept', 'decline'])

    def validate_action(self, value):
        """Validate action"""
        challenge = self.context.get('challenge')

        if challenge.status != 'PENDING':
            raise serializers.ValidationError("Challenge is not pending")

        if timezone.now() > challenge.expires_at:
            raise serializers.ValidationError("Challenge has expired")

        return value


class ChallengeHistorySerializer(serializers.ModelSerializer):
    """
    Serializer for Challenge History - aggregate statistics per user per season
    """
    username = serializers.CharField(source='user.username', read_only=True)
    season_name = serializers.CharField(source='season.name', read_only=True)

    class Meta:
        model = ChallengeHistory
        fields = [
            'id', 'user', 'username', 'season', 'season_name',
            'challenges_sent', 'challenges_received', 'challenges_accepted',
            'challenges_declined', 'challenges_won', 'challenges_lost',
            'updated_at'
        ]
        read_only_fields = ['id', 'updated_at']


class ChallengeStatsSerializer(serializers.Serializer):
    """
    Serializer for challenge statistics
    """
    total_challenges_sent = serializers.IntegerField()
    total_challenges_received = serializers.IntegerField()
    challenges_won = serializers.IntegerField()
    challenges_lost = serializers.IntegerField()
    challenges_accepted = serializers.IntegerField()
    challenges_declined = serializers.IntegerField()
    challenges_expired = serializers.IntegerField()
    win_rate = serializers.FloatField()
    acceptance_rate = serializers.FloatField()
