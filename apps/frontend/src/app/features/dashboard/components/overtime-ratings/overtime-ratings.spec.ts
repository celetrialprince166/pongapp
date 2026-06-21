import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { OvertimeRatings } from './overtime-ratings';

describe('OvertimeRatings', () => {
  let component: OvertimeRatings;
  let fixture: ComponentFixture<OvertimeRatings>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OvertimeRatings],
      providers: [provideHttpClient()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OvertimeRatings);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
