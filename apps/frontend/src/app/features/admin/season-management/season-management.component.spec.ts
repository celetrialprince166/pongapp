import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';

import { SeasonManagementComponent } from './season-management.component';
import {
  SeasonManagementService,
  Season,
  SeasonListResponse
} from '../../../core/services/season-management.service';

function mockSeason(overrides: Partial<Season> = {}): Season {
  return {
    id: 1,
    name: 'Test Season',
    start_date: '2026-06-01T00:00:00Z',
    end_date: '2026-08-31T23:59:59Z',
    is_active: false,
    status: 'upcoming',
    player_count: 0,
    ...overrides,
  };
}

function mockListResp(seasons: Season[]): SeasonListResponse {
  return { count: seasons.length, next: null, previous: null, results: seasons };
}

describe('SeasonManagementComponent', () => {
  let component: SeasonManagementComponent;
  let fixture: ComponentFixture<SeasonManagementComponent>;
  let serviceSpy: jasmine.SpyObj<SeasonManagementService>;

  // Writable signals for testing
  let seasonsValue: Season[] = [];

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('SeasonManagementService', [
      'loadSeasons', 'createSeason', 'updateSeason', 'endSeason',
      'archiveSeason', 'clearError', 'updateSeasons', 'calculateSeasonStatus',
      'formatDate',
    ], {
      seasons: jasmine.createSpy().and.callFake(() => seasonsValue),
      loading: jasmine.createSpy().and.returnValue(false),
      error: jasmine.createSpy().and.returnValue(null),
      filters: jasmine.createSpy().and.returnValue({ page: 1, per_page: 10 }),
    });

    serviceSpy.loadSeasons.and.returnValue(of(mockListResp([])));
    serviceSpy.calculateSeasonStatus.and.returnValue('upcoming');
    serviceSpy.formatDate.and.callFake((d: string) => new Date(d).toLocaleDateString());

    await TestBed.configureTestingModule({
      imports: [SeasonManagementComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SeasonManagementService, useValue: serviceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SeasonManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── TEST 1 ────────────────────────────────────────────────────────────
  it('should create component', () => {
    expect(component).toBeTruthy();
  });

  // ── TEST 2 ────────────────────────────────────────────────────────────
  it('should load seasons on init', () => {
    expect(serviceSpy.loadSeasons).toHaveBeenCalled();
  });

  // ── TEST 3 ────────────────────────────────────────────────────────────
  it('season form should be invalid when empty', () => {
    component.seasonForm.set({ name: '', start_date: '', end_date: '', is_active: true });
    expect(component.validateForm()).toBeFalse();
    expect(component.formErrors()['name']).toBeTruthy();
    expect(component.formErrors()['start_date']).toBeTruthy();
    expect(component.formErrors()['end_date']).toBeTruthy();
  });

  // ── TEST 4 ────────────────────────────────────────────────────────────
  it('season form should be valid with required fields', () => {
    component.seasonForm.set({
      name: 'Spring League',
      start_date: '2026-03-01',
      end_date: '2026-05-31',
      is_active: false,
    });
    expect(component.validateForm()).toBeTrue();
    expect(Object.keys(component.formErrors())).toHaveSize(0);
  });

  // ── TEST 5 ────────────────────────────────────────────────────────────
  it('end_date before start_date should fail validation', () => {
    component.seasonForm.set({
      name: 'Bad Dates',
      start_date: '2026-06-01',
      end_date: '2026-01-01',
      is_active: false,
    });
    expect(component.validateForm()).toBeFalse();
    expect(component.formErrors()['end_date']).toContain('after start date');
  });

  // ── TEST 6 ────────────────────────────────────────────────────────────
  it('submitting form calls createSeason with correct payload', () => {
    serviceSpy.createSeason.and.returnValue(of(mockSeason({ id: 99, name: 'Spring League' })));
    serviceSpy.loadSeasons.and.returnValue(of(mockListResp([])));

    component.seasonForm.set({
      name: 'Spring League',
      start_date: '2026-03-01',
      end_date: '2026-05-31',
      is_active: true,
    });

    component.onCreateSeason();

    expect(serviceSpy.createSeason).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({ name: 'Spring League', is_active: true })
    );
  });

  // ── TEST 7 ────────────────────────────────────────────────────────────
  it('modal closes and seasons reload after successful create', () => {
    serviceSpy.createSeason.and.returnValue(of(mockSeason({ id: 99 })));
    serviceSpy.loadSeasons.and.returnValue(of(mockListResp([])));

    component.showCreateModal.set(true);
    component.seasonForm.set({
      name: 'New Season',
      start_date: '2026-03-01',
      end_date: '2026-05-31',
      is_active: false,
    });
    component.onCreateSeason();

    expect(component.showCreateModal()).toBeFalse();
    expect(serviceSpy.loadSeasons).toHaveBeenCalledTimes(2); // init + after create
  });

  // ── TEST 8 ────────────────────────────────────────────────────────────
  it('edit form pre-fills with selected season data', () => {
    const season = mockSeason({ id: 5, name: 'Edit Me', is_active: true });
    component.openEditModal(season);

    expect(component.showEditModal()).toBeTrue();
    expect(component.seasonForm().name).toBe('Edit Me');
    expect(component.seasonForm().is_active).toBeTrue();
  });

  // ── TEST 9 ────────────────────────────────────────────────────────────
  it('onEditSeason calls updateSeason with correct id', () => {
    const season = mockSeason({ id: 7, name: 'Old Name' });
    serviceSpy.updateSeason.and.returnValue(of(mockSeason({ id: 7, name: 'New Name' })));
    serviceSpy.loadSeasons.and.returnValue(of(mockListResp([])));

    component.openEditModal(season);
    component.seasonForm.update(f => ({ ...f, name: 'New Name' }));
    component.onEditSeason();

    expect(serviceSpy.updateSeason).toHaveBeenCalledOnceWith(
      7,
      jasmine.objectContaining({ name: 'New Name' })
    );
    expect(component.showEditModal()).toBeFalse();
  });

  // ── TEST 10 ───────────────────────────────────────────────────────────
  it('archiveSeason calls service and reloads', () => {
    serviceSpy.archiveSeason.and.returnValue(of({
      id: 1, name: 'To Archive', start_date: '', end_date: '',
      is_active: false, ended_at: new Date().toISOString(),
      ended_by: 1, message: 'Archived'
    }));
    serviceSpy.loadSeasons.and.returnValue(of(mockListResp([])));

    const season = mockSeason({ id: 1, status: 'active' });
    spyOn(window, 'confirm').and.returnValue(true);
    component.onArchiveSeason(season);

    expect(serviceSpy.archiveSeason).toHaveBeenCalledWith(1);
  });

  // ── TEST 11 ───────────────────────────────────────────────────────────
  it('filter change updates activeFilter without API call', () => {
    const callsBefore = serviceSpy.loadSeasons.calls.count();
    component.onFilterChange('active');
    expect(component.activeFilter()).toBe('active');
    expect(serviceSpy.loadSeasons.calls.count()).toBe(callsBefore); // no extra call
  });

  // ── TEST 12 ───────────────────────────────────────────────────────────
  it('resetForm clears form fields and errors', () => {
    component.seasonForm.set({ name: 'Something', start_date: '2026-01-01', end_date: '2026-12-31', is_active: true });
    component.formErrors.set({ name: 'Error' });

    component.resetForm();

    expect(component.seasonForm().name).toBe('');
    expect(component.seasonForm().start_date).toBe('');
    expect(Object.keys(component.formErrors())).toHaveSize(0);
  });
});
