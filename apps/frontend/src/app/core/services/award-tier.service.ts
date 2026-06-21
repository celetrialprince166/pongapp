import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export interface AwardTierPayload {
  tier_type: 'POSITION' | 'ALL_PARTICIPANTS' | 'SPECIFIC_USER';
  position?: number | null;
  points: number;
  user?: number | null;
  label?: string;
}

export interface AwardTierResponse extends AwardTierPayload {
  id: number;
  user_username?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AwardTierService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private base = `${environment.apiUrl}/tournaments`;

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.authService.getToken()}` });
  }

  getAwardTiers(tournamentId: number): Observable<AwardTierResponse[]> {
    return this.http.get<any>(
      `${this.base}/${tournamentId}/award-tiers/`,
      { headers: this.headers() }
    ).pipe(
      map(res => Array.isArray(res) ? res : (res?.results ?? []))
    );
  }

  createAwardTier(tournamentId: number, payload: AwardTierPayload): Observable<AwardTierResponse> {
    return this.http.post<AwardTierResponse>(
      `${this.base}/${tournamentId}/award-tiers/`,
      payload,
      { headers: this.headers() }
    );
  }

  updateAwardTier(tournamentId: number, tierId: number, payload: Partial<AwardTierPayload>): Observable<AwardTierResponse> {
    return this.http.patch<AwardTierResponse>(
      `${this.base}/${tournamentId}/award-tiers/${tierId}/`,
      payload,
      { headers: this.headers() }
    );
  }

  deleteAwardTier(tournamentId: number, tierId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/${tournamentId}/award-tiers/${tierId}/`,
      { headers: this.headers() }
    );
  }

  distributeAwards(tournamentId: number): Observable<{ distributed: number }> {
    return this.http.post<{ distributed: number }>(
      `${this.base}/${tournamentId}/distribute-awards/`,
      {},
      { headers: this.headers() }
    );
  }

  resetAwards(tournamentId: number): Observable<void> {
    return this.http.post<void>(
      `${this.base}/${tournamentId}/reset-awards/`,
      {},
      { headers: this.headers() }
    );
  }
}
