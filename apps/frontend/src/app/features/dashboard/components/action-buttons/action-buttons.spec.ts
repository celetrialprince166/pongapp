import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActionButtons } from './action-buttons';

describe('ActionButtons', () => {
  let component: ActionButtons;
  let fixture: ComponentFixture<ActionButtons>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActionButtons]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActionButtons);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
