from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, PlayerProfile, SuperAdmin, Achievement


class PlayerProfileInline(admin.StackedInline):
    model = PlayerProfile
    can_delete = False
    verbose_name_plural = 'Player Profile'


class SuperAdminInline(admin.StackedInline):
    model = SuperAdmin
    can_delete = False
    verbose_name_plural = 'Super Admin Profile'


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Custom User admin"""
    inlines = (PlayerProfileInline, SuperAdminInline)
    
    list_display = ['username', 'email', 'role', 'is_active', 'date_joined']
    list_filter = ['role', 'is_active', 'is_staff']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering = ['-date_joined']

    fieldsets = BaseUserAdmin.fieldsets + (
        ('Role', {
            'fields': ('role',)
        }),
    )
    
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Role', {
            'fields': ('role',)
        }),
    )


@admin.register(PlayerProfile)
class PlayerProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'current_rating', 'league', 'total_matches', 'wins', 'losses']
    list_filter = ['league', 'is_active_player']
    search_fields = ['user__username', 'user__email']


@admin.register(SuperAdmin)
class SuperAdminAdmin(admin.ModelAdmin):
    list_display = ['user', 'admin_level', 'department']
    list_filter = ['admin_level']
    search_fields = ['user__username']


@admin.register(Achievement)
class AchievementAdmin(admin.ModelAdmin):
    """Achievement admin"""
    list_display = ['user', 'achievement_type', 'earned_date', 'match']
    list_filter = ['achievement_type', 'earned_date']
    search_fields = ['user__username', 'description']
    date_hierarchy = 'earned_date'
    ordering = ['-earned_date']
