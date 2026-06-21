import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TournamentService, RoundFormat } from '../../../core/services/tournament.service';
import { AuthService } from '../../../core/services/auth.service';
import { AwardTierService, AwardTierResponse } from '../../../core/services/award-tier.service';
import { MatchService } from '../../../core/services/match.service';
import { Tournament, TournamentParticipant, TournamentMatch } from '../../../core/models/tournament.model';
import { TournamentBracketComponent } from '../../tournaments/components/tournament-bracket/tournament-bracket.component';

@Component({
  selector: 'app-tournament-detail-admin',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, TournamentBracketComponent],
  templateUrl: './tournament-detail-admin.component.html',
  styleUrls: ['./tournament-detail-admin.component.css']
})
export class TournamentDetailAdminComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private tournamentService = inject(TournamentService);
  private authService = inject(AuthService);
  private awardTierService = inject(AwardTierService);
  private matchService = inject(MatchService);

  // State signals
  tournament = signal<Tournament | null>(null);
  participants = signal<TournamentParticipant[]>([]);
  matches = signal<TournamentMatch[]>([]);
  matchesLoading = signal<boolean>(false);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  actionLoading = signal<string | null>(null); // Track which action is loading

  // Modal states
  showDeleteModal = signal<boolean>(false);
  showStartModal = signal<boolean>(false);
  showCompleteModal = signal<boolean>(false);
  showCorrectionModal = signal<boolean>(false);
  modalMode = signal<'LIVE' | 'CORRECT'>('CORRECT');
  selectedMatch = signal<TournamentMatch | null>(null);
  startingMatchId = signal<number | null>(null);
  showRemoveModal = signal<boolean>(false);
  participantToRemove = signal<{ id: number; name: string } | null>(null);

  // Award tiers
  awardTiers = signal<AwardTierResponse[]>([]);
  showAddTierPanel = signal(false);
  tierSaving = signal(false);
  showDeleteTierModal = signal(false);
  tierToDelete = signal<{ id: number; label: string } | null>(null);
  newTierForm = new FormGroup({
    tierType:  new FormControl<string>('POSITION', [Validators.required]),
    position:  new FormControl<number | null>(null),
    points:    new FormControl<number>(0, [Validators.required, Validators.min(1), (c) => {
      const v = c.value;
      return v !== null && v !== undefined && !Number.isInteger(v) ? { notInteger: true } : null;
    }]),
    label:     new FormControl(''),
  });

  // Inline edit state
  editingTierId = signal<number | null>(null);
  editFormLabel = signal('');
  editFormPoints = signal(0);
  editFormPosition = signal<number | null>(null);
  editFormTierType = signal<string>('POSITION');

  // Duplicate error signals
  tierLabelError = signal<string | null>(null);
  editLabelError = signal<string | null>(null);
  tierPointsError = signal<string | null>(null);

  // Position duplicate error signals
  tierPositionError = signal<string | null>(null);
  editPositionError = signal<string | null>(null);

  // Distribute / Reset state
  distributing = signal(false);
  resetting = signal(false);

  // Round formats (Settings tab)
  roundFormats = signal<RoundFormat[]>([]);
  roundFormatsLoading = signal(false);
  roundFormatsSaving = signal(false);
  roundFormatsSaved = signal(false);

  readonly FORMAT_OPTIONS: { value: string; label: string }[] = [
    { value: 'BEST_OF_3',  label: 'Best of 3' },
    { value: 'BEST_OF_5',  label: 'Best of 5' },
    { value: 'BEST_OF_7',  label: 'Best of 7' },
    { value: 'RACE_TO_5',  label: 'Race to 5' },
    { value: 'RACE_TO_11', label: 'Race to 11' },
    { value: 'RACE_TO_21', label: 'Race to 21' },
  ];

  // Tab & search
  activeTab = signal<'overview' | 'participants' | 'brackets' | 'settings' | 'awards'>('overview');
  searchQuery = signal<string>('');

  filteredParticipants = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.participants();
    return this.participants().filter(p =>
      (p.player_username || '').toLowerCase().includes(q)
    );
  });

  recentParticipants = computed(() => this.filteredParticipants().slice(0, 5));

  // Computed values
  tournamentId = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    return id ? parseInt(id, 10) : null;
  });

  canStart = computed(() => {
    const t = this.tournament();
    return t && (t.status === 'REGISTRATION' || t.status === 'UPCOMING');
  });

  canComplete = computed(() => {
    const t = this.tournament();
    return t && t.status === 'IN_PROGRESS';
  });

  ngOnInit(): void {
    const tabParam = this.route.snapshot.queryParamMap.get('tab');
    const validTabs: Array<'overview' | 'participants' | 'brackets' | 'settings' | 'awards'> =
      ['overview', 'participants', 'brackets', 'settings', 'awards'];
    if (tabParam && validTabs.includes(tabParam as any)) {
      this.activeTab.set(tabParam as any);
    }
    this.loadTournament();
    const id = this.tournamentId();
    if (id) {
      this.loadAwardTiers(id);
      this.loadRoundFormats(id);
    }
  }

  setTab(tab: 'overview' | 'participants' | 'brackets' | 'settings' | 'awards'): void {
    this.activeTab.set(tab);
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, queryParamsHandling: 'merge' });
  }

  /**
   * Load tournament data
   */
  loadTournament(): void {
    const id = this.tournamentId();
    if (!id) {
      this.error.set('Invalid tournament ID');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.tournamentService.getTournamentById(id).subscribe({
      next: (tournament) => {
        this.tournament.set(tournament);
        this.loadParticipants(id);
      },
      error: (err) => {
        console.error('Error loading tournament:', err);
        this.error.set('Failed to load tournament');
        this.loading.set(false);
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
        this.loading.set(false);
        this.loadMatches(tournamentId);
      },
      error: (err) => {
        console.error('Error loading participants:', err);
        this.loading.set(false);
      }
    });
  }

  /**
   * Load tournament matches (bracket) for IN_PROGRESS / COMPLETED tournaments
   */
  loadMatches(tournamentId: number): void {
    this.matchesLoading.set(true);
    this.tournamentService.getTournamentBracket(tournamentId).subscribe({
      next: (matches) => {
        this.matches.set(matches);
        this.matchesLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading matches:', err);
        this.matchesLoading.set(false);
      }
    });
  }

  /**
   * Navigate to full-page scoring for IN_PROGRESS matches
   */
  openScoreModal(match: TournamentMatch): void {
    if (!match.match) return;
    const tid = this.tournamentId();
    this.router.navigate(['/admin/matches', match.match, 'score'], {
      queryParams: { tournament: tid }
    });
  }

  /**
   * Open correction modal in CORRECT mode (for COMPLETED matches)
   */
  openCorrectModal(match: TournamentMatch): void {
    this.selectedMatch.set(match);
    this.modalMode.set('CORRECT');
    this.showCorrectionModal.set(true);
  }

  /**
   * Start a SCHEDULED match then navigate to full-page scoring
   */
  startAndScore(match: TournamentMatch): void {
    if (!match.match) {
      this.error.set('This match has no scoring record. Please refresh and try again.');
      return;
    }
    this.startingMatchId.set(match.match);
    this.matchService.startMatch(match.match).subscribe({
      next: () => {
        this.startingMatchId.set(null);
        const tid = this.tournamentId();
        this.router.navigate(['/admin/matches', match.match, 'score'], {
          queryParams: { tournament: tid }
        });
      },
      error: (err) => {
        this.startingMatchId.set(null);
        this.error.set(err?.error?.detail ?? 'Failed to start match.');
      }
    });
  }

  /**
   * Close scoring/correction modal
   */
  closeCorrectionModal(): void {
    this.showCorrectionModal.set(false);
    this.selectedMatch.set(null);
  }

  /**
   * Handle score saved — update match in local list and reload bracket
   */
  onScoreSaved(updatedMatch: TournamentMatch): void {
    const current = this.matches();
    const updated = current.map(m => m.id === updatedMatch.id ? updatedMatch : m);
    this.matches.set(updated);
    this.closeCorrectionModal();
    // Reload bracket to pick up advancement
    const id = this.tournamentId();
    if (id) this.loadMatches(id);
  }

  /**
   * Get match status label
   */
  getMatchStatusLabel(match: TournamentMatch): string {
    if (match.is_bye) return 'BYE';
    if (match.status === 'completed' || match.completed_at) return 'Completed';
    if (match.status === 'live') return 'Live';
    return 'Pending';
  }

  /**
   * Get match status CSS class
   */
  getMatchStatusClass(match: TournamentMatch): string {
    if (match.is_bye) return 'match-status-bye';
    if (match.status === 'completed' || match.completed_at) return 'match-status-completed';
    if (match.status === 'live') return 'match-status-live';
    return 'match-status-pending';
  }

  /**
   * Load round formats for Settings tab
   */
  loadRoundFormats(tournamentId: number): void {
    this.roundFormatsLoading.set(true);
    this.tournamentService.getRoundFormats(tournamentId).subscribe({
      next: (formats) => {
        this.roundFormats.set(formats);
        this.roundFormatsLoading.set(false);
      },
      error: () => { this.roundFormatsLoading.set(false); }
    });
  }

  updateRoundFormatLocal(roundNumber: number, format: string): void {
    this.roundFormats.update(rows =>
      rows.map(r => r.round_number === roundNumber
        ? { ...r, match_format: format as RoundFormat['match_format'] }
        : r
      )
    );
    this.roundFormatsSaved.set(false);
  }

  saveRoundFormats(): void {
    const id = this.tournamentId();
    if (!id || this.roundFormatsSaving()) return;
    this.roundFormatsSaving.set(true);
    this.tournamentService.saveRoundFormats(id, this.roundFormats()).subscribe({
      next: (saved) => {
        this.roundFormats.set(saved);
        this.roundFormatsSaving.set(false);
        this.roundFormatsSaved.set(true);
        setTimeout(() => this.roundFormatsSaved.set(false), 3000);
      },
      error: () => { this.roundFormatsSaving.set(false); }
    });
  }

  /**
   * Open edit modal
   */
  openEditModal(): void {
    const id = this.tournamentId();
    if (!id) return;
    this.router.navigate(['/admin/tournaments', id, 'edit']);
  }

  /**
   * Open delete confirmation modal
   */
  openDeleteModal(): void {
    this.showDeleteModal.set(true);
  }

  /**
   * Close delete modal
   */
  closeDeleteModal(): void {
    this.showDeleteModal.set(false);
  }

  /**
   * Open start tournament modal
   */
  openStartModal(): void {
    this.showStartModal.set(true);
  }

  /**
   * Close start modal
   */
  closeStartModal(): void {
    this.showStartModal.set(false);
  }

  /**
   * Open complete tournament modal
   */
  openCompleteModal(): void {
    this.showCompleteModal.set(true);
  }

  /**
   * Close complete modal
   */
  closeCompleteModal(): void {
    this.showCompleteModal.set(false);
  }

  /**
   * Delete tournament
   */
  deleteTournament(): void {
    const id = this.tournamentId();
    if (!id) return;

    this.actionLoading.set('delete');

    this.tournamentService.deleteTournament(id).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.closeDeleteModal();
        // Navigate back to admin overview
        this.router.navigate(['/admin/tournaments']);
      },
      error: (err) => {
        console.error('Error deleting tournament:', err);
        this.error.set('Failed to delete tournament');
        this.actionLoading.set(null);
      }
    });
  }

  /**
   * Start tournament
   */
  startTournament(): void {
    const id = this.tournamentId();
    if (!id) return;

    this.actionLoading.set('start');

    this.tournamentService.startTournament(id).subscribe({
      next: (updatedTournament) => {
        this.tournament.set(updatedTournament);
        this.actionLoading.set(null);
        this.closeStartModal();
      },
      error: (err) => {
        console.error('Error starting tournament:', err);
        const msg = err?.error?.detail ||
                    err?.error?.message ||
                    err?.error?.error ||
                    'Failed to start tournament. Check that all participants are confirmed.';
        this.error.set(msg);
        this.actionLoading.set(null);
      }
    });
  }

  /**
   * Complete tournament
   */
  completeTournament(): void {
    const id = this.tournamentId();
    if (!id) return;

    this.actionLoading.set('complete');

    this.tournamentService.completeTournament(id).subscribe({
      next: (updatedTournament) => {
        this.tournament.set(updatedTournament);
        this.actionLoading.set(null);
        this.closeCompleteModal();
      },
      error: (err) => {
        console.error('Error completing tournament:', err);
        this.error.set('Failed to complete tournament');
        this.actionLoading.set(null);
      }
    });
  }

  /**
   * Open remove participant confirmation modal
   */
  openRemoveModal(participant: TournamentParticipant): void {
    this.participantToRemove.set({ id: participant.id, name: participant.player_username || 'this participant' });
    this.showRemoveModal.set(true);
  }

  /**
   * Close remove participant modal
   */
  closeRemoveModal(): void {
    this.showRemoveModal.set(false);
    this.participantToRemove.set(null);
  }

  /**
   * Confirm and execute participant removal
   */
  confirmRemoveParticipant(): void {
    const p = this.participantToRemove();
    if (!p) return;
    const tournamentId = this.tournamentId();
    if (!tournamentId) return;

    this.actionLoading.set(`remove-${p.id}`);
    this.closeRemoveModal();

    this.tournamentService.removeParticipant(tournamentId, p.id).subscribe({
      next: () => {
        this.loadParticipants(tournamentId);
        this.actionLoading.set(null);
      },
      error: (err) => {
        console.error('Error removing participant:', err);
        this.error.set('Failed to remove participant');
        this.actionLoading.set(null);
      }
    });
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    return this.tournamentService.formatDate(dateString);
  }

  /**
   * Format tournament format for display
   */
  formatTournamentFormat(format: string): string {
    return this.tournamentService.formatTournamentFormat(format);
  }

  /**
   * Get status badge info
   */
  getStatusInfo(tournament: Tournament): { class: string; label: string } {
    return this.tournamentService.getStatusInfo(tournament);
  }

  /**
   * Check if a number is a power of 2
   */
  isPowerOfTwo(num: number): boolean {
    return num > 0 && (num & (num - 1)) === 0;
  }

  // ─── Award Tier Methods ───────────────────────────────────────────────────

  loadAwardTiers(tournamentId: number): void {
    this.awardTierService.getAwardTiers(tournamentId).subscribe({
      next: tiers => this.awardTiers.set(tiers),
      error: err => console.warn('Could not load award tiers', err),
    });
  }

  get nt() { return this.newTierForm.controls; }

  ordinal(n: number | null | undefined): string {
    if (n == null) return '—';
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]} Place`;
  }

  onNewTierPositionInput(event: Event): void {
    const val = +(event.target as HTMLInputElement).value;
    if (!val) { this.tierPositionError.set(null); return; }
    const duplicate = this.awardTiers().some(
      t => t.tier_type === 'POSITION' && t.position === val
    );
    this.tierPositionError.set(
      duplicate ? 'This position rank already has a tier assigned.' : null
    );
  }

  onNewTierLabelInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value.trim();
    if (!val) { this.tierLabelError.set(null); return; }
    const duplicate = this.awardTiers().some(
      t => t.label?.toLowerCase() === val.toLowerCase()
    );
    this.tierLabelError.set(
      duplicate ? 'An award tier with this name already exists.' : null
    );
  }

  saveNewTier(): void {
    this.newTierForm.markAllAsTouched();
    const v = this.newTierForm.value;
    if (v.tierType === 'POSITION' && !v.position) {
      this.nt['position'].setErrors({ required: true });
    }
    if (this.newTierForm.invalid) return;
    if (v.tierType === 'POSITION' && !v.position) return;
    if (this.tierPositionError()) return;
    if (this.tierLabelError()) return;
    const id = this.tournamentId();
    if (!id) return;
    this.tierSaving.set(true);
    this.awardTierService.createAwardTier(id, {
      tier_type: v.tierType as 'POSITION' | 'ALL_PARTICIPANTS' | 'SPECIFIC_USER',
      points: v.points ?? 0,
      label: v.label ?? '',
      position: v.tierType === 'POSITION' ? (v.position ?? null) : null,
      user: null,
    }).subscribe({
      next: () => {
        this.tierSaving.set(false);
        this.tierPositionError.set(null);
        this.tierLabelError.set(null);
        this.tierPointsError.set(null);
        this.showAddTierPanel.set(false);
        this.newTierForm.reset({ tierType: 'POSITION', position: null, points: 0, label: '' });
        this.loadAwardTiers(id);
      },
      error: err => {
        this.tierSaving.set(false);
        const posErr = err?.error?.position;
        const lblErr = err?.error?.label;
        const ptsErr = err?.error?.points;
        if (posErr) {
          this.tierPositionError.set(Array.isArray(posErr) ? posErr[0] : posErr);
        } else if (lblErr) {
          this.tierLabelError.set(Array.isArray(lblErr) ? lblErr[0] : lblErr);
        } else if (ptsErr) {
          this.tierPointsError.set(Array.isArray(ptsErr) ? ptsErr[0] : ptsErr);
        } else {
          console.error('Failed to create tier', err);
        }
      },
    });
  }

  openDeleteTierModal(tier: AwardTierResponse): void {
    const label = tier.label || `Position ${tier.position ?? ''}`.trim();
    this.tierToDelete.set({ id: tier.id, label });
    this.showDeleteTierModal.set(true);
  }

  cancelDeleteTier(): void {
    this.showDeleteTierModal.set(false);
    this.tierToDelete.set(null);
  }

  confirmDeleteTier(): void {
    const id = this.tournamentId();
    const tier = this.tierToDelete();
    if (!id || !tier) return;
    this.awardTierService.deleteAwardTier(id, tier.id).subscribe({
      next: () => {
        this.loadAwardTiers(id);
        this.cancelDeleteTier();
      },
      error: err => console.error('Failed to delete tier', err),
    });
  }

  // ─── Add Tier Form ────────────────────────────────────────────────────────

  toggleAddTierForm(): void {
    this.showAddTierPanel.update(v => !v);
  }

  cancelAddTier(): void {
    this.showAddTierPanel.set(false);
    this.tierPositionError.set(null);
    this.tierLabelError.set(null);
    this.newTierForm.reset({ tierType: 'POSITION', position: null, points: 0, label: '' });
  }

  saveTier(): void {
    this.saveNewTier();
  }

  // ─── Inline Edit ──────────────────────────────────────────────────────────

  startInlineEdit(tier: AwardTierResponse): void {
    this.editingTierId.set(tier.id);
    this.editFormLabel.set(tier.label || '');
    this.editFormPoints.set(tier.points);
    this.editFormPosition.set(tier.position ?? null);
    this.editFormTierType.set(tier.tier_type);
    this.editPositionError.set(null);
    this.editLabelError.set(null);
  }

  cancelInlineEdit(): void {
    this.editingTierId.set(null);
    this.editPositionError.set(null);
    this.editLabelError.set(null);
  }

  saveInlineEdit(tierId: number): void {
    if (this.editPositionError()) return;
    if (this.editLabelError()) return;
    const tournId = this.tournamentId();
    if (!tournId) return;
    this.awardTierService.updateAwardTier(tournId, tierId, {
      label:     this.editFormLabel(),
      points:    this.editFormPoints(),
      position:  this.editFormPosition(),
      tier_type: this.editFormTierType() as 'POSITION' | 'ALL_PARTICIPANTS' | 'SPECIFIC_USER',
    }).subscribe({
      next: () => {
        this.editingTierId.set(null);
        this.editPositionError.set(null);
        this.editLabelError.set(null);
        this.loadAwardTiers(tournId);
      },
      error: err => {
        const posErr = err?.error?.position;
        const lblErr = err?.error?.label;
        if (posErr) {
          this.editPositionError.set(Array.isArray(posErr) ? posErr[0] : posErr);
        } else if (lblErr) {
          this.editLabelError.set(Array.isArray(lblErr) ? lblErr[0] : lblErr);
        } else {
          console.error('Failed to update tier', err);
          this.error.set('Failed to update tier');
        }
      },
    });
  }

  setEditLabel(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.editFormLabel.set(val);
    const trimmed = val.trim();
    if (!trimmed) { this.editLabelError.set(null); return; }
    const currentId = this.editingTierId();
    const duplicate = this.awardTiers().some(
      t => t.label?.toLowerCase() === trimmed.toLowerCase() && t.id !== currentId
    );
    this.editLabelError.set(
      duplicate ? 'An award tier with this name already exists.' : null
    );
  }

  setEditPoints(event: Event): void {
    this.editFormPoints.set(+(event.target as HTMLInputElement).value);
  }

  setEditPosition(event: Event): void {
    const val = +(event.target as HTMLSelectElement).value;
    this.editFormPosition.set(val);
    const currentId = this.editingTierId();
    const duplicate = this.awardTiers().some(
      t => t.tier_type === 'POSITION' && t.position === val && t.id !== currentId
    );
    this.editPositionError.set(
      duplicate ? 'This position rank already has a tier assigned.' : null
    );
  }

  // ─── Distribute / Reset ───────────────────────────────────────────────────

  distributeAwards(): void {
    const id = this.tournamentId();
    if (!id) return;
    this.distributing.set(true);
    this.awardTierService.distributeAwards(id).subscribe({
      next: (res) => {
        this.distributing.set(false);
        this.loadAwardTiers(id);
        console.log(`Distributed ${res.distributed} awards`);
      },
      error: err => {
        this.distributing.set(false);
        this.error.set(err?.error?.error ?? 'Failed to distribute awards');
      },
    });
  }

  resetAwards(): void {
    const id = this.tournamentId();
    if (!id) return;
    this.resetting.set(true);
    this.awardTierService.resetAwards(id).subscribe({
      next: () => {
        this.resetting.set(false);
        this.loadAwardTiers(id);
      },
      error: err => {
        this.resetting.set(false);
        this.error.set(err?.error?.error ?? 'Failed to reset awards');
      },
    });
  }

  // ─── Display Helpers ──────────────────────────────────────────────────────

  getTopPoints(): number {
    const tiers = this.awardTiers();
    return tiers.length ? Math.max(...tiers.map(t => t.points)) : 0;
  }

  getTierIcon(tier: AwardTierResponse): string {
    if (tier.tier_type === 'ALL_PARTICIPANTS') return '🏅';
    if (tier.tier_type === 'SPECIFIC_USER') return '⭐';
    if (tier.position === 1) return '🥇';
    if (tier.position === 2) return '🥈';
    if (tier.position === 3) return '🥉';
    return '🏆';
  }

  getTierDisplayName(tier: AwardTierResponse): string {
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
    const s: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
    return `${tier.position}${s[tier.position] ?? 'th'} Place`;
  }

  getTierIconBoxClass(tier: AwardTierResponse): string {
    if (tier.tier_type === 'ALL_PARTICIPANTS') return 'tier-icon-box-green';
    if (tier.tier_type === 'SPECIFIC_USER') return 'tier-icon-box-purple';
    if (tier.position === 1) return 'tier-icon-box-yellow';
    if (tier.position === 2) return 'tier-icon-box-slate';
    if (tier.position === 3) return 'tier-icon-box-orange';
    return 'tier-icon-box-slate';
  }

  getTotalPoints(): number {
    return this.awardTiers().reduce((sum, t) => sum + t.points, 0);
  }
}
