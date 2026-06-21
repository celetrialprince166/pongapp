import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserManagementService, AdminUser, UserRequest } from '../../../core/services/user-management.service';
import { LucideAngularModule, Edit, Key, Unlock, Lock, Trash2 } from 'lucide-angular';

/**
 * User Management Component
 *
 * Admin interface for managing users with role management,
 * activation/deactivation, and password resets.
 *
 * Design reference: docs/designs/user-dashboard/tournament_creation_screen_3/screen.png
 */

interface UserFormData {
  firstName: string;
  lastName: string;
  email: string;
  role: 'ADMIN' | 'PLAYER' | 'MODERATOR';
}

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.css'
})
export class UserManagementComponent implements OnInit {
  // Service injection
  private userService = inject(UserManagementService);

  // Service signals
  users = this.userService.users;
  loading = this.userService.loading;
  error = this.userService.error;
  totalCount = this.userService.totalCount;
  filters = this.userService.filters;

  // Lucide icons for template
  readonly Edit = Edit;
  readonly Key = Key;
  readonly Unlock = Unlock;
  readonly Lock = Lock;
  readonly Trash2 = Trash2;

  // Component state
  showCreateModal = signal(false);
  showEditRoleModal = signal(false);
  showResetPasswordModal = signal(false);
  showDeleteModal = signal(false);
  showStatusModal = signal(false);
  selectedUser = signal<AdminUser | null>(null);
  searchTerm = signal('');
  roleFilter = signal<'all' | 'ADMIN' | 'PLAYER' | 'MODERATOR'>('all');
  statusFilter = signal<'all' | 'active' | 'inactive'>('all');

  // Form data
  userForm = signal<UserFormData>({
    firstName: '',
    lastName: '',
    email: '',
    role: 'PLAYER'
  });

  newRole: 'ADMIN' | 'PLAYER' | 'MODERATOR' = 'PLAYER';
  deactivationReason: string = '';
  resettingPassword = signal(false);
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  // Validation
  formErrors = signal<{ [key: string]: string }>({});

  // Pagination state
  currentPage = signal(1);
  readonly pageSize = 10;
  totalPages = computed(() => Math.ceil(this.totalCount() / this.pageSize) || 1);
  pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  });

  // Expose Math to template
  protected readonly Math = Math;

  ngOnInit(): void {
    this.loadUsers();
  }

  /**
   * Load users with current filters
   */
  loadUsers(page?: number): void {
    if (page !== undefined) {
      this.currentPage.set(page);
    }
    this.userService.loadUsers({
      role: this.roleFilter(),
      status: this.statusFilter(),
      search: this.searchTerm() || undefined,
      page: this.currentPage(),
      perPage: this.pageSize
    }).subscribe();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) return;
    this.loadUsers(page);
  }

  minOf(a: number, b: number): number {
    return Math.min(a, b);
  }

  /**
   * Handle role filter change
   */
  onRoleFilterChange(role: 'all' | 'ADMIN' | 'PLAYER' | 'MODERATOR'): void {
    this.roleFilter.set(role);
    this.loadUsers(1);
  }

  /**
   * Handle status filter change
   */
  onStatusFilterChange(status: 'all' | 'active' | 'inactive'): void {
    this.statusFilter.set(status);
    this.loadUsers(1);
  }

  /**
   * Handle search input
   */
  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);

    // Debounce search
    setTimeout(() => {
      if (this.searchTerm() === input.value) {
        this.loadUsers(1);
      }
    }, 300);
  }

  /**
   * Open create user modal
   */
  openCreateModal(): void {
    this.resetForm();
    this.showCreateModal.set(true);
  }

  /**
   * Close create user modal
   */
  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.resetForm();
  }

  /**
   * Open edit role modal
   */
  openEditRoleModal(user: AdminUser): void {
    this.selectedUser.set(user);
    this.newRole = user.role;
    this.showEditRoleModal.set(true);
  }

  /**
   * Close edit role modal
   */
  closeEditRoleModal(): void {
    this.showEditRoleModal.set(false);
    this.selectedUser.set(null);
  }

  /**
   * Open reset password modal
   */
  openResetPasswordModal(user: AdminUser): void {
    this.selectedUser.set(user);
    this.showResetPasswordModal.set(true);
  }

  /**
   * Close reset password modal
   */
  closeResetPasswordModal(): void {
    this.showResetPasswordModal.set(false);
    this.selectedUser.set(null);
  }

  /**
   * Open delete confirmation modal
   */
  openDeleteModal(user: AdminUser): void {
    this.selectedUser.set(user);
    this.showDeleteModal.set(true);
  }

  /**
   * Close delete confirmation modal
   */
  closeDeleteModal(): void {
    this.showDeleteModal.set(false);
    this.selectedUser.set(null);
  }

  /**
   * Open status change modal (activate/deactivate)
   */
  openStatusModal(user: AdminUser): void {
    this.selectedUser.set(user);
    this.deactivationReason = '';
    this.showStatusModal.set(true);
  }

  /**
   * Close status modal
   */
  closeStatusModal(): void {
    this.showStatusModal.set(false);
    this.selectedUser.set(null);
    this.deactivationReason = '';
  }

  /**
   * Reset form to default values
   */
  resetForm(): void {
    this.userForm.set({
      firstName: '',
      lastName: '',
      email: '',
      role: 'PLAYER'
    });
    this.formErrors.set({});
  }

  updateForm(field: keyof UserFormData, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.userForm.update(f => ({ ...f, [field]: value }));
  }

  /**
   * Validate form data
   */
  validateForm(): boolean {
    const errors: { [key: string]: string } = {};
    const form = this.userForm();

    if (!form.firstName || form.firstName.trim().length === 0) {
      errors['firstName'] = 'First name is required';
    }

    if (!form.lastName || form.lastName.trim().length === 0) {
      errors['lastName'] = 'Last name is required';
    }

    if (!form.email || form.email.trim().length === 0) {
      errors['email'] = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors['email'] = 'Invalid email format';
    }

    this.formErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  /**
   * Submit create user form
   */
  onCreateUser(): void {
    if (!this.validateForm()) {
      return;
    }

    const form = this.userForm();
    const userData: UserRequest = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      role: form.role
    };

    this.userService.createUser(userData).subscribe({
      next: () => {
        this.closeCreateModal();
        this.loadUsers();
      },
      error: (err) => {
        const emailError = err?.error?.email?.[0];
        this.formErrors.update(e => ({ ...e, email: emailError || 'Failed to create user' }));
      }
    });
  }

  /**
   * Update user role
   */
  onUpdateRole(): void {
    const user = this.selectedUser();
    if (!user) return;

    this.userService.updateUserRole(user.id, this.newRole).subscribe({
      next: () => {
        this.closeEditRoleModal();
        this.loadUsers();
      },
      error: (error) => {
        console.error('Failed to update role:', error);
      }
    });
  }

  /**
   * Reset user password — auto-generates and emails a new password
   */
  onResetPassword(): void {
    const user = this.selectedUser();
    if (!user) return;

    this.resettingPassword.set(true);
    this.userService.resetUserPassword(user.id).subscribe({
      next: () => {
        this.resettingPassword.set(false);
        this.closeResetPasswordModal();
        this.showToast(`Password reset successfully. New credentials sent to ${user.email}.`, 'success');
      },
      error: (err) => {
        this.resettingPassword.set(false);
        const msg = err?.error?.message || 'Failed to reset password. Please try again.';
        this.showToast(msg, 'error');
      }
    });
  }

  showToast(message: string, type: 'success' | 'error'): void {
    this.toast.set({ message, type });
    setTimeout(() => this.toast.set(null), 4000);
  }

  getInitials(firstName?: string, lastName?: string): string {
    const f = firstName?.[0] ?? '';
    const l = lastName?.[0] ?? '';
    return (f + l).toUpperCase() || '?';
  }

  /**
   * Toggle user status (activate/deactivate)
   */
  onToggleStatus(): void {
    const user = this.selectedUser();
    if (!user) return;

    if (user.isActive) {
      // Deactivate
      if (!this.deactivationReason || this.deactivationReason.trim().length === 0) {
        alert('Please provide a reason for deactivation');
        return;
      }

      this.userService.deactivateUser(user.id, this.deactivationReason).subscribe({
        next: () => {
          this.closeStatusModal();
          this.loadUsers();
        },
        error: (error) => {
          console.error('Failed to deactivate user:', error);
        }
      });
    } else {
      // Reactivate
      this.userService.reactivateUser(user.id).subscribe({
        next: () => {
          this.closeStatusModal();
          this.loadUsers();
        },
        error: (error) => {
          console.error('Failed to reactivate user:', error);
        }
      });
    }
  }

  /**
   * Delete user
   */
  onDeleteUser(): void {
    const user = this.selectedUser();
    if (!user) return;

    this.userService.deleteUser(user.id).subscribe({
      next: () => {
        this.closeDeleteModal();
        this.loadUsers();
      },
      error: (error) => {
        console.error('Failed to delete user:', error);
      }
    });
  }

  /**
   * Get role badge class
   */
  getRoleBadgeClass(role: string): string {
    return this.userService.getRoleBadgeClass(role);
  }

  /**
   * Get role label
   */
  getRoleLabel(role: string): string {
    return this.userService.getRoleLabel(role);
  }

  /**
   * Get relative time
   */
  getRelativeTime(dateString: string | null): string {
    return this.userService.getRelativeTime(dateString);
  }

  /**
   * Get user avatar URL or initials
   */
  getUserAvatar(user: AdminUser): string {
    if (user.avatar) {
      return user.avatar;
    }
    return `https://ui-avatars.com/api/?name=${user.firstName}+${user.lastName}&background=0EA5E9&color=fff`;
  }

  /**
   * Clear error message
   */
  clearError(): void {
    this.userService.clearError();
  }
}
