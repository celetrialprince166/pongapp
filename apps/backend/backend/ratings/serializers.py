"""
Serializers for Ratings App
"""

from rest_framework import serializers
from .models import Season, RatingHistory, LeagueStanding
from users.serializers import UserSerializer


class SeasonSerializer(serializers.ModelSerializer):
    """
    Serializer for Season model
    """
    is_ongoing = serializers.BooleanField(read_only=True)
    days_remaining = serializers.SerializerMethodField()
    status = serializers.ReadOnlyField()
    player_count = serializers.ReadOnlyField()
    matches_played = serializers.SerializerMethodField()
    tournament_count = serializers.SerializerMethodField()

    class Meta:
        model = Season
        fields = [
            'id', 'name', 'start_date', 'end_date', 'is_active',
            'duration_days', 'max_challenges_per_player', 'is_ongoing',
            'days_remaining', 'status', 'player_count',
            'format', 'region', 'prize_pool', 'ruleset', 'lead_organizer', 'player_cap',
            'matches_played', 'tournament_count',
            'ended_at', 'ended_by',
            'is_deleted', 'deleted_at', 'deleted_by',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'ended_at', 'ended_by',
            'is_deleted', 'deleted_at', 'deleted_by'
        ]

    def get_days_remaining(self, obj):
        """Calculate days remaining in season"""
        from django.utils import timezone
        if obj.is_ongoing:
            delta = obj.end_date - timezone.now()
            return max(0, delta.days)
        return 0

    def get_matches_played(self, obj):
        """Return stored total_matches counter"""
        return obj.total_matches or 0

    def get_tournament_count(self, obj):
        """Count non-deleted tournaments linked to this season"""
        return obj.tournaments.filter(is_deleted=False).count()


class SeasonCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating seasons
    """
    class Meta:
        model = Season
        fields = [
            'name', 'start_date', 'duration_days',
            'max_challenges_per_player', 'is_active',
            'format', 'region', 'prize_pool', 'ruleset', 'lead_organizer', 'player_cap'
        ]

    def validate(self, data):
        """Validate season creation"""
        return data

    def create(self, validated_data):
        """Auto-deactivate any existing active season before creating a new active one."""
        if validated_data.get('is_active', False):
            Season.objects.filter(is_active=True).update(is_active=False)
        return super().create(validated_data)


class RatingHistorySerializer(serializers.ModelSerializer):
    """
    Serializer for Rating History
    """
    user_username = serializers.CharField(source='user.username', read_only=True)
    opponent_username = serializers.CharField(source='opponent.username', read_only=True)
    match_id = serializers.IntegerField(source='match.id', read_only=True)
    season_name = serializers.CharField(source='season.name', read_only=True)

    class Meta:
        model = RatingHistory
        fields = [
            'id', 'user', 'user_username', 'match', 'match_id',
            'season', 'season_name', 'old_rating', 'new_rating',
            'rating_change', 'was_winner', 'opponent', 'opponent_username',
            'opponent_rating', 'old_league', 'new_league', 'league_changed',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class RatingHistoryDetailSerializer(serializers.ModelSerializer):
    """
    Detailed serializer for Rating History with nested objects
    """
    user = UserSerializer(read_only=True)
    opponent = UserSerializer(read_only=True)
    season = SeasonSerializer(read_only=True)

    class Meta:
        model = RatingHistory
        fields = [
            'id', 'user', 'match', 'season', 'old_rating', 'new_rating',
            'rating_change', 'was_winner', 'opponent', 'opponent_rating',
            'old_league', 'new_league', 'league_changed', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class LeagueStandingSerializer(serializers.ModelSerializer):
    """
    Serializer for League Standings
    """
    user_username = serializers.CharField(source='user.username', read_only=True)
    user_avatar = serializers.ImageField(source='user.avatar', read_only=True)
    season_name = serializers.CharField(source='season.name', read_only=True)
    win_rate = serializers.SerializerMethodField()

    class Meta:
        model = LeagueStanding
        fields = [
            'id', 'user', 'user_username', 'user_avatar', 'season',
            'season_name', 'league', 'rank', 'rating', 'matches_played',
            'wins', 'losses', 'win_rate', 'rating_change', 'updated_at'
        ]
        read_only_fields = ['id', 'updated_at']

    def get_win_rate(self, obj):
        """Calculate win rate"""
        if obj.matches_played == 0:
            return 0.0
        return round((obj.wins / obj.matches_played) * 100, 2)


class UserRatingStatsSerializer(serializers.Serializer):
    """
    Serializer for user rating statistics
    """
    current_rating = serializers.IntegerField()
    highest_rating = serializers.IntegerField()
    lowest_rating = serializers.IntegerField()
    rating_change_30_days = serializers.IntegerField()
    total_rating_gained = serializers.IntegerField()
    total_rating_lost = serializers.IntegerField()
    league = serializers.CharField()
    league_changes = serializers.IntegerField()
    promotions = serializers.IntegerField()
    demotions = serializers.IntegerField()
