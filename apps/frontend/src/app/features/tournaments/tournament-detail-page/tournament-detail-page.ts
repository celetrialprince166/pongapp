import { Component, OnInit, OnDestroy, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TournamentService } from '../../../core/services/tournament.service';
import { Tournament, TournamentParticipant, TournamentMatch } from '../../../core/models/tournament.model';
import { AuthService } from '../../../core/services/auth.service';
import { AwardTierService, AwardTierResponse } from '../../../core/services/award-tier.service';
import { TournamentBracketComponent } from '../components/tournament-bracket/tournament-bracket.component';

/**
 * Tournament Detail Page Component
 *
 * Displays detailed information about a tournament including:
 * - Tournament header with status and dates
 * - Tab navigation (Overview, Bracket, Matches, Participants)
 * - Registration/unregistration functionality
 * - Bracket visualization with horizontal scrolling
 * - Live match display and filtering
 * - Participant table with search and statistics
 *
 * Design reference: User-facing tournament detail view
 */
@Component({
  selector: 'app-tournament-detail-page',
  standalone: true,
  imports: [CommonModule, TournamentBracketComponent],
  templateUrl: './tournament-detail-page.html',
  styleUrl: './tournament-detail-page.css'
})
export class TournamentDetailPage implements OnInit, OnDestroy {
  private tournamentService = inject(TournamentService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private awardTierService = inject(AwardTierService);

  // Inject AuthService for role-based access control
  authService = inject(AuthService);

  // Component state
  tournament = signal<Tournament | null>(null);
  participants = signal<TournamentParticipant[]>([]);
  bracket = signal<TournamentMatch[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  activeTab = signal<'overview' | 'bracket' | 'matches' | 'participants' | 'awards'>('overview');
  isRegistered = signal(false);
  registering = signal(false);

  private bracketPollInterval: ReturnType<typeof setInterval> | null = null;
  private readonly BRACKET_POLL_MS = 30_000;

  // Award tiers tab state
  awardTiers = signal<AwardTierResponse[]>([]);
  awardTiersLoading = signal(false);
  awardTiersError = signal<string | null>(null);
  awardTiersPage = signal(1);
  readonly awardTiersPageSize = 10;

  awardTiersPaged = computed(() => {
    const start = (this.awardTiersPage() - 1) * this.awardTiersPageSize;
    return this.awardTiers().slice(start, start + this.awardTiersPageSize);
  });
  totalAwardTiersPages = computed(() =>
    Math.ceil(this.awardTiers().length / this.awardTiersPageSize)
  );
  topPoints = computed(() =>
    this.awardTiers().length
      ? Math.max(...this.awardTiers().map(t => t.points))
      : 0
  );

  // Registration success modal
  showRegistrationSuccessModal = signal(false);

  // Matches tab state
  matchFilter = signal<'all' | 'completed' | 'upcoming'>('all');

  // Participants tab state
  participantSearch = signal('');
  participantPage = signal(1);
  participantPageSize = 5;

  // Computed tournament ID from route
  tournamentId = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    return id ? parseInt(id, 10) : null;
  });

  ngOnInit(): void {
    const id = this.tournamentId();
    if (id) {
      this.loadTournamentData(id);
    } else {
      this.error.set('Invalid tournament ID');
    }
  }

  /**
   * Load all tournament data
   */
  loadTournamentData(tournamentId: number): void {
    this.loading.set(true);
    this.error.set(null);

    // Load tournament details
    this.tournamentService.getTournamentById(tournamentId).subscribe({
      next: (tournament) => {
        this.tournament.set(tournament);
        this.loading.set(false);

        // Load participants
        this.loadParticipants(tournamentId);

        // Load award tiers for the prizes sidebar
        this.loadAwardTiers();

        // Load bracket if tournament has started
        if (tournament.status === 'IN_PROGRESS' || tournament.status === 'COMPLETED') {
          this.loadBracket(tournamentId);
        }

        // Poll bracket every 30 s while tournament is live
        if (tournament.status === 'IN_PROGRESS') {
          this.startBracketPolling(tournamentId);
        } else {
          this.stopBracketPolling();
        }
      },
      error: (err) => {
        this.error.set('Failed to load tournament details');
        this.loading.set(false);
        console.error('Error loading tournament:', err);
      }
    });
  }

  /**
   * Load tournament participants
   */
  loadParticipants(tournamentId: number): void {
    this.tournamentService.getTournamentParticipants(tournamentId).subscribe({
      next: (participants) => {
        this.participants.set(participants);
        const currentUser = this.authService.currentUser();
        if (currentUser) {
          this.isRegistered.set(participants.some(p => p.player === currentUser.id));
        }
      },
      error: (err) => {
        console.error('Error loading participants:', err);
      }
    });
  }

  ngOnDestroy(): void {
    this.stopBracketPolling();
  }

  private startBracketPolling(tournamentId: number): void {
    if (this.bracketPollInterval !== null) return; // already polling
    this.bracketPollInterval = setInterval(() => {
      const t = this.tournament();
      if (!t || t.status !== 'IN_PROGRESS') {
        this.stopBracketPolling();
        return;
      }
      this.loadBracket(tournamentId);
    }, this.BRACKET_POLL_MS);
  }

  private stopBracketPolling(): void {
    if (this.bracketPollInterval !== null) {
      clearInterval(this.bracketPollInterval);
      this.bracketPollInterval = null;
    }
  }

  /**
   * Load tournament bracket
   */
  loadBracket(tournamentId: number): void {
    this.tournamentService.getTournamentBracket(tournamentId).subscribe({
      next: (bracket) => {
        this.bracket.set(bracket);
      },
      error: (err) => {
        console.error('Error loading bracket:', err);
      }
    });
  }

  /**
   * Switch active tab
   */
  switchTab(tab: 'overview' | 'bracket' | 'matches' | 'participants' | 'awards'): void {
    this.activeTab.set(tab);
    if (tab === 'awards' && this.awardTiers().length === 0 && !this.awardTiersLoading()) {
      this.loadAwardTiers();
    }
  }

  loadAwardTiers(): void {
    const id = this.tournamentId();
    if (!id) return;
    this.awardTiersLoading.set(true);
    this.awardTiersError.set(null);
    this.awardTierService.getAwardTiers(id).subscribe({
      next: (tiers) => {
        this.awardTiers.set(tiers);
        this.awardTiersLoading.set(false);
      },
      error: () => {
        this.awardTiersError.set('Failed to load award tiers.');
        this.awardTiersLoading.set(false);
      }
    });
  }

  /**
   * Register for tournament
   */
  onRegister(): void {
    const id = this.tournamentId();
    if (!id || this.registering()) return;

    this.registering.set(true);
    this.tournamentService.registerForTournament(id).subscribe({
      next: () => {
        this.isRegistered.set(true);
        this.registering.set(false);
        this.showRegistrationSuccessModal.set(true);
        // Reload tournament data to update participant count
        this.loadTournamentData(id);
      },
      error: (err) => {
        console.error('Error registering:', err);

        // Extract error message from backend response
        let errorMessage = 'Failed to register for tournament';

        if (err.error?.error) {
          const backendError = err.error.error;

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
        } else if (err.error?.message) {
          errorMessage = err.error.message;
        }

        this.error.set(errorMessage);
        this.registering.set(false);
        // Reload data to refresh state
        this.loadTournamentData(id);
      }
    });
  }

  /**
   * Unregister from tournament
   */
  onUnregister(): void {
    const id = this.tournamentId();
    if (!id || this.registering()) return;

    if (!confirm('Are you sure you want to unregister from this tournament?')) {
      return;
    }

    this.registering.set(true);
    // TODO: Implement unregister API call
    // For now, just mock it
    setTimeout(() => {
      this.isRegistered.set(false);
      this.registering.set(false);
      if (id) {
        this.loadTournamentData(id);
      }
    }, 500);
  }

  /**
   * Navigate back to tournament list
   */
  goBack(): void {
    this.router.navigate(['/tournaments']);
  }

  /**
   * Get status badge class
   */
  getStatusClass(tournament: Tournament): string {
    if (tournament.status === 'REGISTRATION' && tournament.is_full) {
      return 'status-badge status-full';
    }
    switch (tournament.status) {
      case 'REGISTRATION':
        if (!tournament.is_registration_open) return 'status-badge status-closed';
        return 'status-badge status-registration';
      case 'UPCOMING':
        return 'status-badge status-scheduled';
      case 'IN_PROGRESS':
        return 'status-badge status-in-progress';
      case 'COMPLETED':
        return 'status-badge status-completed';
      default:
        return 'status-badge';
    }
  }

  /**
   * Get status label
   */
  getStatusLabel(tournament: Tournament): string {
    if (tournament.status === 'REGISTRATION' && tournament.is_full) {
      return 'Full';
    }
    switch (tournament.status) {
      case 'REGISTRATION':
        if (!tournament.is_registration_open) return 'Registration Closed';
        return 'Registration Open';
      case 'UPCOMING':
        return 'Upcoming';
      case 'IN_PROGRESS':
        return 'In Progress';
      case 'COMPLETED':
        return 'Completed';
      default:
        return tournament.status;
    }
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Check if registration is open
   */
  canRegister(): boolean {
    const t = this.tournament();
    if (!t) return false;

    // Check status (both REGISTRATION and UPCOMING are valid)
    const validStatus = t.status === 'REGISTRATION' || t.status === 'UPCOMING';

    // Check if tournament is full
    const notFull = !t.is_full && t.participant_count < t.max_participants;

    // Check if registration deadline has not passed (null deadline = no restriction)
    const beforeDeadline = !t.registration_deadline || new Date() < new Date(t.registration_deadline);

    // Check if not already registered
    const notRegistered = !this.isRegistered();

    return validStatus && notFull && beforeDeadline && notRegistered;
  }

  /**
   * Clear error message
   */
  clearError(): void {
    this.error.set(null);
  }

  /**
   * Format tournament type for display
   */
  formatTournamentType(format: string): string {
    return format.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Get location (placeholder - backend doesn't have location field yet)
   */
  getLocation(): string {
    return 'Arena Center, Hall B';
  }

  /**
   * Get skill level (placeholder - backend doesn't have skill level field yet)
   */
  getSkillLevel(): string {
    return 'Intermediate - Pro';
  }

  /**
   * Get progress percentage for participant count
   */
  getProgressPercentage(): number {
    const t = this.tournament();
    if (!t || t.max_participants === 0) return 0;
    return (t.participant_count / t.max_participants) * 100;
  }

  /**
   * Get progress bar class based on fill percentage
   */
  getProgressBarClass(): string {
    const percentage = this.getProgressPercentage();
    if (percentage >= 90) return 'progress-full';
    if (percentage >= 70) return 'progress-high';
    return 'progress-normal';
  }

  /**
   * Get display participants (first 4)
   */
  getDisplayParticipants(): TournamentParticipant[] {
    return this.participants().slice(0, 4);
  }

  /**
   * Get remaining participants count
   */
  getRemainingParticipants(): number {
    const total = this.participants().length;
    return total > 4 ? total - 4 : 0;
  }

  /**
   * Get initials from name
   */
  getInitials(name: string): string {
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  /**
   * Get days until registration deadline
   */
  getDaysUntilDeadline(): number {
    const t = this.tournament();
    if (!t || !t.registration_deadline) return -1;

    const now = new Date();
    const deadline = new Date(t.registration_deadline);
    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  /**
   * Check if should show register button
   */
  canShowRegisterButton(): boolean {
    const t = this.tournament();
    if (!t) return false;

    const validStatus = t.status === 'REGISTRATION' || t.status === 'UPCOMING';
    const notFull = t.participant_count < t.max_participants;
    const beforeDeadline = !t.registration_deadline || new Date() < new Date(t.registration_deadline);

    return validStatus && notFull && beforeDeadline && !this.isRegistered();
  }

  /**
   * Get player initials for avatar
   */
  getPlayerInitials(name: string): string {
    if (!name || name === 'TBD') return 'TBD';
    return this.getInitials(name);
  }

  // ============================================
  // MATCHES TAB METHODS
  // ============================================

  /**
   * Get live matches (placeholder - would need backend support)
   */
  getLiveMatches(): TournamentMatch[] {
    // For now, return empty array
    // In real implementation, filter matches with status === 'LIVE'
    return [];
  }

  /**
   * Set match filter
   */
  setMatchFilter(filter: 'all' | 'completed' | 'upcoming'): void {
    this.matchFilter.set(filter);
  }

  /**
   * Get filtered matches grouped by round
   */
  getFilteredMatchesByRound(): { name: string; matches: TournamentMatch[] }[] {
    const filter = this.matchFilter();
    let matches = this.bracket();

    // Apply filter
    if (filter === 'completed') {
      matches = matches.filter(m => m.winner !== null && m.winner !== undefined);
    } else if (filter === 'upcoming') {
      matches = matches.filter(m => m.winner === null || m.winner === undefined);
    }

    // Group by round
    const roundMap = new Map<number, TournamentMatch[]>();
    matches.forEach(match => {
      if (!roundMap.has(match.round)) {
        roundMap.set(match.round, []);
      }
      roundMap.get(match.round)!.push(match);
    });

    // Convert to array and sort by round (descending - show latest first)
    const rounds = Array.from(roundMap.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([roundNum, roundMatches]) => ({
        name: `Round ${roundNum}`,
        matches: roundMatches
      }));

    return rounds;
  }

  /**
   * Get match end time (placeholder)
   */
  getMatchEndTime(match: TournamentMatch): string {
    // Placeholder - would need backend field
    return '2h ago';
  }

  /**
   * Get match scheduled time (placeholder)
   */
  getMatchScheduledTime(match: TournamentMatch): string {
    // Placeholder - would need backend field
    return 'Today, 16:30';
  }

  // ============================================
  // PARTICIPANTS TAB METHODS
  // ============================================

  /**
   * Handle participant search change
   */
  onParticipantSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.participantSearch.set(input.value);
    this.participantPage.set(1); // Reset to first page
  }

  /**
   * Get filtered participants based on search
   */
  getFilteredParticipants(): TournamentParticipant[] {
    const search = this.participantSearch().toLowerCase();
    if (!search) return this.participants();

    return this.participants().filter(p =>
      p.player_username?.toLowerCase().includes(search)
    );
  }

  /**
   * Get paginated participants
   */
  getPaginatedParticipants(): TournamentParticipant[] {
    const filtered = this.getFilteredParticipants();
    const start = (this.participantPage() - 1) * this.participantPageSize;
    const end = start + this.participantPageSize;
    return filtered.slice(start, end);
  }

  /**
   * Get participant offset for displaying row numbers
   */
  participantOffset(): number {
    return (this.participantPage() - 1) * this.participantPageSize;
  }

  /**
   * Get participant range start for pagination info
   */
  getParticipantRangeStart(): string {
    const filtered = this.getFilteredParticipants();
    const start = this.participantOffset() + 1;
    const end = Math.min(start + this.participantPageSize - 1, filtered.length);
    return `${start}-${end}`;
  }

  /**
   * Check if there are more participants to load
   */
  hasMoreParticipants(): boolean {
    const filtered = this.getFilteredParticipants();
    return this.participantPage() * this.participantPageSize < filtered.length;
  }

  /**
   * Go to next participant page
   */
  nextParticipantPage(): void {
    if (this.hasMoreParticipants()) {
      this.participantPage.set(this.participantPage() + 1);
    }
  }

  /**
   * Go to previous participant page
   */
  previousParticipantPage(): void {
    if (this.participantPage() > 1) {
      this.participantPage.set(this.participantPage() - 1);
    }
  }

  /**
   * Get participant club (placeholder)
   */
  getParticipantClub(participant: TournamentParticipant): string {
    // Placeholder - backend doesn't have club field
    const clubs = ['Elite TTC', 'Spin Masters', 'Independent', 'PowerLoop Academy', 'City League'];
    return clubs[Math.floor(Math.random() * clubs.length)];
  }

  /**
   * Get participant ELO rating (placeholder)
   */
  getParticipantELO(participant: TournamentParticipant): number {
    // Placeholder - backend doesn't have ELO field
    return 1800 + Math.floor(Math.random() * 400);
  }

  /**
   * Get participant trend (placeholder)
   */
  getParticipantTrend(participant: TournamentParticipant): string {
    // Placeholder
    const trends = ['+12', '+4', '-8', '+15', '-'];
    return trends[Math.floor(Math.random() * trends.length)];
  }

  /**
   * Get participant status
   */
  getParticipantStatus(participant: TournamentParticipant): string {
    // Placeholder - backend doesn't have status field
    return participant.seed && participant.seed <= 3 ? 'CONFIRMED' : 'PENDING PAY';
  }

  /**
   * Get participant status class
   */
  getParticipantStatusClass(participant: TournamentParticipant): string {
    const status = this.getParticipantStatus(participant);
    return status === 'CONFIRMED' ? 'status-confirmed' : 'status-pending';
  }

  /**
   * Get average ELO of all participants (placeholder)
   */
  getAverageELO(): number {
    // Placeholder calculation
    return 1982;
  }

  /**
   * Get count of unique clubs represented (placeholder)
   */
  getClubsCount(): number {
    // Placeholder
    return 8;
  }

  // ============================================
  // AWARDS TAB HELPERS
  // ============================================

  getTierIcon(tier: AwardTierResponse): string {
    if (tier.tier_type === 'ALL_PARTICIPANTS') return '🏅';
    if (tier.tier_type === 'SPECIFIC_USER') return '⭐';
    if (tier.position === 1) return '🥇';
    if (tier.position === 2) return '🥈';
    if (tier.position === 3) return '🥉';
    return '🏆';
  }

  getTierLabel(tier: AwardTierResponse): string {
    if (tier.tier_type === 'ALL_PARTICIPANTS') return 'All Participants';
    if (tier.tier_type === 'SPECIFIC_USER') return tier.user_username || 'Specific Player';
    if (tier.position === 1) return '1st Place';
    if (tier.position === 2) return '2nd Place';
    if (tier.position === 3) return '3rd Place';
    return `Position ${tier.position}`;
  }

  getTierPositionLabel(tier: AwardTierResponse): string {
    if (tier.tier_type === 'ALL_PARTICIPANTS') return 'All Participants';
    if (tier.tier_type === 'SPECIFIC_USER') return tier.user_username || '—';
    if (!tier.position) return '—';
    const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
    const suffix = suffixes[tier.position] ?? 'th';
    return `${tier.position}${suffix} Place`;
  }

  getPrizeMedalIcon(tier: AwardTierResponse): string {
    return this.getTierIcon(tier);
  }

  getPrizeTierLabel(tier: AwardTierResponse): string {
    if (tier.tier_type === 'ALL_PARTICIPANTS') return 'All Participants';
    if (tier.tier_type === 'SPECIFIC_USER') return tier.user_username || 'Special Award';
    if (!tier.position) return 'Award';
    const s: Record<number, string> = { 1: 'ST', 2: 'ND', 3: 'RD' };
    return `${tier.position}${s[tier.position] || 'TH'} PLACE`;
  }

  minOf(a: number, b: number): number {
    return Math.min(a, b);
  }

  prevAwardPage(): void {
    if (this.awardTiersPage() > 1) {
      this.awardTiersPage.set(this.awardTiersPage() - 1);
    }
  }

  nextAwardPage(): void {
    if (this.awardTiersPage() < this.totalAwardTiersPages()) {
      this.awardTiersPage.set(this.awardTiersPage() + 1);
    }
  }
}
