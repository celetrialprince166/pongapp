import { Component, inject, computed } from '@angular/core';
import { ActionButtons } from '../../features/dashboard/components/action-buttons/action-buttons';
import { RouterLink } from '@angular/router';
import { RouterLinkActive } from '@angular/router';
import { Award, ChartBarBig, ChartColumnBig, Cylinder, HelpCircle, LayoutDashboard, LogOut, LucideAngularModule, Settings, Shield, Swords, Trophy, User, Calendar, Users, UserCog, PlusCircle } from 'lucide-angular';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, LucideAngularModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css'],
})
export class Sidebar {
  private authService = inject(AuthService);
  readonly titleIcon = Cylinder
  readonly logoutIcon = LogOut

  readonly adminMenuItems = [
    {
      name: 'Dashboard',
      icon: LayoutDashboard,
      link: '/admin-dashboard',
    },
    {
      name: 'Season Management',
      icon: Calendar,
      link: '/admin/season-management',
      exact: false,
    },
    {
      name: 'Tournaments',
      icon: Trophy,
      link: '/admin/tournament-overview',
    },
    {
      name: 'Player Management',
      icon: Users,
      link: '/admin/player-management',
    },
    {
      name: 'User Management',
      icon: UserCog,
      link: '/admin/user-management',
    },
    {
      name: 'Point Allocation',
      icon: Award,
      link: '/admin/point-allocation',
    },
  ];

  readonly playerMenuItems = [
    {
      name: 'Dashboard',
      icon: LayoutDashboard,
      link: '/dashboard',
    },
    {
      name: 'League Standings',
      icon: ChartColumnBig,
      link: '/league-standings'
    },
    {
      name: 'Challenges',
      icon: Swords,
      link: '/challenge-hub'
    },
    {
      name: 'Tournaments',
      icon: Trophy,
      link: '/tournaments'
    },
    {
      name: 'My Profile',
      icon: User,
      // link: '/profile' // Add link when available
    },
  ];

  readonly supportItems = [
    {
      name: 'Settings',
      icon: Settings,
      link: '/settings',
    },
    {
      name: 'Help & Support',
      icon: HelpCircle,
      link: '/help',
    },
  ];

  readonly menuItems = computed(() => {
    const user = this.authService.currentUser();
    return user?.role === 'ADMIN' ? this.adminMenuItems : this.playerMenuItems;
  });

  // Expose current user signal
  readonly currentUser = this.authService.currentUser;

  /**
   * Get user initials for avatar placeholder
   */
  getUserInitials(): string {
    const user = this.currentUser();
    if (!user) return '?';

    const firstInitial = user.first_name?.charAt(0)?.toUpperCase() || '';
    const lastInitial = user.last_name?.charAt(0)?.toUpperCase() || '';

    return firstInitial + lastInitial || user.username?.charAt(0)?.toUpperCase() || '?';
  }

  /**
   * Get formatted role label
   */
  getRoleLabel(role: string | undefined): string {
    if (!role) return 'User';
    const roleLabels: { [key: string]: string } = {
      'ADMIN': 'Administrator',
      'PLAYER': 'Player',
      'MODERATOR': 'Moderator',
      'REFEREE': 'Referee'
    };
    return roleLabels[role] || role;
  }

  logout() {
    this.authService.logout();
  }
}
