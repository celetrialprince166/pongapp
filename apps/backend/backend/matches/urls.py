"""
URL Configuration for Matches App
"""

from django.urls import path
from . import views

app_name = 'matches'

urlpatterns = [
    # Match CRUD operations
    path('', views.MatchListCreateView.as_view(), name='match-list-create'),
    path('<int:pk>/', views.MatchDetailView.as_view(), name='match-detail'),

    # Match lifecycle operations
    path('<int:pk>/start/', views.MatchStartView.as_view(), name='match-start'),
    path('<int:pk>/add-point/', views.MatchAddPointView.as_view(), name='match-add-point'),
    path('<int:pk>/complete/', views.MatchCompleteView.as_view(), name='match-complete'),
    path('<int:pk>/correct/', views.MatchCorrectView.as_view(), name='match-correct'),
    path('<int:pk>/cancel/', views.MatchCancelView.as_view(), name='match-cancel'),

    # Live match data
    path('<int:pk>/scoreboard/', views.MatchScoreboardView.as_view(), name='match-scoreboard'),
    path('live/', views.LiveMatchesView.as_view(), name='live-matches'),

    # Match statistics and history
    path('stats/', views.MatchStatsView.as_view(), name='match-stats'),
    path('head-to-head/<int:player1_id>/<int:player2_id>/', views.head_to_head, name='head-to-head'),
]
