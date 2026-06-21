import { Component, OnInit, signal, inject, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { SeasonManagementService, Season, SeasonCreateRequest } from '../../../core/services/season-management.service';
import { ToastService } from '../../../core/services/toast.service';

interface SeasonFormData {
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

@Component({
  selector: 'app-season-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './season-management.component.html',
  styleUrl: './season-management.component.css'
})
export class SeasonManagementComponent implements OnInit {
  private seasonService = inject(SeasonManagementService);
  private router = inject(Router);
  private toast = inject(ToastService);

  private allSeasons = this.seasonService.seasons;
  loading = this.seasonService.loading;
  error = this.seasonService.error;

  // Modal visibility
  showCreateModal = signal(false);
  showEditModal = signal(false);
  showArchiveModal = signal(false);
  showDeleteModal = signal(false);
  showRestoreModal = signal(false);

  // Selected items
  selectedSeason = signal<Season | null>(null);
  seasonToArchive = signal<Season | null>(null);
  seasonToDelete = signal<Season | null>(null);
  seasonToRestore = signal<Season | null>(null);

  // Kebab menu
  openMenuId = signal<number | null>(null);

  // Filters & pagination
  searchTerm = signal('');
  activeFilter = signal<'all' | 'active' | 'upcoming' | 'archived' | 'deleted'>('all');
  currentPage = signal(1);
  readonly itemsPerPage = 10;

  // Submitting states
  isSubmitting = signal(false);
  isDeleting = signal(false);
  isRestoring = signal(false);

  activeSeason = signal<Season | null>(null);
  activeSeasonName = computed(() => this.activeSeason()?.name ?? null);

  seasonForm = signal<SeasonFormData>({ name: '', start_date: '', end_date: '', is_active: true });
  formErrors = signal<{ [key: string]: string }>({});
  protected readonly Math = Math;

  // Split deleted vs non-deleted
  private nonDeletedSeasons = computed(() =>
    this.allSeasons().filter(s => !s.is_deleted)
  );
  private deletedSeasons = computed(() =>
    this.allSeasons().filter(s => s.is_deleted === true)
  );

  private filteredSeasons = computed(() => {
    const filter = this.activeFilter();
    const search = this.searchTerm().toLowerCase();

    if (filter === 'deleted') {
      let list = this.deletedSeasons();
      if (search) list = list.filter(s => s.name.toLowerCase().includes(search));
      return list;
    }

    let list = this.nonDeletedSeasons();
    if (filter !== 'all') {
      list = list.filter((s: Season) => s.status === filter);
    }
    if (search) {
      list = list.filter((s: Season) => s.name.toLowerCase().includes(search));
    }
    return list;
  });

  seasons = computed(() => {
    const all = this.filteredSeasons();
    const start = (this.currentPage() - 1) * this.itemsPerPage;
    return all.slice(start, start + this.itemsPerPage);
  });

  totalFilteredCount = computed(() => this.filteredSeasons().length);
  totalPages = computed(() => Math.ceil(this.totalFilteredCount() / this.itemsPerPage));
  canGoPrev = computed(() => this.currentPage() > 1);
  canGoNext = computed(() => this.currentPage() < this.totalPages());
  paginationStart = computed(() =>
    this.totalFilteredCount() === 0 ? 0 : (this.currentPage() - 1) * this.itemsPerPage + 1
  );
  paginationEnd = computed(() =>
    Math.min(this.currentPage() * this.itemsPerPage, this.totalFilteredCount())
  );

  filterCounts = computed(() => {
    const nd = this.nonDeletedSeasons();
    return {
      all: nd.length,
      active: nd.filter((s: Season) => s.status === 'active').length,
      upcoming: nd.filter((s: Season) => s.status === 'upcoming').length,
      archived: nd.filter((s: Season) => s.status === 'archived').length,
      deleted: this.deletedSeasons().length
    };
  });

  ngOnInit(): void {
    this.loadSeasons();
  }

  loadSeasons(): void {
    forkJoin([
      this.seasonService.loadSeasons({}),
      this.seasonService.getDeletedSeasons()
    ]).subscribe({
      next: ([listResponse, deletedSeasons]) => {
        const live = this.allSeasons().map(s => ({
          ...s,
          status: s.status || this.seasonService.calculateSeasonStatus(s)
        }));
        const deleted = deletedSeasons.map(s => ({
          ...s,
          is_deleted: true,
          status: s.status ?? ('archived' as const)
        }));
        // Merge: live seasons + deleted seasons (no duplicates)
        const liveIds = new Set(live.map(s => s.id));
        const merged = [...live, ...deleted.filter(s => !liveIds.has(s.id))];
        this.seasonService.updateSeasons(merged);
      }
    });
  }

  // ── Close kebab on document click ────────────────────────────────
  @HostListener('document:click')
  onDocumentClick(): void {
    this.openMenuId.set(null);
  }

  toggleKebabMenu(id: number, event: MouseEvent): void {
    event.stopPropagation();
    this.openMenuId.set(this.openMenuId() === id ? null : id);
  }

  closeKebabMenu(): void {
    this.openMenuId.set(null);
  }

  // ── Filter / Search / Pagination ─────────────────────────────────
  onFilterChange(filter: 'all' | 'active' | 'upcoming' | 'archived' | 'deleted'): void {
    this.activeFilter.set(filter);
    this.currentPage.set(1);
  }

  onSearchChange(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }

  onPrevPage(): void {
    if (this.canGoPrev()) this.currentPage.update(p => p - 1);
  }

  onNextPage(): void {
    if (this.canGoNext()) this.currentPage.update(p => p + 1);
  }

  // ── Create Modal ─────────────────────────────────────────────────
  openCreateModal(): void {
    this.resetForm();
    this.activeSeason.set(null);
    this.showCreateModal.set(true);
    this.seasonService.getActiveSeason().subscribe({
      next: (season) => this.activeSeason.set(season),
      error: () => this.activeSeason.set(null)
    });
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.activeSeason.set(null);
    this.resetForm();
  }

  onCreateSeason(): void {
    if (!this.validateForm()) return;
    const form = this.seasonForm();
    const durationDays = Math.ceil(
      (new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / 86400000
    );
    const payload: SeasonCreateRequest = {
      name: form.name.trim(),
      start_date: this.formatDateForAPI(form.start_date),
      duration_days: durationDays,
      is_active: form.is_active
    };
    this.isSubmitting.set(true);
    this.seasonService.createSeason(payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.closeCreateModal();
        this.loadSeasons();
        this.toast.success('Season created successfully.');
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.seasonService.clearError();
        const msg = err.error?.detail || err.error?.message || 'Failed to create season. Please try again.';
        this.toast.error(msg);
      }
    });
  }

  // ── Edit Modal ────────────────────────────────────────────────────
  openEditModal(season: Season): void {
    this.selectedSeason.set(season);
    this.seasonForm.set({
      name: season.name,
      start_date: this.formatDateForInput(season.start_date),
      end_date: this.formatDateForInput(season.end_date),
      is_active: season.is_active
    });
    this.showEditModal.set(true);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.selectedSeason.set(null);
    this.resetForm();
  }

  onEditSeason(): void {
    if (!this.validateForm() || !this.selectedSeason()) return;
    const form = this.seasonForm();
    const durationDays = Math.ceil(
      (new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / 86400000
    );
    const payload: Partial<SeasonCreateRequest> = {
      name: form.name.trim(),
      start_date: this.formatDateForAPI(form.start_date),
      duration_days: durationDays,
      is_active: form.is_active
    };
    this.isSubmitting.set(true);
    this.seasonService.updateSeason(this.selectedSeason()!.id, payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.closeEditModal();
        this.loadSeasons();
        this.toast.success('Season updated successfully.');
      },
      error: () => { this.isSubmitting.set(false); }
    });
  }

  // ── Archive Modal ─────────────────────────────────────────────────
  onArchiveSeason(season: Season): void {
    this.seasonToArchive.set(season);
    this.showArchiveModal.set(true);
  }

  closeArchiveModal(): void {
    this.showArchiveModal.set(false);
    this.seasonToArchive.set(null);
  }

  confirmArchive(): void {
    const season = this.seasonToArchive();
    if (!season) return;
    this.isSubmitting.set(true);
    this.seasonService.archiveSeason(season.id).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.closeArchiveModal();
        this.loadSeasons();
        this.toast.success('Season archived successfully.');
      },
      error: () => { this.isSubmitting.set(false); }
    });
  }

  // ── Delete Modal ──────────────────────────────────────────────────
  openDeleteModal(season: Season): void {
    this.seasonToDelete.set(season);
    this.showDeleteModal.set(true);
  }

  closeDeleteModal(): void {
    this.showDeleteModal.set(false);
    this.seasonToDelete.set(null);
  }

  confirmDelete(): void {
    const season = this.seasonToDelete();
    if (!season) return;
    this.isDeleting.set(true);
    this.seasonService.softDeleteSeason(season.id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.closeDeleteModal();
        this.loadSeasons();
        this.toast.error('Season deleted.');
      },
      error: (err) => {
        this.isDeleting.set(false);
        this.closeDeleteModal();
        const msg = err.error?.error || err.error?.message || 'Failed to delete season.';
        this.toast.error(msg);
      }
    });
  }

  // ── Restore Modal ─────────────────────────────────────────────────
  openRestoreModal(season: Season): void {
    this.seasonToRestore.set(season);
    this.showRestoreModal.set(true);
  }

  closeRestoreModal(): void {
    this.showRestoreModal.set(false);
    this.seasonToRestore.set(null);
  }

  confirmRestore(): void {
    const season = this.seasonToRestore();
    if (!season) return;
    this.isRestoring.set(true);
    this.seasonService.restoreSeason(season.id).subscribe({
      next: () => {
        this.isRestoring.set(false);
        this.closeRestoreModal();
        this.loadSeasons();
        this.toast.success('Season restored successfully.');
      },
      error: (err) => {
        this.isRestoring.set(false);
        this.closeRestoreModal();
        const msg = err.error?.error || err.error?.message || 'Failed to restore season.';
        this.toast.error(msg);
      }
    });
  }

  // ── Navigation ────────────────────────────────────────────────────
  onViewSeason(season: Season): void {
    this.router.navigate(['/admin/season-management', season.id]);
  }

  // ── Helpers ───────────────────────────────────────────────────────
  resetForm(): void {
    this.seasonForm.set({ name: '', start_date: '', end_date: '', is_active: true });
    this.formErrors.set({});
  }

  validateForm(): boolean {
    const errors: { [key: string]: string } = {};
    const f = this.seasonForm();
    if (!f.name?.trim()) errors['name'] = 'Season name is required';
    if (!f.start_date) errors['start_date'] = 'Start date is required';
    if (!f.end_date) errors['end_date'] = 'End date is required';
    if (f.start_date && f.end_date && f.start_date >= f.end_date) {
      errors['end_date'] = 'End date must be after start date';
    }
    this.formErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  getStatusDotClass(season: Season): string {
    if (season.is_deleted) return 'status-dot status-dot-deleted';
    return `status-dot status-dot-${season.status}`;
  }

  getStatusClass(status: string): string {
    const map: { [k: string]: string } = {
      active: 'status-badge status-active',
      upcoming: 'status-badge status-upcoming',
      archived: 'status-badge status-archived'
    };
    return map[status] ?? 'status-badge';
  }

  getStatusLabel(status: string): string {
    return { active: 'Active', upcoming: 'Upcoming', archived: 'Archived' }[status] ?? status;
  }

  formatDateForDisplay(dateString: string): string {
    return this.seasonService.formatDate(dateString);
  }

  formatDateForInput(dateString: string): string {
    return new Date(dateString).toISOString().split('T')[0];
  }

  formatDateForAPI(dateString: string): string {
    return new Date(dateString).toISOString();
  }

  clearError(): void {
    this.seasonService.clearError();
  }

  updateSeasonFormField(field: string, value: any): void {
    this.seasonForm.update(f => ({ ...f, [field]: value }));
  }
}
