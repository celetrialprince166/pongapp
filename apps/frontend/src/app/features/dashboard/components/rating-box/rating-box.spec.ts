import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { RatingBox } from './rating-box';

describe('RatingBox', () => {
  let component: RatingBox;
  let fixture: ComponentFixture<RatingBox>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RatingBox],
      providers: [provideHttpClient()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RatingBox);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
