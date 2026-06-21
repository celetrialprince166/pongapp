import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlayerManagementService, Player, PlayerRequest } from '../../../core/services/player-management.service';
import { LucideAngularModule, Edit, Trash2, UserPlus, Search } from 'lucide-angular';

/**
 * Player Management Component
 *
 * Admin interface for managing players with ELO ratings.
 * Displays a table of players with search, filtering, and CRUD operations.
 *
 * Design reference: docs/designs/user-dashboard/tournament_creation_screen_1/screen.png
 */

interface PlayerFormData {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  league: 'PRO' | 'AMATEUR';
  role: 'PLAYER' | 'ADMIN' | 'MODERATOR';
}

@Component({
  selector: 'app-player-management',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './player-management.component.html',
  styleUrl: './player-management.component.css'
})
export class PlayerManagementComponent implements OnInit {
  // Service injection
  private playerService = inject(PlayerManagementService);

  // Service signals
  players = this.playerService.players;
  loading = this.playerService.loading;
  error = this.playerService.error;
  totalCount = this.playerService.totalCount;

  // Lucide icons for template
  readonly Edit = Edit;
  readonly Trash2 = Trash2;
  readonly UserPlus = UserPlus;
  readonly Search = Search;
  filters = this.playerService.filters;

  // Component state
  showCreateModal = signal(false);
  showEditModal = signal(false);
  showDeleteModal = signal(false);
  selectedPlayer = signal<Player | null>(null);
  searchTerm = signal('');
  leagueFilter = signal<'all' | 'PRO' | 'AMATEUR'>('all');

  // Form data
  playerForm = signal<PlayerFormData>({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    league: 'AMATEUR',
    role: 'PLAYER'
  });

  // Validation
  formErrors = signal<{ [key: string]: string }>({});

  // Expose Math to template
  protected readonly Math = Math;

  ngOnInit(): void {
    this.loadPlayers();
  }

  /**
   * Load players with current filters
   */
  loadPlayers(): void {
    this.playerService.loadPlayers({
      league: this.leagueFilter(),
      search: this.searchTerm() || undefined
    }).subscribe();
  }

  /**
   * Handle league filter change
   */
  onLeagueFilterChange(league: 'all' | 'PRO' | 'AMATEUR'): void {
    this.leagueFilter.set(league);
    this.loadPlayers();
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
        this.loadPlayers();
      }
    }, 300);
  }

  /**
   * Open create player modal
   */
  openCreateModal(): void {
    this.resetForm();
    this.showCreateModal.set(true);
  }

  /**
   * Close create player modal
   */
  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.resetForm();
  }

  /**
   * Open edit player modal
   */
  openEditModal(player: Player): void {
    this.selectedPlayer.set(player);
    this.playerForm.set({
      username: player.username,
      email: player.email,
      firstName: player.firstName,
      lastName: player.lastName,
      password: '',
      league: player.league,
      role: player.role
    });
    this.showEditModal.set(true);
  }

  /**
   * Close edit player modal
   */
  closeEditModal(): void {
    this.showEditModal.set(false);
    this.selectedPlayer.set(null);
    this.resetForm();
  }

  /**
   * Open delete confirmation modal
   */
  openDeleteModal(player: Player): void {
    this.selectedPlayer.set(player);
    this.showDeleteModal.set(true);
  }

  /**
   * Close delete confirmation modal
   */
  closeDeleteModal(): void {
    this.showDeleteModal.set(false);
    this.selectedPlayer.set(null);
  }

  /**
   * Reset form to default values
   */
  resetForm(): void {
    this.playerForm.set({
      username: '',
      email: '',
      firstName: '',
      lastName: '',
      password: '',
      league: 'AMATEUR',
      role: 'PLAYER'
    });
    this.formErrors.set({});
  }

  /**
   * Validate form data
   */
  validateForm(isEdit: boolean = false): boolean {
    const errors: { [key: string]: string } = {};
    const form = this.playerForm();

    if (!form.username || form.username.trim().length === 0) {
      errors['username'] = 'Username is required';
    }

    if (!form.email || form.email.trim().length === 0) {
      errors['email'] = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors['email'] = 'Invalid email format';
    }

    if (!form.firstName || form.firstName.trim().length === 0) {
      errors['firstName'] = 'First name is required';
    }

    if (!form.lastName || form.lastName.trim().length === 0) {
      errors['lastName'] = 'Last name is required';
    }

    if (!isEdit && (!form.password || form.password.length < 6)) {
      errors['password'] = 'Password must be at least 6 characters';
    }

    this.formErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  /**
   * Submit create player form
   */
  onCreatePlayer(): void {
    if (!this.validateForm(false)) {
      return;
    }

    const form = this.playerForm();
    const playerData: PlayerRequest = {
      username: form.username.trim(),
      email: form.email.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      password: form.password,
      league: form.league,
      role: form.role
    };

    this.playerService.createPlayer(playerData).subscribe({
      next: () => {
        this.closeCreateModal();
        this.loadPlayers();
      },
      error: (error) => {
        console.error('Failed to create player:', error);
      }
    });
  }

  /**
   * Submit edit player form
   */
  onEditPlayer(): void {
    if (!this.validateForm(true) || !this.selectedPlayer()) {
      return;
    }

    const form = this.playerForm();
    const playerId = this.selectedPlayer()!.id;
    const playerData: Partial<PlayerRequest> = {
      username: form.username.trim(),
      email: form.email.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      league: form.league,
      role: form.role
    };

    // Only include password if it was changed
    if (form.password && form.password.length >= 6) {
      playerData.password = form.password;
    }

    this.playerService.updatePlayer(playerId, playerData).subscribe({
      next: () => {
        this.closeEditModal();
        this.loadPlayers();
      },
      error: (error) => {
        console.error('Failed to update player:', error);
      }
    });
  }

  /**
   * Delete player
   */
  onDeletePlayer(): void {
    const player = this.selectedPlayer();
    if (!player) return;

    this.playerService.deletePlayer(player.id).subscribe({
      next: () => {
        this.closeDeleteModal();
        this.loadPlayers();
      },
      error: (error) => {
        console.error('Failed to delete player:', error);
      }
    });
  }

  /**
   * Get league badge class
   */
  getLeagueBadgeClass(league: string): string {
    return this.playerService.getLeagueBadgeClass(league);
  }

  /**
   * Get league label
   */
  getLeagueLabel(league: string): string {
    return this.playerService.getLeagueLabel(league);
  }

  /**
   * Format win rate
   */
  formatWinRate(winRate: number): string {
    return this.playerService.formatWinRate(winRate);
  }

  /**
   * Get player avatar URL or initials
   */
  getPlayerAvatar(player: Player): string {
    if (player.avatar) {
      return player.avatar;
    }
    // Return placeholder or initials
    return `https://ui-avatars.com/api/?name=${player.firstName}+${player.lastName}&background=0EA5E9&color=fff`;
  }

  /**
   * Clear error message
   */
  clearError(): void {
    this.playerService.clearError();
  }
}
