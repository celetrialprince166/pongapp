"""
URL Configuration for Ratings App
"""

from django.urls import path
from . import views

app_name = 'ratings'

urlpatterns = [
    # Seasons
    path('seasons/', views.SeasonListCreateView.as_view(), name='season-list-create'),
    path('seasons/active/', views.ActiveSeasonView.as_view(), name='active-season'),
    path('seasons/deleted/', views.SeasonDeletedListView.as_view(), name='season-deleted-list'),
    path('seasons/<int:pk>/', views.SeasonDetailView.as_view(), name='season-detail'),
    path('seasons/<int:pk>/end/', views.end_season, name='season-end'),
    path('seasons/<int:pk>/delete/', views.SeasonSoftDeleteView.as_view(), name='season-soft-delete'),
    path('seasons/<int:pk>/restore/', views.SeasonRestoreView.as_view(), name='season-restore'),
    path('seasons/<int:pk>/recalculate-elo/', views.RecalculateELOView.as_view(), name='season-recalculate-elo'),

    # Rating History
    path('history/', views.RatingHistoryListView.as_view(), name='rating-history-list'),
    path('history/<int:user_id>/', views.UserRatingHistoryView.as_view(), name='user-rating-history'),

    # League Standings
    path('standings/', views.LeagueStandingsView.as_view(), name='league-standings'),
    path('standings/update/', views.update_league_standings, name='update-standings'),

    # Rating Statistics
    path('stats/<int:user_id>/', views.UserRatingStatsView.as_view(), name='user-rating-stats'),
    path('chart/<int:user_id>/', views.RatingChartDataView.as_view(), name='rating-chart-data'),
]
