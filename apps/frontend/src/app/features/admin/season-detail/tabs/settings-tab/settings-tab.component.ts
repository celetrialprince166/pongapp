import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Season, SeasonManagementService } from '../../../../../core/services/season-management.service';
import { ToastService } from '../../../../../core/services/toast.service';

@Component({
  selector: 'app-settings-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings-tab.component.html',
  styleUrl: './settings-tab.component.css'
})
export class SettingsTabComponent {
  @Input({ required: true }) season!: Season;

  isRecalculating = signal(false);

  constructor(
    private seasonService: SeasonManagementService,
    private toast: ToastService
  ) {}

  recalculate(): void {
    this.isRecalculating.set(true);
    this.seasonService.recalculateElo(this.season.id).subscribe({
      next: (res) => {
        this.isRecalculating.set(false);
        this.toast.success(
          `ELO recalculated — ${res.matches_processed} match${res.matches_processed !== 1 ? 'es' : ''} processed, ${res.players_affected} player${res.players_affected !== 1 ? 's' : ''} affected.`
        );
      },
      error: () => {
        this.isRecalculating.set(false);
        this.toast.error('Failed to recalculate ELO ratings.');
      }
    });
  }
}
