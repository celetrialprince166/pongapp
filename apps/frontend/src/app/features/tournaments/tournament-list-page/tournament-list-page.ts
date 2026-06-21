import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TournamentService } from '../../../core/services/tournament.service';
import { Tournament } from '../../../core/models/tournament.model';
import { AuthService } from '../../../core/services/auth.service';
import { TournamentCardComponent, TournamentCardData } from '../../../shared/components/tournament-card/tournament-card.component';

/**
 * Tournament Discovery Page
 *
 * Stitch-aligned card-based tournament browsing with category filters,
 * image-header cards, 3-column stats grid, and Host Tournament CTA.
 */
@Component({
  selector: 'app-tournament-list-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TournamentCardComponent],
  templateUrl: './tournament-list-page.html',
  styleUrl: './tournament-list-page.css'
})
export class TournamentListPage implements OnInit {
  private tournamentService = inject(TournamentService);
  private router = inject(Router);
  authService = inject(AuthService);

  // Service signals
  tournaments = this.tournamentService.tournaments;
  loading = this.tournamentService.loading;
  error = this.tournamentService.error;

  // Component state
  searchTerm = signal('');
  statusFilter = signal<string>('all');
  activeTab = signal('All');
  currentPage = signal(1);
  readonly PAGE_SIZE = 9;
  isRegistering = signal(false);

  // Tab options
  tabs = ['All', 'Upcoming', 'Registration', 'In Progress', 'Completed'];

  // Filtered tournaments (all matching, before pagination)
  filteredTournaments = computed(() => {
    const search = this.searchTerm().toLowerCase();
    const status = this.statusFilter();
    let filtered = this.tournaments();

    if (status !== 'all') {
      filtered = filtered.filter((t: Tournament) => t.status === status);
    }

    if (search) {
      filtered = filtered.filter((t: Tournament) =>
        t.name.toLowerCase().includes(search) ||
        t.description?.toLowerCase().includes(search)
      );
    }

    return filtered;
  });

  // Pagination
  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredTournaments().length / this.PAGE_SIZE)));
  canGoPrev = computed(() => this.currentPage() > 1);
  canGoNext = computed(() => this.currentPage() < this.totalPages());
  paginationStart = computed(() => {
    const total = this.filteredTournaments().length;
    return total === 0 ? 0 : (this.currentPage() - 1) * this.PAGE_SIZE + 1;
  });
  paginationEnd = computed(() =>
    Math.min(this.currentPage() * this.PAGE_SIZE, this.filteredTournaments().length)
  );

  // Paginated slice
  paginatedTournaments = computed(() => {
    const start = (this.currentPage() - 1) * this.PAGE_SIZE;
    return this.filteredTournaments().slice(start, start + this.PAGE_SIZE);
  });

  ngOnInit(): void {
    this.loadTournaments();
  }

  loadTournaments(): void {
    this.tournamentService.loadTournaments().subscribe();
  }

  onTournamentClick(tournament: Tournament): void {
    this.router.navigate(['/tournaments', tournament.id]);
  }

  onSearchChange(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }

  onStatusFilterChange(status: string): void {
    this.statusFilter.set(status);
    this.currentPage.set(1);
  }

  onTabChange(tab: string): void {
    this.activeTab.set(tab);
    this.currentPage.set(1);
    switch (tab) {
      case 'Upcoming':      this.statusFilter.set('UPCOMING');      break;
      case 'Registration':  this.statusFilter.set('REGISTRATION');  break;
      case 'In Progress':   this.statusFilter.set('IN_PROGRESS');   break;
      case 'Completed':     this.statusFilter.set('COMPLETED');     break;
      default:              this.statusFilter.set('all');
    }
  }

  prevPage(): void { if (this.canGoPrev()) this.currentPage.update(p => p - 1); }
  nextPage(): void { if (this.canGoNext()) this.currentPage.update(p => p + 1); }

  clearError(): void { this.tournamentService.clearError(); }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  navigateToCreate(): void {
    this.router.navigate(['/admin/tournament-overview']);
  }

  onCardClick(tournamentId: number): void {
    this.router.navigate(['/tournaments', tournamentId]);
  }

  /** Map Tournament model to TournamentCardData for the card component */
  mapToCardData(tournament: Tournament): TournamentCardData {
    return {
      id: tournament.id,
      name: tournament.name,
      location: tournament.organizer_username || 'Tournament Venue',
      heroImage: '',
      heroColor: '#EEF2F7',
      status: this.getCardStatus(tournament),
      tournamentStatus: tournament.status,
      prize: this.getPrizeDisplay(tournament),
      participants: `${tournament.participant_count}/${tournament.max_participants}`,
      format: this.getFormatLabel(tournament.tournament_format),
      date: this.formatDate(tournament.start_date),
      isFull: tournament.participant_count >= tournament.max_participants,
      isRegistered: !!tournament.is_registered
    };
  }

  private getCardStatus(tournament: Tournament): 'open' | 'closing_soon' | 'closed' {
    if (tournament.status === 'COMPLETED' || tournament.status === 'CANCELLED' ||
        !tournament.is_registration_open) {
      return 'closed';
    }
    if ((tournament.participant_count / tournament.max_participants) >= 0.9) return 'closing_soon';
    return 'open';
  }

  private getPrizeDisplay(tournament: Tournament): string {
    const label = tournament.prize_label;
    if (!label) return '—';
    if (label.includes('$') || label.includes(',')) return label;
    const num = Number(label);
    if (!isNaN(num) && num > 0) return '$' + num.toLocaleString('en-US');
    return label;
  }

  private getFormatLabel(format: string): string {
    const map: Record<string, string> = {
      'SINGLE_ELIMINATION': 'Single Elimination',
      'DOUBLE_ELIMINATION': 'Double Elimination',
      'ROUND_ROBIN':        'Round Robin',
      'SWISS':              'Swiss',
      'GROUP_KNOCKOUT':     'Groups + KO',
      'MIXED':              'Mixed',
      'KO':                 'Single Elimination',
      'RR':                 'Round Robin',
      'DE':                 'Double Elimination',
    };
    return map[format] ?? format.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  getProgressPercentage(tournament: Tournament): number {
    if (tournament.max_participants === 0) return 0;
    return (tournament.participant_count / tournament.max_participants) * 100;
  }
}
