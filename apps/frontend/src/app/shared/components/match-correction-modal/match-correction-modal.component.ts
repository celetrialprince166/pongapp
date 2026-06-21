import {
  Component, Input, Output, EventEmitter, OnInit, signal, inject, DestroyRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { TournamentMatch } from '../../../core/models/tournament.model';
import { MatchService } from '../../../core/services/match.service';

export interface GameEntry {
  game_number: number;
  player1_score: number;
  player2_score: number;
}

interface ScoreSnapshot {
  games: GameEntry[];
}

@Component({
  selector: 'app-match-correction-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './match-correction-modal.component.html',
  styleUrls: ['./match-correction-modal.component.css']
})
export class MatchCorrectionModalComponent implements OnInit {
  private matchService = inject(MatchService);
  private destroyRef = inject(DestroyRef);

  @Input() match: TournamentMatch | null = null;
  @Input() mode: 'LIVE' | 'CORRECT' = 'CORRECT';
  @Input() matchFormat: 'BEST_OF_3' | 'BEST_OF_5' | 'BEST_OF_7' |
                        'RACE_TO_5' | 'RACE_TO_11' | 'RACE_TO_21' = 'BEST_OF_3';

  @Output() scoreSaved = new EventEmitter<TournamentMatch>();
  @Output() cancelled = new EventEmitter<void>();

  // Shared state
  saving = signal(false);
  error = signal<string | null>(null);
  reason = signal('');

  // CORRECT mode: per-game entry rows
  gameEntries = signal<GameEntry[]>([]);

  // LIVE mode: scoreboard + undo
  scoreboard = signal<any>(null);
  scoreboardLoading = signal(false);
  addingPoint = signal<number | null>(null);
  undoStack = signal<ScoreSnapshot[]>([]);

  get maxGames(): number {
    if (this.matchFormat === 'BEST_OF_5') return 5;
    if (this.matchFormat === 'BEST_OF_7') return 7;
    if (this.matchFormat === 'RACE_TO_5') return 5;
    if (this.matchFormat === 'RACE_TO_11') return 11;
    if (this.matchFormat === 'RACE_TO_21') return 21;
    return 3;
  }

  get player1Name(): string {
    return this.match?.player1_name ?? `Player ${this.match?.player1 ?? '1'}`;
  }

  get player2Name(): string {
    return this.match?.player2_name ?? `Player ${this.match?.player2 ?? '2'}`;
  }

  get matchLabel(): string {
    if (!this.match) return 'Match';
    return `Round ${this.match.round} · Match ${this.match.match_number}`;
  }

  get matchId(): number {
    return this.match?.match ?? 0;
  }

  ngOnInit(): void {
    if (this.mode === 'CORRECT') {
      this.initGameEntries();
    } else {
      this.initLiveMode();
    }
  }

  private initGameEntries(): void {
    const entries: GameEntry[] = [];
    for (let i = 1; i <= this.maxGames; i++) {
      entries.push({ game_number: i, player1_score: 0, player2_score: 0 });
    }
    this.gameEntries.set(entries);
  }

  private initLiveMode(): void {
    this.loadScoreboard();
    interval(3000).pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap(() => this.matchService.getMatchScoreboard(this.matchId))
    ).subscribe({
      next: (sb) => this.scoreboard.set(sb),
      error: () => {}
    });
  }

  private loadScoreboard(): void {
    this.scoreboardLoading.set(true);
    this.matchService.getMatchScoreboard(this.matchId).subscribe({
      next: (sb) => {
        this.scoreboard.set(sb);
        this.scoreboardLoading.set(false);
      },
      error: () => this.scoreboardLoading.set(false)
    });
  }

  // ─── CORRECT mode ─────────────────────────────────────────────────────────

  updateGameScore(index: number, field: 'player1_score' | 'player2_score', value: string): void {
    const num = parseInt(value, 10);
    const entries = [...this.gameEntries()];
    entries[index] = { ...entries[index], [field]: isNaN(num) ? 0 : Math.max(0, num) };
    this.gameEntries.set(entries);
  }

  isCorrectValid(): boolean {
    return this.gameEntries().some(g => g.player1_score > 0 || g.player2_score > 0);
  }

  onSaveCorrection(): void {
    if (!this.match || !this.isCorrectValid()) return;
    this.saving.set(true);
    this.error.set(null);

    const nonEmpty = this.gameEntries().filter(g => g.player1_score > 0 || g.player2_score > 0);

    this.matchService.correctMatchScore(this.matchId, nonEmpty, this.reason() || undefined).subscribe({
      next: () => {
        this.saving.set(false);
        const p1Wins = nonEmpty.filter(g => g.player1_score > g.player2_score).length;
        const p2Wins = nonEmpty.filter(g => g.player2_score > g.player1_score).length;
        const updated: TournamentMatch = {
          ...this.match!,
          player1_score: p1Wins,
          player2_score: p2Wins,
          status: 'completed'
        };
        this.scoreSaved.emit(updated);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.detail ?? err?.error?.error ?? 'Failed to save correction.');
      }
    });
  }

  // ─── LIVE mode ────────────────────────────────────────────────────────────

  addPoint(playerId: number): void {
    if (!this.matchId || this.addingPoint() !== null || this.saving()) return;

    const current = this.scoreboard();
    if (current) {
      const snapshot: ScoreSnapshot = {
        games: (current.games || []).map((g: any) => ({
          game_number: g.game_number,
          player1_score: g.player1_score,
          player2_score: g.player2_score
        }))
      };
      this.undoStack.update(stack => [...stack, snapshot]);
    }

    this.addingPoint.set(playerId);
    this.matchService.addPoint(this.matchId, playerId).subscribe({
      next: () => {
        this.addingPoint.set(null);
        this.loadScoreboard();
      },
      error: (err) => {
        this.addingPoint.set(null);
        this.undoStack.update(stack => stack.slice(0, -1));
        this.error.set(err?.error?.detail ?? 'Failed to add point.');
      }
    });
  }

  canUndo(): boolean {
    return this.undoStack().length > 0;
  }

  undoLastPoint(): void {
    const stack = this.undoStack();
    if (stack.length === 0) return;

    const prev = stack[stack.length - 1];
    this.undoStack.update(s => s.slice(0, -1));
    this.saving.set(true);
    this.error.set(null);

    this.matchService.correctMatchScore(this.matchId, prev.games).subscribe({
      next: () => {
        this.saving.set(false);
        this.loadScoreboard();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.detail ?? 'Failed to undo.');
        this.undoStack.update(s => [...s, prev]);
      }
    });
  }

  completeMatch(): void {
    if (!this.matchId) return;
    this.saving.set(true);
    this.error.set(null);

    this.matchService.completeMatch(this.matchId).subscribe({
      next: () => {
        this.saving.set(false);
        const sb = this.scoreboard();
        const updated: TournamentMatch = {
          ...this.match!,
          player1_score: sb?.player1_games_won ?? this.match?.player1_score ?? 0,
          player2_score: sb?.player2_games_won ?? this.match?.player2_score ?? 0,
          status: 'completed'
        };
        this.scoreSaved.emit(updated);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.detail ?? 'Failed to complete match.');
      }
    });
  }

  onReasonChange(value: string): void {
    this.reason.set(value);
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
