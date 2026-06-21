from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views
from matches.views import UserMatchHistoryView

urlpatterns = [
    # Authentication
    path('auth/signup/', views.UserRegistrationView.as_view(), name='signup'),
    path('auth/admin/signup/', views.SuperAdminRegistrationView.as_view(), name='admin_signup'),
    path('auth/login/', views.UserLoginView.as_view(), name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', views.UserProfileView.as_view(), name='profile'),
    path('auth/me/update/', views.UserProfileUpdateView.as_view(), name='profile_update'),
    path('auth/change-password/', views.ChangePasswordView.as_view(), name='change_password'),
    path('auth/check-username/', views.check_username_availability, name='check_username'),
    path('auth/check-email/', views.check_email_availability, name='check_email'),

    # Users
    path('users/', views.UserListView.as_view(), name='user_list'),
    path('users/<int:pk>/', views.UserDetailView.as_view(), name='user_detail'),
    path('users/<int:pk>/achievements/', views.UserAchievementsView.as_view(), name='user_achievements'),
    path('users/<int:pk>/stats/', views.UserStatsView.as_view(), name='user_stats'),
    path('users/<int:pk>/matches/', UserMatchHistoryView.as_view(), name='user_match_history'),

    # Leaderboard
    path('leaderboard/', views.LeaderboardView.as_view(), name='leaderboard'),

    # Player Discovery
    path('players/random/', views.random_player, name='random_player'),
    path('players/search/', views.SearchPlayerView.as_view(), name='search_players'),

    # User search (alias used by award tier form: ?username=<q>)
    path('users/search/', views.UserSearchView.as_view(), name='user_search'),
]
