from rest_framework import generics, status, permissions
from rest_framework.pagination import PageNumberPagination
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.db.models import Q

from .models import User, Achievement
from .serializers import (
    UserSerializer, UserRegistrationSerializer, AdminUserCreateSerializer,
    UserUpdateSerializer, ChangePasswordSerializer, AchievementSerializer,
    UserDetailSerializer, LeaderboardUserSerializer, SuperAdminRegistrationSerializer
)
import random


class UserPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'per_page'
    max_page_size = 100


class UserRegistrationView(generics.CreateAPIView):
    """
    User registration endpoint (signup)
    POST /api/auth/signup/
    """
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Generate JWT tokens for the new user
        refresh = RefreshToken.for_user(user)

        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            'message': 'User registered successfully!'
        }, status=status.HTTP_201_CREATED)


class SuperAdminRegistrationView(generics.CreateAPIView):
    """
    Admin registration endpoint (signup)
    POST /api/auth/admin/signup/
    """
    serializer_class = SuperAdminRegistrationSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Generate JWT tokens for the new user
        refresh = RefreshToken.for_user(user)

        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            'message': 'User registered successfully!'
        }, status=status.HTTP_201_CREATED)


class UserLoginView(APIView):
    """
    User login endpoint
    POST /api/auth/login/
    Body: {"username": "...", "password": "..."}
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        if not username or not password:
            return Response({
                'error': 'Please provide both username and password'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Try to authenticate with username or email
        user = authenticate(username=username, password=password)

        if not user:
            # Try authenticating with email
            try:
                user_obj = User.objects.get(email=username.lower())
                user = authenticate(username=user_obj.username, password=password)
            except User.DoesNotExist:
                pass

        if user:
            if not user.is_active:
                return Response({
                    'error': 'This account has been disabled'
                }, status=status.HTTP_403_FORBIDDEN)

            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)

            return Response({
                'user': UserSerializer(user).data,
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                },
                'message': 'Login successful!'
            }, status=status.HTTP_200_OK)

        return Response({
            'error': 'Invalid credentials'
        }, status=status.HTTP_401_UNAUTHORIZED)


class UserProfileView(generics.RetrieveAPIView):
    """
    Get current user profile
    GET /api/auth/me/
    """
    serializer_class = UserDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserProfileUpdateView(generics.UpdateAPIView):
    """
    Update current user profile
    PUT/PATCH /api/auth/me/update/
    """
    serializer_class = UserUpdateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    """
    Change user password
    POST /api/auth/change-password/
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user

        # Check old password
        if not user.check_password(serializer.data.get('old_password')):
            return Response({
                'error': 'Old password is incorrect'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Set new password
        user.set_password(serializer.data.get('new_password'))
        user.save()

        return Response({
            'message': 'Password changed successfully!'
        }, status=status.HTTP_200_OK)


class UserListView(generics.ListCreateAPIView):
    """
    List all users (with search and filtering) or create a new user (admin only)
    GET /api/users/ - List users
    POST /api/users/ - Create user (admin only)
    Query params: search, role, is_active, league, is_active_player
    """
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = UserPagination

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return AdminUserCreateSerializer
        return UserSerializer

    def get_queryset(self):
        queryset = User.objects.all()

        # Filter by active status
        is_active = self.request.query_params.get('is_active', None)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        # Filter by role
        role = self.request.query_params.get('role', None)
        if role:
            queryset = queryset.filter(role=role.upper())

        # Search by username, email, or name
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search) |
                Q(email__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )

        # Filter by league
        league = self.request.query_params.get('league', None)
        if league:
            queryset = queryset.filter(player_profile__league=league.upper())

        # Filter by active player status
        is_active_player = self.request.query_params.get('is_active_player', None)
        if is_active_player is not None:
            queryset = queryset.filter(player_profile__is_active_player=is_active_player.lower() == 'true')

        return queryset.order_by('-date_joined')

    def create(self, request, *args, **kwargs):
        if request.user.role != 'ADMIN' and not request.user.is_staff:
            return Response(
                {'error': 'Only administrators can create users'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response({
            'message': (
                f'User {user.username} created successfully. '
                f'Login credentials have been sent to {user.email}.'
            ),
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role,
            }
        }, status=status.HTTP_201_CREATED)


class UserDetailView(generics.RetrieveDestroyAPIView):
    """
    Get or delete a user by ID
    GET    /api/users/{id}/
    DELETE /api/users/{id}/  (admin only)
    """
    queryset = User.objects.all()
    serializer_class = UserDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def destroy(self, request, *args, **kwargs):
        if request.user.role != 'ADMIN' and not request.user.is_staff:
            return Response(
                {'error': 'Only administrators can delete users'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)


class UserAchievementsView(generics.ListAPIView):
    """
    Get user achievements
    GET /api/users/{id}/achievements/
    """
    serializer_class = AchievementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user_id = self.kwargs.get('pk')
        return Achievement.objects.filter(user_id=user_id)


class LeaderboardView(APIView):
    """
    Get global leaderboard
    GET /api/leaderboard/
    Query params: league (AMATEUR/PRO), limit (default 50)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        league = request.query_params.get('league', None)
        limit = int(request.query_params.get('limit', 50))

        # Show all active users, not just those with matches
        queryset = User.objects.filter(is_active=True)

        if league:
            queryset = queryset.filter(player_profile__league=league.upper())

        queryset = queryset.order_by('-player_profile__current_rating')[:limit]

        # Add rank to each user
        leaderboard_data = []
        for rank, user in enumerate(queryset, start=1):
            serializer = LeaderboardUserSerializer(user, context={'rank': rank})
            leaderboard_data.append(serializer.data)

        response_data = {
            'count': len(leaderboard_data),
            'league': league if league else 'ALL',
            'results': leaderboard_data
        }

        return Response(response_data, status=status.HTTP_200_OK)


class UserStatsView(APIView):
    """
    Get user statistics
    GET /api/users/{id}/stats/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({
                'error': 'User not found'
            }, status=status.HTTP_404_NOT_FOUND)

        # Get player profile
        profile = getattr(user, 'player_profile', None)
        
        if not profile:
             return Response({
                'error': 'User has no player profile'
            }, status=status.HTTP_404_NOT_FOUND)

        stats = {
            'rating': {
                'current': profile.current_rating,
                'highest': profile.highest_rating,
                'league': profile.league,
            },
            'matches': {
                'total': profile.total_matches,
                'wins': profile.wins,
                'losses': profile.losses,
                'win_rate': profile.win_rate,
                'loss_rate': profile.loss_rate,
            },
            'streaks': {
                'current_win_streak': profile.win_streak,
                'longest_win_streak': profile.longest_win_streak,
            },
            'achievements': {
                'total': user.achievements.count(),
                'recent': AchievementSerializer(
                    user.achievements.all()[:5],
                    many=True
                ).data
            },
            'activity': {
                'is_active': profile.is_active_player,
                'last_match': profile.last_match_date,
                'joined': user.date_joined,
            }
        }

        return Response(stats, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def check_username_availability(request):
    """
    Check if username is available
    POST /api/auth/check-username/
    Body: {"username": "..."}
    """
    username = request.data.get('username')

    if not username:
        return Response({
            'error': 'Username is required'
        }, status=status.HTTP_400_BAD_REQUEST)

    is_available = not User.objects.filter(username__iexact=username).exists()

    return Response({
        'username': username,
        'available': is_available
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def check_email_availability(request):
    """
    Check if email is available
    POST /api/auth/check-email/
    Body: {"email": "..."}
    """
    email = request.data.get('email')

    if not email:
        return Response({
            'error': 'Email is required'
        }, status=status.HTTP_400_BAD_REQUEST)

    is_available = not User.objects.filter(email__iexact=email).exists()

    return Response({
        'email': email,
        'available': is_available
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def random_player(request):
    """
    Get a random player (opponent)
    GET /api/players/random/
    """
    user = request.user
    # Get all active players excluding self and admins (optional, maybe we want to play admins?)
    # Let's exclude self and non-active players
    pks = User.objects.filter(is_active=True).exclude(id=user.id).values_list('pk', flat=True)
    
    if not pks:
        return Response({
            'error': 'No other players available'
        }, status=status.HTTP_404_NOT_FOUND)

    random_pk = random.choice(list(pks))
    random_user = User.objects.get(pk=random_pk)
    
    return Response(UserSerializer(random_user).data, status=status.HTTP_200_OK)


class SearchPlayerView(generics.ListAPIView):
    """
    Search players by name
    GET /api/players/search/?q=...
    """
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = User.objects.filter(is_active=True)
        query = self.request.query_params.get('q', None)

        if query:
            queryset = queryset.filter(
                Q(username__icontains=query) |
                Q(email__icontains=query) |
                Q(first_name__icontains=query) |
                Q(last_name__icontains=query)
            )

        return queryset.order_by('-player_profile__current_rating')


class UserSearchView(generics.ListAPIView):
    """
    Search users by username (used by admin forms for award tier lookup).
    GET /api/users/search/?username=<q>
    Returns max 10 results: [{id, username, avatar}]
    """
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        query = self.request.query_params.get('username', '').strip()
        if not query:
            return User.objects.none()
        return User.objects.filter(
            is_active=True,
            username__icontains=query
        ).order_by('username')[:10]
