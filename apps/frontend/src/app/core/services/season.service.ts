import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { Season } from '../models/season.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SeasonService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/ratings/seasons/`;

  readonly seasons = signal<Season[]>([]);
  readonly loading = signal(false);

  getSeasons(): Observable<Season[]> {
    this.loading.set(true);

    return this.http.get<any>(this.apiUrl).pipe(
      map(response => {
        const list: Season[] = Array.isArray(response)
          ? response
          : (response?.results ?? []);
        this.seasons.set(list);
        this.loading.set(false);
        return list;
      }),
      catchError(() => {
        this.loading.set(false);
        return of([]);
      })
    );
  }

  getActiveSeason(): Observable<Season> {
    return this.http.get<Season>(`${this.apiUrl}active/`).pipe(
      catchError(error => { throw error; })
    );
  }
}
