import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TournamentService } from '../../../core/services/tournament.service';

/**
 * Tournament Creation Component
 *
 * Admin interface for creating new tournaments with comprehensive form.
 * Includes basic info, dates, format, participants, and advanced settings.
 *
 * Design reference: docs/designs/user-dashboard/tournament_creation_screen_2/screen.png
 */

interface TournamentFormData {
  name: string;
  location: string;
  description: string;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  format: 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN' | 'SWISS' | 'GROUP_KNOCKOUT';
  maxParticipants: number;
  seedingMethod: 'elo' | 'random' | 'manual';
  publishToPublic: boolean;
  allowLateEntries: boolean;
}

@Component({
  selector: 'app-tournament-creation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tournament-creation.component.html',
  styleUrl: './tournament-creation.component.css'
})
export class TournamentCreationComponent implements OnInit {
  // Service injection
  private tournamentService = inject(TournamentService);
  private router = inject(Router);

  // Form data
  tournamentForm = signal<TournamentFormData>({
    name: '',
    location: '',
    description: '',
    startDate: '',
    endDate: '',
    registrationDeadline: '',
    format: 'SINGLE_ELIMINATION',
    maxParticipants: 32,
    seedingMethod: 'elo',
    publishToPublic: true,
    allowLateEntries: false
  });

  // Validation
  formErrors = signal<{ [key: string]: string }>({});

  // Component state
  loading = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    // Set default registration deadline to 1 day before start date
    this.updateRegistrationDeadline();
  }

  /**
   * Get minimum start date (current date)
   */
  getMinStartDate(): string {
    const now = new Date();
    // Format as date format: YYYY-MM-DD
    return now.toISOString().slice(0, 10);
  }

  /**
   * Update registration deadline when start date changes
   * Sets it to 1 day before start date by default
   */
  updateRegistrationDeadline(): void {
    const form = this.tournamentForm();
    if (form.startDate) {
      const startDate = new Date(form.startDate + 'T00:00:00');
      // Set deadline to 1 day before start
      startDate.setDate(startDate.getDate() - 1);
      // Format as date format: YYYY-MM-DD
      const deadline = startDate.toISOString().slice(0, 10);
      this.tournamentForm.update(f => ({ ...f, registrationDeadline: deadline }));
    }
  }

  /**
   * Handle format selection
   */
  onFormatChange(format: 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN' | 'SWISS' | 'GROUP_KNOCKOUT'): void {
    this.tournamentForm.update(f => ({ ...f, format }));
  }

  /**
   * Handle seeding method change
   */
  onSeedingMethodChange(seedingMethod: 'elo' | 'random' | 'manual'): void {
    this.tournamentForm.update(f => ({ ...f, seedingMethod }));
  }

  /**
   * Handle publish toggle
   */
  onPublishToggle(): void {
    this.tournamentForm.update(f => ({ ...f, publishToPublic: !f.publishToPublic }));
  }

  /**
   * Handle late entries toggle
   */
  onLateEntriesToggle(): void {
    this.tournamentForm.update(f => ({ ...f, allowLateEntries: !f.allowLateEntries }));
  }

  /**
   * Validate form data
   */
  validateForm(): boolean {
    const errors: { [key: string]: string } = {};
    const form = this.tournamentForm();

    if (!form.name || form.name.trim().length === 0) {
      errors['name'] = 'Tournament name is required';
    }

    if (!form.location || form.location.trim().length === 0) {
      errors['location'] = 'Location/Venue is required';
    }

    if (!form.startDate) {
      errors['startDate'] = 'Start date is required';
    }

    if (!form.endDate) {
      errors['endDate'] = 'End date is required';
    }

    if (form.startDate && form.endDate) {
      const start = new Date(form.startDate);
      const end = new Date(form.endDate);
      if (start > end) {
        errors['endDate'] = 'End date must be after start date';
      }
    }

    if (!form.registrationDeadline) {
      errors['registrationDeadline'] = 'Registration deadline is required';
    }

    if (form.registrationDeadline && form.startDate) {
      const deadline = new Date(form.registrationDeadline);
      const start = new Date(form.startDate);
      if (deadline >= start) {
        errors['registrationDeadline'] = 'Registration deadline must be before start date';
      }
    }

    if (form.maxParticipants < 2) {
      errors['maxParticipants'] = 'Must have at least 2 participants';
    }

    // Validate max_participants for elimination formats (must be power of 2)
    if (form.format === 'SINGLE_ELIMINATION' || form.format === 'DOUBLE_ELIMINATION') {
      const validCounts = [4, 8, 16, 32, 64];
      if (!validCounts.includes(form.maxParticipants)) {
        errors['maxParticipants'] = 'Elimination tournaments must have 4, 8, 16, 32, or 64 participants';
      }
    } else if (form.maxParticipants > 256) {
      errors['maxParticipants'] = 'Cannot exceed 256 participants';
    }

    this.formErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  /**
   * Create tournament
   */
  onCreateTournament(): void {
    console.log('Create tournament button clicked');
    console.log('Form data:', this.tournamentForm());

    if (!this.validateForm()) {
      console.log('Validation failed:', this.formErrors());
      // Show validation error banner
      this.error.set('Please fix the validation errors before submitting');
      return;
    }

    console.log('Validation passed, creating tournament...');
    this.loading.set(true);
    this.error.set(null);

    const form = this.tournamentForm();

    // Map frontend fields to backend expected fields
    // Convert date-only strings to full ISO datetime strings
    const startDateTime = new Date(form.startDate + 'T09:00:00').toISOString();
    const endDateTime = new Date(form.endDate + 'T18:00:00').toISOString();
    const regDeadline = new Date(form.registrationDeadline + 'T23:59:59').toISOString();

    const tournamentData = {
      name: form.name.trim(),
      description: form.description.trim() || `Tournament at ${form.location.trim()}`,
      tournament_format: form.format,  // Backend expects 'tournament_format' not 'format'
      max_participants: form.maxParticipants,
      min_participants: 2,  // Backend requires this field
      registration_deadline: regDeadline,
      start_date: startDateTime,
      end_date: endDateTime,
      is_rated: true,  // Backend requires this field
      season: null,  // Backend requires this field (nullable)
      status: 'REGISTRATION'  // Set initial status to enable immediate registration
    };

    console.log('Sending tournament data:', tournamentData);

    this.tournamentService.createTournament(tournamentData).subscribe({
      next: (tournament) => {
        this.loading.set(false);
        alert('Tournament created successfully!');
        this.router.navigate(['/admin/tournament-overview']);
      },
      error: (error) => {
        console.error('Failed to create tournament:', error);
        this.loading.set(false);
        this.error.set('Failed to create tournament. Please try again.');
      }
    });
  }

  /**
   * Save as draft (optional functionality)
   */
  onSaveAsDraft(): void {
    if (!this.tournamentForm().name || this.tournamentForm().name.trim().length === 0) {
      alert('Please enter a tournament name before saving');
      return;
    }

    // For now, just show a message
    // In a real implementation, you would save as draft with a different status
    alert('Draft functionality not yet implemented');
  }

  /**
   * Cancel and go back
   */
  onCancel(): void {
    if (confirm('Are you sure you want to cancel? All unsaved changes will be lost.')) {
      this.router.navigate(['/admin/tournament-overview']);
    }
  }

  /**
   * Get format label
   */
  getFormatLabel(format: string): string {
    const labels: { [key: string]: string } = {
      'SINGLE_ELIMINATION': 'Single Elimination',
      'DOUBLE_ELIMINATION': 'Double Elimination',
      'ROUND_ROBIN': 'Round Robin',
      'SWISS': 'Swiss System',
      'GROUP_KNOCKOUT': 'Group Stage + Knockout'
    };
    return labels[format] || format;
  }

  /**
   * Get seeding method label
   */
  getSeedingMethodLabel(method: string): string {
    const labels: { [key: string]: string } = {
      'elo': 'By ELO Rating',
      'random': 'Random',
      'manual': 'Manual'
    };
    return labels[method] || method;
  }

  /**
   * Clear error
   */
  clearError(): void {
    this.error.set(null);
  }
}
