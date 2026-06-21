import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SeasonManagementService, Season } from '../../../core/services/season-management.service';
import { ToastService } from '../../../core/services/toast.service';
import { OverviewTabComponent } from './tabs/overview-tab/overview-tab.component';
import { TournamentsTabComponent } from './tabs/tournaments-tab/tournaments-tab.component';
import { StandingsTabComponent } from './tabs/standings-tab/standings-tab.component';
import { SettingsTabComponent } from './tabs/settings-tab/settings-tab.component';

type DetailTab = 'overview' | 'tournaments' | 'standings' | 'settings';

@Component({
  selector: 'app-season-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, OverviewTabComponent, TournamentsTabComponent, StandingsTabComponent, SettingsTabComponent],
  templateUrl: './season-detail.component.html',
  styleUrl: './season-detail.component.css'
})
export class SeasonDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private seasonService = inject(SeasonManagementService);
  private toast = inject(ToastService);

  season = signal<Season | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);
  activeTab = signal<DetailTab>('overview');
  showEndSeasonModal = signal(false);
  isEndingSeason = signal(false);

  seasonId = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    return id ? Number(id) : null;
  });

  canEdit = computed(() => {
    const s = this.season();
    return !!s && !s.is_deleted && (s.status === 'active' || s.status === 'upcoming');
  });

  canEnd = computed(() => {
    const s = this.season();
    return !!s && !s.is_deleted && s.status === 'active';
  });

  ngOnInit(): void {
    const id = this.seasonId();
    if (!id) { this.router.navigate(['/admin/season-management']); return; }
    this.loadSeason(id);
  }

  private loadSeason(id: number): void {
    this.isLoading.set(true);
    this.seasonService.getSeason(id).subscribe({
      next: (s) => {
        if (!s.status) {
          s = { ...s, status: this.seasonService.calculateSeasonStatus(s) };
        }
        this.season.set(s);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Failed to load season details.');
        this.isLoading.set(false);
      }
    });
  }

  setTab(tab: DetailTab): void { this.activeTab.set(tab); }

  goBack(): void { this.router.navigate(['/admin/season-management']); }

  goToEdit(): void {
    const id = this.seasonId();
    if (id) this.router.navigate(['/admin/season-management', id, 'edit']);
  }

  openEndSeasonModal(): void { this.showEndSeasonModal.set(true); }

  closeEndSeasonModal(): void {
    if (!this.isEndingSeason()) this.showEndSeasonModal.set(false);
  }

  confirmEndSeason(): void {
    const id = this.seasonId();
    if (!id) return;
    this.isEndingSeason.set(true);
    this.seasonService.endSeason(id).subscribe({
      next: () => {
        this.isEndingSeason.set(false);
        this.showEndSeasonModal.set(false);
        this.toast.success('Season ended successfully.');
        this.loadSeason(id);
      },
      error: (err) => {
        this.isEndingSeason.set(false);
        const msg = err.error?.error || err.error?.message || 'Failed to end season.';
        this.toast.error(msg);
      }
    });
  }

  getStatusBadgeClass(status: string): string {
    const map: { [k: string]: string } = {
      active:   'badge-active',
      upcoming: 'badge-upcoming',
      archived: 'badge-archived'
    };
    return 'status-badge ' + (map[status] ?? 'badge-archived');
  }

  getStatusLabel(status: string): string {
    return { active: 'Active', upcoming: 'Upcoming', archived: 'Archived' }[status] ?? status;
  }

  formatDate(dateString: string): string {
    return this.seasonService.formatDate(dateString);
  }
}
