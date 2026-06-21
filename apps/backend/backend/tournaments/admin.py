from django.contrib import admin
from .models import (
    Tournament, TournamentParticipant, TournamentRound,
    TournamentBracket, TournamentGroup, TournamentGroupStanding,
    AwardTier, PlayerAward
)


class TournamentParticipantInline(admin.TabularInline):
    """Inline admin for tournament participants"""
    model = TournamentParticipant
    extra = 0
    readonly_fields = ['registered_at', 'confirmed_at']


@admin.register(Tournament)
class TournamentAdmin(admin.ModelAdmin):
    """Tournament admin"""

    list_display = ['name', 'tournament_format', 'status', 'is_rated', 'participant_count', 'max_participants', 'start_date', 'organizer']
    list_filter = ['status', 'tournament_format', 'is_rated', 'season']
    search_fields = ['name', 'description', 'organizer__username']
    date_hierarchy = 'start_date'
    ordering = ['-start_date']

    inlines = [TournamentParticipantInline]

    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'description', 'tournament_format', 'status', 'organizer')
        }),
        ('Registration', {
            'fields': ('max_participants', 'min_participants', 'registration_deadline')
        }),
        ('Tournament Details', {
            'fields': ('is_rated', 'season', 'start_date', 'end_date')
        }),
        ('Awards', {
            'fields': ('prize_label', 'awards_distributed')
        }),
    )


@admin.register(TournamentParticipant)
class TournamentParticipantAdmin(admin.ModelAdmin):
    """Tournament Participant admin"""

    list_display = ['player', 'tournament', 'status', 'seed', 'final_rank', 'registered_at']
    list_filter = ['status', 'tournament']
    search_fields = ['player__username', 'tournament__name']
    ordering = ['tournament', 'seed']


@admin.register(TournamentRound)
class TournamentRoundAdmin(admin.ModelAdmin):
    """Tournament Round admin"""

    list_display = ['tournament', 'round_number', 'name', 'is_completed', 'started_at']
    list_filter = ['is_completed', 'tournament']
    search_fields = ['tournament__name', 'name']
    ordering = ['tournament', 'round_number']


@admin.register(TournamentBracket)
class TournamentBracketAdmin(admin.ModelAdmin):
    """Tournament Bracket admin"""

    list_display = ['tournament', 'round', 'bracket_position', 'player1', 'player2', 'match']
    list_filter = ['tournament', 'round']
    search_fields = ['tournament__name', 'player1__username', 'player2__username']
    ordering = ['tournament', 'round', 'bracket_position']


@admin.register(TournamentGroup)
class TournamentGroupAdmin(admin.ModelAdmin):
    """Tournament Group admin"""

    list_display = ['name', 'tournament']
    list_filter = ['tournament']
    search_fields = ['name', 'tournament__name']
    ordering = ['tournament', 'name']


@admin.register(TournamentGroupStanding)
class TournamentGroupStandingAdmin(admin.ModelAdmin):
    """Tournament Group Standing admin"""

    list_display = ['player', 'group', 'points', 'wins', 'losses', 'matches_played']
    list_filter = ['group__tournament', 'group']
    search_fields = ['player__username', 'group__name']
    ordering = ['group', '-points', '-wins']


@admin.register(AwardTier)
class AwardTierAdmin(admin.ModelAdmin):
    """Award Tier admin"""

    list_display = ['tournament', 'tier_type', 'position', 'user', 'points', 'label']
    list_filter = ['tier_type', 'tournament']
    search_fields = ['tournament__name', 'user__username', 'label']
    ordering = ['tournament', 'tier_type', 'position']


@admin.register(PlayerAward)
class PlayerAwardAdmin(admin.ModelAdmin):
    """Player Award admin"""

    list_display = ['player', 'tournament', 'award_tier', 'points_awarded', 'awarded_at']
    list_filter = ['tournament']
    search_fields = ['player__username', 'tournament__name']
    ordering = ['-awarded_at']
    readonly_fields = ['awarded_at']
