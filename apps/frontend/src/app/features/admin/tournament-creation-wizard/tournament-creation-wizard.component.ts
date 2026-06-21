import { Component, signal, computed, inject, OnInit, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, switchMap, of, forkJoin, concatMap } from 'rxjs';
import { TournamentService, RoundFormat } from '../../../core/services/tournament.service';
import { SeasonService } from '../../../core/services/season.service';
import { AwardTierService, AwardTierPayload } from '../../../core/services/award-tier.service';
import { AuthService } from '../../../core/services/auth.service';
import { MatchRulesStepComponent } from './steps/match-rules-step/match-rules-step.component';
import { environment } from '../../../../environments/environment';

type FormatId = 'single_elimination' | 'round_robin' | 'groups_ko';
type RegistrationMode = 'automatic' | 'manual';
type TierType = 'POSITION' | 'ALL_PARTICIPANTS' | 'SPECIFIC_USER';

interface FormatOption {
  id: FormatId;
  label: string;
  icon: string;
  desc: string;
}

interface AwardTierDraft {
  tierType: TierType;
  position: number | null;   // integer rank (1, 2, 3…) for POSITION type
  points: number;
  userId: number | null;     // resolved user ID for SPECIFIC_USER type
  username: string;          // display-only
  label: string;
}

interface UserSearchResult {
  id: number;
  username: string;
}

@Component({
  selector: 'app-tournament-creation-wizard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatchRulesStepComponent],
  templateUrl: './tournament-creation-wizard.component.html',
  styleUrl: './tournament-creation-wizard.component.css'
})
export class TournamentCreationWizardComponent implements OnInit {
  private tournamentService = inject(TournamentService);
  private seasonService = inject(SeasonService);
  private awardTierService = inject(AwardTierService);
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  private router = inject(Router);

  seasonLoading = signal(true);
  hasActiveSeason = signal(false);
  activeSeasonId = signal<number | null>(null);
  activeSeasonLabel = signal<string>('');
  saving = signal(false);
  currentStep = signal(1);

  readonly steps = [
    { number: 1, label: 'Basic Info' },
    { number: 2, label: 'Dates' },
    { number: 3, label: 'Format' },
    { number: 4, label: 'Award Tiers' },
    { number: 5, label: 'Review and Publish' },
  ];

  readonly formatOptions = signal<FormatOption[]>([
    {
      id: 'single_elimination',
      label: 'Single Elimination',
      icon: 'restart_alt',
      desc: "One loss and you're out. Fast-paced knockout.",
    },
    {
      id: 'round_robin',
      label: 'Round Robin',
      icon: 'grid_view',
      desc: 'Everyone plays everyone. Most fair but takes longer.',
    },
    {
      id: 'groups_ko',
      label: 'Groups + KO',
      icon: 'account_tree',
      desc: 'Initial group stages followed by a final bracket.',
    },
  ]);

  readonly tierTypeOptions: { value: TierType; label: string }[] = [
    { value: 'POSITION', label: 'Position' },
    { value: 'ALL_PARTICIPANTS', label: 'All Participants' },
    { value: 'SPECIFIC_USER', label: 'Specific Player' },
  ];

  // Step 1 form
  basicInfoForm = new FormGroup({
    tournamentName:   new FormControl('', [Validators.required]),
    startDate:        new FormControl('', [Validators.required]),
    location:         new FormControl(''),
    season:           new FormControl(''),
    prizeLabel:       new FormControl(''),
    tournamentFormat: new FormControl<FormatId>('single_elimination', [Validators.required]),
    maxPlayers:       new FormControl<number | null>(null),
  });

  // Step 2 form
  registrationForm = new FormGroup({
    registrationMode:     new FormControl<RegistrationMode>('manual'),
    registrationDeadline: new FormControl(''),
    isPublic:             new FormControl(true),
  });

  // Step 3 form
  rulesForm = new FormGroup({
    generalRules: new FormControl(''),
    isRated:      new FormControl(true),
  });

  // Award tiers (draft — not yet persisted)
  awardTiers = signal<AwardTierDraft[]>([
    { tierType: 'POSITION', position: 1, points: 500, userId: null, username: '', label: 'Champion' },
    { tierType: 'POSITION', position: 2, points: 250, userId: null, username: '', label: 'Runner Up' },
  ]);

  // Round formats — populated when reaching step 4
  roundFormats = signal<RoundFormat[]>([]);
  roundFormatsLoading = signal(false);

  showAddTier = signal(false);

  newTierForm = new FormGroup({
    tierType:       new FormControl<TierType>('POSITION', [Validators.required]),
    position:       new FormControl<number | null>(null),
    points:         new FormControl<number>(0, [Validators.required, Validators.min(1)]),
    playerUsername: new FormControl(''),
    label:          new FormControl(''),
  });

  // Username search state
  userSearchResults = signal<UserSearchResult[]>([]);
  userSearchLoading = signal(false);
  resolvedUserId = signal<number | null>(null);

  /** Shorthand accessors */
  get f()  { return this.basicInfoForm.controls; }
  get r()  { return this.registrationForm.controls; }
  get ru() { return this.rulesForm.controls; }
  get nt() { return this.newTierForm.controls; }

  isLastStep = computed(() => this.currentStep() === this.steps.length);

  /** Ordinal label for a position integer */
  ordinal(n: number | null): string {
    if (n == null) return '—';
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]} Place`;
  }

  ngOnInit(): void {
    this.seasonService.getActiveSeason().subscribe({
      next: (season) => {
        this.activeSeasonId.set(season.id);
        this.activeSeasonLabel.set(season.name);
        this.hasActiveSeason.set(true);
        this.seasonLoading.set(false);
        this.basicInfoForm.patchValue({ season: String(season.id) });
      },
      error: () => {
        this.hasActiveSeason.set(false);
        this.seasonLoading.set(false);
        this.basicInfoForm.patchValue({ season: '' });
      }
    });

    // Debounced username search
    this.nt['playerUsername'].valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => {
        const query = (q ?? '').trim();
        if (query.length < 2) {
          this.userSearchResults.set([]);
          this.resolvedUserId.set(null);
          return of([]);
        }
        this.userSearchLoading.set(true);
        const headers = new HttpHeaders({ Authorization: `Bearer ${this.authService.getToken()}` });
        return this.http.get<UserSearchResult[]>(
          `${environment.apiUrl}/users/search/?username=${encodeURIComponent(query)}`,
          { headers }
        );
      })
    ).subscribe({
      next: results => {
        this.userSearchResults.set(results);
        this.userSearchLoading.set(false);
      },
      error: () => { this.userSearchLoading.set(false); }
    });
  }

  selectUserResult(user: UserSearchResult): void {
    this.resolvedUserId.set(user.id);
    this.nt['playerUsername'].setValue(user.username, { emitEvent: false });
    this.userSearchResults.set([]);
  }

  selectFormat(id: FormatId): void {
    this.basicInfoForm.patchValue({ tournamentFormat: id });
  }

  selectRegistrationMode(mode: RegistrationMode): void {
    this.registrationForm.patchValue({ registrationMode: mode });
    if (mode === 'manual') {
      this.r['registrationDeadline'].clearValidators();
    } else {
      this.r['registrationDeadline'].setValidators([Validators.required]);
    }
    this.r['registrationDeadline'].updateValueAndValidity();
  }

  addTier(): void {
    this.newTierForm.markAllAsTouched();
    const v = this.newTierForm.value;
    const tierType = v.tierType as TierType;

    if (!tierType || !v.points) return;
    if (tierType === 'POSITION' && !v.position) {
      this.nt['position'].setErrors({ required: true });
      return;
    }
    if (tierType === 'SPECIFIC_USER' && !this.resolvedUserId()) {
      this.nt['playerUsername'].setErrors({ notResolved: true });
      return;
    }

    this.awardTiers.update(tiers => [...tiers, {
      tierType,
      position: tierType === 'POSITION' ? (v.position ?? null) : null,
      points: v.points ?? 0,
      userId: tierType === 'SPECIFIC_USER' ? this.resolvedUserId() : null,
      username: tierType === 'SPECIFIC_USER' ? (v.playerUsername ?? '') : '',
      label: v.label ?? '',
    }]);
    this.newTierForm.reset({ tierType: 'POSITION', position: null, points: 0, playerUsername: '', label: '' });
    this.resolvedUserId.set(null);
    this.userSearchResults.set([]);
    this.showAddTier.set(false);
  }

  removeTier(index: number): void {
    this.awardTiers.update(tiers => tiers.filter((_, i) => i !== index));
  }

  cancelAddTier(): void {
    this.showAddTier.set(false);
    this.newTierForm.reset({ tierType: 'POSITION', position: null, points: 0, playerUsername: '', label: '' });
    this.resolvedUserId.set(null);
    this.userSearchResults.set([]);
  }

  getBackendFormat(formatId: string | null): string {
    const map: Record<FormatId, string> = {
      single_elimination: 'SINGLE_ELIMINATION',
      round_robin:        'ROUND_ROBIN',
      groups_ko:          'GROUP_KNOCKOUT',
    };
    return map[formatId as FormatId] ?? 'SINGLE_ELIMINATION';
  }

  get reviewFormatLabel(): string {
    const map: Record<FormatId, string> = {
      single_elimination: 'Single Elimination',
      round_robin:        'Round Robin',
      groups_ko:          'Groups + KO',
    };
    return map[this.f['tournamentFormat'].value as FormatId] ?? '';
  }

  get reviewSeasonLabel(): string {
    const id = this.f['season'].value;
    if (!id) return '—';
    return this.activeSeasonLabel() || '—';
  }

  onNextStep(): void {
    if (this.currentStep() === 1) {
      this.basicInfoForm.markAllAsTouched();
      if (this.basicInfoForm.invalid) return;
    }
    if (this.currentStep() === 2) {
      if (this.r['registrationMode'].value === 'automatic' && !this.r['registrationDeadline'].value) {
        this.r['registrationDeadline'].setErrors({ required: true });
        return;
      }
    }
    if (!this.isLastStep()) {
      const nextStep = this.currentStep() + 1;
      this.currentStep.set(nextStep);
      // When entering step 4 (Match Rules), load defaults from current step 1 values
      if (nextStep === 4) {
        this.loadRoundFormatDefaults();
      }
    }
  }

  loadRoundFormatDefaults(): void {
    const bv = this.basicInfoForm.value;
    const backendFormat = this.getBackendFormat(bv.tournamentFormat as string);
    const maxPlayers = bv.maxPlayers ?? 32;
    this.roundFormatsLoading.set(true);
    this.tournamentService.previewRoundFormats(backendFormat, maxPlayers).subscribe({
      next: (formats) => {
        this.roundFormats.set(formats);
        this.roundFormatsLoading.set(false);
      },
      error: () => { this.roundFormatsLoading.set(false); }
    });
  }

  onPrevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update(s => s - 1);
    }
  }

  onCancel(): void {
    this.router.navigate(['/admin/tournament-overview']);
  }

  onSaveDraft(): void {
    this._submit('UPCOMING');
  }

  onCreateTournament(): void {
    this.basicInfoForm.markAllAsTouched();
    if (this.basicInfoForm.invalid) return;
    this._submit('REGISTRATION');
  }

  private _submit(status: string): void {
    this.saving.set(true);
    let createdTournamentId: number | null = null;
    const bv = this.basicInfoForm.value;
    const rv = this.registrationForm.value;
    const ruv = this.rulesForm.value;

    const startDate = bv.startDate
      ? new Date(bv.startDate + 'T09:00:00')
      : new Date();
    const startIso = startDate.toISOString();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    const endIso = endDate.toISOString();

    const modeMap: Record<RegistrationMode, string> = {
      automatic: 'AUTOMATIC',
      manual:    'MANUAL',
    };
    const backendMode = modeMap[rv.registrationMode as RegistrationMode] ?? 'MANUAL';

    const payload: Record<string, unknown> = {
      name:               (bv.tournamentName ?? '').trim(),
      description:        (ruv.generalRules ?? '').trim(),
      location:           (bv.location ?? '').trim(),
      is_public:          rv.isPublic ?? true,
      tournament_format:  this.getBackendFormat(bv.tournamentFormat as string),
      status,
      start_date:         startIso,
      end_date:           endIso,
      max_participants:   bv.maxPlayers ?? 32,
      min_participants:   4,
      registration_mode:  backendMode,
      is_rated:           ruv.isRated ?? true,
      prize_label:        (bv.prizeLabel ?? '').trim(),
    };

    if (bv.season) {
      payload['season'] = Number(bv.season);
    }
    if (backendMode === 'AUTOMATIC' && rv.registrationDeadline) {
      payload['registration_deadline'] = new Date(rv.registrationDeadline).toISOString();
    }

    // Phase 1: create tournament
    this.tournamentService.createTournament(payload).pipe(
      // Phase 2: post award tiers and round formats in parallel
      concatMap(tournament => {
        createdTournamentId = tournament.id;
        const tiers = this.awardTiers();
        const formats = this.roundFormats();

        const tierRequests = tiers.length
          ? tiers.map(t => {
              const tierPayload: AwardTierPayload = {
                tier_type: t.tierType,
                points:    t.points,
                label:     t.label,
                position:  t.tierType === 'POSITION' ? t.position : null,
                user:      t.tierType === 'SPECIFIC_USER' ? t.userId : null,
              };
              return this.awardTierService.createAwardTier(tournament.id, tierPayload);
            })
          : [of(null)];

        const saveFormats$ = formats.length
          ? this.tournamentService.saveRoundFormats(tournament.id, formats)
          : of(null);

        return forkJoin([
          forkJoin(tierRequests),
          saveFormats$,
        ]).pipe(concatMap(() => of({ tournament })));
      })
    ).subscribe({
      next: ({ tournament }) => {
        this.saving.set(false);
        this.router.navigate(['/admin/tournaments', tournament.id]);
      },
      error: (err) => {
        this.saving.set(false);
        console.warn('Post-creation step failed — navigate to detail anyway', err);
        if (createdTournamentId) {
          this.router.navigate(['/admin/tournaments', createdTournamentId]);
        }
      }
    });
  }
}
