import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GamesSummary } from './games-summary';

describe('GamesSummary', () => {
  let component: GamesSummary;
  let fixture: ComponentFixture<GamesSummary>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GamesSummary]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GamesSummary);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
