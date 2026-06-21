import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TournamentService } from '../../../core/services/tournament.service';
import { SeasonService } from '../../../core/services/season.service';
import { Tournament } from '../../../core/models/tournament.model';
import { LucideAngularModule, ArrowLeft } from 'lucide-angular';

/**
 * Tournament Edit Component
 *
 * Admin interface for editing existing tournaments.
 * Design reference: docs/designs/tournaments/image copy 12.png
 */
@Component({
  selector: 'app-tournament-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './tournament-edit.html',
  styleUrl: './tournament-edit.css'
})
export class TournamentEditComponent implements OnInit {
  // Services
  private tournamentService = inject(TournamentService);
  private seasonService = inject(SeasonService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Seasons list for dropdown
  seasons = this.seasonService.seasons;

  // Icons
  readonly ArrowLeft = ArrowLeft;

  // Component state
  tournamentId = signal<number>(0);
  tournament = signal<Tournament | null>(null);
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);

  // Form data
  formData = signal({
    name: '',
    date: '',
    registrationDeadline: '',
    endDate: '',
    format: 'SINGLE_ELIMINATION' as 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN' | 'SWISS' | 'GROUP_KNOCKOUT',
    maxParticipants: 32,
    status: 'REGISTRATION' as 'REGISTRATION' | 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
    description: '',
    prize_label: '',
    season: null as number | null,
  });

  // Format options
  formatOptions = [
    { value: 'SINGLE_ELIMINATION', label: 'Single Elimination' },
    { value: 'DOUBLE_ELIMINATION', label: 'Double Elimination' },
    { value: 'ROUND_ROBIN', label: 'Round Robin' },
    { value: 'SWISS', label: 'Swiss System' },
    { value: 'GROUP_KNOCKOUT', label: 'Group Stage + Knockout' }
  ];

  // Status options
  statusOptions = [
    { value: 'REGISTRATION', label: 'Registration Open' },
    { value: 'UPCOMING', label: 'Upcoming' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CANCELLED', label: 'Cancelled' }
  ];

  ngOnInit(): void {
    this.seasonService.getSeasons().subscribe();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.tournamentId.set(parseInt(id, 10));
      this.loadTournament();
    } else {
      this.error.set('Tournament ID not found');
    }
  }

  /**
   * Load tournament data
   */
  loadTournament(): void {
    this.loading.set(true);
    this.tournamentService.getTournamentById(this.tournamentId()).subscribe({
      next: (tournament) => {
        this.tournament.set(tournament);

        // Populate form data
        this.formData.set({
          name: tournament.name,
          date: this.formatDateForInput(tournament.start_date),
          registrationDeadline: tournament.registration_deadline ? this.formatDateForInput(tournament.registration_deadline) : '',
          endDate: tournament.end_date ? this.formatDateForInput(tournament.end_date) : this.formatDateForInput(tournament.start_date),
          format: tournament.tournament_format as any,
          maxParticipants: tournament.max_participants,
          status: tournament.status as any,
          description: tournament.description || '',
          prize_label: tournament.prize_label || '',
          season: tournament.season ?? null,
        });

        this.loading.set(false);
      },
      error: (error) => {
        console.error('Failed to load tournament:', error);
        this.error.set('Failed to load tournament');
        this.loading.set(false);
      }
    });
  }

  /**
   * Format date for input field (YYYY-MM-DD)
   */
  formatDateForInput(dateString: string): string {
    const date = new Date(dateString);
    return date.toISOString().slice(0, 10);
  }

  /**
   * Format date for display
   */
  formatDateForDisplay(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Calculate time ago
   */
  getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  }

  /**
   * Go back to tournament management
   */
  goBack(): void {
    this.router.navigate(['/admin/tournament-overview']);
  }

  /**
   * Save changes
   */
  onSaveChanges(): void {
    this.saving.set(true);
    this.error.set(null);

    const form = this.formData();
    const tournament = this.tournament();

    if (!tournament) return;

    // Prepare update data
    const updateData = {
      name: form.name.trim(),
      description: form.description.trim(),
      tournament_format: form.format,
      max_participants: form.maxParticipants,
      min_participants: 2,
      registration_deadline: new Date(form.registrationDeadline + 'T23:59:59').toISOString(),
      start_date: new Date(form.date + 'T09:00:00').toISOString(),
      end_date: new Date(form.endDate + 'T18:00:00').toISOString(),
      status: form.status,
      is_rated: true,
      season: form.season,
      prize_label: form.prize_label.trim(),
    };

    this.tournamentService.updateTournament(this.tournamentId(), updateData).subscribe({
      next: (updated) => {
        this.saving.set(false);
        alert('Tournament updated successfully!');
        this.router.navigate(['/admin/tournament-overview']);
      },
      error: (error) => {
        console.error('Failed to update tournament:', error);
        this.error.set('Failed to update tournament. Please try again.');
        this.saving.set(false);
      }
    });
  }

  /**
   * Delete tournament
   */
  onDeleteTournament(): void {
    const tournament = this.tournament();
    if (!tournament) return;

    const confirmMessage = `Are you sure you want to delete "${tournament.name}"? This action cannot be undone.`;

    if (confirm(confirmMessage)) {
      this.tournamentService.deleteTournament(this.tournamentId()).subscribe({
        next: () => {
          alert('Tournament deleted successfully');
          this.router.navigate(['/admin/tournament-overview']);
        },
        error: (error) => {
          console.error('Failed to delete tournament:', error);
          alert('Failed to delete tournament. Please try again.');
        }
      });
    }
  }

  /**
   * Cancel and go back
   */
  onCancel(): void {
    if (confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')) {
      this.goBack();
    }
  }

  /**
   * Update form field
   */
  updateFormField(field: string, value: any): void {
    this.formData.update(data => ({ ...data, [field]: value }));
  }
}
