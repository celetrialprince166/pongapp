import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import {
import { environment } from '../../../environments/environment';
  SeasonManagementService,
  Season,
  SeasonCreateRequest,
  SeasonListResponse
} from './season-management.service';

const BASE = `${environment.apiUrl}/ratings/seasons`;

function mockSeason(overrides: Partial<Season> = {}): Season {
  return {
    id: 1,
    name: 'Season 1',
    start_date: '2026-01-01T00:00:00Z',
    end_date: '2026-03-31T23:59:59Z',
    is_active: true,
    status: 'active',
    player_count: 0,
    ...overrides,
  };
}

function mockListResponse(seasons: Season[]): SeasonListResponse {
  return { count: seasons.length, next: null, previous: null, results: seasons };
}

describe('SeasonManagementService', () => {
  let service: SeasonManagementService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SeasonManagementService,
      ],
    });
    service = TestBed.inject(SeasonManagementService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // ── TEST 1 ────────────────────────────────────────────────────────────
  it('loadSeasons should GET seasons endpoint and update signal', () => {
    const mockSeasons = [mockSeason({ id: 1 }), mockSeason({ id: 2, name: 'Season 2' })];

    service.loadSeasons({}).subscribe();

    const req = httpMock.expectOne(r => r.url === BASE);
    expect(req.request.method).toBe('GET');
    req.flush(mockListResponse(mockSeasons));

    expect(service.seasons().length).toBe(2);
    expect(service.seasons()[0].name).toBe('Season 1');
  });

  // ── TEST 2 ────────────────────────────────────────────────────────────
  it('getActiveSeason should GET /active/ endpoint', () => {
    const active = mockSeason({ status: 'active' });

    service.getActiveSeason().subscribe(s => expect(s.is_active).toBeTrue());

    const req = httpMock.expectOne(`${BASE}/active/`);
    expect(req.request.method).toBe('GET');
    req.flush(active);
  });

  // ── TEST 3 ────────────────────────────────────────────────────────────
  it('getSeason should GET /seasons/{id}/', () => {
    service.getSeason(5).subscribe(s => expect(s.id).toBe(5));

    const req = httpMock.expectOne(`${BASE}/5/`);
    expect(req.request.method).toBe('GET');
    req.flush(mockSeason({ id: 5 }));
  });

  // ── TEST 4 ────────────────────────────────────────────────────────────
  it('createSeason should POST correct payload to /seasons/', () => {
    const payload: SeasonCreateRequest = {
      name: 'Test Season',
      start_date: '2026-01-01T00:00:00Z',
      duration_days: 90,
      is_active: true,
    };
    const created = mockSeason({ id: 10, name: 'Test Season' });

    service.createSeason(payload).subscribe(s => expect(s.id).toBe(10));

    const req = httpMock.expectOne(`${BASE}/`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(created);
  });

  // ── TEST 5 ────────────────────────────────────────────────────────────
  it('updateSeason should PUT correct endpoint', () => {
    const patch: Partial<SeasonCreateRequest> = { name: 'Updated Season' };
    const updated = mockSeason({ id: 1, name: 'Updated Season' });

    service.updateSeason(1, patch).subscribe(s => expect(s.name).toBe('Updated Season'));

    const req = httpMock.expectOne(`${BASE}/1/`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(patch);
    req.flush(updated);
  });

  // ── TEST 6 ────────────────────────────────────────────────────────────
  it('endSeason should POST to /seasons/{id}/end/', () => {
    const endResponse = {
      id: 1, name: 'Season 1',
      start_date: '2026-01-01T00:00:00Z',
      end_date: '2026-03-31T23:59:59Z',
      is_active: false,
      ended_at: '2026-02-15T12:00:00Z',
      ended_by: 1,
      message: 'Season "Season 1" has been archived successfully',
    };

    service.endSeason(1).subscribe(r => expect(r.is_active).toBeFalse());

    const req = httpMock.expectOne(`${BASE}/1/end/`);
    expect(req.request.method).toBe('POST');
    req.flush(endResponse);
  });

  // ── TEST 7 ────────────────────────────────────────────────────────────
  it('archiveSeason should alias to endSeason', () => {
    service.archiveSeason(3).subscribe();

    const req = httpMock.expectOne(`${BASE}/3/end/`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 3, is_active: false, ended_at: new Date().toISOString(), message: 'ok' });
  });

  // ── TEST 8 ────────────────────────────────────────────────────────────
  it('seasons can be mapped to { value: id, label: name } for dropdowns', () => {
    service.loadSeasons({}).subscribe();

    const req = httpMock.expectOne(r => r.url === BASE);
    req.flush(mockListResponse([
      mockSeason({ id: 1, name: 'Season 1' }),
      mockSeason({ id: 2, name: 'Season 2', status: 'upcoming' }),
    ]));

    const options = service.seasons().map(s => ({ value: s.id, label: s.name }));
    expect(options).toEqual([
      { value: 1, label: 'Season 1' },
      { value: 2, label: 'Season 2' },
    ]);
  });

  // ── TEST 9 ────────────────────────────────────────────────────────────
  it('calculateSeasonStatus returns correct statuses', () => {
    const now = new Date();
    const past = (d: Date) => d.toISOString();

    const active = mockSeason({
      start_date: new Date(now.getTime() - 86400000).toISOString(),
      end_date: new Date(now.getTime() + 86400000).toISOString(),
      is_active: true,
    });
    const upcoming = mockSeason({
      start_date: new Date(now.getTime() + 86400000).toISOString(),
      end_date: new Date(now.getTime() + 86400000 * 10).toISOString(),
      is_active: true,
    });
    const archived = mockSeason({
      start_date: new Date(now.getTime() - 86400000 * 10).toISOString(),
      end_date: new Date(now.getTime() - 86400000).toISOString(),
      is_active: false,
      ended_at: new Date(now.getTime() - 86400000).toISOString(),
    });

    expect(service.calculateSeasonStatus(active)).toBe('active');
    expect(service.calculateSeasonStatus(upcoming)).toBe('upcoming');
    expect(service.calculateSeasonStatus(archived)).toBe('archived');
  });
});
