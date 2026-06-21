import {
  Component, OnInit, OnDestroy, signal, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatchService } from '../../../core/services/match.service';
import { MatchWebSocketService } from '../../../core/services/match-websocket.service';
import { Match } from '../../../core/models/match.model';

type MatchFormat = 'BEST_OF_3' | 'BEST_OF_5' | 'BEST_OF_7' | 'RACE_TO_5' | 'RACE_TO_11' | 'RACE_TO_21';

@Component({
  selector: 'app-live-scoring',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './live-scoring.component.html',
  styleUrl: './live-scoring.component.css'
})
export class LiveScoringComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private matchService = inject(MatchService);
  private matchWebSocket = inject(MatchWebSocketService);

  match = signal<Match | null>(null);
  loading = signal(true);
  submitting = signal(false);
  error = signal<string | null>(null);

  private matchId = 0;
  private wsSubscription?: Subscription;
  private pollInterval?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.matchId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadMatch(true);
    this.connectWebSocket();
  }

  ngOnDestroy(): void {
    this.wsSubscription?.unsubscribe();
    this.matchWebSocket.disconnect();
    clearInterval(this.pollInterval);
  }

  private connectWebSocket(): void {
    this.wsSubscription = this.matchWebSocket.connect(this.matchId).subscribe({
      next: (event) => {
        if (event.type === 'match_update') {
          this.match.set(event.match);
          this.loading.set(false);
          if (event.match.status === 'COMPLETED') {
            setTimeout(() => this.router.navigate(['/dashboard']), 2000);
          }
        }
      },
      error: () => {
        console.warn('WebSocket unavailable — falling back to polling');
        this.startPolling();
      }
    });
  }

  private startPolling(): void {
    clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => this.loadMatch(false), 3000);
  }

  loadMatch(showLoading = false): void {
    if (showLoading) this.loading.set(true);
    this.matchService.getMatchById(this.matchId).subscribe({
      next: (m) => {
        this.match.set(m);
        this.loading.set(false);
        this.error.set(null);
      },
      error: () => {
        this.loading.set(false);
        if (showLoading) this.error.set('Failed to load match.');
      }
    });
  }

  addPoint(player: 'player1' | 'player2'): void {
    const m = this.match();
    if (!m || this.submitting()) return;
    const playerId = player === 'player1' ? m.player1 : m.player2;
    this.submitting.set(true);
    this.error.set(null);
    this.matchService.addPoint(this.matchId, playerId).subscribe({
      next: () => {
        this.submitting.set(false);
        // WebSocket will push the update; polling fallback also fires via interval
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.error?.error ?? 'Failed to add point.');
      }
    });
  }

  completeMatch(): void {
    if (!confirm('Complete this match and record the result?')) return;
    this.submitting.set(true);
    this.error.set(null);
    this.matchService.completeMatch(this.matchId).subscribe({
      next: () => {
        this.submitting.set(false);
        // WebSocket will push status=COMPLETED and trigger navigation;
        // fall back to immediate navigate if WS is in polling mode
        if (!this.wsSubscription || this.pollInterval) {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.error?.error ?? 'Failed to complete match.');
      }
    });
  }

  isRaceTo(): boolean {
    return this.match()?.match_format?.startsWith('RACE_TO') ?? false;
  }

  getFormatLabel(): string {
    const fmt = this.match()?.match_format as MatchFormat | undefined;
    if (!fmt) return '';
    const labels: Record<MatchFormat, string> = {
      'BEST_OF_3': 'Best of 3',
      'BEST_OF_5': 'Best of 5',
      'BEST_OF_7': 'Best of 7',
      'RACE_TO_5': 'Race to 5',
      'RACE_TO_11': 'Race to 11',
      'RACE_TO_21': 'Race to 21',
    };
    return labels[fmt] ?? fmt;
  }

  getTargetLabel(): string {
    const m = this.match();
    if (!m) return '';
    if (m.match_format.startsWith('RACE_TO')) {
      return `First to ${m.target_score} points`;
    }
    const targets: Record<string, number> = {
      'BEST_OF_3': 2, 'BEST_OF_5': 3, 'BEST_OF_7': 4
    };
    return `First to ${targets[m.match_format] ?? 2} wins`;
  }

  getScoreLabel(): string {
    return this.isRaceTo() ? 'points' : 'games won';
  }

  canComplete(): boolean {
    const m = this.match();
    if (!m || m.status !== 'IN_PROGRESS') return false;
    const p1 = m.player1_games_won ?? 0;
    const p2 = m.player2_games_won ?? 0;
    if (m.match_format.startsWith('BEST_OF')) {
      const req: Record<string, number> = { 'BEST_OF_3': 2, 'BEST_OF_5': 3, 'BEST_OF_7': 4 };
      const needed = req[m.match_format] ?? 2;
      return p1 >= needed || p2 >= needed;
    }
    if (m.match_format.startsWith('RACE_TO')) {
      const target = m.target_score ?? 0;
      return p1 >= target || p2 >= target;
    }
    return false;
  }

  getLeadingPlayer(): 'player1' | 'player2' | null {
    const m = this.match();
    if (!m) return null;
    const p1 = m.player1_games_won ?? 0;
    const p2 = m.player2_games_won ?? 0;
    if (p1 > p2) return 'player1';
    if (p2 > p1) return 'player2';
    return null;
  }
}
