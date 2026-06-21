import secrets
import string
import logging

from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User, Achievement, PlayerProfile, SuperAdmin

logger = logging.getLogger(__name__)


class PlayerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlayerProfile
        fields = [
            'current_rating', 'highest_rating', 'league',
            'total_matches', 'wins', 'losses', 'win_rate', 'loss_rate',
            'win_streak', 'longest_win_streak', 'is_active_player',
            'last_match_date'
        ]


class SuperAdminSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    role = serializers.CharField(source='user.role', read_only=True)

    class Meta:
        model = SuperAdmin
        fields = ['id', 'username', 'email', 'admin_level', 'department', 'role']
        read_only_fields = ['id', 'username', 'email', 'role']

class SuperAdminRegistrationSerializer(serializers.ModelSerializer):
    """
    Serializer for super admin registration (signup)
    """
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )

    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'password_confirm',
            'first_name', 'last_name', 'bio'
        ]
        extra_kwargs = {
            'email': {'required': True},
            'first_name': {'required': False},
            'last_name': {'required': False},
        }

    def validate(self, attrs):
        """Validate that passwords match"""
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                "password": "Password fields didn't match."
            })
        return attrs

    def validate_email(self, value):
        """Ensure email is unique"""
        if User.objects.filter(email=value.lower()).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    def validate_username(self, value):
        """Ensure username is unique and valid"""
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def create(self, validated_data):
        """Create new user with hashed password"""
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')

        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()

        return user
class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for User model (read-only for profiles)
    """
    player_profile = PlayerProfileSerializer(read_only=True)
    admin_profile = SuperAdminSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'bio', 'avatar', 'role', 'is_active', 'last_login', 'date_joined',
            'player_profile', 'admin_profile'
        ]
        read_only_fields = [
            'id', 'role', 'is_active', 'last_login', 'date_joined'
        ]


class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    Serializer for user registration (signup)
    """
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )

    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'password_confirm',
            'first_name', 'last_name', 'bio'
        ]
        extra_kwargs = {
            'email': {'required': True},
            'first_name': {'required': False},
            'last_name': {'required': False},
        }

    def validate(self, attrs):
        """Validate that passwords match"""
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                "password": "Password fields didn't match."
            })
        return attrs

    def validate_email(self, value):
        """Ensure email is unique"""
        if User.objects.filter(email=value.lower()).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    def validate_username(self, value):
        """Ensure username is unique and valid"""
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def create(self, validated_data):
        """Create new user with hashed password"""
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')

        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()

        return user


class AdminUserCreateSerializer(serializers.ModelSerializer):
    """
    Used by admins to create users via POST /api/users/.
    Auto-generates username from first+last name, auto-generates a secure
    password, creates PlayerProfile, and sends a welcome email.
    """
    first_name = serializers.CharField(required=True)
    last_name = serializers.CharField(required=True)
    email = serializers.EmailField(required=True)
    role = serializers.ChoiceField(
        choices=['PLAYER', 'MODERATOR', 'ADMIN'],
        default='PLAYER'
    )

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'role']

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    @staticmethod
    def generate_username(first_name, last_name):
        base = f"{first_name.strip()}{last_name.strip()}".replace(' ', '')
        username = base
        counter = 1
        while User.objects.filter(username__iexact=username).exists():
            username = f"{base}{counter}"
            counter += 1
        return username

    @staticmethod
    def generate_password(length=12):
        alphabet = string.ascii_letters + string.digits
        while True:
            pwd = ''.join(secrets.choice(alphabet) for _ in range(length))
            if (any(c.isupper() for c in pwd) and
                    any(c.islower() for c in pwd) and
                    any(c.isdigit() for c in pwd)):
                return pwd

    def create(self, validated_data):
        role = validated_data.pop('role', 'PLAYER')
        first_name = validated_data['first_name']
        last_name = validated_data['last_name']

        username = self.generate_username(first_name, last_name)
        raw_password = self.generate_password()

        user = User.objects.create_user(
            username=username,
            email=validated_data['email'],
            password=raw_password,
            first_name=first_name,
            last_name=last_name,
        )
        user.role = role
        user.save(update_fields=['role'])

        PlayerProfile.objects.get_or_create(user=user)

        self._send_welcome_email(user, raw_password)

        # Attach raw password so the view can include it in the response
        user._raw_password = raw_password
        return user

    @staticmethod
    def _send_welcome_email(user, raw_password):
        from django.core.mail import send_mail
        from django.conf import settings

        if not user.email:
            logger.warning("Skipping welcome email for %s — no email address", user.username)
            return

        subject = "Welcome to PingMaster — Your Login Credentials"
        site_url = getattr(settings, 'SITE_URL', 'http://localhost:4200')
        message = (
            f"Hi {user.first_name},\n\n"
            f"Your PingMaster account has been created. "
            f"Here are your login details:\n\n"
            f"  Username: {user.username}\n"
            f"  Password: {raw_password}\n\n"
            f"Please log in and change your password after your first login.\n\n"
            f"{site_url}\n\n"
            f"-- The PingMaster Team\n"
        )
        try:
            send_mail(
                subject, message,
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )
            logger.info("Welcome email sent to %s", user.email)
        except Exception as e:
            logger.error("Welcome email FAILED for %s: %s: %s", user.email, type(e).__name__, e)


class UserUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating user profile
    """
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'bio', 'avatar']


class ChangePasswordSerializer(serializers.Serializer):
    """
    Serializer for password change endpoint
    """
    old_password = serializers.CharField(required=True, style={'input_type': 'password'})
    new_password = serializers.CharField(
        required=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    new_password_confirm = serializers.CharField(required=True, style={'input_type': 'password'})

    def validate(self, attrs):
        """Validate that new passwords match"""
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({
                "new_password": "Password fields didn't match."
            })
        return attrs


class AchievementSerializer(serializers.ModelSerializer):
    """
    Serializer for Achievement model
    """
    user = serializers.StringRelatedField()
    achievement_type_display = serializers.CharField(source='get_achievement_type_display', read_only=True)
    match_id = serializers.IntegerField(source='match.id', read_only=True, allow_null=True)

    class Meta:
        model = Achievement
        fields = [
            'id', 'user', 'achievement_type', 'achievement_type_display',
            'earned_date', 'description', 'match_id'
        ]


class UserDetailSerializer(serializers.ModelSerializer):
    """
    Detailed serializer for user profile including achievements
    """
    player_profile = PlayerProfileSerializer(read_only=True)
    achievements = AchievementSerializer(many=True, read_only=True)
    achievements_count = serializers.SerializerMethodField()
    
    # Player profile fields as SerializerMethodFields for backward compatibility
    current_rating = serializers.SerializerMethodField()
    highest_rating = serializers.SerializerMethodField()
    league = serializers.SerializerMethodField()
    total_matches = serializers.SerializerMethodField()
    wins = serializers.SerializerMethodField()
    losses = serializers.SerializerMethodField()
    win_rate = serializers.SerializerMethodField()
    loss_rate = serializers.SerializerMethodField()
    win_streak = serializers.SerializerMethodField()
    longest_win_streak = serializers.SerializerMethodField()
    is_active_player = serializers.SerializerMethodField()
    last_match_date = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'bio', 'avatar', 'current_rating', 'highest_rating', 'league',
            'total_matches', 'wins', 'losses', 'win_rate', 'loss_rate',
            'win_streak', 'longest_win_streak', 'is_active_player',
            'last_match_date', 'date_joined', 'achievements', 'achievements_count',
            'player_profile'
        ]

    def get_achievements_count(self, obj):
        """Get total number of achievements"""
        return obj.achievements.count()
    
    def get_current_rating(self, obj):
        return obj.player_profile.current_rating if hasattr(obj, 'player_profile') else None
    
    def get_highest_rating(self, obj):
        return obj.player_profile.highest_rating if hasattr(obj, 'player_profile') else None
    
    def get_league(self, obj):
        return obj.player_profile.league if hasattr(obj, 'player_profile') else None
    
    def get_total_matches(self, obj):
        return obj.player_profile.total_matches if hasattr(obj, 'player_profile') else 0
    
    def get_wins(self, obj):
        return obj.player_profile.wins if hasattr(obj, 'player_profile') else 0
    
    def get_losses(self, obj):
        return obj.player_profile.losses if hasattr(obj, 'player_profile') else 0
    
    def get_win_rate(self, obj):
        return obj.player_profile.win_rate if hasattr(obj, 'player_profile') else 0.0
    
    def get_loss_rate(self, obj):
        return obj.player_profile.loss_rate if hasattr(obj, 'player_profile') else 0.0
    
    def get_win_streak(self, obj):
        return obj.player_profile.win_streak if hasattr(obj, 'player_profile') else 0
    
    def get_longest_win_streak(self, obj):
        return obj.player_profile.longest_win_streak if hasattr(obj, 'player_profile') else 0
    
    def get_is_active_player(self, obj):
        return obj.player_profile.is_active_player if hasattr(obj, 'player_profile') else False
    
    def get_last_match_date(self, obj):
        return obj.player_profile.last_match_date if hasattr(obj, 'player_profile') else None


class LeaderboardUserSerializer(serializers.ModelSerializer):
    """
    Simplified serializer for leaderboard display
    """
    current_rating = serializers.SerializerMethodField()
    league = serializers.SerializerMethodField()
    total_matches = serializers.SerializerMethodField()
    wins = serializers.SerializerMethodField()
    losses = serializers.SerializerMethodField()
    win_rate = serializers.SerializerMethodField()
    win_streak = serializers.SerializerMethodField()
    rank = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'avatar', 'current_rating', 'league',
            'total_matches', 'wins', 'losses', 'win_rate', 'win_streak', 'rank'
        ]

    def get_rank(self, obj):
        """Calculate user rank (will be provided by view context)"""
        return self.context.get('rank', None)
    
    def get_current_rating(self, obj):
        return obj.player_profile.current_rating if hasattr(obj, 'player_profile') else None
    
    def get_league(self, obj):
        return obj.player_profile.league if hasattr(obj, 'player_profile') else None
    
    def get_total_matches(self, obj):
        return obj.player_profile.total_matches if hasattr(obj, 'player_profile') else 0
    
    def get_wins(self, obj):
        return obj.player_profile.wins if hasattr(obj, 'player_profile') else 0
    
    def get_losses(self, obj):
        return obj.player_profile.losses if hasattr(obj, 'player_profile') else 0
    
    def get_win_rate(self, obj):
        return obj.player_profile.win_rate if hasattr(obj, 'player_profile') else 0.0
    
    def get_win_streak(self, obj):
        return obj.player_profile.win_streak if hasattr(obj, 'player_profile') else 0
