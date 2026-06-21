import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, ArrowLeft, Shuffle, Search, CheckCircle, User, Swords } from 'lucide-angular';
import { RouterLink, Router } from '@angular/router';
import { LeaderboardService } from 'src/app/core/services/leaderboard.service';
import { ChallengeService } from 'src/app/core/services/challenge.service';
import { UserService } from 'src/app/core/services/user.service';
import { Player } from 'src/app/core/models/player.model';
import { ChallengeRequest } from 'src/app/core/models/challenge.model';

@Component({
    selector: 'app-challenge-hub',
    standalone: true,
    imports: [CommonModule, FormsModule, LucideAngularModule, RouterLink],
    templateUrl: './challenge-hub.html',
    styleUrls: ['./challenge-hub.css']
})
export class ChallengeHub implements OnInit {
    readonly arrowLeftIcon = ArrowLeft;
    readonly shuffleIcon = Shuffle;
    readonly searchIcon = Search;
    readonly checkCircleIcon = CheckCircle;
    readonly userIcon = User;
    readonly swordsIcon = Swords;

    // Signals
    searchQuery = signal<string>('');
    selectedPlayer = signal<Player | null>(null);
    allPlayers = signal<Player[]>([]);
    currentUserId = signal<number | null>(null);
    isLoading = signal<boolean>(true);
    isSubmitting = signal<boolean>(false);
    errorMessage = signal<string>('');
    successMessage = signal<string>('');

    // Form state
    matchType: 'duel' | 'training' = 'duel';
    matchFormat: 'best-of' | 'race-to' = 'best-of';
    bestOfGames: number = 3;
    raceToPoints: number = 11;

    constructor(
        private leaderboardService: LeaderboardService,
        private challengeService: ChallengeService,
        private userService: UserService,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.loadData();
    }

    filteredPlayers = computed(() => {
        const search = this.searchQuery().toLowerCase();
        const players = this.allPlayers();
        const currentId = this.currentUserId();

        // Filter out current user and apply search
        return players.filter(p => {
            if (p.id === currentId) return false; // Don't show self
            if (!search) return true;

            const name = p.first_name && p.last_name
                ? `${p.first_name} ${p.last_name}`.toLowerCase()
                : '';
            return name.includes(search) || p.username.toLowerCase().includes(search);
        });
    });

    private loadData(): void {
        this.isLoading.set(true);

        // Get current user first
        this.userService.getUser().subscribe({
            next: (user) => {
                this.currentUserId.set(user.id);

                // Then get all players
                this.leaderboardService.getLeaderboard().subscribe({
                    next: (players) => {
                        this.allPlayers.set(players);
                        this.isLoading.set(false);
                    },
                    error: (error) => {
                        console.error('[Challenge Hub] Error loading players:', error);
                        this.errorMessage.set('Failed to load players. Please try again.');
                        this.isLoading.set(false);
                    }
                });
            },
            error: (error) => {
                console.error('[Challenge Hub] Error loading user:', error);
                this.errorMessage.set('Failed to load user data.');
                this.isLoading.set(false);
            }
        });
    }

    selectPlayer(player: Player): void {
        this.selectedPlayer.set(player);
        this.clearMessages();
    }

    challengeRandom(): void {
        const availablePlayers = this.filteredPlayers();
        if (availablePlayers.length === 0) {
            this.errorMessage.set('No players available to challenge.');
            return;
        }

        const randomIndex = Math.floor(Math.random() * availablePlayers.length);
        const randomPlayer = availablePlayers[randomIndex];
        this.selectPlayer(randomPlayer);
    }

    challengeSelected(): void {
        const player = this.selectedPlayer();
        if (!player) {
            this.errorMessage.set('Please select a player to challenge.');
            return;
        }

        this.isSubmitting.set(true);
        this.clearMessages();

        // Map format to backend expected values
        const matchFormat: 'BEST_OF' | 'RACE_TO' = this.matchFormat === 'best-of' ? 'BEST_OF' : 'RACE_TO';
        const formatValue = this.matchFormat === 'best-of' ? this.bestOfGames : this.raceToPoints;
        const matchTypeBackend: 'DUEL' | 'TRAINING' = this.matchType === 'duel' ? 'DUEL' : 'TRAINING';

        const challengePayload: ChallengeRequest = {
            challenged: player.id,
            match_format: matchFormat,
            format_value: formatValue,
            match_type: matchTypeBackend
        };

        this.challengeService.createChallenge(challengePayload).subscribe({
            next: (response) => {
                const playerName = player.first_name && player.last_name
                    ? `${player.first_name} ${player.last_name}`
                    : player.username;
                this.successMessage.set(`Challenge sent to ${playerName}!`);
                this.isSubmitting.set(false);

                // Reset form after 2 seconds and navigate to dashboard
                setTimeout(() => {
                    this.router.navigate(['/dashboard']);
                }, 2000);
            },
            error: (error) => {
                console.error('[Challenge Hub] Error sending challenge:', error);

                let errorMsg = 'Failed to send challenge. Please try again.';
                if (error.error?.detail) {
                    errorMsg = error.error.detail;
                } else if (error.error?.message) {
                    errorMsg = error.error.message;
                } else if (typeof error.error === 'string') {
                    errorMsg = error.error;
                } else if (error.error) {
                    // Try to extract validation errors
                    const validationErrors = Object.entries(error.error)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(', ');
                    if (validationErrors) {
                        errorMsg = validationErrors;
                    }
                }

                this.errorMessage.set(errorMsg);
                this.isSubmitting.set(false);
            }
        });
    }

    private clearMessages(): void {
        this.errorMessage.set('');
        this.successMessage.set('');
    }

    getLeagueBadgeClass(league: string): string {
        return league === 'PRO' ? 'badge-pro' : 'badge-amateur';
    }
}
