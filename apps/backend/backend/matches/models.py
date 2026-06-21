from django.db import models
from django.conf import settings
from django.utils import timezone


class Match(models.Model):
    """
    Match model for tracking table tennis matches.
    Supports both rated (admin-refereed) and unrated (player-managed) matches.
    """
    MATCH_STATUS = [
        ('SCHEDULED', 'Scheduled'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]

    MATCH_FORMAT = [
        ('BEST_OF_3', 'Best of 3'),
        ('BEST_OF_5', 'Best of 5'),
        ('BEST_OF_7', 'Best of 7'),
        ('RACE_TO_5', 'Race to 5'),
        ('RACE_TO_11', 'Race to 11'),
        ('RACE_TO_21', 'Race to 21'),
    ]

    # Players
    player1 = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='matches_as_player1'
    )
    player2 = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='matches_as_player2'
    )

    # Match details
    status = models.CharField(max_length=20, choices=MATCH_STATUS, default='SCHEDULED')
    match_format = models.CharField(max_length=20, choices=MATCH_FORMAT, default='BEST_OF_3')
    # For RACE_TO formats: first to reach this score wins (null for BEST_OF formats)
    target_score = models.IntegerField(null=True, blank=True)

    # Rated vs Unrated
    is_rated = models.BooleanField(default=True)
    is_admin_refereed = models.BooleanField(default=False)

    # Referee (admin user for rated matches)
    referee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='refereed_matches',
        null=True,
        blank=True
    )

    # Results
    winner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='won_matches',
        null=True,
        blank=True
    )
    player1_games_won = models.IntegerField(default=0)
    player2_games_won = models.IntegerField(default=0)

    # Context
    season = models.ForeignKey(
        'ratings.Season',
        on_delete=models.SET_NULL,
        related_name='matches',
        null=True,
        blank=True
    )
    tournament = models.ForeignKey(
        'tournaments.Tournament',
        on_delete=models.SET_NULL,
        related_name='matches',
        null=True,
        blank=True
    )
    challenge = models.OneToOneField(
        'challenges.Challenge',
        on_delete=models.SET_NULL,
        related_name='match',
        null=True,
        blank=True
    )

    # Table assignment
    table_number = models.PositiveIntegerField(null=True, blank=True)

    # Timestamps
    scheduled_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['season', 'is_rated']),
            models.Index(fields=['-created_at']),
        ]
        verbose_name_plural = 'Matches'

    def __str__(self):
        return f"{self.player1.username} vs {self.player2.username} - {self.get_status_display()}"

    @property
    def duration_minutes(self):
        """Calculate match duration in minutes"""
        if self.started_at and self.completed_at:
            delta = self.completed_at - self.started_at
            return round(delta.total_seconds() / 60, 2)
        return None

    @property
    def is_marathon(self):
        """Check if match qualifies as marathon (>60 mins)"""
        duration = self.duration_minutes
        return duration and duration > 60

    def start_match(self):
        """Mark match as started"""
        self.status = 'IN_PROGRESS'
        self.started_at = timezone.now()
        self.save()

    def complete_match(self, winner):
        """Mark match as completed with winner"""
        self.status = 'COMPLETED'
        self.winner = winner
        self.completed_at = timezone.now()
        self.save()


class Game(models.Model):
    """
    Individual game within a match (e.g., Game 1 of Best of 3).
    Tracks point-by-point scoring.
    """
    match = models.ForeignKey(
        Match,
        on_delete=models.CASCADE,
        related_name='games'
    )
    game_number = models.IntegerField()  # 1, 2, 3, etc.

    # Scores
    player1_score = models.IntegerField(default=0)
    player2_score = models.IntegerField(default=0)

    # Winner
    winner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='won_games',
        null=True,
        blank=True
    )

    # Status
    is_completed = models.BooleanField(default=False)

    # Timestamps
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['match', 'game_number']
        unique_together = ['match', 'game_number']

    def __str__(self):
        return f"{self.match} - Game {self.game_number}"

    @property
    def is_deuce(self):
        """Check if game is in deuce (both players at 10+)"""
        return self.player1_score >= 10 and self.player2_score >= 10

    @property
    def score_difference(self):
        """Get absolute score difference"""
        return abs(self.player1_score - self.player2_score)

    def add_point(self, player):
        """Add a point for the specified player and check for game completion"""
        if player == self.match.player1:
            self.player1_score += 1
        elif player == self.match.player2:
            self.player2_score += 1

        # Check for game completion (first to 11, win by 2)
        if self.player1_score >= 11 or self.player2_score >= 11:
            if self.score_difference >= 2:
                self.is_completed = True
                self.completed_at = timezone.now()
                if self.player1_score > self.player2_score:
                    self.winner = self.match.player1
                    self.match.player1_games_won += 1
                else:
                    self.winner = self.match.player2
                    self.match.player2_games_won += 1
                self.match.save()

        self.save()


class MatchEvent(models.Model):
    """
    Track individual events/points within a match for detailed statistics.
    """
    EVENT_TYPES = [
        ('POINT', 'Point Scored'),
        ('SERVICE_CHANGE', 'Service Change'),
        ('TIMEOUT', 'Timeout'),
        ('GAME_END', 'Game End'),
    ]

    match = models.ForeignKey(
        Match,
        on_delete=models.CASCADE,
        related_name='events'
    )
    game = models.ForeignKey(
        Game,
        on_delete=models.CASCADE,
        related_name='events',
        null=True,
        blank=True
    )

    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    player = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='match_events',
        null=True,
        blank=True
    )

    # Scores at the time of event
    player1_score = models.IntegerField(default=0)
    player2_score = models.IntegerField(default=0)

    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f"{self.match} - {self.get_event_type_display()} at {self.timestamp}"
