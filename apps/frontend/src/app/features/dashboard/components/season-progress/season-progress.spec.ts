import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { SeasonProgress } from './season-progress';

describe('SeasonProgress', () => {
  let component: SeasonProgress;
  let fixture: ComponentFixture<SeasonProgress>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeasonProgress],
      providers: [provideHttpClient()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SeasonProgress);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
