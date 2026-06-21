from django.contrib import admin
from .models import Challenge, ChallengeHistory


@admin.register(Challenge)
class ChallengeAdmin(admin.ModelAdmin):
    """Challenge admin"""

    list_display = ['challenger', 'challenged', 'status', 'is_forced', 'time_remaining', 'season', 'created_at']
    list_filter = ['status', 'is_forced', 'season', 'created_at']
    search_fields = ['challenger__username', 'challenged__username']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']

    fieldsets = (
        ('Players', {
            'fields': ('challenger', 'challenged', 'message')
        }),
        ('Status', {
            'fields': ('status', 'is_forced')
        }),
        ('Context', {
            'fields': ('season',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'expires_at', 'responded_at')
        }),
    )

    readonly_fields = ['created_at']


@admin.register(ChallengeHistory)
class ChallengeHistoryAdmin(admin.ModelAdmin):
    """Challenge History admin"""

    list_display = ['user', 'season', 'challenges_sent', 'challenges_received', 'challenges_accepted', 'challenges_declined', 'challenges_won', 'challenges_lost']
    list_filter = ['season']
    search_fields = ['user__username']
    ordering = ['season', 'user']
