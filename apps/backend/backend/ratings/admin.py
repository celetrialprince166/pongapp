from django.contrib import admin
from .models import Season, RatingHistory, LeagueStanding


@admin.register(Season)
class SeasonAdmin(admin.ModelAdmin):
    """Season admin"""

    list_display = ['name', 'start_date', 'end_date', 'is_active', 'total_matches', 'total_players', 'days_remaining']
    list_filter = ['is_active', 'start_date']
    search_fields = ['name']
    date_hierarchy = 'start_date'
    ordering = ['-start_date']

    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'is_active')
        }),
        ('Duration', {
            'fields': ('start_date', 'end_date', 'duration_days')
        }),
        ('Settings', {
            'fields': ('max_challenges_per_player',)
        }),
        ('Statistics', {
            'fields': ('total_matches', 'total_players')
        }),
    )


@admin.register(RatingHistory)
class RatingHistoryAdmin(admin.ModelAdmin):
    """Rating History admin"""

    list_display = ['user', 'old_rating', 'new_rating', 'rating_change', 'was_winner', 'opponent', 'match', 'created_at']
    list_filter = ['was_winner', 'league_changed', 'created_at']
    search_fields = ['user__username', 'opponent__username']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']

    readonly_fields = ['created_at']


@admin.register(LeagueStanding)
class LeagueStandingAdmin(admin.ModelAdmin):
    """League Standing admin"""

    list_display = ['rank', 'user', 'league', 'rating', 'matches_played', 'wins', 'losses', 'season']
    list_filter = ['league', 'season']
    search_fields = ['user__username']
    ordering = ['league', 'rank']
