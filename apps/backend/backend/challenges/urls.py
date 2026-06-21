"""
URL Configuration for Challenges App
"""

from django.urls import path
from . import views

app_name = 'challenges'

urlpatterns = [
    # Challenge CRUD operations
    path('', views.ChallengeListCreateView.as_view(), name='challenge-list-create'),
    path('<int:pk>/', views.ChallengeDetailView.as_view(), name='challenge-detail'),

    # Challenge lists
    path('sent/', views.ChallengeSentView.as_view(), name='challenges-sent'),
    path('received/', views.ChallengeReceivedView.as_view(), name='challenges-received'),
    path('pending-count/', views.pending_challenges_count, name='pending-count'),

    # Challenge actions
    path('<int:pk>/accept/', views.ChallengeAcceptView.as_view(), name='challenge-accept'),
    path('<int:pk>/decline/', views.ChallengeDeclineView.as_view(), name='challenge-decline'),
    path('<int:pk>/cancel/', views.ChallengeCancelView.as_view(), name='challenge-cancel'),

    # Challenge history and statistics
    path('history/', views.ChallengeHistoryView.as_view(), name='challenge-history'),
    path('stats/<int:user_id>/', views.UserChallengeStatsView.as_view(), name='challenge-stats'),
]
