from django.core.exceptions import ValidationError
from django.db import models
from django.conf import settings
from django.utils import timezone


class Tournament(models.Model):
    """
    Tournament model for organizing competitive events.
    Supports multiple formats: Single/Double Elimination, Round Robin, Swiss, etc.
    """
    TOURNAMENT_STATUS = [
        ('UPCOMING', 'Upcoming'),
        ('REGISTRATION', 'Registration Open'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]

    TOURNAMENT_FORMAT = [
        ('SINGLE_ELIMINATION', 'Single Elimination'),
        ('DOUBLE_ELIMINATION', 'Double Elimination'),
        ('ROUND_ROBIN', 'Round Robin'),
        ('SWISS', 'Swiss System'),
        ('GROUP_KNOCKOUT', 'Group Stage + Knockout'),
    ]

    REGISTRATION_MODE = [
        ('AUTOMATIC', 'Automatic (deadline-based)'),
        ('MANUAL', 'Manual (admin closes)'),
    ]

    MATCH_FORMAT = [
        ('BEST_OF_3', 'Best of 3'),
        ('BEST_OF_5', 'Best of 5'),
        ('BEST_OF_7', 'Best of 7'),
    ]

    # Basic information
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    location = models.CharField(max_length=300, blank=True, default='')
    is_public = models.BooleanField(default=True)
    tournament_format = models.CharField(max_length=30, choices=TOURNAMENT_FORMAT)
    status = models.CharField(max_length=20, choices=TOURNAMENT_STATUS, default='UPCOMING')

    # Organizer (admin)
    organizer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='organized_tournaments'
    )

    # Season context
    season = models.ForeignKey(
        'ratings.Season',
        on_delete=models.SET_NULL,
        related_name='tournaments',
        null=True,
        blank=True
    )

    # Registration settings
    registration_mode = models.CharField(
        max_length=20,
        choices=REGISTRATION_MODE,
        default='AUTOMATIC',
        help_text='AUTOMATIC: closes at deadline, MANUAL: admin closes manually'
    )
    max_participants = models.IntegerField(default=16)
    min_participants = models.IntegerField(default=4)
    registration_deadline = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Required for AUTOMATIC mode, optional for MANUAL mode'
    )
    registration_closed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Timestamp when registration was manually closed by admin'
    )

    # Match format for matches within this tournament
    match_format = models.CharField(
        max_length=20,
        choices=MATCH_FORMAT,
        default='BEST_OF_3',
        help_text='Default match format (Best of 3/5/7) for all matches in this tournament'
    )

    # Is this tournament rated?
    is_rated = models.BooleanField(default=True)

    # Awards
    prize_label = models.CharField(
        max_length=100,
        blank=True,
        help_text='Display label for the prize shown on the tournament card (e.g. "₵500 Cash Prize")'
    )
    awards_distributed = models.BooleanField(
        default=False,
        help_text='True after distribute-awards has been run; blocks re-distribution until reset'
    )

    # Soft delete
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='deleted_tournaments'
    )

    # Timestamps
    start_date = models.DateTimeField()
    end_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-start_date']

    def __str__(self):
        return f"{self.name} - {self.get_tournament_format_display()}"

    @property
    def is_registration_open(self):
        """Check if registration is still open"""
        if self.status != 'REGISTRATION':
            return False

        # Never open if tournament has reached full capacity
        if self.is_full:
            return False

        # Manual mode - check if admin closed it
        if self.registration_mode == 'MANUAL':
            return self.registration_closed_at is None

        # Automatic mode - check deadline
        if self.registration_deadline:
            return timezone.now() < self.registration_deadline

        # Fallback: if no deadline in automatic mode, consider closed
        return False

    @property
    def participant_count(self):
        """Get current number of participants"""
        return self.participants.filter(status='CONFIRMED').count()

    @property
    def is_full(self):
        """Check if tournament has reached max participants"""
        return self.participant_count >= self.max_participants


class TournamentParticipant(models.Model):
    """
    Tracks players registered for a tournament.
    """
    PARTICIPANT_STATUS = [
        ('PENDING', 'Pending'),
        ('CONFIRMED', 'Confirmed'),
        ('WITHDRAWN', 'Withdrawn'),
        ('ELIMINATED', 'Eliminated'),
    ]

    tournament = models.ForeignKey(
        Tournament,
        on_delete=models.CASCADE,
        related_name='participants'
    )
    player = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='tournament_participations'
    )

    status = models.CharField(max_length=20, choices=PARTICIPANT_STATUS, default='PENDING')
    seed = models.IntegerField(null=True, blank=True)  # Seeding for bracket

    # Final placement
    final_rank = models.IntegerField(null=True, blank=True)

    # Timestamps
    registered_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ['tournament', 'player']
        ordering = ['seed']

    def __str__(self):
        return f"{self.player.username} in {self.tournament.name}"

    def confirm(self):
        """Confirm participation"""
        self.status = 'CONFIRMED'
        self.confirmed_at = timezone.now()
        self.save()


class TournamentRound(models.Model):
    """
    Represents a round in a tournament (e.g., Quarter Finals, Semi Finals, Finals).
    """
    tournament = models.ForeignKey(
        Tournament,
        on_delete=models.CASCADE,
        related_name='rounds'
    )
    round_number = models.IntegerField()
    name = models.CharField(max_length=100)  # e.g., "Quarter Finals", "Semi Finals"

    # Status
    is_completed = models.BooleanField(default=False)

    # Timestamps
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['tournament', 'round_number']
        unique_together = ['tournament', 'round_number']

    def __str__(self):
        return f"{self.tournament.name} - {self.name}"


class TournamentBracket(models.Model):
    """
    Represents a match slot in the tournament bracket.
    Links to the actual Match once players are determined.
    """
    tournament = models.ForeignKey(
        Tournament,
        on_delete=models.CASCADE,
        related_name='brackets'
    )
    round = models.ForeignKey(
        TournamentRound,
        on_delete=models.CASCADE,
        related_name='brackets'
    )

    # Position in bracket
    bracket_position = models.IntegerField()

    # Players (may be TBD until previous rounds complete)
    player1 = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='bracket_as_player1',
        null=True,
        blank=True
    )
    player2 = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='bracket_as_player2',
        null=True,
        blank=True
    )

    # Link to actual match
    match = models.OneToOneField(
        'matches.Match',
        on_delete=models.SET_NULL,
        related_name='tournament_bracket',
        null=True,
        blank=True
    )

    # Winner of this bracket slot
    winner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='bracket_wins',
        null=True,
        blank=True
    )

    # Advancement tracking
    winner_advances_to = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        related_name='source_brackets',
        null=True,
        blank=True
    )

    # For double elimination
    loser_advances_to = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        related_name='loser_source_brackets',
        null=True,
        blank=True
    )

    class Meta:
        ordering = ['round', 'bracket_position']
        unique_together = ['tournament', 'round', 'bracket_position']

    def __str__(self):
        return f"{self.tournament.name} - {self.round.name} - Position {self.bracket_position}"


class TournamentRoundFormat(models.Model):
    """Stores the admin-configured match format for each round of a tournament."""
    MATCH_FORMAT_CHOICES = [
        ('BEST_OF_3', 'Best of 3'),
        ('BEST_OF_5', 'Best of 5'),
        ('BEST_OF_7', 'Best of 7'),
        ('RACE_TO_5', 'Race to 5'),
        ('RACE_TO_11', 'Race to 11'),
        ('RACE_TO_21', 'Race to 21'),
    ]

    tournament = models.ForeignKey(
        Tournament,
        on_delete=models.CASCADE,
        related_name='round_formats'
    )
    round_number = models.PositiveIntegerField()
    round_name = models.CharField(max_length=50)  # e.g. "Final", "Semi Finals"
    match_format = models.CharField(
        max_length=20,
        choices=MATCH_FORMAT_CHOICES,
        default='BEST_OF_3'
    )

    class Meta:
        unique_together = ['tournament', 'round_number']
        ordering = ['round_number']

    def __str__(self):
        return f"{self.tournament.name} R{self.round_number}: {self.match_format}"


class TournamentGroup(models.Model):
    """
    For Group Stage tournaments (Group Stage + Knockout format).
    """
    tournament = models.ForeignKey(
        Tournament,
        on_delete=models.CASCADE,
        related_name='groups'
    )
    name = models.CharField(max_length=50)  # e.g., "Group A", "Group B"

    class Meta:
        unique_together = ['tournament', 'name']
        ordering = ['name']

    def __str__(self):
        return f"{self.tournament.name} - {self.name}"


class AwardTier(models.Model):
    """
    Defines a point award tier for a tournament.
    Three types:
      POSITION       — awarded to the player finishing at a specific rank
      ALL_PARTICIPANTS — awarded to every confirmed + ranked participant
      SPECIFIC_USER  — awarded to a manually selected player regardless of rank
    """
    POSITION = 'POSITION'
    ALL_PARTICIPANTS = 'ALL_PARTICIPANTS'
    SPECIFIC_USER = 'SPECIFIC_USER'
    TIER_TYPE_CHOICES = [
        (POSITION, 'Position'),
        (ALL_PARTICIPANTS, 'All Participants'),
        (SPECIFIC_USER, 'Specific User'),
    ]

    tournament = models.ForeignKey(
        Tournament,
        on_delete=models.CASCADE,
        related_name='award_tiers'
    )
    tier_type = models.CharField(max_length=20, choices=TIER_TYPE_CHOICES)
    position = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Final rank that triggers this award. Required for POSITION type.'
    )
    points = models.PositiveIntegerField(
        help_text='Number of points credited to the player\'s current_rating'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='specific_award_tiers',
        help_text='Target player. Required for SPECIFIC_USER type.'
    )
    label = models.CharField(
        max_length=100,
        blank=True,
        help_text='Optional display label (e.g. "Champion", "Fair Play Award")'
    )

    class Meta:
        ordering = ['tier_type', 'position']
        constraints = [
            models.UniqueConstraint(
                fields=['tournament', 'position'],
                condition=models.Q(position__isnull=False),
                name='unique_position_rank_per_tournament'
            )
        ]

    def __str__(self):
        return f"{self.get_tier_type_display()} — {self.points} pts ({self.tournament.name})"

    def clean(self):
        if self.tier_type == self.POSITION and self.position is None:
            raise ValidationError({'position': 'Position is required for POSITION tier type.'})
        if self.tier_type == self.SPECIFIC_USER and self.user_id is None:
            raise ValidationError({'user': 'User is required for SPECIFIC_USER tier type.'})


class PlayerAward(models.Model):
    """
    Records a single point award credited to a player from a tournament.
    One record per tier matched — a player can have multiple records (stacking).
    award_tier uses SET_NULL so records persist even if the tier is later deleted.
    """
    tournament = models.ForeignKey(
        Tournament,
        on_delete=models.CASCADE,
        related_name='player_awards'
    )
    player = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='player_awards'
    )
    award_tier = models.ForeignKey(
        AwardTier,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='player_awards'
    )
    points_awarded = models.PositiveIntegerField()
    awarded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-awarded_at']

    def __str__(self):
        return f"{self.player.username} — {self.points_awarded} pts ({self.tournament.name})"


class TournamentGroupStanding(models.Model):
    """
    Track standings within a tournament group.
    """
    group = models.ForeignKey(
        TournamentGroup,
        on_delete=models.CASCADE,
        related_name='standings'
    )
    player = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='group_standings'
    )

    # Statistics
    matches_played = models.IntegerField(default=0)
    wins = models.IntegerField(default=0)
    losses = models.IntegerField(default=0)
    games_won = models.IntegerField(default=0)
    games_lost = models.IntegerField(default=0)
    points = models.IntegerField(default=0)  # For standings calculation

    class Meta:
        unique_together = ['group', 'player']
        ordering = ['group', '-points', '-wins']

    def __str__(self):
        return f"{self.player.username} in {self.group.name}"
