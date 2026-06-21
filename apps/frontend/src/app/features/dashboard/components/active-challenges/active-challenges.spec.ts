import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActiveChallenges } from './active-challenges';

describe('ActiveChallenges', () => {
  let component: ActiveChallenges;
  let fixture: ComponentFixture<ActiveChallenges>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActiveChallenges]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActiveChallenges);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
