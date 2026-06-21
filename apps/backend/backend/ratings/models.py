from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta


class Season(models.Model):
    """
    Season model for tracking rating periods.
    Default duration is 2 weeks.
    """
    name = models.CharField(max_length=100)  # e.g., "Season 1 - Spring 2025"
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    is_active = models.BooleanField(default=True)

    # Settings
    duration_days = models.IntegerField(default=14)  # 2 weeks
    max_challenges_per_player = models.IntegerField(default=4)

    # Season metadata
    format = models.CharField(max_length=100, blank=True, default='')
    region = models.CharField(max_length=100, blank=True, default='')
    prize_pool = models.CharField(max_length=100, blank=True, default='')
    ruleset = models.CharField(max_length=500, blank=True, default='')
    lead_organizer = models.CharField(max_length=200, blank=True, default='')
    player_cap = models.IntegerField(null=True, blank=True)

    # Statistics
    total_matches = models.IntegerField(default=0)
    total_players = models.IntegerField(default=0)

    # Archive tracking
    ended_at = models.DateTimeField(null=True, blank=True)
    ended_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='seasons_ended'
    )

    # Soft delete
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='deleted_seasons'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-start_date']

    def __str__(self):
        return f"{self.name} ({self.start_date.date()} - {self.end_date.date()})"

    @property
    def is_ongoing(self):
        """Check if season is currently active"""
        now = timezone.now()
        return self.start_date <= now <= self.end_date

    @property
    def days_remaining(self):
        """Calculate days remaining in season"""
        if not self.is_ongoing:
            return 0
        delta = self.end_date - timezone.now()
        return max(0, delta.days)

    @property
    def status(self):
        """
        Calculate season status
        - archived: has ended_at (explicitly archived) or past end date
        - active: is_active and dates include today
        - upcoming: is_active and start date is in future
        """
        if self.ended_at:
            return 'archived'

        if not self.is_active:
            # Inactive but not explicitly archived
            now = timezone.now()
            if self.end_date > now:
                return 'upcoming'
            return 'archived'

        # Active season
        now = timezone.now()
        if now < self.start_date:
            return 'upcoming'
        elif self.start_date <= now <= self.end_date:
            return 'active'
        else:
            return 'archived'

    @property
    def player_count(self):
        """Get count of unique players with matches in this season"""
        from matches.models import Match
        player_ids = set()
        matches = Match.objects.filter(season=self)
        for match in matches:
            player_ids.add(match.player1_id)
            player_ids.add(match.player2_id)
        return len(player_ids)

    def save(self, *args, **kwargs):
        """Auto-calculate end_date if not provided"""
        if not self.end_date and self.start_date:
            self.end_date = self.start_date + timedelta(days=self.duration_days)
        super().save(*args, **kwargs)


class RatingHistory(models.Model):
    """
    Track all rating changes for users.
    Records ELO rating changes after each match.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='rating_history'
    )
    match = models.ForeignKey(
        'matches.Match',
        on_delete=models.CASCADE,
        related_name='rating_changes'
    )
    season = models.ForeignKey(
        Season,
        on_delete=models.CASCADE,
        related_name='rating_changes',
        null=True,
        blank=True
    )

    # Rating change details
    old_rating = models.IntegerField()
    new_rating = models.IntegerField()
    rating_change = models.IntegerField()  # Can be positive or negative

    # Match context
    was_winner = models.BooleanField()
    opponent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='opponent_rating_history'
    )
    opponent_rating = models.IntegerField()

    # League changes
    old_league = models.CharField(max_length=20)
    new_league = models.CharField(max_length=20)
    league_changed = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['season']),
        ]
        verbose_name_plural = 'Rating histories'

    def __str__(self):
        change_str = f"+{self.rating_change}" if self.rating_change > 0 else str(self.rating_change)
        return f"{self.user.username}: {self.old_rating} → {self.new_rating} ({change_str})"


class LeagueStanding(models.Model):
    """
    Track player standings within their league for a season.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='league_standings'
    )
    season = models.ForeignKey(
        Season,
        on_delete=models.CASCADE,
        related_name='league_standings'
    )
    league = models.CharField(
        max_length=20,
        choices=[('AMATEUR', 'Amateur'), ('PRO', 'Professional')]
    )

    # Rankings
    rank = models.IntegerField(default=0)
    rating = models.IntegerField()

    # Season statistics
    matches_played = models.IntegerField(default=0)
    wins = models.IntegerField(default=0)
    losses = models.IntegerField(default=0)
    rating_change = models.IntegerField(default=0)  # Total change for season

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['league', 'rank']
        unique_together = ['user', 'season']
        indexes = [
            models.Index(fields=['season', 'league', 'rank']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.league} #{self.rank} (Season: {self.season.name})"
