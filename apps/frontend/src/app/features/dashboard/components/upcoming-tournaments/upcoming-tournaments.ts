import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule, Calendar, Users, ChevronRight, Trophy, Target, Repeat } from 'lucide-angular';
import { TournamentService } from 'src/app/core/services/tournament.service';
import { Tournament } from 'src/app/core/models/tournament.model';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-upcoming-tournaments',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, RouterLink],
  templateUrl: './upcoming-tournaments.html',
  styleUrls: ['./upcoming-tournaments.css'],
})
export class UpcomingTournaments implements OnInit {
  readonly calendarIcon = Calendar;
  readonly usersIcon = Users;
  readonly arrowIcon = ChevronRight;
  tournaments = signal<Tournament[]>([]);
  isLoading = signal<boolean>(true);
  isRegistering = signal<boolean>(false);

  // Inject AuthService for role-based access control
  authService = inject(AuthService);

  constructor(
    private tournamentService: TournamentService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.isLoading.set(true);

    // Fetch tournaments with REGISTRATION or UPCOMING status
    this.tournamentService.getTournaments().subscribe({
      next: (tournaments) => {
        // Filter for upcoming tournaments (REGISTRATION or UPCOMING status)
        const upcomingTournaments = tournaments.filter(
          t => t.status === 'REGISTRATION' || t.status === 'UPCOMING'
        );
        this.tournaments.set(upcomingTournaments);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading tournaments:', error);
        this.isLoading.set(false);
      }
    });
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  getTournamentIcon(format: string): any {
    switch (format) {
      case 'SINGLE_ELIMINATION':
        return Trophy;
      case 'DOUBLE_ELIMINATION':
        return Repeat;
      case 'ROUND_ROBIN':
        return Target;
      default:
        return Trophy;
    }
  }

  /**
   * Check if user can register for tournament
   */
  canRegister(tournament: Tournament): boolean {
    // Check status (both REGISTRATION and UPCOMING are valid)
    const validStatus = tournament.status === 'REGISTRATION' || tournament.status === 'UPCOMING';

    // Check if tournament is full
    const notFull = !tournament.is_full && tournament.participant_count < tournament.max_participants;

    // Check if registration is open
    const isOpen = tournament.is_registration_open !== false;

    // Check if registration deadline has not passed
    const now = new Date();
    const deadline = new Date(tournament.registration_deadline);
    const beforeDeadline = now < deadline;

    return validStatus && notFull && isOpen && beforeDeadline;
  }

  /**
   * Register for tournament
   */
  onRegister(tournamentId: number, event: Event): void {
    event.stopPropagation();  // Prevent navigation

    if (this.isRegistering()) return;

    this.isRegistering.set(true);

    this.tournamentService.registerForTournament(tournamentId).subscribe({
      next: (response) => {
        console.log('Registration successful:', response);
        alert('Successfully registered for tournament!');
        this.isRegistering.set(false);
        // Reload tournaments to update participant count
        this.loadData();
      },
      error: (error) => {
        console.error('Registration failed:', error);

        // Extract error message from backend response
        let errorMessage = 'Failed to register for tournament';

        if (error.error?.error) {
          const backendError = error.error.error;

          // Provide user-friendly messages for specific errors
          if (backendError.includes('deadline has passed')) {
            errorMessage = 'Registration deadline has passed for this tournament';
          } else if (backendError.includes('full')) {
            errorMessage = 'This tournament is already full';
          } else if (backendError.includes('already registered')) {
            errorMessage = 'You are already registered for this tournament';
          } else if (backendError.includes('not open for registration')) {
            errorMessage = 'This tournament is not open for registration';
          } else {
            errorMessage = backendError;
          }
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }

        alert(errorMessage);
        this.isRegistering.set(false);
        // Reload data to refresh tournament state
        this.loadData();
      }
    });
  }

  /**
   * Navigate to tournament detail page
   */
  navigateToTournament(tournamentId: number): void {
    this.router.navigate(['/tournaments', tournamentId]);
  }
}
