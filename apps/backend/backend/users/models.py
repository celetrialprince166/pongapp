from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator, MaxValueValidator


class User(AbstractUser):
    """
    Custom User model extending Django's AbstractUser.
    Includes table tennis specific fields like rating, league, and statistics.
    """

    # Profile Information
    email = models.EmailField(unique=True, blank=False)
    bio = models.TextField(max_length=500, blank=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)

    # Roles
    ROLE_CHOICES = [
        ('ADMIN', 'Admin'),
        ('PLAYER', 'Player'),
        ('REFEREE', 'Referee'),
    ]
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='PLAYER')

    # Timestamps
    date_joined = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date_joined']
        indexes = [
            models.Index(fields=['username']),
        ]

    def __str__(self):
        return f"{self.username} ({self.role})"


class Achievement(models.Model):
    """
    Achievement/Badge model for tracking player accomplishments
    """
    ACHIEVEMENT_TYPES = [
        ('UNDEFEATED', 'Undefeated Champion'),
        ('GIANT_SLAYER', 'Giant Slayer'),
        ('COMEBACK_KING', 'Comeback King'),
        ('PERFECT_GAME', 'Perfect Game'),
        ('MARATHON', 'Marathon Player'),
        ('DOMINANT', 'Dominant Performance'),
        ('UNDERDOG', 'Underdog Victory'),
        ('BULLY', 'The Bully'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='achievements')
    achievement_type = models.CharField(max_length=20, choices=ACHIEVEMENT_TYPES)
    earned_date = models.DateTimeField(auto_now_add=True)
    description = models.TextField()

    # Reference to the match where achievement was earned
    match = models.ForeignKey('matches.Match', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-earned_date']
        unique_together = ['user', 'achievement_type', 'match']

    def __str__(self):
        return f"{self.user.username} - {self.get_achievement_type_display()}"


class PlayerProfile(models.Model):
    """
    Profile for players and referees containing game statistics.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='player_profile')
    
    # Rating & League
    current_rating = models.IntegerField(default=1000)
    highest_rating = models.IntegerField(default=1000)
    league = models.CharField(
        max_length=20,
        choices=[('AMATEUR', 'Amateur'), ('PRO', 'Professional')],
        default='AMATEUR'
    )

    # Statistics
    total_matches = models.IntegerField(default=0)
    wins = models.IntegerField(default=0)
    losses = models.IntegerField(default=0)
    win_streak = models.IntegerField(default=0)
    longest_win_streak = models.IntegerField(default=0)

    # Activity
    is_active_player = models.BooleanField(default=True)
    last_match_date = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} Profile"

    @property
    def win_rate(self):
        """Calculate win rate percentage"""
        if self.total_matches == 0:
            return 0.0
        return round((self.wins / self.total_matches) * 100, 2)

    @property
    def loss_rate(self):
        """Calculate loss rate percentage"""
        if self.total_matches == 0:
            return 0.0
        return round((self.losses / self.total_matches) * 100, 2)

    def update_league(self):
        """Update league based on current rating (1500 is PRO threshold)"""
        if self.current_rating >= 1500 and self.league == 'AMATEUR':
            self.league = 'PRO'
            self.save()
        elif self.current_rating < 1500 and self.league == 'PRO':
            self.league = 'AMATEUR'
            self.save()


class SuperAdmin(models.Model):
    """
    Profile for SuperAdmins containing admin-specific data.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='admin_profile')
    
    admin_level = models.CharField(
        max_length=20,
        choices=[('SUPER', 'Super Admin'), ('MODERATOR', 'Moderator')],
        default='SUPER'
    )
    department = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f"{self.user.username} Admin Profile"
