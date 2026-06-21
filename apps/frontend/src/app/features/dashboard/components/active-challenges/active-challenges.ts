import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Challenge } from '../../../../core/models/challenge.model';
import { ChallengeService } from '../../../../core/services/challenge.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-active-challenges',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './active-challenges.html',
  styleUrls: ['./active-challenges.css'],
})
export class ActiveChallenges implements OnInit {
  private challengeService = inject(ChallengeService);
  private authService = inject(AuthService);

  isLoading = signal(true);
  incoming = signal<Challenge[]>([]);
  sent = signal<Challenge[]>([]);
  actionInProgress = signal<number | null>(null);

  currentUserId = computed(() => this.authService.currentUser()?.id ?? null);

  hasAny = computed(() => this.incoming().length > 0 || this.sent().length > 0);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    let received = false;
    let sentDone = false;

    this.challengeService.getReceivedChallenges().subscribe({
      next: (data) => {
        this.incoming.set(data.filter(c => c.status === 'PENDING'));
        received = true;
        if (sentDone) this.isLoading.set(false);
      },
      error: () => {
        received = true;
        if (sentDone) this.isLoading.set(false);
      }
    });

    this.challengeService.getSentChallenges().subscribe({
      next: (data) => {
        this.sent.set(data.filter(c => c.status === 'PENDING'));
        sentDone = true;
        if (received) this.isLoading.set(false);
      },
      error: () => {
        sentDone = true;
        if (received) this.isLoading.set(false);
      }
    });
  }

  accept(id: number): void {
    this.actionInProgress.set(id);
    this.challengeService.acceptChallenge(id).subscribe({
      next: () => {
        this.incoming.update(list => list.filter(c => c.id !== id));
        this.actionInProgress.set(null);
      },
      error: () => this.actionInProgress.set(null)
    });
  }

  decline(id: number): void {
    this.actionInProgress.set(id);
    this.challengeService.declineChallenge(id).subscribe({
      next: () => {
        this.incoming.update(list => list.filter(c => c.id !== id));
        this.actionInProgress.set(null);
      },
      error: () => this.actionInProgress.set(null)
    });
  }

  cancel(id: number): void {
    this.actionInProgress.set(id);
    this.challengeService.cancelChallenge(id).subscribe({
      next: () => {
        this.sent.update(list => list.filter(c => c.id !== id));
        this.actionInProgress.set(null);
      },
      error: () => this.actionInProgress.set(null)
    });
  }

  formatChallenge(c: Challenge): string {
    return `Best of ${c.format_value}`;
  }
}
