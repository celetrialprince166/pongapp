import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MatchService } from '../../../core/services/match.service';
import { MatchWebSocketService } from '../../../core/services/match-websocket.service';

interface ScoreboardGame {
  id: number;
  game_number: number;
  player1_score: number;
  player2_score: number;
  is_completed: boolean;
  winner: number | null;
  winner_username?: string;
}

interface UndoEntry {
  gameNumber: number;
  p1Before: number;
  p2Before: number;
}

@Component({
  selector: 'app-admin-match-scoring',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-match-scoring.component.html',
  styleUrls: ['./admin-match-scoring.component.css']
})
export class AdminMatchScoringComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private matchService = inject(MatchService);
  private matchWebSocket = inject(MatchWebSocketService);

  // Route params
  matchId = signal<number | null>(null);
  tournamentId = signal<number | null>(null);

  // Match data — MatchDetailSerializer: player1/player2 are nested objects
  match = signal<any | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  saving = signal(false);
  completing = signal(false);
  showCompleteModal = signal(false);

  // Inline game score edit (for current in-progress game)
  inProgressP1Score = signal(0);
  inProgressP2Score = signal(0);

  // Undo stack
  private undoStack: UndoEntry[] = [];
  hasUndo = signal(false);

  // Poll interval (fallback when WebSocket unavailable)
  private pollInterval: any = null;
  private wsSubscription?: Subscription;

  // Computed: player names — player1/player2 are nested UserSerializer objects
  player1Name = computed(() => this.match()?.player1?.username ?? 'Player 1');
  player2Name = computed(() => this.match()?.player2?.username ?? 'Player 2');
  player1Id = computed<number | null>(() => this.match()?.player1?.id ?? null);
  player2Id = computed<number | null>(() => this.match()?.player2?.id ?? null);

  // Computed: match-level scores — directly from match (MatchDetailSerializer)
  player1GamesWon = computed(() => this.match()?.player1_games_won ?? 0);
  player2GamesWon = computed(() => this.match()?.player2_games_won ?? 0);

  // Computed: game rows — from match.games (GameSerializer array in MatchDetailSerializer)
  allGames = computed<ScoreboardGame[]>(() => this.match()?.games ?? []);
  completedGames = computed(() => this.allGames().filter((g: ScoreboardGame) => g.is_completed));
  currentGameRow = computed(() => this.allGames().find((g: ScoreboardGame) => !g.is_completed) ?? null);
  pendingGameRows = computed(() => {
    const games = this.allGames();
    const currentIdx = games.findIndex((g: ScoreboardGame) => !g.is_completed);
    if (currentIdx === -1) return [];
    return games.slice(currentIdx + 1);
  });

  // Computed: current game number from the in-progress game row
  currentGame = computed(() => this.currentGameRow()?.game_number ?? 1);

  // Computed: serve indicator
  servePlayer = computed(() => {
    const cur = this.currentGameRow();
    if (!cur) return 1;
    const gameNum = cur.game_number;
    const totalPoints = cur.player1_score + cur.player2_score;
    const baseServerIsP1 = gameNum % 2 === 1;
    const atDeuce = cur.player1_score >= 10 && cur.player2_score >= 10;
    const switchEvery = atDeuce ? 1 : 2;
    const switches = Math.floor(totalPoints / switchEvery);
    const p1Serves = (switches % 2 === 0) === baseServerIsP1;
    return p1Serves ? 1 : 2;
  });

  isMatchComplete = computed(() => this.match()?.status === 'COMPLETED');

  canCompleteMatch = computed(() => {
    const m = this.match();
    if (!m) return false;
    const fmt: string = m.match_format ?? '';
    if (fmt.startsWith('BEST_OF')) {
      const required: Record<string, number> = { BEST_OF_3: 2, BEST_OF_5: 3, BEST_OF_7: 4 };
      const needed = required[fmt] ?? 2;
      return Math.max(this.player1GamesWon(), this.player2GamesWon()) >= needed;
    }
    // RACE_TO formats: require at least one completed game before allowing completion
    return this.completedGames().length > 0;
  });

  ngOnInit(): void {
    const idStr = this.route.snapshot.paramMap.get('id');
    const tidStr = this.route.snapshot.queryParamMap.get('tournament');
    if (idStr) this.matchId.set(parseInt(idStr, 10));
    if (tidStr) this.tournamentId.set(parseInt(tidStr, 10));

    this.loadMatch();
    this.connectWebSocket();
  }

  ngOnDestroy(): void {
    this.wsSubscription?.unsubscribe();
    this.matchWebSocket.disconnect();
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  private connectWebSocket(): void {
    const id = this.matchId();
    if (!id) return;
    this.wsSubscription = this.matchWebSocket.connect(id).subscribe({
      next: (event) => {
        if (event.type === 'match_update') {
          this.match.set(event.match);
          this.syncInProgressScores();
        }
      },
      error: () => {
        console.warn('[AdminScoring] WebSocket unavailable — falling back to polling');
        this.pollInterval = setInterval(() => this.refreshMatch(), 3000);
      }
    });
  }

  loadMatch(): void {
    const id = this.matchId();
    if (!id) return;
    this.loading.set(true);
    this.matchService.getMatchById(id).subscribe({
      next: (m) => {
        this.match.set(m);
        this.syncInProgressScores();
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.detail ?? 'Failed to load match.');
        this.loading.set(false);
      }
    });
  }

  refreshMatch(): void {
    const id = this.matchId();
    if (!id || this.saving()) return;
    this.matchService.getMatchById(id).subscribe({
      next: (m) => {
        this.match.set(m);
        this.syncInProgressScores();
      }
    });
  }

  private syncInProgressScores(): void {
    const cur = this.currentGameRow();
    if (cur) {
      this.inProgressP1Score.set(cur.player1_score);
      this.inProgressP2Score.set(cur.player2_score);
    }
  }

  addPointP1(): void {
    const id = this.player1Id();
    if (id !== null) this.addPoint(id);
  }

  addPointP2(): void {
    const id = this.player2Id();
    if (id !== null) this.addPoint(id);
  }

  addPoint(playerId: number): void {
    const id = this.matchId();
    if (!id || this.saving()) return;

    // Push undo entry before API call
    const cur = this.currentGameRow();
    if (cur) {
      this.undoStack.push({
        gameNumber: cur.game_number,
        p1Before: cur.player1_score,
        p2Before: cur.player2_score
      });
      this.hasUndo.set(true);
    }

    this.saving.set(true);
    this.matchService.addPoint(id, playerId).subscribe({
      next: () => {
        this.saving.set(false);
        this.refreshMatch();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.detail ?? err?.error?.error ?? 'Failed to add point.');
        this.undoStack.pop();
        this.hasUndo.set(this.undoStack.length > 0);
      }
    });
  }

  removePointP1(): void {
    this.removePoint(1);
  }

  removePointP2(): void {
    this.removePoint(2);
  }

  removePoint(player: 1 | 2): void {
    const id = this.matchId();
    const cur = this.currentGameRow();
    if (!id || !cur || this.saving()) return;

    const newP1 = player === 1 ? Math.max(0, cur.player1_score - 1) : cur.player1_score;
    const newP2 = player === 2 ? Math.max(0, cur.player2_score - 1) : cur.player2_score;
    if (newP1 === cur.player1_score && newP2 === cur.player2_score) return;

    this.submitGameCorrection(cur.game_number, newP1, newP2);
  }

  undoLastAction(): void {
    const entry = this.undoStack.pop();
    this.hasUndo.set(this.undoStack.length > 0);
    if (!entry) return;
    this.submitGameCorrection(entry.gameNumber, entry.p1Before, entry.p2Before);
  }

  submitGameCorrection(gameNumber: number, p1Score: number, p2Score: number): void {
    const id = this.matchId();
    if (!id || this.saving()) return;
    this.saving.set(true);
    this.matchService.correctMatchScore(id, [
      { game_number: gameNumber, player1_score: p1Score, player2_score: p2Score }
    ]).subscribe({
      next: () => {
        this.saving.set(false);
        this.refreshMatch();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.detail ?? 'Failed to correct score.');
      }
    });
  }

  saveInProgressGame(): void {
    const cur = this.currentGameRow();
    if (!cur) return;
    this.submitGameCorrection(cur.game_number, this.inProgressP1Score(), this.inProgressP2Score());
  }

  openCompleteModal(): void {
    this.showCompleteModal.set(true);
  }

  cancelCompleteModal(): void {
    this.showCompleteModal.set(false);
  }

  saveAndUpdateBracket(): void {
    this.showCompleteModal.set(false);
    const id = this.matchId();
    if (!id || this.completing()) return;

    const cur = this.currentGameRow();
    const hasUnsavedScores = cur &&
      (this.inProgressP1Score() !== cur.player1_score ||
       this.inProgressP2Score() !== cur.player2_score);

    if (hasUnsavedScores) {
      // Flush unsaved in-progress game scores before completing
      this.saving.set(true);
      this.matchService.correctMatchScore(id, [
        { game_number: cur!.game_number, player1_score: this.inProgressP1Score(), player2_score: this.inProgressP2Score() }
      ]).subscribe({
        next: () => {
          this.saving.set(false);
          this.doCompleteMatch(id);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.detail ?? 'Failed to save in-progress game before completing.');
        }
      });
    } else {
      this.doCompleteMatch(id);
    }
  }

  private doCompleteMatch(id: number): void {
    this.completing.set(true);
    this.matchService.completeMatch(id).subscribe({
      next: () => {
        this.completing.set(false);
        const tid = this.tournamentId();
        if (tid) {
          this.router.navigate(['/admin/tournaments', tid]);
        } else {
          this.router.navigate(['/admin/tournament-overview']);
        }
      },
      error: (err) => {
        this.completing.set(false);
        this.error.set(err?.error?.detail ?? err?.error?.error ?? 'Failed to complete match.');
      }
    });
  }

  cancel(): void {
    const tid = this.tournamentId();
    if (tid) {
      this.router.navigate(['/admin/tournaments', tid]);
    } else {
      this.router.navigate(['/admin/tournament-overview']);
    }
  }

  getGameWinnerLabel(game: ScoreboardGame): string {
    if (!game.is_completed) return '';
    // Prefer winner_username from GameSerializer
    if (game.winner_username) return game.winner_username;
    if (game.winner === this.player1Id()) return this.player1Name();
    if (game.winner === this.player2Id()) return this.player2Name();
    return '';
  }
}
