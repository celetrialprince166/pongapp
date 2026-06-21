import { Component, Input, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Tournament } from '../../../../../core/models/tournament.model';
import { environment } from '../../../../../../environments/environment';

@Component({
  selector: 'app-tournaments-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tournaments-tab.component.html',
  styleUrl: './tournaments-tab.component.css'
})
export class TournamentsTabComponent implements OnInit {
  @Input({ required: true }) seasonId!: number;

  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/tournaments`;

  tournaments = signal<Tournament[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.http.get<any>(`${this.apiUrl}/?season=${this.seasonId}`).subscribe({
      next: (res) => {
        const list: Tournament[] = Array.isArray(res) ? res : (res?.results ?? []);
        this.tournaments.set(list);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Failed to load tournaments for this season.');
        this.isLoading.set(false);
      }
    });
  }

  formatLabel(val: string): string {
    return val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  getStatusInfo(status: string): { cls: string; label: string } {
    const map: Record<string, { cls: string; label: string }> = {
      UPCOMING:      { cls: 'badge-upcoming',      label: 'Upcoming' },
      REGISTRATION:  { cls: 'badge-registration',  label: 'Open' },
      IN_PROGRESS:   { cls: 'badge-in-progress',   label: 'In Progress' },
      COMPLETED:     { cls: 'badge-completed',      label: 'Completed' },
      CANCELLED:     { cls: 'badge-cancelled',      label: 'Cancelled' },
    };
    return map[status] ?? { cls: '', label: status };
  }

  inProgressCount(): number {
    return this.tournaments().filter(t => t.status === 'IN_PROGRESS').length;
  }

  totalParticipants(): number {
    return this.tournaments().reduce((acc, t) => acc + (t.participant_count ?? 0), 0);
  }
}
