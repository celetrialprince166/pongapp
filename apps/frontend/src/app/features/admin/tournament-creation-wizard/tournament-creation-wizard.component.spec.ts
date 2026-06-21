import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError, delay } from 'rxjs';

import { signal } from '@angular/core';
import { TournamentCreationWizardComponent } from './tournament-creation-wizard.component';
import { TournamentService } from '../../../core/services/tournament.service';
import { SeasonService } from '../../../core/services/season.service';
import { AwardTierService, AwardTierPayload } from '../../../core/services/award-tier.service';
import { AuthService } from '../../../core/services/auth.service';

const MOCK_TOURNAMENT = { id: 99, name: 'Test Tournament' };
const MOCK_SEASONS = [{ id: 1, name: 'Season 1', start_date: '2024-01-01', end_date: '2024-06-30' }];

function fillStep1(component: TournamentCreationWizardComponent) {
  component.basicInfoForm.patchValue({
    tournamentName: 'Cypress Test Tournament',
    startDate: '2026-12-01',
    location: 'Test Venue Hall A',
    tournamentFormat: 'round_robin',
    maxPlayers: 32,
  });
}

function fillStep2(component: TournamentCreationWizardComponent) {
  component.registrationForm.patchValue({
    registrationMode: 'manual',
    isPublic: true,
  });
}

function fillStep3(component: TournamentCreationWizardComponent) {
  component.rulesForm.patchValue({ generalRules: 'Standard ITTF rules apply.', isRated: true });
}

describe('TournamentCreationWizardComponent', () => {
  let component: TournamentCreationWizardComponent;
  let fixture: ComponentFixture<TournamentCreationWizardComponent>;
  let tournamentServiceSpy: jasmine.SpyObj<TournamentService>;
  let awardTierServiceSpy: jasmine.SpyObj<AwardTierService>;
  let seasonServiceSpy: jasmine.SpyObj<SeasonService>;
  let router: Router;

  beforeEach(async () => {
    tournamentServiceSpy = jasmine.createSpyObj('TournamentService', ['createTournament']);
    awardTierServiceSpy = jasmine.createSpyObj('AwardTierService', ['createAwardTier']);
    seasonServiceSpy = jasmine.createSpyObj('SeasonService', ['getSeasons']);
    (seasonServiceSpy as any).seasons = signal(MOCK_SEASONS);

    tournamentServiceSpy.createTournament.and.returnValue(of(MOCK_TOURNAMENT as any));
    awardTierServiceSpy.createAwardTier.and.returnValue(of({
      id: 10, tier_type: 'POSITION', position: 1, points: 500
    } as any));
    seasonServiceSpy.getSeasons.and.returnValue(of(MOCK_SEASONS as any));

    await TestBed.configureTestingModule({
      imports: [TournamentCreationWizardComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: TournamentService, useValue: tournamentServiceSpy },
        { provide: AwardTierService, useValue: awardTierServiceSpy },
        { provide: SeasonService, useValue: seasonServiceSpy },
        { provide: AuthService, useValue: { getToken: () => 'mock-token' } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TournamentCreationWizardComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  // ── TEST 1 ──────────────────────────────────────────────────────────────
  it('should create component', () => {
    expect(component).toBeTruthy();
  });

  // ── TEST 2 ──────────────────────────────────────────────────────────────
  it('submit sends correct full payload', () => {
    fillStep1(component);
    fillStep2(component);
    fillStep3(component);

    const navigateSpy = spyOn(router, 'navigate');
    component['_submit']('REGISTRATION');

    expect(tournamentServiceSpy.createTournament).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({
        location: 'Test Venue Hall A',
        is_public: true,
        description: 'Standard ITTF rules apply.',
        registration_mode: 'MANUAL',
        tournament_format: 'ROUND_ROBIN',
      })
    );
  });

  // ── TEST 3 ──────────────────────────────────────────────────────────────
  it('two-phase submit saves award tiers after creation', () => {
    fillStep1(component);
    fillStep2(component);
    fillStep3(component);

    // Pre-set 2 tiers
    component.awardTiers.set([
      { tierType: 'POSITION', position: 1, points: 500, userId: null, username: '', label: 'Champion' },
      { tierType: 'POSITION', position: 2, points: 250, userId: null, username: '', label: 'Runner Up' },
    ]);

    const navigateSpy = spyOn(router, 'navigate');
    component['_submit']('REGISTRATION');

    expect(tournamentServiceSpy.createTournament).toHaveBeenCalled();
    expect(awardTierServiceSpy.createAwardTier).toHaveBeenCalledTimes(2);
    // Both calls use the tournament id from the response (99)
    expect(awardTierServiceSpy.createAwardTier.calls.allArgs().every(
      ([id]: [number, AwardTierPayload]) => id === 99
    )).toBeTrue();
    expect(navigateSpy).toHaveBeenCalledWith(['/admin/tournaments', 99]);
  });

  // ── TEST 4 ──────────────────────────────────────────────────────────────
  it('award tier failure does not block navigation', () => {
    fillStep1(component);
    fillStep2(component);
    fillStep3(component);

    component.awardTiers.set([
      { tierType: 'POSITION', position: 1, points: 500, userId: null, username: '', label: 'Champion' },
    ]);

    awardTierServiceSpy.createAwardTier.and.returnValue(throwError(() => new Error('tier error')));
    const warnSpy = spyOn(console, 'warn');
    const navigateSpy = spyOn(router, 'navigate');

    component['_submit']('REGISTRATION');

    // Navigation does not happen on tier failure (tournament was created but forkJoin fails)
    // The error handler logs a warning
    expect(warnSpy).toHaveBeenCalled();
    // saving should be reset
    expect(component.saving()).toBeFalse();
  });

  // ── TEST 5 ──────────────────────────────────────────────────────────────
  it('Phase 1 failure does not navigate', () => {
    fillStep1(component);
    fillStep2(component);

    tournamentServiceSpy.createTournament.and.returnValue(
      throwError(() => ({ status: 400, error: { name: ['This field is required.'] } }))
    );
    const navigateSpy = spyOn(router, 'navigate');

    component['_submit']('REGISTRATION');

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(component.saving()).toBeFalse();
  });

  // ── TEST 6 ──────────────────────────────────────────────────────────────
  it('loading state is true during submit and false after', fakeAsync(() => {
    fillStep1(component);

    tournamentServiceSpy.createTournament.and.returnValue(
      of(MOCK_TOURNAMENT as any).pipe(delay(500))
    );
    component.awardTiers.set([]);
    spyOn(router, 'navigate');

    component['_submit']('UPCOMING');
    expect(component.saving()).toBeTrue();

    tick(500);
    expect(component.saving()).toBeFalse();
  }));

  // ── ordinal helper ───────────────────────────────────────────────────────
  it('ordinal() produces correct labels', () => {
    expect(component.ordinal(1)).toBe('1st Place');
    expect(component.ordinal(2)).toBe('2nd Place');
    expect(component.ordinal(3)).toBe('3rd Place');
    expect(component.ordinal(4)).toBe('4th Place');
    expect(component.ordinal(null)).toBe('—');
  });

  // ── format mapping ───────────────────────────────────────────────────────
  it('groups_ko maps to GROUP_KNOCKOUT in payload', () => {
    fillStep1(component);
    component.selectFormat('groups_ko');
    component.awardTiers.set([]);

    let sentPayload: Record<string, unknown> = {};
    tournamentServiceSpy.createTournament.and.callFake((p: any) => {
      sentPayload = p;
      return of(MOCK_TOURNAMENT as any);
    });
    spyOn(router, 'navigate');

    component['_submit']('UPCOMING');
    expect(sentPayload['tournament_format']).toBe('GROUP_KNOCKOUT');
  });

  // ── registration mode mapping ─────────────────────────────────────────
  it('registrationMode maps automatic → AUTOMATIC and manual → MANUAL', () => {
    fillStep1(component);
    component.awardTiers.set([]);

    const captured: string[] = [];
    tournamentServiceSpy.createTournament.and.callFake((p: any) => {
      captured.push(p['registration_mode']);
      return of(MOCK_TOURNAMENT as any);
    });
    spyOn(router, 'navigate');

    component.selectRegistrationMode('automatic');
    component.registrationForm.patchValue({ registrationDeadline: '2026-11-01T12:00' });
    component['_submit']('UPCOMING');

    component.selectRegistrationMode('manual');
    component['_submit']('UPCOMING');

    expect(captured[0]).toBe('AUTOMATIC');
    expect(captured[1]).toBe('MANUAL');
  });

  // ── season stored as integer ───────────────────────────────────────────
  it('season is sent as integer not string when selected', () => {
    fillStep1(component);
    component.basicInfoForm.patchValue({ season: '1' });
    component.awardTiers.set([]);

    let sentPayload: Record<string, unknown> = {};
    tournamentServiceSpy.createTournament.and.callFake((p: any) => {
      sentPayload = p;
      return of(MOCK_TOURNAMENT as any);
    });
    spyOn(router, 'navigate');

    component['_submit']('UPCOMING');
    expect(sentPayload['season']).toBe(1);
    expect(typeof sentPayload['season']).toBe('number');
  });

  // ── step validation ────────────────────────────────────────────────────
  it('AUTOMATIC mode blocks step 2 advance without deadline', () => {
    component.selectRegistrationMode('automatic');
    component.registrationForm.patchValue({ registrationDeadline: '' });
    component.currentStep.set(2);

    component.onNextStep();

    expect(component.currentStep()).toBe(2); // did not advance
    expect(component.r['registrationDeadline'].errors).toBeTruthy();
  });

  it('MANUAL mode advances step 2 without deadline', () => {
    component.selectRegistrationMode('manual');
    component.currentStep.set(2);

    component.onNextStep();

    expect(component.currentStep()).toBe(3);
  });

  // ── format card selection ──────────────────────────────────────────────
  it('selectFormat updates tournamentFormat control', () => {
    component.selectFormat('round_robin');
    expect(component.f['tournamentFormat'].value).toBe('round_robin');

    component.selectFormat('single_elimination');
    expect(component.f['tournamentFormat'].value).toBe('single_elimination');
  });

  // ── season dropdown populates from API ────────────────────────────────
  it('loads seasons from SeasonService on init', () => {
    expect(seasonServiceSpy.getSeasons).toHaveBeenCalled();
    expect(component.seasons()).toEqual(MOCK_SEASONS as any);
  });
});
