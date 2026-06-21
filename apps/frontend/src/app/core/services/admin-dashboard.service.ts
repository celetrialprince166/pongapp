import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap, map } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

// ─── Response interfaces ───────────────────────────────────────────────────

export interface DeltaIndicator {
  value: number | null;
  direction: 'up' | 'down' | 'neutral';
}

export interface DashboardStats {
  seasons: {
    total: number;
    active: number;
    upcoming: number;
    archived: number;
  };
  tournaments: {
    total: number;
    upcoming: number;
    registration_open: number;
    in_progress: number;
    completed: number;
  };
  players: {
    total: number;
    active_this_month: number;
  };
  matches: {
    total: number;
    in_progress: number;
    completed_today: number;
    completed_this_month: number;
  };
  registrations: {
    pending: number;
    total_this_month: number;
  };
  deltas: {
    active_players: DeltaIndicator;
    completed_matches: DeltaIndicator;
    registrations: DeltaIndicator;
    tournaments: DeltaIndicator;
  };
}

export interface ActivityItemMetadata {
  object_id: number;
  object_type: 'Season' | 'Tournament' | 'Match' | 'Player';
  url: string | null;
}

export interface ActivityItem {
  id: string;
  type:
    | 'SEASON_CREATED'
    | 'SEASON_STARTED'
    | 'SEASON_ENDED'
    | 'TOURNAMENT_CREATED'
    | 'TOURNAMENT_STARTED'
    | 'TOURNAMENT_COMPLETED'
    | 'MATCH_COMPLETED'
    | 'PLAYER_REGISTERED';
  title: string;
  description: string;
  timestamp: string;
  actor: string;
  metadata: ActivityItemMetadata;
}

export interface ActivityResponse {
  activities: ActivityItem[];
  total: number;
}

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  route: string;
  priority: number;
  badge: number | null;
}

export interface QuickActionsResponse {
  actions: QuickAction[];
}

// ─── Service ──────────────────────────────────────────────────────────────

@Injectable({
  providedIn: 'root'
})
export class AdminDashboardService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = `${environment.apiUrl}/admin`;

  // Signals for reactive state management
  private statsSignal = signal<DashboardStats | null>(null);
  private activitiesSignal = signal<ActivityItem[]>([]);
  private quickActionsSignal = signal<QuickAction[]>([]);
  private loadingSignal = signal<boolean>(false);
  private errorSignal = signal<string | null>(null);

  // Public readonly signals
  readonly stats = this.statsSignal.asReadonly();
  readonly activities = this.activitiesSignal.asReadonly();
  readonly quickActions = this.quickActionsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  constructor() { }

  /**
   * GET /api/admin/dashboard/stats/
   * Returns live aggregated counts across the system.
   */
  getDashboardStats(): Observable<DashboardStats> {
    const headers = this.authHeaders();
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http.get<DashboardStats>(`${this.apiUrl}/dashboard/stats/`, { headers }).pipe(
      tap({
        next: (stats) => {
          this.statsSignal.set(stats);
          this.loadingSignal.set(false);
        },
        error: (error) => {
          console.error('[AdminDashboard] Failed to load stats:', error);
          this.errorSignal.set('Failed to load dashboard statistics. Please try again.');
          this.loadingSignal.set(false);
        }
      })
    );
  }

  /**
   * GET /api/admin/dashboard/activity/?limit=20
   * Returns a unified chronological feed of recent system events.
   */
  getRecentActivity(limit: number = 20): Observable<ActivityResponse> {
    const headers = this.authHeaders();

    return this.http.get<ActivityResponse>(
      `${this.apiUrl}/dashboard/activity/?limit=${limit}`,
      { headers }
    ).pipe(
      tap({
        next: (response) => {
          this.activitiesSignal.set(response?.activities ?? []);
        },
        error: (error) => {
          console.error('[AdminDashboard] Failed to load activity:', error);
        }
      })
    );
  }

  /**
   * GET /api/admin/dashboard/quick-actions/
   * Returns dynamic quick action items based on current system state.
   */
  getQuickActions(): Observable<QuickActionsResponse> {
    const headers = this.authHeaders();

    return this.http.get<QuickActionsResponse>(
      `${this.apiUrl}/dashboard/quick-actions/`,
      { headers }
    ).pipe(
      tap({
        next: (response) => {
          this.quickActionsSignal.set(response?.actions ?? []);
        },
        error: (error) => {
          console.error('[AdminDashboard] Failed to load quick actions:', error);
        }
      })
    );
  }

  /**
   * Refresh both stats and activity feed.
   */
  refreshDashboard(): Observable<any> {
    return new Observable(observer => {
      this.getDashboardStats().subscribe({
        next: () => {
          this.getRecentActivity().subscribe({
            next: () => {
              observer.next(undefined);
              observer.complete();
            },
            error: (err) => observer.error(err)
          });
        },
        error: (err) => observer.error(err)
      });
    });
  }

  /**
   * Reset all signals to initial state.
   */
  clearState(): void {
    this.statsSignal.set(null);
    this.activitiesSignal.set([]);
    this.quickActionsSignal.set([]);
    this.loadingSignal.set(false);
    this.errorSignal.set(null);
  }

  /**
   * Icon for a given activity type.
   */
  getActivityIcon(type: ActivityItem['type']): string {
    const iconMap: Record<ActivityItem['type'], string> = {
      'SEASON_CREATED':       '🗓',
      'SEASON_STARTED':       '🎬',
      'SEASON_ENDED':         '🏁',
      'TOURNAMENT_CREATED':   '🏆',
      'TOURNAMENT_STARTED':   '▶',
      'TOURNAMENT_COMPLETED': '✅',
      'MATCH_COMPLETED':      '🏓',
      'PLAYER_REGISTERED':    '👤',
    };
    return iconMap[type] ?? '📌';
  }

  /**
   * Relative time string from an ISO timestamp.
   */
  getRelativeTime(timestamp: string): string {
    const now = new Date();
    const ts = new Date(timestamp);
    const diffMs = now.getTime() - ts.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1)       return 'Just now';
    if (diffMins < 60)      return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24)     return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7)       return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    return ts.toLocaleDateString();
  }

  // ── private ────────────────────────────────────────────────────────────────

  private authHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({ 'Authorization': `Bearer ${token}` });
  }
}
