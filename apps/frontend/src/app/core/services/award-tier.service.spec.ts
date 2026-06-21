import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { AwardTierService, AwardTierPayload, AwardTierResponse } from './award-tier.service';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

const MOCK_TOKEN = 'mock.jwt.token';

describe('AwardTierService', () => {
  let service: AwardTierService;
  let httpMock: HttpTestingController;
  let authSpy: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj('AuthService', ['getToken']);
    authSpy.getToken.and.returnValue(MOCK_TOKEN);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AwardTierService,
        { provide: AuthService, useValue: authSpy },
      ],
    });

    service = TestBed.inject(AwardTierService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // ── TEST 1 ────────────────────────────────────────────────────────────
  it('getAwardTiers should GET correct endpoint', () => {
    const mockTiers: AwardTierResponse[] = [
      { id: 1, tier_type: 'POSITION', position: 1, points: 500, label: 'Champion' },
    ];

    service.getAwardTiers(1).subscribe(result => {
      expect(result).toEqual(mockTiers);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/tournaments/1/award-tiers/`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${MOCK_TOKEN}`);
    req.flush(mockTiers);
  });

  // ── TEST 2 ────────────────────────────────────────────────────────────
  it('createAwardTier should POST correct endpoint with payload', () => {
    const payload: AwardTierPayload = { tier_type: 'POSITION', position: 1, points: 500 };
    const mockResponse: AwardTierResponse = { id: 1, ...payload };

    service.createAwardTier(1, payload).subscribe(result => {
      expect(result.id).toBe(1);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/tournaments/1/award-tiers/`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockResponse);
  });

  // ── TEST 3 ────────────────────────────────────────────────────────────
  it('updateAwardTier should PATCH correct endpoint', () => {
    const patch = { points: 750 };
    const mockResponse: AwardTierResponse = { id: 5, tier_type: 'POSITION', position: 1, points: 750 };

    service.updateAwardTier(1, 5, patch).subscribe(result => {
      expect(result.points).toBe(750);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/tournaments/1/award-tiers/5/`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(patch);
    req.flush(mockResponse);
  });

  // ── TEST 4 ────────────────────────────────────────────────────────────
  it('deleteAwardTier should DELETE correct endpoint with no body', () => {
    service.deleteAwardTier(1, 5).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/tournaments/1/award-tiers/5/`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toBeNull();
    req.flush(null);
  });

  // ── TEST 5 ────────────────────────────────────────────────────────────
  it('distributeAwards should POST to correct endpoint', () => {
    service.distributeAwards(1).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/tournaments/1/distribute-awards/`);
    expect(req.request.method).toBe('POST');
    req.flush({ distributed: 3 });
  });

  // ── TEST 6 ────────────────────────────────────────────────────────────
  it('resetAwards should POST to correct endpoint', () => {
    service.resetAwards(1).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/tournaments/1/reset-awards/`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });
});
