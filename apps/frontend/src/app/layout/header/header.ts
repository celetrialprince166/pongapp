import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter, type Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

interface PageInfo {
  title: string;
  subtitle: string;
}

const PAGE_MAP: { pattern: RegExp; info: PageInfo }[] = [
  { pattern: /^\/admin\/tournament-overview/, info: { title: 'Tournament Management', subtitle: 'Manage and oversee all tournaments' } },
  { pattern: /^\/admin\/tournaments\/create/, info: { title: 'Create Tournament', subtitle: 'Set up a new tournament' } },
  { pattern: /^\/admin\/tournaments\/\d+\/edit/, info: { title: 'Edit Tournament', subtitle: 'Update tournament details' } },
  { pattern: /^\/admin\/tournaments\/\d+/, info: { title: 'Tournament Details', subtitle: 'View and manage tournament' } },
  { pattern: /^\/admin\/player-management/, info: { title: 'Player Management', subtitle: 'Manage registered players' } },
  { pattern: /^\/admin\/user-management/, info: { title: 'User Management', subtitle: 'Manage system users' } },
  { pattern: /^\/admin\/point-allocation/, info: { title: 'Point Allocation', subtitle: 'Configure point rules and rewards' } },
  { pattern: /^\/admin-dashboard/, info: { title: 'Dashboard', subtitle: 'Overview of system activity' } },
  { pattern: /^\/tournaments\/\d+/, info: { title: 'Tournament Details', subtitle: 'View tournament information' } },
  { pattern: /^\/tournaments/, info: { title: 'Tournaments', subtitle: 'Find and join upcoming leagues and events' } },
  { pattern: /^\/dashboard/, info: { title: 'Dashboard', subtitle: 'Welcome back' } },
  { pattern: /^\/league-standings/, info: { title: 'League Standings', subtitle: 'Current rankings and standings' } },
  { pattern: /^\/challenge-hub/, info: { title: 'Challenge Hub', subtitle: 'Challenge other players' } },
];

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.html',
  styleUrls: ['./header.css'],
})
export class Header implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);

  readonly currentUser = this.authService.currentUser;

  pageInfo = signal<PageInfo>({ title: 'Dashboard', subtitle: '' });

  private routerSub?: Subscription;

  ngOnInit() {
    this.resolvePageInfo(this.router.url);
    this.routerSub = this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe(e => {
      this.resolvePageInfo(e.urlAfterRedirects);
    });
  }

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
  }

  private resolvePageInfo(url: string) {
    for (const { pattern, info } of PAGE_MAP) {
      if (pattern.test(url)) {
        this.pageInfo.set(info);
        return;
      }
    }
    this.pageInfo.set({ title: 'PingMaster', subtitle: '' });
  }

  getUserDisplayName(): string {
    const user = this.currentUser();
    if (!user) return '';
    const full = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    const raw = full || user.username || '';
    return raw.replace(/\b\w/g, c => c.toUpperCase());
  }

  getUserInitials(): string {
    const user = this.currentUser();
    if (!user) return '?';
    const display = this.getUserDisplayName();
    const parts = display.split(' ');
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return display.charAt(0).toUpperCase() || '?';
  }

  getRankLabel(): string {
    const user = this.currentUser();
    if (!user) return '';
    if (user.league) return user.league;
    const roleLabels: { [key: string]: string } = {
      'ADMIN': 'Admin',
      'PLAYER': 'Player',
      'MODERATOR': 'Moderator',
      'REFEREE': 'Referee',
    };
    return roleLabels[user.role || ''] || 'Member';
  }
}
