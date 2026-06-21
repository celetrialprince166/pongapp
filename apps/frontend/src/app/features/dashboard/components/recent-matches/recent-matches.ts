import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { UserService, User } from 'src/app/core/services/user.service';
import { MatchService } from 'src/app/core/services/match.service';
import { ChallengeService } from 'src/app/core/services/challenge.service';
import { Match as MatchModel } from 'src/app/core/models/match.model';
import { Challenge } from 'src/app/core/models/challenge.model';
import { forkJoin } from 'rxjs';

interface DisplayMatch {
  opponentName: string;
  opponentAvatar: string | null;
  score: string;
  result: 'WIN' | 'LOSS';
  eloChange: number;
}

interface DisplayChallenge {
  opponentName: string;
  opponentAvatar: string | null;
  format: string;
  status: string;
  isReceived: boolean;
  id: number;
}

@Component({
  selector: 'app-recent-matches',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './recent-matches.html',
  styleUrls: ['./recent-matches.css'],
})
export class RecentMatches implements OnInit {
  activeTab: 'recent' | 'challenges' = 'recent';
  matches = signal<DisplayMatch[]>([]);
  challenges = signal<DisplayChallenge[]>([]);
  isLoading = signal<boolean>(true);
  currentUserId: number | undefined;

  constructor(
    private userService: UserService,
    private matchService: MatchService,
    private challengeService: ChallengeService
  ) { }

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.isLoading.set(true);

    this.userService.getUser().subscribe({
      next: (user: User) => {
        this.currentUserId = user.id;

        // Fetch both matches and challenges in parallel
        forkJoin({
          matches: this.matchService.getUserMatches(user.id, 5),
          receivedChallenges: this.challengeService.getReceivedChallenges(),
          sentChallenges: this.challengeService.getSentChallenges()
        }).subscribe({
          next: ({ matches, receivedChallenges, sentChallenges }) => {
            console.log('[Recent Matches] Received challenges:', receivedChallenges);
            console.log('[Recent Matches] Sent challenges:', sentChallenges);

            // Process matches
            const completedMatches = matches.filter(m => m.status === 'COMPLETED');
            const displayMatches = completedMatches.map(match => this.transformMatch(match));
            this.matches.set(displayMatches);

            // Process challenges (only pending ones)
            const pendingReceived = receivedChallenges
              .filter(c => c.status === 'PENDING')
              .map(c => this.transformChallenge(c, true));
            const pendingSent = sentChallenges
              .filter(c => c.status === 'PENDING')
              .map(c => this.transformChallenge(c, false));

            console.log('[Recent Matches] Pending received:', pendingReceived);
            console.log('[Recent Matches] Pending sent:', pendingSent);

            this.challenges.set([...pendingReceived, ...pendingSent]);
            console.log('[Recent Matches] All challenges set:', this.challenges());

            this.isLoading.set(false);
          },
          error: (error) => {
            console.error('Error loading dashboard data:', error);
            this.isLoading.set(false);
          }
        });
      },
      error: (error) => {
        console.error('Error loading user data:', error);
        this.isLoading.set(false);
      }
    });
  }

  private transformMatch(match: MatchModel): DisplayMatch {
    const isPlayer1 = match.player1 === this.currentUserId;
    const won = match.winner === this.currentUserId;

    // Calculate score from games won if score string not available
    const scoreDisplay = match.score || `${match.player1_games_won || 0}-${match.player2_games_won || 0}`;

    return {
      opponentName: isPlayer1 ? (match.player2_username || `Player ${match.player2}`) : (match.player1_username || `Player ${match.player1}`),
      opponentAvatar: null, // Will be enhanced later
      score: scoreDisplay,
      result: won ? 'WIN' : 'LOSS',
      eloChange: won ? 10 : -10 // Placeholder, will fetch from rating history later
    };
  }

  private transformChallenge(challenge: Challenge, isReceived: boolean): DisplayChallenge {
    return {
      opponentName: isReceived
        ? (challenge.challenger_username || `Player ${challenge.challenger}`)
        : (challenge.challenged_username || `Player ${challenge.challenged}`),
      opponentAvatar: null,
      format: this.formatMatchType(challenge.match_format, challenge.format_value),
      status: challenge.status,
      isReceived: isReceived,
      id: challenge.id
    };
  }

  private formatMatchType(format: string, formatValue: number): string {
    if (format === 'BEST_OF') {
      return `Best of ${formatValue}`;
    } else if (format === 'RACE_TO') {
      return `Race to ${formatValue}`;
    }
    return format;
  }
}
