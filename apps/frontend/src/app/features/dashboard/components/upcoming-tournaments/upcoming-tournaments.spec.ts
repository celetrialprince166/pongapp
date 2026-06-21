import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { UpcomingTournaments } from './upcoming-tournaments';

describe('UpcomingTournaments', () => {
  let component: UpcomingTournaments;
  let fixture: ComponentFixture<UpcomingTournaments>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpcomingTournaments],
      providers: [provideHttpClient(), provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpcomingTournaments);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
