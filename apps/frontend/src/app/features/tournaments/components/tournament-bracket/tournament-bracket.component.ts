import {
  Component, Input, Output, EventEmitter, signal, computed,
  AfterViewInit, OnDestroy, ViewChild, ElementRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TournamentMatch, GroupData } from '../../../../core/models/tournament.model';
import { TournamentService } from '../../../../core/services/tournament.service';
import { AuthService } from '../../../../core/services/auth.service';

interface BracketRound {
  roundNumber: number;
  roundName: string;
  matches: TournamentMatch[];
}

@Component({
  selector: 'app-tournament-bracket',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './tournament-bracket.component.html',
  styleUrl: './tournament-bracket.component.css'
})
export class TournamentBracketComponent implements AfterViewInit, OnDestroy {
  private tournamentService = inject(TournamentService);
  private authService = inject(AuthService);

  isAdmin = this.authService.isAdmin;

  @ViewChild('bracketScrollRef') bracketScrollRef?: ElementRef<HTMLElement>;

  // ── Signals ────────────────────────────────────────────────────────────────
  matches          = signal<TournamentMatch[]>([]);
  tournamentFormat = signal<string>('');
  tournamentId     = signal<number | null>(null);
  viewMode         = signal<'bracket' | 'list'>('bracket');
  groupStandings   = signal<GroupData[]>([]);

  private resizeObserver?: ResizeObserver;

  // ── Inputs ────────────────────────────────────────────────────────────────
  @Input() set bracketMatches(value: TournamentMatch[]) {
    this.matches.set(value || []);
    setTimeout(() => this.drawConnectors(), 60);
  }

  @Input() set format(value: string) {
    this.tournamentFormat.set(value || '');
    const id = this.tournamentId();
    if (id && value === 'GROUP_KNOCKOUT') {
      this.loadGroupStandings(id);
    }
  }

  @Input() set tournamentIdInput(value: number) {
    this.tournamentId.set(value || null);
    if (value && this.tournamentFormat() === 'GROUP_KNOCKOUT') {
      this.loadGroupStandings(value);
    }
  }

  /** Emitted when admin clicks Score on a live match */
  @Output() adminScoreMatch = new EventEmitter<TournamentMatch>();
  /** Emitted when admin clicks Start on a pending match */
  @Output() adminStartMatch = new EventEmitter<TournamentMatch>();
  /** Emitted when admin clicks Correct on a completed match */
  @Output() adminCorrectMatch = new EventEmitter<TournamentMatch>();

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngAfterViewInit(): void {
    setTimeout(() => this.drawConnectors(), 100);
    const el = this.bracketScrollRef?.nativeElement;
    if (el) {
      this.resizeObserver = new ResizeObserver(() => this.drawConnectors());
      this.resizeObserver.observe(el);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  // ── Computed ──────────────────────────────────────────────────────────────
  bracketRounds = computed<BracketRound[]>(() => {
    const matchList = this.matches();
    if (!matchList || matchList.length === 0) return [];

    const roundsMap = new Map<number, TournamentMatch[]>();
    matchList.forEach(match => {
      if (!roundsMap.has(match.round)) roundsMap.set(match.round, []);
      roundsMap.get(match.round)!.push(match);
    });

    const sortedRoundNumbers = Array.from(roundsMap.keys()).sort((a, b) => a - b);
    const totalRounds = sortedRoundNumbers.length;

    return sortedRoundNumbers.map((roundNum, index) => {
      const roundMatches = roundsMap.get(roundNum)!;
      roundMatches.sort((a, b) => a.match_number - b.match_number);
      return {
        roundNumber: roundNum,
        roundName: this.getRoundName(index + 1, totalRounds),
        matches: roundMatches
      };
    });
  });

  hasMatches = computed(() => this.matches().length > 0);

  lastRoundNumber = computed(() => {
    const rounds = this.bracketRounds();
    return rounds.length > 0 ? rounds[rounds.length - 1].roundNumber : 0;
  });

  // ── Group standings ───────────────────────────────────────────────────────
  loadGroupStandings(tournamentId: number): void {
    this.tournamentService.getGroupStandings(tournamentId).subscribe({
      next: (data) => this.groupStandings.set(data),
      error: () => {}
    });
  }

  // ── SVG Connectors ────────────────────────────────────────────────────────
  drawConnectors(): void {
    if (this.viewMode() !== 'bracket') return;

    const scrollEl = this.bracketScrollRef?.nativeElement;
    if (!scrollEl) return;

    const gridEl = scrollEl.querySelector('.bracket-grid') as HTMLElement | null;
    if (!gridEl) return;

    // Remove existing SVG overlay
    const existing = gridEl.querySelector('.bracket-svg-overlay');
    if (existing) existing.remove();

    const fmt = this.tournamentFormat();
    const usesConnectors =
      fmt === 'SINGLE_ELIMINATION' ||
      fmt === 'DOUBLE_ELIMINATION' ||
      fmt === 'GROUP_KNOCKOUT';
    if (!usesConnectors) return;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('bracket-svg-overlay');
    svg.setAttribute('width',  String(gridEl.offsetWidth));
    svg.setAttribute('height', String(gridEl.offsetHeight));

    const gridRect = gridEl.getBoundingClientRect();
    let hasPath = false;

    for (const match of this.matches()) {
      if (!match.winner_advances_to) continue;

      const sourceEl = gridEl.querySelector(`[data-match-id="${match.id}"]`) as HTMLElement | null;
      const targetEl = gridEl.querySelector(`[data-match-id="${match.winner_advances_to}"]`) as HTMLElement | null;
      if (!sourceEl || !targetEl) continue;

      const sr = sourceEl.getBoundingClientRect();
      const tr = targetEl.getBoundingClientRect();

      const x1 = sr.right  - gridRect.left;
      const y1 = sr.top    - gridRect.top  + sr.height / 2;
      const x2 = tr.left   - gridRect.left;
      const y2 = tr.top    - gridRect.top  + tr.height / 2;
      const mx = (x1 + x2) / 2;

      const isCompleted = match.status === 'completed' || match.winner !== null;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`);
      path.setAttribute('stroke', isCompleted ? '#22c55e' : '#4b5563');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('fill', 'none');
      path.setAttribute('opacity', '0.6');
      svg.appendChild(path);
      hasPath = true;
    }

    if (hasPath) gridEl.appendChild(svg);
  }

  // ── View toggle ───────────────────────────────────────────────────────────
  setViewMode(mode: 'bracket' | 'list'): void {
    this.viewMode.set(mode);
    if (mode === 'bracket') setTimeout(() => this.drawConnectors(), 60);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private getRoundName(roundIndex: number, totalRounds: number): string {
    const fromEnd = totalRounds - roundIndex + 1;
    if (fromEnd === 1) return 'Finals';
    if (fromEnd === 2) return 'Semi-Finals';
    if (fromEnd === 3) return 'Quarter-Finals';
    return `Round ${roundIndex}`;
  }

  getPlayerName(match: TournamentMatch, player: 'player1' | 'player2'): string {
    if (player === 'player1') {
      return match.player1_name || (match.player1 ? `Player ${match.player1}` : 'TBD');
    }
    return match.player2_name || (match.player2 ? `Player ${match.player2}` : 'TBD');
  }

  isWinner(match: TournamentMatch, player: 'player1' | 'player2'): boolean {
    if (!match.winner) return false;
    return player === 'player1'
      ? match.winner === match.player1
      : match.winner === match.player2;
  }

  isCompleted(match: TournamentMatch): boolean {
    return match.status === 'completed' || match.winner !== null || match.completed_at !== null;
  }

  getMatchStatusClass(match: TournamentMatch): string {
    if (match.status === 'live') return 'match-live';
    if (this.isCompleted(match))  return 'match-completed';
    if (match.player1 && match.player2) return 'match-ready';
    return 'match-pending';
  }

  getListStatusLabel(match: TournamentMatch): string {
    if (match.status === 'live')  return '🔴 LIVE';
    if (this.isCompleted(match))  return 'Done';
    if (match.is_bye)             return 'BYE';
    return 'Upcoming';
  }
}
