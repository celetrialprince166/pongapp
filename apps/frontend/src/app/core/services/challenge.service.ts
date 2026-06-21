import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AuthService } from './auth.service';
import { Challenge, ChallengeRequest } from '../models/challenge.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ChallengeService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = `${environment.apiUrl}/challenges`;

  constructor() { }

  /**
   * Get all challenges
   * @returns Observable of challenge array
   */
  getAllChallenges(): Observable<Challenge[]> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get<any>(`${this.apiUrl}/`, { headers }).pipe(
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
   * Get challenges received by current user
   * @returns Observable of received challenges
   */
  getReceivedChallenges(): Observable<Challenge[]> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get<any>(`${this.apiUrl}/received/`, { headers }).pipe(
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
   * Get challenges sent by current user
   * @returns Observable of sent challenges
   */
  getSentChallenges(): Observable<Challenge[]> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get<any>(`${this.apiUrl}/sent/`, { headers }).pipe(
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
   * Get pending challenges count (for badge)
   * @returns Observable of count
   */
  getPendingCount(): Observable<{ count: number }> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get<{ count: number }>(`${this.apiUrl}/pending-count/`, { headers });
  }

  /**
   * Create a new challenge
   * @param challengeData Challenge request data
   * @returns Observable of created challenge
   */
  createChallenge(challengeData: ChallengeRequest): Observable<Challenge> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.post<Challenge>(`${this.apiUrl}/`, challengeData, { headers });
  }

  /**
   * Accept a challenge
   * @param challengeId Challenge ID
   * @returns Observable of accepted challenge
   */
  acceptChallenge(challengeId: number): Observable<Challenge> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.post<Challenge>(
      `${this.apiUrl}/${challengeId}/accept/`,
      {},
      { headers }
    );
  }

  /**
   * Decline a challenge
   * @param challengeId Challenge ID
   * @returns Observable of declined challenge
   */
  declineChallenge(challengeId: number): Observable<Challenge> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.post<Challenge>(
      `${this.apiUrl}/${challengeId}/decline/`,
      {},
      { headers }
    );
  }

  /**
   * Cancel a sent challenge
   * @param challengeId Challenge ID
   * @returns Observable of cancelled challenge
   */
  cancelChallenge(challengeId: number): Observable<Challenge> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.post<Challenge>(
      `${this.apiUrl}/${challengeId}/cancel/`,
      {},
      { headers }
    );
  }

  /**
   * Get challenge by ID
   * @param challengeId Challenge ID
   * @returns Observable of challenge
   */
  getChallengeById(challengeId: number): Observable<Challenge> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get<Challenge>(`${this.apiUrl}/${challengeId}/`, { headers });
  }
}
