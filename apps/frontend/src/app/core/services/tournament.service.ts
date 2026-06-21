import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap, catchError, of, forkJoin } from 'rxjs';
import { AuthService } from './auth.service';
import { Tournament, TournamentParticipant, TournamentMatch, GroupData } from '../models/tournament.model';
import { environment } from '../../../environments/environment';

export interface TournamentListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Tournament[];
}

export interface RoundFormat {
  round_number: number;
  round_name: string;
  match_format: 'BEST_OF_3' | 'BEST_OF_5' | 'BEST_OF_7' | 'RACE_TO_5' | 'RACE_TO_11' | 'RACE_TO_21';
}

export interface TournamentFilters {
  status?: 'upcoming' | 'past' | 'all';
  league?: 'AMATEUR' | 'PRO';
  search?: string;
  page?: number;
  per_page?: number;
}

@Injectable({
  providedIn: 'root'
})
export class TournamentService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = environment.apiUrl ? `${environment.apiUrl}/tournaments` : `${environment.apiUrl}/tournaments`;

  // Signal-based state management for admin views
  private tournamentsSignal = signal<Tournament[]>([]);
  private loadingSignal = signal<boolean>(false);
  private errorSignal = signal<string | null>(null);
  private totalCountSignal = signal<number>(0);
  private filtersSignal = signal<TournamentFilters>({ status: 'all' });

  // Read-only signals exposed to components
  readonly tournaments = this.tournamentsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly totalCount = this.totalCountSignal.asReadonly();
  readonly filters = this.filtersSignal.asReadonly();

  constructor() { }

  /**
   * Get all tournaments with optional status filtering
   * @param status Optional filter by tournament status
   * @returns Observable of tournament array
   */
  getTournaments(status?: 'UPCOMING' | 'REGISTRATION' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'): Observable<Tournament[]> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    let url = `${this.apiUrl}/`;
    if (status) {
      url += `?status=${status}`;
    }

    return this.http.get<any>(url, { headers }).pipe(
      map((response) => {
        // Handle paginated response
        if (response && response.results) {
          return response.results;
        }
        // Handle array response
        return Array.isArray(response) ? response : [];
      })
    );
  }

  /**
   * Get tournament by ID
   * @param tournamentId Tournament ID
   * @returns Observable of tournament
   */
  getTournamentById(tournamentId: number): Observable<Tournament> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get<Tournament>(`${this.apiUrl}/${tournamentId}/`, { headers });
  }

  /**
   * Register for a tournament
   * @param tournamentId Tournament ID
   * @returns Observable of registration confirmation
   */
  registerForTournament(tournamentId: number): Observable<any> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.post(
      `${this.apiUrl}/${tournamentId}/register/`,
      {},
      { headers }
    );
  }

  /**
   * Get tournament participants
   * @param tournamentId Tournament ID
   * @returns Observable of participants array
   */
  getTournamentParticipants(tournamentId: number): Observable<TournamentParticipant[]> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get<any>(
      `${this.apiUrl}/${tournamentId}/participants/`,
      { headers }
    ).pipe(
      map(res => Array.isArray(res) ? res : (res?.results ?? []))
    );
  }

  /**
   * Get tournament bracket
   * @param tournamentId Tournament ID
   * @returns Observable of bracket data
   */
  getTournamentBracket(tournamentId: number): Observable<TournamentMatch[]> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    return this.http.get<any>(`${this.apiUrl}/${tournamentId}/bracket/`, { headers }).pipe(
      map((res: any) => {
        if (!res || !Array.isArray(res.rounds)) return [];
        const flat: TournamentMatch[] = [];
        for (const roundData of res.rounds) {
          const roundNumber: number = roundData.round?.round_number ?? 0;
          for (const bracket of (roundData.brackets ?? [])) {
            const m = bracket.match;
            flat.push({
              id: bracket.id,
              tournament: res.tournament_id,
              match: m?.id ?? 0,
              round: roundNumber,
              match_number: bracket.bracket_position ?? 0,
              player1: bracket.player1 ?? null,
              player2: bracket.player2 ?? null,
              winner: bracket.winner ?? (m?.winner ?? null),
              is_bye: !bracket.player1 || !bracket.player2,
              created_at: m?.created_at ?? '',
              completed_at: m?.completed_at ?? null,
              player1_name: bracket.player1_username ?? undefined,
              player2_name: bracket.player2_username ?? undefined,
              player1_score: m?.player1_games_won ?? undefined,
              player2_score: m?.player2_games_won ?? undefined,
              status: m?.status === 'IN_PROGRESS' ? 'live'
                    : m?.status === 'COMPLETED'   ? 'completed'
                    : 'pending',
              winner_advances_to: bracket.winner_advances_to ?? null,
            });
          }
        }
        return flat;
      })
    );
  }

  getGroupStandings(tournamentId: number): Observable<GroupData[]> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    return this.http.get<any>(`${this.apiUrl}/${tournamentId}/standings/`, { headers }).pipe(
      map((res: any) => res?.groups ?? [])
    );
  }

  /**
   * Start a tournament (admin only)
   * @param tournamentId Tournament ID
   * @returns Observable of started tournament
   */
  startTournament(tournamentId: number): Observable<Tournament> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.post<Tournament>(
      `${this.apiUrl}/${tournamentId}/start/`,
      {},
      { headers }
    );
  }

  /**
   * Complete a tournament (admin only)
   * @param tournamentId Tournament ID
   * @returns Observable of completed tournament
   */
  completeTournament(tournamentId: number): Observable<Tournament> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.post<Tournament>(
      `${this.apiUrl}/${tournamentId}/complete/`,
      {},
      { headers }
    );
  }

  /**
   * Load tournaments with filtering and pagination (for admin views)
   */
  loadTournaments(filters?: TournamentFilters): Observable<TournamentListResponse> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    const currentFilters = { ...this.filtersSignal(), ...filters };
    this.filtersSignal.set(currentFilters);

    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    // Handle 'upcoming' filter with multiple statuses
    // Backend doesn't support comma-separated statuses, so we fetch separately and merge
    if (currentFilters.status === 'upcoming') {
      return this.loadMultipleStatuses(['UPCOMING', 'REGISTRATION'], currentFilters, headers);
    }

    // Single status filters use normal endpoint
    let params = new HttpParams();
    if (currentFilters.search) {
      params = params.set('search', currentFilters.search);
    }
    if (currentFilters.status && currentFilters.status !== 'all') {
      if (currentFilters.status === 'past') {
        params = params.set('status', 'COMPLETED');
      }
    }
    if (currentFilters.league) {
      params = params.set('league', currentFilters.league);
    }
    if (currentFilters.page) {
      params = params.set('page', currentFilters.page.toString());
    }
    if (currentFilters.per_page) {
      params = params.set('per_page', currentFilters.per_page.toString());
    }

    return this.http.get<TournamentListResponse>(`${this.apiUrl}/`, { headers, params }).pipe(
      tap(response => {
        this.tournamentsSignal.set(response.results);
        this.totalCountSignal.set(response.count);
        this.loadingSignal.set(false);
      }),
      catchError(error => {
        console.error('Error loading tournaments:', error);
        this.errorSignal.set('Failed to load tournaments');
        this.loadingSignal.set(false);
        return of({ count: 0, next: null, previous: null, results: [] });
      })
    );
  }

  /**
   * Load tournaments with multiple statuses (backend doesn't support comma-separated)
   * Makes separate requests and merges results
   */
  private loadMultipleStatuses(
    statuses: string[],
    filters: TournamentFilters,
    headers: HttpHeaders
  ): Observable<TournamentListResponse> {
    // Create a request for each status
    const requests = statuses.map(status => {
      let params = new HttpParams();
      if (filters.search) {
        params = params.set('search', filters.search);
      }
      params = params.set('status', status);
      if (filters.page) {
        params = params.set('page', filters.page.toString());
      }
      if (filters.per_page) {
        params = params.set('per_page', filters.per_page.toString());
      }

      return this.http.get<TournamentListResponse>(`${this.apiUrl}/`, { headers, params });
    });

    // Execute all requests in parallel and merge results
    return forkJoin(requests).pipe(
      map(responses => {
        // Merge all results
        const allResults = responses.flatMap(r => r.results || []);
        const totalCount = responses.reduce((sum, r) => sum + (r.count || 0), 0);

        // Sort by start_date descending
        allResults.sort((a, b) =>
          new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
        );

        return {
          count: totalCount,
          next: null,
          previous: null,
          results: allResults
        };
      }),
      tap(response => {
        this.tournamentsSignal.set(response.results);
        this.totalCountSignal.set(response.count);
        this.loadingSignal.set(false);
      }),
      catchError(error => {
        console.error('Error loading tournaments:', error);
        this.errorSignal.set('Failed to load tournaments');
        this.loadingSignal.set(false);
        return of({ count: 0, next: null, previous: null, results: [] });
      })
    );
  }

  /**
   * Preview default round formats for a tournament format + player count.
   * No tournament ID needed — purely computational on the backend.
   */
  previewRoundFormats(tournamentFormat: string, maxPlayers: number): Observable<RoundFormat[]> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    return this.http.get<RoundFormat[]>(
      `${this.apiUrl}/round-formats/preview/`,
      { headers, params: { tournament_format: tournamentFormat, max_players: maxPlayers.toString() } }
    );
  }

  /**
   * Save round format configs for an existing tournament (admin only).
   */
  saveRoundFormats(tournamentId: number, formats: RoundFormat[]): Observable<RoundFormat[]> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    return this.http.put<RoundFormat[]>(
      `${this.apiUrl}/${tournamentId}/round-formats/`,
      formats,
      { headers }
    );
  }

  /**
   * Get saved round formats for a tournament.
   */
  getRoundFormats(tournamentId: number): Observable<RoundFormat[]> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    return this.http.get<RoundFormat[]>(
      `${this.apiUrl}/${tournamentId}/round-formats/`,
      { headers }
    );
  }

  /**
   * Create tournament (admin only)
   */
  createTournament(data: any): Observable<Tournament> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    return this.http.post<Tournament>(`${this.apiUrl}/`, data, { headers }).pipe(
      tap(newTournament => {
        const current = this.tournamentsSignal();
        this.tournamentsSignal.set([newTournament, ...current]);
        this.totalCountSignal.set(this.totalCountSignal() + 1);
      }),
      catchError(error => {
        console.error('Error creating tournament:', error);
        this.errorSignal.set('Failed to create tournament');
        throw error;
      })
    );
  }

  /**
   * Update tournament (admin only)
   */
  updateTournament(id: number, data: any): Observable<Tournament> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    return this.http.put<Tournament>(`${this.apiUrl}/${id}/`, data, { headers }).pipe(
      tap(updated => {
        const current = this.tournamentsSignal();
        const index = current.findIndex(t => t.id === id);
        if (index !== -1) {
          const newList = [...current];
          newList[index] = updated;
          this.tournamentsSignal.set(newList);
        }
      })
    );
  }

  /**
   * Delete tournament (admin only)
   * @param id Tournament ID
   * @returns Observable of void
   */
  deleteTournament(id: number): Observable<void> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.delete<void>(`${this.apiUrl}/${id}/`, { headers }).pipe(
      tap(() => {
        const current = this.tournamentsSignal();
        const filtered = current.filter(t => t.id !== id);
        this.tournamentsSignal.set(filtered);
        this.totalCountSignal.set(this.totalCountSignal() - 1);
      }),
      catchError(error => {
        console.error('Error deleting tournament:', error);
        this.errorSignal.set('Failed to delete tournament');
        throw error;
      })
    );
  }

  /**
   * Remove participant from tournament (admin only)
   * @param tournamentId Tournament ID
   * @param participantId Participant ID
   * @returns Observable of void
   */
  removeParticipant(tournamentId: number, participantId: number): Observable<void> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.delete<void>(
      `${this.apiUrl}/${tournamentId}/participants/${participantId}/`,
      { headers }
    );
  }

  /**
   * Update filters and reload
   */
  updateFilters(filters: Partial<TournamentFilters>): void {
    this.loadTournaments(filters).subscribe();
  }

  /**
   * Clear error
   */
  clearError(): void {
    this.errorSignal.set(null);
  }

  /**
   * Get status info for badge
   */
  getStatusInfo(tournament: Tournament): { class: string; label: string } {
    if (tournament.status === 'REGISTRATION') {
      if (tournament.participant_count >= tournament.max_participants) {
        return { class: 'status-full', label: 'Full' };
      }
      if (!tournament.is_registration_open) {
        return { class: 'status-closed', label: 'Closed' };
      }
      return { class: 'status-open', label: 'Open' };
    } else if (tournament.status === 'UPCOMING') {
      return { class: 'status-upcoming', label: 'Upcoming' };
    } else if (tournament.status === 'IN_PROGRESS') {
      return { class: 'status-in-progress', label: 'In Progress' };
    } else if (tournament.status === 'COMPLETED') {
      return { class: 'status-completed', label: 'Completed' };
    } else if (tournament.status === 'CANCELLED') {
      return { class: 'status-cancelled', label: 'Cancelled' };
    }
    return { class: 'status-default', label: tournament.status };
  }

  /**
   * Format tournament format
   */
  formatTournamentFormat(format: string): string {
    const formats: { [key: string]: string } = {
      'SINGLE_ELIMINATION': 'Single Elimination',
      'DOUBLE_ELIMINATION': 'Double Elimination',
      'ROUND_ROBIN': 'Round Robin',
      'SWISS': 'Swiss System',
      'GROUP_KNOCKOUT': 'Group Stage + Knockout'
    };
    return formats[format] || format;
  }

  /**
   * Format date
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Format date range
   */
  formatDateRange(startDate: string, endDate: string | null): string {
    const start = this.formatDate(startDate);
    if (endDate) {
      const end = this.formatDate(endDate);
      return `${start} - ${end}`;
    }
    return start;
  }
}
