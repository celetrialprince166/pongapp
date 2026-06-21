import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap, catchError, of } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import { snakeToCamelObject, camelToSnakeObject } from '../utils/case-transform.util';

/**
 * Player Interface
 * Represents a player with ratings and statistics
 */
export interface Player {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
  eloRating: number;
  league: 'PRO' | 'AMATEUR';
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  winRate: number;
  isActive: boolean;
  role: 'PLAYER' | 'ADMIN' | 'MODERATOR';
  dateJoined: string;
}

/**
 * Player List Response Interface
 */
export interface PlayerListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Player[];
}

/**
 * Player Filters Interface
 */
export interface PlayerFilters {
  search?: string;
  league?: 'all' | 'PRO' | 'AMATEUR';
  page?: number;
  perPage?: number;
}

/**
 * Player Create/Update Request
 */
export interface PlayerRequest {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  league?: 'PRO' | 'AMATEUR';
  role?: 'PLAYER' | 'ADMIN' | 'MODERATOR';
}

/**
 * Player Management Service
 *
 * Provides functionality for managing players in the admin interface.
 * Handles CRUD operations, filtering, and statistics.
 */
@Injectable({
  providedIn: 'root'
})
export class PlayerManagementService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = environment.apiUrl ? `${environment.apiUrl}/users` : `${environment.apiUrl}/users`;

  // Signal-based state management
  private playersSignal = signal<Player[]>([]);
  private loadingSignal = signal<boolean>(false);
  private errorSignal = signal<string | null>(null);
  private totalCountSignal = signal<number>(0);
  private filtersSignal = signal<PlayerFilters>({ league: 'all', page: 1, perPage: 10 });

  // Read-only signals exposed to components
  readonly players = this.playersSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly totalCount = this.totalCountSignal.asReadonly();
  readonly filters = this.filtersSignal.asReadonly();

  /**
   * Load players with filtering and pagination
   */
  loadPlayers(filters?: PlayerFilters): Observable<PlayerListResponse> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    const currentFilters = { ...this.filtersSignal(), ...filters };
    this.filtersSignal.set(currentFilters);

    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    let params = new HttpParams();
    if (currentFilters.search) {
      params = params.set('search', currentFilters.search);
    }
    if (currentFilters.league && currentFilters.league !== 'all') {
      params = params.set('league', currentFilters.league);
    }
    if (currentFilters.page) {
      params = params.set('page', currentFilters.page.toString());
    }
    if (currentFilters.perPage) {
      params = params.set('per_page', currentFilters.perPage.toString());
    }

    return this.http.get<any>(`${this.apiUrl}/`, { headers, params }).pipe(
      map(response => {
        // Transform snake_case to camelCase
        const results = response.results ? response.results.map((item: any) =>
          this.transformPlayer(snakeToCamelObject(item))
        ) : [];
        return {
          count: response.count || 0,
          next: response.next,
          previous: response.previous,
          results
        };
      }),
      tap(response => {
        this.playersSignal.set(response.results);
        this.totalCountSignal.set(response.count);
        this.loadingSignal.set(false);
      }),
      catchError(error => {
        console.error('Error loading players:', error);
        this.errorSignal.set('Failed to load players');
        this.loadingSignal.set(false);
        return of({ count: 0, next: null, previous: null, results: [] });
      })
    );
  }

  /**
   * Transform player data from API response
   */
  private transformPlayer(player: any): Player {
    return {
      ...player,
      eloRating: player.eloRating || player.rating || 1500,
      matchesPlayed: player.matchesPlayed || 0,
      matchesWon: player.matchesWon || 0,
      matchesLost: player.matchesLost || 0,
      winRate: player.winRate || 0,
      league: player.league || 'AMATEUR',
      isActive: player.isActive !== false,
      role: player.role || 'PLAYER'
    };
  }

  /**
   * Get player by ID
   */
  getPlayer(id: number): Observable<Player> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get<any>(`${this.apiUrl}/${id}/`, { headers }).pipe(
      map(response => this.transformPlayer(snakeToCamelObject(response)))
    );
  }

  /**
   * Create new player (admin only)
   */
  createPlayer(data: PlayerRequest): Observable<Player> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const payload = camelToSnakeObject(data);

    return this.http.post<any>(`${this.apiUrl}/`, payload, { headers }).pipe(
      map(response => this.transformPlayer(snakeToCamelObject(response))),
      tap(newPlayer => {
        const current = this.playersSignal();
        this.playersSignal.set([newPlayer, ...current]);
        this.totalCountSignal.set(this.totalCountSignal() + 1);
      }),
      catchError(error => {
        console.error('Error creating player:', error);
        this.errorSignal.set('Failed to create player');
        throw error;
      })
    );
  }

  /**
   * Update player (admin only)
   */
  updatePlayer(id: number, data: Partial<PlayerRequest>): Observable<Player> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const payload = camelToSnakeObject(data);

    return this.http.put<any>(`${this.apiUrl}/${id}/`, payload, { headers }).pipe(
      map(response => this.transformPlayer(snakeToCamelObject(response))),
      tap(updated => {
        const current = this.playersSignal();
        const index = current.findIndex(p => p.id === id);
        if (index !== -1) {
          const newList = [...current];
          newList[index] = updated;
          this.playersSignal.set(newList);
        }
      })
    );
  }

  /**
   * Delete player (admin only)
   */
  deletePlayer(id: number): Observable<void> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.delete<void>(`${this.apiUrl}/${id}/`, { headers }).pipe(
      tap(() => {
        const current = this.playersSignal();
        this.playersSignal.set(current.filter(p => p.id !== id));
        this.totalCountSignal.set(this.totalCountSignal() - 1);
      }),
      catchError(error => {
        console.error('Error deleting player:', error);
        this.errorSignal.set('Failed to delete player');
        throw error;
      })
    );
  }

  /**
   * Update filters and reload
   */
  updateFilters(filters: Partial<PlayerFilters>): void {
    this.loadPlayers(filters).subscribe();
  }

  /**
   * Clear error
   */
  clearError(): void {
    this.errorSignal.set(null);
  }

  /**
   * Get league badge class
   */
  getLeagueBadgeClass(league: string): string {
    return league === 'PRO' ? 'league-badge league-pro' : 'league-badge league-amateur';
  }

  /**
   * Get league label
   */
  getLeagueLabel(league: string): string {
    return league === 'PRO' ? 'PRO' : 'Amateur';
  }

  /**
   * Format win rate as percentage
   */
  formatWinRate(winRate: number): string {
    return `${(winRate * 100).toFixed(1)}%`;
  }
}
