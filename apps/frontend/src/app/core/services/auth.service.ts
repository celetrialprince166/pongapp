import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, map } from 'rxjs';
import { Router } from '@angular/router';
import { User } from '../models/user.model';
import { environment } from '../../../environments/environment';

interface AuthResponse {
  tokens: {
    access: string;
    refresh: string;
  };
  user?: User;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private apiUrl = `${environment.apiUrl}/auth`;

  // Signals to track state
  currentUser = signal<User | null>(null);

  // Role-based access control computed signals
  isAdmin = computed(() => {
    const user = this.currentUser();
    return user?.role === 'ADMIN' || user?.is_staff === true;
  });

  isPlayer = computed(() => {
    const user = this.currentUser();
    return user?.role === 'PLAYER' || (!user?.is_staff && user !== null);
  });

  isStaff = computed(() => {
    const user = this.currentUser();
    return user?.is_staff === true;
  });

  constructor() {
    // Initialize user from sessionStorage if token exists
    this.loadUserFromStorage();
  }

  private loadUserFromStorage(): void {
    const userJson = sessionStorage.getItem('current_user');
    if (userJson) {
      try {
        const user = JSON.parse(userJson);
        this.currentUser.set(user);
      } catch (error) {
        console.error('[AuthService] Failed to parse user from storage:', error);
        sessionStorage.removeItem('current_user');
      }
    }
  }

  login(credentials: any): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login/`, credentials).pipe(
      tap(response => {
        this.saveTokens(response.tokens.access, response.tokens.refresh);
        if (response.user) {
          this.saveUser(response.user);
          this.currentUser.set(response.user);
          this.redirectBasedOnRole(response.user);
        } else {
          // If user not in response, fetch it (simplified for now)
          // In a real app we might chain this
        }
      })
    );
  }

  register(userData: any): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/signup/`, userData).pipe(
      tap(response => {
        this.saveTokens(response.tokens.access, response.tokens.refresh);
        if (response.user) {
          this.saveUser(response.user);
          this.currentUser.set(response.user);
          this.redirectBasedOnRole(response.user);
        }
      })
    );
  }

  logout() {
    this.clearTokens();
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  private saveTokens(access: string, refresh: string) {
    sessionStorage.setItem('access_token', access);
    sessionStorage.setItem('refresh_token', refresh);
  }

  private saveUser(user: User) {
    sessionStorage.setItem('current_user', JSON.stringify(user));
  }

  private clearTokens() {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    sessionStorage.removeItem('current_user');
  }

  getToken(): string | null {
    return sessionStorage.getItem('access_token');
  }

  getRefreshToken(): string | null {
    return sessionStorage.getItem('refresh_token');
  }

  refreshAccessToken(): Observable<string> {
    const refreshToken = this.getRefreshToken();
    return this.http.post<{ access: string; refresh?: string }>(
      `${this.apiUrl}/refresh/`,
      { refresh: refreshToken }
    ).pipe(
      tap(response => {
        sessionStorage.setItem('access_token', response.access);
        if (response.refresh) {
          sessionStorage.setItem('refresh_token', response.refresh);
        }
      }),
      map(response => response.access)
    );
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getUserRole(): string | undefined {
    return this.currentUser()?.role;
  }

  redirectBasedOnRole(user: User) {
    if (user.role === 'ADMIN') {
      this.router.navigate(['/admin/dashboard']);
    } else {
      this.router.navigate(['/tournaments']);
    }
  }
}
