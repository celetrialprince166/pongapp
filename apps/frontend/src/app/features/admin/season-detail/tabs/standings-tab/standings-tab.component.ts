import { Component, Input, Output, EventEmitter, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Season, SeasonStanding, SeasonManagementService } from '../../../../../core/services/season-management.service';

@Component({
  selector: 'app-standings-tab',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './standings-tab.component.html',
  styleUrl: './standings-tab.component.css'
})
export class StandingsTabComponent implements OnInit {
  @Input({ required: true }) season!: Season;
  @Output() viewTournaments = new EventEmitter<void>();

  standings = signal<SeasonStanding[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);

  constructor(private seasonService: SeasonManagementService) {}

  ngOnInit(): void {
    this.loadStandings();
  }

  loadStandings(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.seasonService.getStandings(this.season.id).subscribe({
      next: (data) => {
        const list = Array.isArray(data) ? data : (data as any)?.results ?? [];
        this.standings.set(list);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Failed to load standings.');
        this.isLoading.set(false);
      }
    });
  }

  goToTournaments(): void {
    this.viewTournaments.emit();
  }
}
