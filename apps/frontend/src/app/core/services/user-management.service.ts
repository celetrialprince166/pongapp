import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap, catchError, of } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import { snakeToCamelObject, camelToSnakeObject } from '../utils/case-transform.util';

/**
 * Admin User Interface
 * Represents a user in the admin management interface
 */
export interface AdminUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  role: 'ADMIN' | 'PLAYER' | 'MODERATOR';
  isActive: boolean;
  lastLogin: string | null;
  dateJoined: string;
}

/**
 * User List Response Interface
 */
export interface UserListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: AdminUser[];
}

/**
 * User Filters Interface
 */
export interface UserFilters {
  search?: string;
  role?: 'all' | 'ADMIN' | 'PLAYER' | 'MODERATOR';
  status?: 'all' | 'active' | 'inactive';
  page?: number;
  perPage?: number;
}

/**
 * User Create/Update Request
 */
export interface UserRequest {
  username?: string;
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  role?: 'ADMIN' | 'PLAYER' | 'MODERATOR';
}


/**
 * User Management Service
 *
 * Provides functionality for managing users in the admin interface.
 * Handles user CRUD operations, role management, activation, and password resets.
 */
@Injectable({
  providedIn: 'root'
})
export class UserManagementService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = environment.apiUrl ? `${environment.apiUrl}/users` : `${environment.apiUrl}/users`;
  private adminApiUrl = environment.apiUrl ? `${environment.apiUrl}/admin/users` : `${environment.apiUrl}/admin/users`;

  // Signal-based state management
  private usersSignal = signal<AdminUser[]>([]);
  private loadingSignal = signal<boolean>(false);
  private errorSignal = signal<string | null>(null);
  private totalCountSignal = signal<number>(0);
  private filtersSignal = signal<UserFilters>({ role: 'all', status: 'all', page: 1, perPage: 10 });

  // Read-only signals exposed to components
  readonly users = this.usersSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly totalCount = this.totalCountSignal.asReadonly();
  readonly filters = this.filtersSignal.asReadonly();

  /**
   * Load users with filtering and pagination
   */
  loadUsers(filters?: UserFilters): Observable<UserListResponse> {
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
    if (currentFilters.role && currentFilters.role !== 'all') {
      params = params.set('role', currentFilters.role);
    }
    if (currentFilters.status && currentFilters.status !== 'all') {
      params = params.set('is_active', currentFilters.status === 'active' ? 'true' : 'false');
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
          snakeToCamelObject<AdminUser>(item)
        ) : [];
        return {
          count: response.count || 0,
          next: response.next,
          previous: response.previous,
          results
        };
      }),
      tap(response => {
        this.usersSignal.set(response.results);
        this.totalCountSignal.set(response.count);
        this.loadingSignal.set(false);
      }),
      catchError(error => {
        console.error('Error loading users:', error);
        this.errorSignal.set('Failed to load users');
        this.loadingSignal.set(false);
        return of({ count: 0, next: null, previous: null, results: [] });
      })
    );
  }

  /**
   * Get user by ID
   */
  getUser(id: number): Observable<AdminUser> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get<any>(`${this.apiUrl}/${id}/`, { headers }).pipe(
      map(response => snakeToCamelObject<AdminUser>(response))
    );
  }

  /**
   * Create new user (admin only)
   */
  createUser(data: UserRequest): Observable<AdminUser> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const payload = camelToSnakeObject(data);

    return this.http.post<any>(`${this.apiUrl}/`, payload, { headers }).pipe(
      map(response => snakeToCamelObject<AdminUser>(response)),
      tap(newUser => {
        const current = this.usersSignal();
        this.usersSignal.set([newUser, ...current]);
        this.totalCountSignal.set(this.totalCountSignal() + 1);
      }),
      catchError(error => {
        console.error('Error creating user:', error);
        this.errorSignal.set('Failed to create user');
        throw error;
      })
    );
  }

  /**
   * Update user role (admin only)
   */
  updateUserRole(id: number, role: string): Observable<AdminUser> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    return this.http.patch<any>(`${this.adminApiUrl}/${id}/role/`, { role }, { headers }).pipe(
      map(response => snakeToCamelObject<AdminUser>(response)),
      tap(updated => {
        const current = this.usersSignal();
        const index = current.findIndex(u => u.id === id);
        if (index !== -1) {
          const newList = [...current];
          newList[index] = updated;
          this.usersSignal.set(newList);
        }
      }),
      catchError(error => {
        console.error('Error updating user role:', error);
        this.errorSignal.set('Failed to update user role');
        throw error;
      })
    );
  }

  /**
   * Deactivate user (admin only)
   */
  deactivateUser(id: number, reason: string): Observable<{ success: boolean }> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    return this.http.post<any>(`${this.adminApiUrl}/${id}/deactivate/`, { reason }, { headers }).pipe(
      tap(() => {
        const current = this.usersSignal();
        const index = current.findIndex(u => u.id === id);
        if (index !== -1) {
          const newList = [...current];
          newList[index] = { ...newList[index], isActive: false };
          this.usersSignal.set(newList);
        }
      }),
      catchError(error => {
        console.error('Error deactivating user:', error);
        this.errorSignal.set('Failed to deactivate user');
        throw error;
      })
    );
  }

  /**
   * Reactivate user (admin only)
   */
  reactivateUser(id: number): Observable<{ success: boolean }> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.post<any>(`${this.adminApiUrl}/${id}/reactivate/`, {}, { headers }).pipe(
      tap(() => {
        const current = this.usersSignal();
        const index = current.findIndex(u => u.id === id);
        if (index !== -1) {
          const newList = [...current];
          newList[index] = { ...newList[index], isActive: true };
          this.usersSignal.set(newList);
        }
      }),
      catchError(error => {
        console.error('Error reactivating user:', error);
        this.errorSignal.set('Failed to reactivate user');
        throw error;
      })
    );
  }

  /**
   * Reset user password (admin only) — auto-generates and emails new password
   */
  resetUserPassword(id: number): Observable<any> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    return this.http.post<any>(`${this.adminApiUrl}/${id}/reset-password/`, {}, { headers }).pipe(
      catchError(error => {
        console.error('Error resetting password:', error);
        this.errorSignal.set('Failed to reset password');
        throw error;
      })
    );
  }

  /**
   * Delete user (admin only)
   */
  deleteUser(id: number): Observable<void> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.delete<void>(`${this.apiUrl}/${id}/`, { headers }).pipe(
      tap(() => {
        const current = this.usersSignal();
        this.usersSignal.set(current.filter(u => u.id !== id));
        this.totalCountSignal.set(this.totalCountSignal() - 1);
      }),
      catchError(error => {
        console.error('Error deleting user:', error);
        this.errorSignal.set('Failed to delete user');
        throw error;
      })
    );
  }

  /**
   * Update filters and reload
   */
  updateFilters(filters: Partial<UserFilters>): void {
    this.loadUsers(filters).subscribe();
  }

  /**
   * Clear error
   */
  clearError(): void {
    this.errorSignal.set(null);
  }

  /**
   * Get role badge class
   */
  getRoleBadgeClass(role: string): string {
    const classMap: { [key: string]: string } = {
      'ADMIN': 'role-badge role-admin',
      'PLAYER': 'role-badge role-player',
      'MODERATOR': 'role-badge role-moderator'
    };
    return classMap[role] || 'role-badge';
  }

  /**
   * Get role label
   */
  getRoleLabel(role: string): string {
    const labelMap: { [key: string]: string } = {
      'ADMIN': 'Admin',
      'PLAYER': 'Player',
      'MODERATOR': 'Moderator'
    };
    return labelMap[role] || role;
  }

  /**
   * Get relative time from date
   */
  getRelativeTime(dateString: string | null): string {
    if (!dateString) return 'Never';

    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString();
  }
}
