import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AuthService } from './auth.service';
import { Match, Game, MatchEvent } from '../models/match.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MatchService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = `${environment.apiUrl}/matches`;

  constructor() { }

  /**
   * Get all matches with optional status filtering
   * @param status Optional filter by match status
   * @returns Observable of match array
   */
  getMatches(status?: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'): Observable<Match[]> {
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
   * Get matches for a specific user
   * @param userId User ID to filter matches
   * @param limit Optional limit number of matches returned
   * @returns Observable of match array
   */
  getUserMatches(userId: number, limit?: number): Observable<Match[]> {
    return this.getMatches().pipe(
      map((matches) => {
        // Filter matches where user is either player1 or player2
        const userMatches = matches.filter(
          m => m.player1 === userId || m.player2 === userId
        );

        // Sort by created_at descending (most recent first)
        userMatches.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        // Apply limit if specified
        return limit ? userMatches.slice(0, limit) : userMatches;
      })
    );
  }

  /**
   * Get live matches
   * @returns Observable of live match array
   */
  getLiveMatches(): Observable<Match[]> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get<Match[]>(`${this.apiUrl}/live/`, { headers });
  }

  /**
   * Get match by ID
   * @param id Match ID
   * @returns Observable of match
   */
  getMatchById(id: number): Observable<Match> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get<Match>(`${this.apiUrl}/${id}/`, { headers });
  }

  /**
   * Get match scoreboard
   * @param id Match ID
   * @returns Observable of scoreboard data
   */
  getMatchScoreboard(id: number): Observable<any> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get(`${this.apiUrl}/${id}/scoreboard/`, { headers });
  }

  /**
   * Start a match (changes status to IN_PROGRESS)
   * @param matchId Match ID
   * @returns Observable of started match
   */
  startMatch(matchId: number): Observable<any> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    return this.http.post(`${this.apiUrl}/${matchId}/start/`, {}, { headers });
  }

  /**
   * Add point to current game
   * @param matchId Match ID
   * @param playerId Player ID who scored
   * @returns Observable of updated game state
   */
  addPoint(matchId: number, playerId: number): Observable<any> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.post(
      `${this.apiUrl}/${matchId}/add-point/`,
      { player_id: playerId },
      { headers }
    );
  }

  /**
   * Complete a match
   * @param matchId Match ID
   * @returns Observable of completed match
   */
  completeMatch(matchId: number): Observable<Match> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.post<Match>(
      `${this.apiUrl}/${matchId}/complete/`,
      {},
      { headers }
    );
  }

  /**
   * Correct a match score (admin only) — PUT /api/matches/:id/correct/
   * @param matchId Match ID
   * @param games Per-game score corrections
   * @param reason Optional reason for correction
   * @returns Observable of corrected match
   */
  correctMatchScore(
    matchId: number,
    games: { game_number: number; player1_score: number; player2_score: number }[],
    reason?: string
  ): Observable<any> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    return this.http.put(
      `${this.apiUrl}/${matchId}/correct/`,
      { games, reason },
      { headers }
    );
  }
}
