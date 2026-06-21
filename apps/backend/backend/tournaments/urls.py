"""
URL Configuration for Tournaments App
"""

from django.urls import path
from . import views

app_name = 'tournaments'

urlpatterns = [
    # Tournament CRUD operations
    path('', views.TournamentListCreateView.as_view(), name='tournament-list-create'),
    path('<int:pk>/', views.TournamentDetailView.as_view(), name='tournament-detail'),

    # Tournament registration
    path('<int:pk>/register/', views.TournamentRegisterView.as_view(), name='tournament-register'),
    path('<int:pk>/unregister/', views.TournamentUnregisterView.as_view(), name='tournament-unregister'),

    # Tournament management
    path('<int:pk>/start/', views.TournamentStartView.as_view(), name='tournament-start'),
    path('<int:pk>/complete/', views.TournamentCompleteView.as_view(), name='tournament-complete'),
    path('<int:pk>/restore/', views.TournamentRestoreView.as_view(), name='tournament-restore'),
    path('<int:pk>/bracket/', views.TournamentBracketView.as_view(), name='tournament-bracket'),
    path('<int:pk>/standings/', views.TournamentStandingsView.as_view(), name='tournament-standings'),
    path('<int:pk>/participants/', views.TournamentParticipantsView.as_view(), name='tournament-participants'),
    path('<int:pk>/participants/<int:pid>/', views.AdminRemoveParticipantView.as_view(), name='tournament-remove-participant'),

    # Awards
    path('<int:pk>/award-tiers/', views.AwardTierListCreateView.as_view(), name='award-tier-list-create'),
    path('<int:pk>/award-tiers/<int:tid>/', views.AwardTierDetailView.as_view(), name='award-tier-detail'),
    path('<int:pk>/distribute-awards/', views.DistributeAwardsView.as_view(), name='distribute-awards'),
    path('<int:pk>/reset-awards/', views.ResetAwardsView.as_view(), name='reset-awards'),
    path('<int:pk>/player-awards/', views.PlayerAwardsListView.as_view(), name='player-awards-list'),

    # Round format configuration
    path('round-formats/preview/', views.TournamentRoundFormatsPreviewView.as_view(), name='round-formats-preview'),
    path('<int:pk>/round-formats/', views.TournamentRoundFormatsView.as_view(), name='round-formats'),

    # Tournament statistics
    path('stats/<int:user_id>/', views.UserTournamentStatsView.as_view(), name='tournament-stats'),
    path('user/<int:user_id>/', views.user_tournaments, name='user-tournaments'),
]
