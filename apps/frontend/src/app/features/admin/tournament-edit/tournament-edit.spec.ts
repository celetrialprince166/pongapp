import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { TournamentEditComponent } from './tournament-edit';

describe('TournamentEdit', () => {
  let component: TournamentEditComponent;
  let fixture: ComponentFixture<TournamentEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TournamentEditComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TournamentEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
