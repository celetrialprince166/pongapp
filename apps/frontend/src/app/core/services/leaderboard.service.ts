import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AuthService } from './auth.service';
import { LeaderboardEntry } from '../models/player.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LeaderboardService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = `${environment.apiUrl}`;

  constructor() { }

  /**
   * Get leaderboard with optional league filtering
   * @param league Optional filter: 'ALL', 'AMATEUR', or 'PRO'
   * @returns Observable of leaderboard entries with ranks
   */
  getLeaderboard(league?: 'ALL' | 'AMATEUR' | 'PRO'): Observable<LeaderboardEntry[]> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    let url = `${this.apiUrl}/leaderboard/`;
    if (league && league !== 'ALL') {
      url += `?league=${league}`;
    }

    return this.http.get<{ count: number; league: string; results: LeaderboardEntry[] }>(url, { headers }).pipe(
      map((response) => {
        // Extract results array from response and add rank to each player (1-indexed)
        const players = response.results || [];
        return players.map((player, index) => ({
          ...player,
          rank: player.rank || index + 1  // Use backend rank if available, otherwise calculate
        }));
      })
    );
  }

  /**
   * Get user's rank from leaderboard
   * @param userId User ID to find rank for
   * @param league Optional league filter
   * @returns Observable of rank number
   */
  getUserRank(userId: number, league?: 'ALL' | 'AMATEUR' | 'PRO'): Observable<{ rank: number; total: number }> {
    return this.getLeaderboard(league).pipe(
      map((leaderboard) => {
        const rank = leaderboard.findIndex(p => p.id === userId) + 1;
        return {
          rank: rank || 0,
          total: leaderboard.length
        };
      })
    );
  }
}
