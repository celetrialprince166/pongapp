from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta


class Challenge(models.Model):
    """
    Challenge (Duel) model for player-to-player match requests.
    Players can challenge each other to matches.
    - Max 4 outgoing challenges per season
    - 24-hour expiry time
    - Forced acceptance for top 7 players
    """
    CHALLENGE_STATUS = [
        ('PENDING', 'Pending'),
        ('ACCEPTED', 'Accepted'),
        ('DECLINED', 'Declined'),
        ('EXPIRED', 'Expired'),
        ('CANCELLED', 'Cancelled'),
        ('COMPLETED', 'Completed'),
    ]

    MATCH_TYPES = [
        ('DUEL', 'Duel'),
        ('TRAINING', 'Training'),
    ]

    MATCH_FORMATS = [
        ('BEST_OF', 'Best of'),
        ('RACE_TO', 'Race to'),
    ]

    # Players
    challenger = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='challenges_sent'
    )
    challenged = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='challenges_received'
    )

    # Status
    status = models.CharField(max_length=20, choices=CHALLENGE_STATUS, default='PENDING')

    # Message/Note
    message = models.TextField(max_length=500, blank=True)

    # Match Configuration
    match_type = models.CharField(max_length=20, choices=MATCH_TYPES, default='DUEL')
    match_format = models.CharField(max_length=20, choices=MATCH_FORMATS, default='BEST_OF')
    format_value = models.IntegerField(default=3)  # e.g., Best of 3, Race to 11

    # Context
    season = models.ForeignKey(
        'ratings.Season',
        on_delete=models.SET_NULL,
        related_name='challenges',
        null=True,
        blank=True
    )

    # Forced acceptance flag (for top 7 players)
    is_forced = models.BooleanField(default=False)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    responded_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['challenger', 'status']),
            models.Index(fields=['challenged', 'status']),
            models.Index(fields=['season']),
        ]

    def __str__(self):
        return f"{self.challenger.username} challenges {self.challenged.username} - {self.get_status_display()}"

    def save(self, *args, **kwargs):
        """Auto-set expiry time if not provided (24 hours from creation)"""
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=24)
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        """Check if challenge has expired"""
        return timezone.now() > self.expires_at and self.status == 'PENDING'

    @property
    def time_remaining(self):
        """Get time remaining before expiry in hours"""
        if self.status != 'PENDING':
            return 0
        delta = self.expires_at - timezone.now()
        return max(0, round(delta.total_seconds() / 3600, 1))

    def accept(self):
        """Accept the challenge"""
        self.status = 'ACCEPTED'
        self.responded_at = timezone.now()
        self.save()

    def decline(self):
        """Decline the challenge"""
        self.status = 'DECLINED'
        self.responded_at = timezone.now()
        self.save()

    def cancel(self):
        """Cancel the challenge (by challenger)"""
        self.status = 'CANCELLED'
        self.save()

    def mark_expired(self):
        """Mark challenge as expired"""
        if self.is_expired:
            self.status = 'EXPIRED'
            self.save()


class ChallengeHistory(models.Model):
    """
    Track challenge history for statistics and analytics.
    Stores aggregate data per season per user.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='challenge_history'
    )
    season = models.ForeignKey(
        'ratings.Season',
        on_delete=models.CASCADE,
        related_name='challenge_history'
    )

    # Statistics
    challenges_sent = models.IntegerField(default=0)
    challenges_received = models.IntegerField(default=0)
    challenges_accepted = models.IntegerField(default=0)
    challenges_declined = models.IntegerField(default=0)
    challenges_won = models.IntegerField(default=0)
    challenges_lost = models.IntegerField(default=0)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'season']
        verbose_name_plural = 'Challenge histories'

    def __str__(self):
        return f"{self.user.username} - Season {self.season.name}"
