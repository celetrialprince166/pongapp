from rest_framework import serializers
from django.db import transaction
from .models import Match, Game, MatchEvent
from users.serializers import UserSerializer


class GameSerializer(serializers.ModelSerializer):
    """
    Serializer for Game model
    """
    winner_username = serializers.CharField(source='winner.username', read_only=True)

    class Meta:
        model = Game
        fields = [
            'id', 'game_number', 'player1_score', 'player2_score',
            'winner', 'winner_username', 'is_completed',
            'started_at', 'completed_at', 'is_deuce', 'score_difference'
        ]
        read_only_fields = ['id', 'started_at', 'completed_at', 'winner']


class MatchEventSerializer(serializers.ModelSerializer):
    """
    Serializer for MatchEvent model
    """
    player_username = serializers.CharField(source='player.username', read_only=True)

    class Meta:
        model = MatchEvent
        fields = [
            'id', 'event_type', 'player', 'player_username',
            'player1_score', 'player2_score', 'timestamp'
        ]
        read_only_fields = ['id', 'timestamp']


class MatchListSerializer(serializers.ModelSerializer):
    """
    Simplified serializer for match lists
    """
    player1_username = serializers.CharField(source='player1.username', read_only=True)
    player2_username = serializers.CharField(source='player2.username', read_only=True)
    winner_username = serializers.CharField(source='winner.username', read_only=True)
    referee_username = serializers.CharField(source='referee.username', read_only=True)

    class Meta:
        model = Match
        fields = [
            'id', 'player1', 'player1_username', 'player2', 'player2_username',
            'status', 'match_format', 'target_score', 'is_rated', 'is_admin_refereed',
            'winner', 'winner_username', 'player1_games_won', 'player2_games_won',
            'referee', 'referee_username', 'scheduled_at', 'started_at',
            'completed_at', 'created_at'
        ]


class MatchDetailSerializer(serializers.ModelSerializer):
    """
    Detailed serializer for match with games and events
    """
    player1 = UserSerializer(read_only=True)
    player2 = UserSerializer(read_only=True)
    winner = UserSerializer(read_only=True)
    referee = UserSerializer(read_only=True)
    games = GameSerializer(many=True, read_only=True)
    events = MatchEventSerializer(many=True, read_only=True)

    class Meta:
        model = Match
        fields = [
            'id', 'player1', 'player2', 'status', 'match_format', 'target_score',
            'is_rated', 'is_admin_refereed', 'referee', 'winner',
            'player1_games_won', 'player2_games_won', 'season',
            'tournament', 'challenge', 'scheduled_at', 'started_at',
            'completed_at', 'created_at', 'updated_at', 'duration_minutes',
            'is_marathon', 'games', 'events'
        ]


class MatchCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating matches
    """
    class Meta:
        model = Match
        fields = [
            'id', 'player1', 'player2', 'match_format', 'target_score', 'is_rated',
            'is_admin_refereed', 'referee', 'scheduled_at', 'season',
            'tournament', 'challenge'
        ]
        read_only_fields = ['id']

    def validate(self, data):
        """Validate match creation data"""
        # Ensure players are different
        if data.get('player1') == data.get('player2'):
            raise serializers.ValidationError("Players must be different")

        # If rated, must have referee
        if data.get('is_rated') and data.get('is_admin_refereed') and not data.get('referee'):
            raise serializers.ValidationError(
                "Rated admin-refereed matches must have a referee"
            )

        # Referee cannot be a player
        referee = data.get('referee')
        if referee and referee in [data.get('player1'), data.get('player2')]:
            raise serializers.ValidationError("Referee cannot be one of the players")

        return data

    def create(self, validated_data):
        """Create match and initial game"""
        with transaction.atomic():
            match = Match.objects.create(**validated_data)

            # Create first game
            Game.objects.create(
                match=match,
                game_number=1
            )

        return match


class AddPointSerializer(serializers.Serializer):
    """
    Serializer for adding a point to a player
    """
    player_id = serializers.IntegerField(required=True)

    def validate_player_id(self, value):
        """Validate that player is in the match"""
        match = self.context.get('match')
        if match and value not in [match.player1.id, match.player2.id]:
            raise serializers.ValidationError("Player is not in this match")
        return value


class CompleteMatchSerializer(serializers.Serializer):
    """
    Serializer for completing a match
    """
    winner_id = serializers.IntegerField(required=True)

    def validate_winner_id(self, value):
        """Validate that winner is in the match"""
        match = self.context.get('match')
        if match and value not in [match.player1.id, match.player2.id]:
            raise serializers.ValidationError("Winner must be one of the players")
        return value


class MatchStatsSerializer(serializers.Serializer):
    """
    Serializer for match statistics
    """
    total_matches = serializers.IntegerField()
    completed = serializers.IntegerField()
    in_progress = serializers.IntegerField()
    scheduled = serializers.IntegerField()
    cancelled = serializers.IntegerField()
    rated_matches = serializers.IntegerField()
    unrated_matches = serializers.IntegerField()
    average_duration = serializers.FloatField()
    longest_match = serializers.FloatField()
    shortest_match = serializers.FloatField()


class MatchScoreboardSerializer(serializers.Serializer):
    """
    Simplified serializer for live scoreboards
    """
    match_id = serializers.IntegerField()
    player1_username = serializers.CharField()
    player2_username = serializers.CharField()
    player1_games_won = serializers.IntegerField()
    player2_games_won = serializers.IntegerField()
    current_game = serializers.DictField()
    status = serializers.CharField()
    is_rated = serializers.BooleanField()
