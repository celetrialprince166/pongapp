import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { AuthService } from './auth.service';
import { PointAllocation } from '../models/point-allocation.model';
import { environment } from '../../../environments/environment';

// TODO: Backend endpoints required:
// GET  /api/point-allocations/ → returns list of PointAllocation
// PUT  /api/point-allocations/ → accepts updated list, returns saved list

const MOCK_ALLOCATIONS: PointAllocation[] = [
  {
    id: 1,
    category: 'FIRST_PLACE',
    label: 'Tournament 1st Place',
    description: 'Points awarded to the tournament winner',
    points: 100
  },
  {
    id: 2,
    category: 'SECOND_PLACE',
    label: 'Tournament 2nd Place',
    description: 'Points awarded to the runner-up',
    points: 75
  },
  {
    id: 3,
    category: 'THIRD_PLACE',
    label: 'Tournament 3rd Place',
    description: 'Points awarded for third place finish',
    points: 50
  },
  {
    id: 4,
    category: 'MATCH_WIN',
    label: 'Match Win',
    description: 'Points awarded for each match win',
    points: 10
  },
  {
    id: 5,
    category: 'MATCH_LOSS',
    label: 'Match Loss (Participation)',
    description: 'Points awarded for each match played (loss)',
    points: 3
  },
  {
    id: 6,
    category: 'PARTICIPATION',
    label: 'Season Participation Bonus',
    description: 'Bonus points for registering and participating in a tournament',
    points: 5
  }
];

@Injectable({
  providedIn: 'root'
})
export class PointAllocationService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = `${environment.apiUrl}/point-allocations`;

  /**
   * Get all point allocation rules
   * TODO: Backend endpoint required: GET /api/point-allocations/
   * Returns mock data until backend is implemented
   */
  getPointAllocations(): Observable<PointAllocation[]> {
    // TODO: Uncomment when backend is ready:
    // const token = this.authService.getToken();
    // const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    // return this.http.get<PointAllocation[]>(`${this.apiUrl}/`, { headers });

    return of(MOCK_ALLOCATIONS);
  }

  /**
   * Update point allocation rules
   * TODO: Backend endpoint required: PUT /api/point-allocations/
   * Body: PointAllocation[]
   */
  updatePointAllocations(allocations: PointAllocation[]): Observable<PointAllocation[]> {
    // TODO: Uncomment when backend is ready:
    // const token = this.authService.getToken();
    // const headers = new HttpHeaders({
    //   'Authorization': `Bearer ${token}`,
    //   'Content-Type': 'application/json'
    // });
    // return this.http.put<PointAllocation[]>(`${this.apiUrl}/`, allocations, { headers });

    // Stub: return updated list immediately (simulates save)
    return of(allocations);
  }
}
