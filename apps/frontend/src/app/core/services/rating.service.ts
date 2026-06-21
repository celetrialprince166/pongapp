import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { RatingHistory, Season, Rating } from '../models/rating.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RatingService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = `${environment.apiUrl}/ratings`;

  constructor() { }

  /**
   * Get rating history for a user
   * @param userId User ID
   * @returns Observable of rating history array
   */
  getRatingHistory(userId: number): Observable<RatingHistory[]> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get<RatingHistory[]>(`${this.apiUrl}/history/${userId}/`, { headers });
  }

  /**
   * Get all seasons
   * @returns Observable of season array
   */
  getSeasons(): Observable<Season[]> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get<Season[]>(`${this.apiUrl}/seasons/`, { headers });
  }

  /**
   * Get active season
   * @returns Observable of active season
   */
  getActiveSeason(): Observable<Season> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get<Season>(`${this.apiUrl}/seasons/active/`, { headers });
  }

  /**
   * Get season by ID
   * @param seasonId Season ID
   * @returns Observable of season
   */
  getSeasonById(seasonId: number): Observable<Season> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get<Season>(`${this.apiUrl}/seasons/${seasonId}/`, { headers });
  }

  /**
   * Get league standings for a season
   * @param seasonId Optional season ID (defaults to active season)
   * @returns Observable of standings
   */
  getStandings(seasonId?: number): Observable<any> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    let url = `${this.apiUrl}/standings/`;
    if (seasonId) {
      url += `?season=${seasonId}`;
    }

    return this.http.get(url, { headers });
  }
}
