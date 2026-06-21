import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Admin Guard
 *
 * Protects routes that should only be accessible to admin users.
 * Checks if the current user has admin privileges using AuthService.isAdmin().
 * Redirects non-admin users to the dashboard.
 *
 * Usage:
 * {
 *   path: 'admin/tournaments/:id',
 *   component: AdminTournamentDetailComponent,
 *   canActivate: [adminGuard]
 * }
 */
export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAdmin()) {
    return true;
  }

  // Redirect non-admins to dashboard
  console.warn('[AdminGuard] Access denied - redirecting to dashboard');
  router.navigate(['/dashboard']);
  return false;
};
