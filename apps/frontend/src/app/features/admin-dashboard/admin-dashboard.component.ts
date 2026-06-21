import {
  Component, OnInit, signal, inject, computed, DestroyRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin, interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AdminDashboardService, DashboardStats, ActivityItem, QuickAction, DeltaIndicator
} from '../../core/services/admin-dashboard.service';
import { AuthService } from '../../core/services/auth.service';
import { DeltaBadgeComponent } from '../../shared/components/delta-badge/delta-badge.component';
import {
  LucideAngularModule,
  Calendar, Plus, Trophy, Flag, Zap, UserPlus,
  ChevronRight, Clock, CheckCircle, AlertTriangle
} from 'lucide-angular';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, DeltaBadgeComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboard implements OnInit {
  private dashboardService = inject(AdminDashboardService);
  private authService = inject(AuthService);
  readonly router = inject(Router);
  private destroyRef = inject(DestroyRef);

  // Local signals
  stats = signal<DashboardStats | null>(null);
  activities = signal<ActivityItem[]>([]);
  quickActions = signal<QuickAction[]>([]);
  isLoading = signal(true);
  hasError = signal(false);
  lastUpdated = signal<string>('Just now');

  // Computed values
  adminName = computed(() => this.authService.currentUser()?.username ?? 'Admin');
  currentDate = computed(() => new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }));
  maxTournamentValue = computed(() => {
    const s = this.stats();
    if (!s) return 1;
    return Math.max(
      s.tournaments.upcoming,
      s.tournaments.registration_open,
      s.tournaments.in_progress,
      s.tournaments.completed,
      1
    );
  });

  // Lucide icons
  readonly Calendar = Calendar;
  readonly Plus = Plus;
  readonly Trophy = Trophy;
  readonly Flag = Flag;
  readonly Zap = Zap;
  readonly UserPlus = UserPlus;
  readonly ChevronRight = ChevronRight;
  readonly Clock = Clock;
  readonly CheckCircle = CheckCircle;
  readonly AlertTriangle = AlertTriangle;

  readonly skeletonItems = [1, 2, 3, 4];

  ngOnInit(): void {
    this.loadAll();
    this.setupAutoRefresh();
  }

  private loadAll(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    forkJoin({
      stats: this.dashboardService.getDashboardStats(),
      activity: this.dashboardService.getRecentActivity(10),
      actions: this.dashboardService.getQuickActions()
    }).subscribe({
      next: ({ stats, activity, actions }) => {
        this.stats.set(stats);
        this.activities.set(activity?.activities ?? []);
        this.quickActions.set(actions?.actions ?? []);
        this.isLoading.set(false);
        this.lastUpdated.set(new Date().toLocaleTimeString());
      },
      error: () => {
        this.hasError.set(true);
        this.isLoading.set(false);
      }
    });
  }

  private setupAutoRefresh(): void {
    interval(60000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.dashboardService.getDashboardStats().subscribe(s => this.stats.set(s));
      this.dashboardService.getQuickActions().subscribe(r => this.quickActions.set(r.actions));
    });

    interval(30000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.dashboardService.getRecentActivity(10).subscribe(r => this.activities.set(r.activities));
    });
  }

  onRefresh(): void {
    this.loadAll();
  }

  getBarWidth(value: number): number {
    const max = this.maxTournamentValue();
    if (max === 0) return 0;
    return (value / max) * 100;
  }

  getActivityIconType(type: ActivityItem['type']): 'trophy' | 'flag' | 'zap' | 'user-plus' {
    if (type.startsWith('SEASON')) return 'trophy';
    if (type.startsWith('TOURNAMENT')) return 'flag';
    if (type.startsWith('MATCH')) return 'zap';
    return 'user-plus';
  }

  getActivityIconClass(type: ActivityItem['type']): string {
    if (type.startsWith('SEASON')) return 'blue';
    if (type.startsWith('TOURNAMENT')) return 'purple';
    if (type.startsWith('MATCH')) return 'green';
    return 'orange';
  }

  getPriorityClass(priority: number): string {
    if (priority === 1) return 'red';
    if (priority === 2) return 'orange';
    if (priority === 3) return 'blue';
    return 'gray';
  }

  getRelativeTime(ts: string): string {
    return this.dashboardService.getRelativeTime(ts);
  }

  safeDelta(d?: DeltaIndicator): DeltaIndicator {
    return d ?? { value: null, direction: 'neutral' };
  }
}
