import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TournamentCardData {
  id: number;
  name: string;
  location: string;
  heroImage: string;
  heroColor: string;
  status: 'open' | 'closing_soon' | 'closed';
  tournamentStatus?: string; // Raw backend status: UPCOMING, REGISTRATION, IN_PROGRESS, COMPLETED, CANCELLED
  prize: string;
  participants: string;
  format: string;
  date: string;
  isFull: boolean;
  isRegistered?: boolean;
}

@Component({
  selector: 'app-tournament-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tournament-card.component.html',
  styleUrl: './tournament-card.component.css'
})
export class TournamentCardComponent {
  tournament = input.required<TournamentCardData>();
  cardClick = output<number>();

  onClick() {
    this.cardClick.emit(this.tournament().id);
  }

  getStatusClass(): string {
    const rawStatus = this.tournament().tournamentStatus;
    if (rawStatus) {
      switch (rawStatus) {
        case 'UPCOMING': return 'status-upcoming';
        case 'REGISTRATION': return 'status-registration';
        case 'IN_PROGRESS': return 'status-in-progress';
        case 'COMPLETED': return 'status-completed';
        case 'CANCELLED': return 'status-cancelled';
      }
    }
    // Fallback to availability status
    switch (this.tournament().status) {
      case 'open': return 'status-open';
      case 'closing_soon': return 'status-closing';
      case 'closed': return 'status-closed';
      default: return '';
    }
  }

  getStatusLabel(): string {
    const rawStatus = this.tournament().tournamentStatus;
    if (rawStatus) {
      switch (rawStatus) {
        case 'UPCOMING': return 'Upcoming';
        case 'REGISTRATION': return 'Open';
        case 'IN_PROGRESS': return 'Live';
        case 'COMPLETED': return 'Completed';
        case 'CANCELLED': return 'Cancelled';
      }
    }
    switch (this.tournament().status) {
      case 'open': return 'OPEN';
      case 'closing_soon': return 'LAST CALL';
      case 'closed': return 'CLOSED';
      default: return '';
    }
  }

  getButtonClass(): string {
    return 'btn-primary';
  }

  getButtonText(): string {
    return 'View Details';
  }
}
