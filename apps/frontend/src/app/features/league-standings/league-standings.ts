import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LeaderboardService } from 'src/app/core/services/leaderboard.service';
import { LeaderboardEntry } from 'src/app/core/models/player.model';

@Component({
  selector: 'app-league-standings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './league-standings.html',
  styleUrls: ['./league-standings.css'],
})
export class LeagueStandings implements OnInit {
  // Signals
  allPlayers = signal<LeaderboardEntry[]>([]);
  isLoading = signal<boolean>(true);
  activeLeague = signal<'ALL' | 'AMATEUR' | 'PRO'>('ALL');
  searchTerm = signal<string>('');
  currentPage = signal<number>(1);
  pageSize = 10;

  constructor(private leaderboardService: LeaderboardService) { }

  ngOnInit(): void {
    this.loadLeaderboard();
  }

  // Computed signals
  filteredPlayers = computed(() => {
    let players = this.allPlayers();

    // Filter by league
    const league = this.activeLeague();
    if (league !== 'ALL') {
      players = players.filter(p => p.league === league);
    }

    // Filter by search term
    const search = this.searchTerm().toLowerCase().trim();
    if (search) {
      players = players.filter(p => {
        const firstName = p.first_name?.toLowerCase() || '';
        const lastName = p.last_name?.toLowerCase() || '';
        const fullName = firstName && lastName ? `${firstName} ${lastName}` : '';

        return p.username.toLowerCase().includes(search) ||
          firstName.includes(search) ||
          lastName.includes(search) ||
          fullName.includes(search);
      });
    }

    return players;
  });

  top3Players = computed(() => {
    return this.filteredPlayers().slice(0, 3);
  });

  paginatedPlayers = computed(() => {
    const filtered = this.filteredPlayers();
    const start = (this.currentPage() - 1) * this.pageSize;
    const end = start + this.pageSize;
    return filtered.slice(start, end);
  });

  totalPages = computed(() => {
    return Math.ceil(this.filteredPlayers().length / this.pageSize);
  });

  private loadLeaderboard(): void {
    this.isLoading.set(true);

    this.leaderboardService.getLeaderboard().subscribe({
      next: (players) => {
        this.allPlayers.set(players);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading leaderboard:', error);
        this.isLoading.set(false);
      }
    });
  }

  setActiveLeague(league: 'ALL' | 'AMATEUR' | 'PRO'): void {
    this.activeLeague.set(league);
    this.currentPage.set(1); // Reset to first page
  }

  onSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    this.currentPage.set(1); // Reset to first page
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  previousPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  getLeagueBadgeClass(league: string): string {
    return league === 'PRO' ? 'badge-pro' : 'badge-amateur';
  }

  getOrdinalSuffix(rank: number): string {
    const j = rank % 10;
    const k = rank % 100;
    if (j == 1 && k != 11) return 'st';
    if (j == 2 && k != 12) return 'nd';
    if (j == 3 && k != 13) return 'rd';
    return 'th';
  }
}
