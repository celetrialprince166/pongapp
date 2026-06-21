import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Season Management Service
 *
 * Provides API communication for admin season management features.
 * Handles CRUD operations for seasons with admin permissions.
 */

export interface Season {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_ongoing?: boolean;
  days_remaining?: number;
  player_count?: number;
  status: 'active' | 'upcoming' | 'archived';
  ended_at?: string;
  ended_by?: number;
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_by?: number | null;
  // Season metadata
  format?: string;
  region?: string;
  prize_pool?: string;
  ruleset?: string;
  lead_organizer?: string;
  player_cap?: number | null;
  // Computed fields
  matches_played?: number;
  tournament_count?: number;
  max_challenges_per_player?: number | null;
}

export interface SeasonListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Season[];
}

export interface SeasonFilters {
  status?: 'all' | 'active' | 'upcoming' | 'archived';
  search?: string;
  page?: number;
  per_page?: number;
  include_deleted?: boolean;
}

export interface SeasonCreateRequest {
  name: string;
  start_date: string;  // ISO date
  duration_days: number;  // Duration in days (backend calculates end_date from this)
  max_challenges_per_player?: number;  // Optional (defaults to 4)
  is_active?: boolean;
}

export interface SeasonStanding {
  id: number;
  user: number;
  user_username: string;
  user_avatar: string | null;
  season: number;
  league: string;
  rank: number;
  rating: number;
  rating_change: number;
  matches_played: number;
  wins: number;
  losses: number;
  win_rate: number;
}

export interface SeasonEndResponse {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  ended_at: string;
  ended_by: number;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class SeasonManagementService {
  private readonly API_URL = `${environment.apiUrl}/ratings/seasons`;

  // Signals for reactive state management
  private seasonsSignal = signal<Season[]>([]);
  private loadingSignal = signal<boolean>(false);
  private errorSignal = signal<string | null>(null);
  private totalCountSignal = signal<number>(0);
  private filtersSignal = signal<SeasonFilters>({ status: 'all', page: 1, per_page: 10 });

  // Read-only signals exposed to components
  readonly seasons = this.seasonsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly totalCount = this.totalCountSignal.asReadonly();
  readonly filters = this.filtersSignal.asReadonly();

  constructor(private http: HttpClient) {}

  /**
   * Load seasons with optional filtering
   */
  loadSeasons(filters?: SeasonFilters): Observable<SeasonListResponse> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    // Merge filters
    const currentFilters = { ...this.filtersSignal(), ...filters };
    this.filtersSignal.set(currentFilters);

    // Build query params
    let params = new HttpParams();
    if (currentFilters.search) {
      params = params.set('search', currentFilters.search);
    }
    if (currentFilters.status && currentFilters.status !== 'all') {
      params = params.set('status', currentFilters.status);
    }
    if (currentFilters.page) {
      params = params.set('page', currentFilters.page.toString());
    }
    if (currentFilters.per_page) {
      params = params.set('per_page', currentFilters.per_page.toString());
    }
    if (currentFilters.include_deleted) {
      params = params.set('include_deleted', 'true');
    }

    return this.http.get<SeasonListResponse>(this.API_URL + '/', { params }).pipe(
      tap(response => {
        this.seasonsSignal.set(response.results);
        this.totalCountSignal.set(response.count);
        this.loadingSignal.set(false);
      }),
      catchError(error => {
        console.error('Error loading seasons:', error);
        this.errorSignal.set('Failed to load seasons. Please try again.');
        this.loadingSignal.set(false);
        return of({ count: 0, next: null, previous: null, results: [] });
      })
    );
  }

  /**
   * Get a single season by ID
   */
  getSeason(id: number): Observable<Season> {
    return this.http.get<Season>(`${this.API_URL}/${id}/`).pipe(
      catchError(error => {
        console.error('Error fetching season:', error);
        this.errorSignal.set('Failed to load season details.');
        throw error;
      })
    );
  }

  /**
   * Create a new season (admin only)
   */
  createSeason(seasonData: SeasonCreateRequest): Observable<Season> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http.post<Season>(this.API_URL + '/', seasonData).pipe(
      tap(newSeason => {
        // Add to existing list
        const currentSeasons = this.seasonsSignal();
        this.seasonsSignal.set([newSeason, ...currentSeasons]);
        this.totalCountSignal.set(this.totalCountSignal() + 1);
        this.loadingSignal.set(false);
      }),
      catchError(error => {
        console.error('Error creating season:', error);
        this.errorSignal.set(error.error?.message || 'Failed to create season.');
        this.loadingSignal.set(false);
        throw error;
      })
    );
  }

  /**
   * Update an existing season (admin only)
   */
  updateSeason(id: number, seasonData: Partial<SeasonCreateRequest>): Observable<Season> {
    return this.http.patch<Season>(`${this.API_URL}/${id}/`, seasonData).pipe(
      tap(updatedSeason => {
        // Update in list
        const currentSeasons = this.seasonsSignal();
        const index = currentSeasons.findIndex(s => s.id === id);
        if (index !== -1) {
          const updated = [...currentSeasons];
          updated[index] = updatedSeason;
          this.seasonsSignal.set(updated);
        }
      }),
      catchError(error => {
        console.error('Error updating season:', error);
        this.errorSignal.set('Failed to update season.');
        throw error;
      })
    );
  }

  /**
   * End an active season (admin only)
   * API endpoint: POST /api/ratings/seasons/{id}/end/
   */
  endSeason(id: number): Observable<SeasonEndResponse> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http.post<SeasonEndResponse>(`${this.API_URL}/${id}/end/`, {}).pipe(
      tap(response => {
        // Update season in list
        const currentSeasons = this.seasonsSignal();
        const index = currentSeasons.findIndex(s => s.id === id);
        if (index !== -1) {
          const updated = [...currentSeasons];
          updated[index] = {
            ...updated[index],
            is_active: false,
            status: 'archived'
          };
          this.seasonsSignal.set(updated);
        }
        this.loadingSignal.set(false);
      }),
      catchError(error => {
        console.error('Error ending season:', error);
        this.errorSignal.set(error.error?.error || 'Failed to end season.');
        this.loadingSignal.set(false);
        throw error;
      })
    );
  }

  /**
   * Archive a season (admin only)
   * This is an alias for endSeason since they perform the same action
   */
  archiveSeason(id: number): Observable<SeasonEndResponse> {
    return this.endSeason(id);
  }

  /**
   * Soft-delete a season (admin only)
   * POST /api/ratings/seasons/{id}/delete/
   */
  softDeleteSeason(id: number): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/${id}/delete/`, {}).pipe(
      catchError(error => {
        throw error;
      })
    );
  }

  /**
   * Restore a soft-deleted season (admin only)
   * POST /api/ratings/seasons/{id}/restore/
   */
  restoreSeason(id: number): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/${id}/restore/`, {}).pipe(
      catchError(error => {
        throw error;
      })
    );
  }

  /**
   * Get all soft-deleted seasons (admin only)
   * GET /api/ratings/seasons/deleted/
   */
  getDeletedSeasons(): Observable<Season[]> {
    return this.http.get<Season[]>(`${this.API_URL}/deleted/`).pipe(
      catchError(error => {
        console.error('Error fetching deleted seasons:', error);
        throw error;
      })
    );
  }

  /**
   * Get the currently active season
   */
  getActiveSeason(): Observable<Season> {
    return this.http.get<Season>(`${this.API_URL}/active/`).pipe(
      catchError(error => {
        console.error('Error fetching active season:', error);
        throw error;
      })
    );
  }

  /**
   * Trigger full ELO recalculation from match history (admin only)
   * POST /api/ratings/seasons/{id}/recalculate-elo/
   */
  recalculateElo(seasonId: number): Observable<{ matches_processed: number; players_affected: number }> {
    return this.http.post<{ matches_processed: number; players_affected: number }>(
      `${this.API_URL}/${seasonId}/recalculate-elo/`,
      {}
    ).pipe(
      catchError(error => {
        console.error('Error recalculating ELO:', error);
        throw error;
      })
    );
  }

  /**
   * Get standings for a season
   * GET /api/ratings/standings/?season_id={id}
   */
  getStandings(seasonId: number): Observable<SeasonStanding[]> {
    const standingsUrl = `${environment.apiUrl}/ratings/standings/`;
    return this.http.get<any>(`${standingsUrl}?season_id=${seasonId}`).pipe(
      catchError(error => {
        console.error('Error fetching standings:', error);
        throw error;
      })
    );
  }

  /**
   * Update filters and reload seasons
   */
  updateFilters(filters: Partial<SeasonFilters>): void {
    this.loadSeasons(filters).subscribe();
  }

  /**
   * Reset filters to defaults
   */
  resetFilters(): void {
    this.filtersSignal.set({ status: 'all', page: 1, per_page: 10 });
    this.loadSeasons().subscribe();
  }

  /**
   * Clear error message
   */
  clearError(): void {
    this.errorSignal.set(null);
  }

  /**
   * Update seasons in the signal (used for computed status)
   */
  updateSeasons(seasons: Season[]): void {
    this.seasonsSignal.set(seasons);
  }

  /**
   * Calculate season status from dates and active state
   *
   * Rules:
   * - If season has ended_at (was explicitly archived) → archived
   * - If season is_active and dates include today → active
   * - If season is_active and dates are in future → upcoming
   * - If season is_active and dates have passed → archived (auto-archive)
   * - If season is not active but not explicitly archived → upcoming (can be reactivated)
   */
  calculateSeasonStatus(season: Season): 'active' | 'upcoming' | 'archived' {
    // Explicitly archived seasons (via archive button) are permanently archived
    if (season.ended_at) {
      return 'archived';
    }

    const now = new Date();
    const startDate = new Date(season.start_date);
    const endDate = new Date(season.end_date);

    // Active seasons
    if (season.is_active) {
      if (now >= startDate && now <= endDate) {
        return 'active';
      } else if (now < startDate) {
        return 'upcoming';
      } else {
        // Past end date, auto-archive
        return 'archived';
      }
    }

    // Inactive but not explicitly archived - can be reactivated
    // Show as upcoming if dates are valid
    if (endDate > now) {
      return 'upcoming';
    } else {
      // Past dates and inactive - archived
      return 'archived';
    }
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}
