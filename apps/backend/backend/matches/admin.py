from django.contrib import admin
from .models import Match, Game, MatchEvent


class GameInline(admin.TabularInline):
    """Inline admin for games within a match"""
    model = Game
    extra = 0
    readonly_fields = ['started_at', 'completed_at']


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    """Match admin"""

    list_display = ['__str__', 'status', 'match_format', 'is_rated', 'winner', 'season', 'created_at']
    list_filter = ['status', 'is_rated', 'is_admin_refereed', 'match_format', 'season']
    search_fields = ['player1__username', 'player2__username']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']

    inlines = [GameInline]

    fieldsets = (
        ('Players', {
            'fields': ('player1', 'player2', 'referee')
        }),
        ('Match Details', {
            'fields': ('status', 'match_format', 'is_rated', 'is_admin_refereed')
        }),
        ('Results', {
            'fields': ('winner', 'player1_games_won', 'player2_games_won')
        }),
        ('Context', {
            'fields': ('season', 'tournament', 'challenge')
        }),
        ('Timestamps', {
            'fields': ('scheduled_at', 'started_at', 'completed_at')
        }),
    )


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    """Game admin"""

    list_display = ['match', 'game_number', 'player1_score', 'player2_score', 'winner', 'is_completed']
    list_filter = ['is_completed', 'match__season']
    search_fields = ['match__player1__username', 'match__player2__username']
    ordering = ['match', 'game_number']


@admin.register(MatchEvent)
class MatchEventAdmin(admin.ModelAdmin):
    """Match Event admin"""

    list_display = ['match', 'event_type', 'player', 'player1_score', 'player2_score', 'timestamp']
    list_filter = ['event_type', 'timestamp']
    search_fields = ['match__player1__username', 'match__player2__username', 'player__username']
    date_hierarchy = 'timestamp'
    ordering = ['timestamp']
