import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TournamentService } from '../../../core/services/tournament.service';
import { Tournament } from '../../../core/models/tournament.model';
import { LucideAngularModule, Plus, Calendar, Trophy, Users, Pencil, Trash2 } from 'lucide-angular';

/**
 * Tournament Overview Component
 *
 * Admin interface for viewing and managing tournaments.
 * Displays tournaments in card-based layout with filtering.
 *
 * Design reference: docs/designs/tournaments/image copy 11.png
 */
@Component({
  selector: 'app-tournament-overview',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './tournament-overview.component.html',
  styleUrl: './tournament-overview.component.css'
})
export class TournamentOverviewComponent implements OnInit {
  // Service injection
  private tournamentService = inject(TournamentService);
  private router = inject(Router);

  // Service signals
  tournaments = this.tournamentService.tournaments;
  loading = this.tournamentService.loading;
  error = this.tournamentService.error;
  totalCount = this.tournamentService.totalCount;
  filters = this.tournamentService.filters;

  // Lucide icons for template
  readonly Plus = Plus;
  readonly Calendar = Calendar;
  readonly Trophy = Trophy;
  readonly Users = Users;
  readonly Pencil = Pencil;
  readonly Trash2 = Trash2;

  // Static hero images from Stitch design (cycled by index % 4)
  readonly HERO_IMAGES = [
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBdFti7gesoGr9LwHplW0LyiDwAyMqXhTdmztmL98pAgakWbR5tMFEuYXXVvRgToZaL4OzcHC3d8PPA9jXMHEv1D1FYGg3g06_kZud-vJqj4OabG0cS4cITMXYBjiDKL__nc8aYRpwOVzIouyuvipEvhihbXWTnFMTHibn9PjBsz10sGvjmlaeDWWW21ttdxU5-0A2VpQr5woSJV2anXO3fLv1td6vfEOYisPAIHuN3czaraGA2Q_wigoxf0INHkTxDQDEDfTXjvj_Z',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCpvfoiNcvO3Bq-XCtYvJsKMjucvzE74TVFhus5I8g2jvde6u4eCs2FKAsww4RzyX0PdcUQKdyw2RmoWUHhqyE43zX-AgTw6zVokoAU_R5JHVeQFGH6CmvE_LcG8y05gekLzNqXFNyDO2i40lsxXKZGZJh5zV0ubCPhvxGcoMxFTgwvM1EJ03AViFs1Opp5sheBlPLhmZ1xxwg1exzr2e-GuDeSaeauu4YbzxY4QJclq8FkxCL-o2d0x1XuS69F2XhBNyo08vEZZkLl',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuB4EUJMYaRTqf1YCT2h2G6TieP4vcdDqOXZQGrS9YPaIstwaxvjVHrbXBiK6yz1iM6veG8oObenO6CLfcic-fMgrrexaV-hnIjl-sBvBA5dKGllc7WQ4m52KipXLS_d8t2lU9yHyIwFWjZOUIDU9ir6I1ErAlu41AH_fc8tNOVg0qrfS7JV_3n_mYQV2wKISnNSrmO1osrz-S_N1EEhamhkj3OJvDi1Nt1AGD8gFaK5q6WfjttT4DOzputLwf9LFQhCDytVStvBalxN',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBzplQ67jucSjZZBhVAQcXJXF3BkObF9HW51vtN-kkFMQodoJ46YJ_gI7oDVHK_HU4lnEEuyS3IA8KAjicEIKcfMrrUryl7QX6tKjpDIOzV3rJtqw7yT7g8R98cXCdH5M0JF9791vhUdQASufEJ3GvNokTJaCuh1DKc7wabifZ1nX71tnG7r6-hWXZvUNp5HBSeboJKCc1qpLwJFe-YvoWbit7pm2RnnbKad0Wrd7U7ngJhRMa4WgoeuvpQLWtZZGBU4fPhVFqy5PJT',
  ];

  // Component state
  activeTab = signal<'all' | 'regional' | 'national'>('all');
  searchQuery = signal('');
  currentPage = signal<number>(1);
  perPage = 6;
  private searchTimeout?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.loadTournaments();
  }

  loadTournaments(): void {
    const leagueMap: Record<string, 'AMATEUR' | 'PRO' | undefined> = {
      regional: 'AMATEUR',
      national: 'PRO',
      all: undefined,
    };
    this.tournamentService.loadTournaments({
      status: 'all',
      league: leagueMap[this.activeTab()],
      search: this.searchQuery() || undefined,
      page: this.currentPage(),
      per_page: this.perPage,
    }).subscribe();
  }

  onTabChange(tab: 'all' | 'regional' | 'national'): void {
    this.activeTab.set(tab);
    this.currentPage.set(1);
    this.loadTournaments();
  }

  onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.currentPage.set(1);
      this.loadTournaments();
    }, 400);
  }

  /**
   * Navigate to tournament creation page
   */
  onCreateTournament(): void {
    this.router.navigate(['/admin/tournaments/create']);
  }

  /**
   * Register for a tournament
   */
  onRegister(tournamentId: number): void {
    this.tournamentService.registerForTournament(tournamentId).subscribe({
      next: () => {
        alert('Successfully registered for tournament!');
        this.loadTournaments();
      },
      error: (error) => {
        console.error('Failed to register:', error);

        // Extract error message from backend response
        let errorMessage = 'Failed to register for tournament';

        if (error.error?.error) {
          const backendError = error.error.error;

          // Provide user-friendly messages for specific errors
          if (backendError.includes('deadline has passed')) {
            errorMessage = 'Registration deadline has passed for this tournament';
          } else if (backendError.includes('full')) {
            errorMessage = 'This tournament is already full';
          } else if (backendError.includes('already registered')) {
            errorMessage = 'You are already registered for this tournament';
          } else if (backendError.includes('not open for registration')) {
            errorMessage = 'This tournament is not open for registration';
          } else {
            errorMessage = backendError;
          }
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }

        alert(errorMessage);
        this.loadTournaments();
      }
    });
  }

  /**
   * View tournament details (admin view)
   */
  onViewDetails(tournamentId: number): void {
    this.router.navigate(['/admin/tournaments', tournamentId]);
  }

  /**
   * Get status info for a tournament
   */
  getStatusInfo(tournament: Tournament): { class: string; label: string } {
    return this.tournamentService.getStatusInfo(tournament);
  }

  /**
   * Format tournament format for display
   */
  formatTournamentFormat(format: string): string {
    return this.tournamentService.formatTournamentFormat(format);
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    return this.tournamentService.formatDate(dateString);
  }

  /**
   * Format date range
   */
  formatDateRange(tournament: Tournament): string {
    return this.tournamentService.formatDate(tournament.start_date);
  }

  /**
   * Get participant info string
   */
  getParticipantInfo(tournament: Tournament): string {
    const current = (tournament as any).current_participants || 0;
    return `${current}/${tournament.max_participants} participants`;
  }

  /**
   * Check if tournament is full
   */
  isTournamentFull(tournament: Tournament): boolean {
    const current = (tournament as any).current_participants || 0;
    return current >= tournament.max_participants;
  }

  /**
   * Check if tournament allows registration
   */
  canRegister(tournament: Tournament): boolean {
    // Check status (both REGISTRATION and UPCOMING are valid)
    const validStatus = tournament.status === 'REGISTRATION' || tournament.status === 'UPCOMING';

    // Check if tournament is full
    const notFull = !this.isTournamentFull(tournament);

    // Check if registration deadline has not passed
    const now = new Date();
    const deadline = new Date(tournament.registration_deadline);
    const beforeDeadline = now < deadline;

    return validStatus && notFull && beforeDeadline;
  }

  /**
   * Handle pagination - next page
   */
  onNextPage(): void {
    const totalPages = Math.ceil(this.totalCount() / this.perPage);
    if (this.currentPage() < totalPages) {
      this.currentPage.set(this.currentPage() + 1);
      this.loadTournaments();
    }
  }

  /**
   * Handle pagination - previous page
   */
  onPrevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.set(this.currentPage() - 1);
      this.loadTournaments();
    }
  }

  /**
   * Get total pages
   */
  getTotalPages(): number {
    return Math.ceil(this.totalCount() / this.perPage);
  }

  /**
   * Edit tournament - navigate to edit page
   */
  onEditTournament(event: Event, tournamentId: number): void {
    event.stopPropagation();
    this.router.navigate(['/admin/tournaments', tournamentId, 'edit']);
  }

  /**
   * Delete tournament with confirmation
   */
  onDeleteTournament(event: Event, tournament: Tournament): void {
    event.stopPropagation();

    const confirmMessage = `Are you sure you want to delete "${tournament.name}"? This action cannot be undone.`;

    if (confirm(confirmMessage)) {
      this.tournamentService.deleteTournament(tournament.id).subscribe({
        next: () => {
          alert('Tournament deleted successfully');
          this.loadTournaments();
        },
        error: (error) => {
          console.error('Failed to delete tournament:', error);
          alert('Failed to delete tournament. Please try again.');
        }
      });
    }
  }

  clearError(): void {
    this.tournamentService.clearError();
  }

  // ── Card helper methods ──────────────────────────────────────

  getHeroImage(index: number): string {
    return this.HERO_IMAGES[index % 4];
  }

  getHeroBg(tournament: Tournament): string {
    const participants = tournament.participant_count || 0;
    switch (tournament.status) {
      case 'REGISTRATION': {
        if (participants >= tournament.max_participants) return '#C7B299';
        const days = Math.ceil(
          (new Date(tournament.registration_deadline).getTime() - Date.now()) / 86400000
        );
        return days <= 3 ? '#D9A066' : '#E9B68D';
      }
      case 'UPCOMING':    return '#E9B68D';
      case 'IN_PROGRESS': return '#D9A066';
      case 'COMPLETED':
      case 'CANCELLED':   return '#C7B299';
      default:            return '#E9B68D';
    }
  }

  getHeroBadge(tournament: Tournament): { label: string; color: string } {
    const participants = tournament.participant_count || 0;
    switch (tournament.status) {
      case 'REGISTRATION': {
        if (participants >= tournament.max_participants) return { label: 'CLOSED',    color: '#64748B' };
        const days = Math.ceil(
          (new Date(tournament.registration_deadline).getTime() - Date.now()) / 86400000
        );
        return days <= 3
          ? { label: 'LAST CALL', color: '#F97316' }
          : { label: 'OPEN',      color: '#10B981' };
      }
      case 'UPCOMING':    return { label: 'UPCOMING',  color: '#3B82F6' };
      case 'IN_PROGRESS': return { label: 'LIVE',       color: '#EAB308' };
      case 'COMPLETED':   return { label: 'ENDED',      color: '#64748B' };
      case 'CANCELLED':   return { label: 'CANCELLED',  color: '#EF4444' };
      default:            return { label: tournament.status, color: '#64748B' };
    }
  }

  isCardDimmed(tournament: Tournament): boolean {
    return tournament.status === 'COMPLETED' || tournament.status === 'CANCELLED';
  }

  isCardFull(tournament: Tournament): boolean {
    return (tournament.participant_count || 0) >= tournament.max_participants
      && tournament.status === 'REGISTRATION';
  }

  getFormatAbbr(format: string): string {
    const map: Record<string, string> = {
      SINGLE_ELIMINATION: 'SE',
      DOUBLE_ELIMINATION: 'DE',
      ROUND_ROBIN:        'RR',
      SWISS:              'SW',
      GROUP_KNOCKOUT:     'KO',
    };
    return map[format] || format;
  }

  formatStartDate(tournament: Tournament): string {
    return new Date(tournament.start_date).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  getLocation(tournament: Tournament): string {
    if (tournament.location) return tournament.location;
    if (tournament.league)   return tournament.league === 'PRO' ? 'National League' : 'Regional League';
    return 'TBA';
  }
}
