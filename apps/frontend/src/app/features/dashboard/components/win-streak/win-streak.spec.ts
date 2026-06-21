import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WinStreak } from './win-streak';

describe('WinStreak', () => {
  let component: WinStreak;
  let fixture: ComponentFixture<WinStreak>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WinStreak]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WinStreak);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
