import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { RecentMatches } from './recent-matches';

describe('RecentMatches', () => {
  let component: RecentMatches;
  let fixture: ComponentFixture<RecentMatches>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecentMatches],
      providers: [provideHttpClient()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecentMatches);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
