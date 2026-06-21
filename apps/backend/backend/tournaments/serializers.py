"""
Serializers for Tournaments App
"""

from rest_framework import serializers
from django.db import transaction

from .models import (
    Tournament, TournamentParticipant, TournamentRound,
    TournamentBracket, TournamentGroup, TournamentGroupStanding,
    AwardTier, PlayerAward, TournamentRoundFormat
)
from users.serializers import UserSerializer
from matches.serializers import MatchListSerializer


class TournamentParticipantSerializer(serializers.ModelSerializer):
    """
    Serializer for Tournament Participants
    """
    player_username = serializers.CharField(source='player.username', read_only=True)
    player_avatar = serializers.ImageField(source='player.avatar', read_only=True)
    player_rating = serializers.SerializerMethodField()
    tournament_points = serializers.SerializerMethodField()

    class Meta:
        model = TournamentParticipant
        fields = [
            'id', 'tournament', 'player', 'player_username', 'player_avatar',
            'player_rating', 'seed', 'status', 'final_rank', 'registered_at',
            'tournament_points',
        ]
        read_only_fields = ['id', 'registered_at', 'seed', 'final_rank']

    def get_player_rating(self, obj):
        """Get player rating from player profile"""
        return obj.player.player_profile.current_rating if hasattr(obj.player, 'player_profile') else None

    def get_tournament_points(self, obj):
        """Sum of ELO changes from all completed matches in this tournament."""
        from django.db.models import Sum
        from ratings.models import RatingHistory
        total = RatingHistory.objects.filter(
            user=obj.player,
            match__tournament=obj.tournament,
        ).aggregate(total=Sum('rating_change'))['total']
        return total or 0


class TournamentSerializer(serializers.ModelSerializer):
    """
    Serializer for Tournament model
    """
    organizer_username = serializers.CharField(source='organizer.username', read_only=True)
    participant_count = serializers.ReadOnlyField()
    is_full = serializers.ReadOnlyField()
    is_registration_open = serializers.ReadOnlyField()
    is_registered = serializers.SerializerMethodField()

    class Meta:
        model = Tournament
        fields = [
            'id', 'name', 'description', 'location', 'is_public', 'tournament_format',
            'match_format', 'status',
            'organizer', 'organizer_username', 'max_participants',
            'min_participants', 'registration_mode', 'registration_deadline',
            'registration_closed_at', 'start_date', 'end_date', 'is_rated', 'season',
            'prize_label', 'awards_distributed',
            'participant_count', 'is_full', 'is_registration_open', 'is_registered',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'registration_closed_at', 'awards_distributed']

    def get_is_registered(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        return TournamentParticipant.objects.filter(
            tournament=obj,
            player=request.user,
            status='CONFIRMED'
        ).exists()


class TournamentDetailSerializer(serializers.ModelSerializer):
    """
    Detailed serializer for Tournament with participants
    """
    organizer = UserSerializer(read_only=True)
    participants = TournamentParticipantSerializer(many=True, read_only=True)
    participant_count = serializers.ReadOnlyField()
    is_full = serializers.ReadOnlyField()
    is_registration_open = serializers.ReadOnlyField()
    is_registered = serializers.SerializerMethodField()

    class Meta:
        model = Tournament
        fields = [
            'id', 'name', 'description', 'location', 'is_public', 'tournament_format',
            'match_format', 'status',
            'organizer', 'max_participants', 'min_participants',
            'registration_mode', 'registration_deadline', 'registration_closed_at',
            'start_date', 'end_date', 'is_rated',
            'season', 'prize_label', 'awards_distributed',
            'participants', 'participant_count', 'is_full',
            'is_registration_open', 'is_registered', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'registration_closed_at', 'awards_distributed']

    def get_is_registered(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        return TournamentParticipant.objects.filter(
            tournament=obj,
            player=request.user,
            status='CONFIRMED'
        ).exists()


class TournamentCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating tournaments
    """
    class Meta:
        model = Tournament
        fields = [
            'id', 'name', 'description', 'location', 'is_public', 'tournament_format', 'match_format',
            'max_participants', 'min_participants', 'registration_mode', 'registration_deadline',
            'start_date', 'end_date', 'is_rated', 'season', 'status', 'prize_label'
        ]
        read_only_fields = ['id']

    def validate(self, data):
        """Validate tournament creation"""
        registration_mode = data.get('registration_mode', 'AUTOMATIC')
        registration_deadline = data.get('registration_deadline')
        start_date = data.get('start_date')

        # Validate registration deadline for AUTOMATIC mode
        if registration_mode == 'AUTOMATIC':
            if not registration_deadline:
                raise serializers.ValidationError(
                    "Registration deadline is required for AUTOMATIC registration mode"
                )
            if registration_deadline >= start_date:
                raise serializers.ValidationError(
                    "Registration deadline must be before start date"
                )

        # For MANUAL mode, deadline is optional but if provided, must be before start
        if registration_mode == 'MANUAL' and registration_deadline:
            if registration_deadline >= start_date:
                raise serializers.ValidationError(
                    "Registration deadline must be before start date"
                )

        # Validate end date
        if data.get('end_date') and start_date >= data.get('end_date'):
            raise serializers.ValidationError(
                "Start date must be before end date"
            )

        # Validate participant limits
        if data.get('min_participants') > data.get('max_participants'):
            raise serializers.ValidationError(
                "Minimum participants cannot exceed maximum"
            )

        # Validate max_participants for elimination formats
        tournament_format = data.get('tournament_format')
        max_participants = data.get('max_participants')

        if tournament_format in ['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION']:
            # Must be power of 2
            if max_participants not in [4, 8, 16, 32, 64]:
                raise serializers.ValidationError(
                    f"{tournament_format} tournaments must have 4, 8, 16, 32, or 64 max participants"
                )

        return data

    def create(self, validated_data):
        """Create tournament with organizer from request"""
        validated_data['organizer'] = self.context.get('request').user
        return super().create(validated_data)


class TournamentRoundSerializer(serializers.ModelSerializer):
    """
    Serializer for Tournament Rounds
    """
    class Meta:
        model = TournamentRound
        fields = [
            'id', 'tournament', 'round_number', 'name', 'is_completed',
            'started_at', 'completed_at'
        ]
        read_only_fields = ['id', 'started_at', 'completed_at']


class TournamentRoundFormatSerializer(serializers.ModelSerializer):
    """Serializer for per-round match format configuration."""
    class Meta:
        model = TournamentRoundFormat
        fields = ['id', 'round_number', 'round_name', 'match_format']


class TournamentBracketSerializer(serializers.ModelSerializer):
    """
    Serializer for Tournament Brackets
    """
    player1_username = serializers.CharField(source='player1.username', read_only=True, allow_null=True)
    player2_username = serializers.CharField(source='player2.username', read_only=True, allow_null=True)
    match = MatchListSerializer(read_only=True)

    class Meta:
        model = TournamentBracket
        fields = [
            'id', 'tournament', 'round', 'bracket_position',
            'player1', 'player1_username', 'player2', 'player2_username',
            'match', 'winner_advances_to', 'loser_advances_to'
        ]
        read_only_fields = ['id']


class TournamentGroupSerializer(serializers.ModelSerializer):
    """
    Serializer for Tournament Groups
    """
    class Meta:
        model = TournamentGroup
        fields = ['id', 'tournament', 'name']
        read_only_fields = ['id']


class TournamentGroupStandingSerializer(serializers.ModelSerializer):
    """
    Serializer for Group Standings
    """
    player_username = serializers.CharField(source='player.username', read_only=True)
    player_avatar = serializers.ImageField(source='player.avatar', read_only=True)
    goal_difference = serializers.SerializerMethodField()

    class Meta:
        model = TournamentGroupStanding
        fields = [
            'id', 'group', 'player', 'player_username', 'player_avatar',
            'matches_played', 'wins', 'losses', 'games_won', 'games_lost',
            'points', 'goal_difference'
        ]
        read_only_fields = ['id']

    def get_goal_difference(self, obj):
        """Calculate goal difference"""
        return obj.games_won - obj.games_lost


class TournamentBracketViewSerializer(serializers.Serializer):
    """
    Serializer for tournament bracket visualization
    """
    rounds = serializers.ListField()
    grand_final = serializers.DictField(required=False)


class AwardTierSerializer(serializers.ModelSerializer):
    """
    Serializer for AwardTier — used for CRUD on /api/tournaments/:id/award-tiers/
    """
    user_username = serializers.CharField(source='user.username', read_only=True, allow_null=True)

    class Meta:
        model = AwardTier
        fields = ['id', 'tier_type', 'position', 'points', 'user', 'user_username', 'label']

    def validate(self, data):
        tier_type = data.get('tier_type') or (self.instance.tier_type if self.instance else None)
        position = data.get('position') if 'position' in data else (self.instance.position if self.instance else None)
        user = data.get('user') or (self.instance.user if self.instance else None)

        if tier_type == AwardTier.POSITION and position is None:
            raise serializers.ValidationError({'position': 'Position is required for POSITION tier type.'})
        if tier_type == AwardTier.SPECIFIC_USER and user is None:
            raise serializers.ValidationError({'user': 'User is required for SPECIFIC_USER tier type.'})

        # Resolve tournament pk once (used by both duplicate checks below)
        if self.instance:
            tournament_pk = self.instance.tournament_id
        else:
            view = self.context.get('view')
            tournament_pk = view.kwargs.get('pk') if view else None

        # Duplicate position rank check — prevent two POSITION tiers with the same rank per tournament
        if tier_type == AwardTier.POSITION and position is not None and tournament_pk:
            qs = AwardTier.objects.filter(
                tournament_id=tournament_pk,
                position=position
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({
                    'position': f'An award tier for position rank {position} already exists for this tournament.'
                })

        # Duplicate label check — prevent two tiers with the same name per tournament
        label = data.get('label') if 'label' in data else (self.instance.label if self.instance else None)
        if label and label.strip() and tournament_pk:
            qs = AwardTier.objects.filter(
                tournament_id=tournament_pk,
                label__iexact=label.strip()
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({
                    'label': f'An award tier with the name "{label.strip()}" already exists for this tournament.'
                })

        return data


class PlayerAwardSerializer(serializers.ModelSerializer):
    """
    Serializer for PlayerAward — read-only, returned by /api/tournaments/:id/player-awards/
    """
    player_username = serializers.CharField(source='player.username', read_only=True)
    tier_type = serializers.CharField(source='award_tier.tier_type', read_only=True, allow_null=True)
    tier_label = serializers.CharField(source='award_tier.label', read_only=True, allow_null=True)
    tier_position = serializers.IntegerField(source='award_tier.position', read_only=True, allow_null=True)

    class Meta:
        model = PlayerAward
        fields = [
            'id', 'player', 'player_username',
            'award_tier', 'tier_type', 'tier_label', 'tier_position',
            'points_awarded', 'awarded_at'
        ]


class TournamentStatsSerializer(serializers.Serializer):
    """
    Serializer for tournament statistics
    """
    total_tournaments = serializers.IntegerField()
    tournaments_won = serializers.IntegerField()
    tournaments_participated = serializers.IntegerField()
    current_tournaments = serializers.IntegerField()
    best_placement = serializers.IntegerField()
    total_matches = serializers.IntegerField()
    total_wins = serializers.IntegerField()
    win_rate = serializers.FloatField()
