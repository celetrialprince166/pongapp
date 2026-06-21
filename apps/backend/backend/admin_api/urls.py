"""
URL Configuration for Admin API
"""

from django.urls import path
from . import views

app_name = 'admin_api'

urlpatterns = [
    path('dashboard/stats/', views.DashboardStatsView.as_view(), name='dashboard-stats'),
    path('dashboard/activity/', views.DashboardActivityView.as_view(), name='dashboard-activity'),
    path('dashboard/quick-actions/', views.DashboardQuickActionsView.as_view(), name='dashboard-quick-actions'),

    # User management
    path('users/<int:pk>/role/', views.UpdateUserRoleView.as_view(), name='admin-user-role'),
    path('users/<int:pk>/deactivate/', views.DeactivateUserView.as_view(), name='admin-user-deactivate'),
    path('users/<int:pk>/reactivate/', views.ReactivateUserView.as_view(), name='admin-user-reactivate'),
    path('users/<int:pk>/reset-password/', views.ResetUserPasswordView.as_view(), name='admin-user-reset-password'),
]
