import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService, User } from 'src/app/core/services/user.service';

@Component({
  selector: 'app-season-progress',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './season-progress.html',
  styleUrls: ['./season-progress.css'],
})
export class SeasonProgress implements OnInit {
  winRatio = signal<number>(0);
  gamesPlayed = signal<number>(0);
  totalGames = signal<number>(0);
  playedCount = signal<number>(0);
  winStreak = signal<number>(0);
  isLoading = signal<boolean>(true);

  constructor(private userService: UserService) { }

  ngOnInit(): void {
    this.loadData();
  }

  get gamesPlayedPercentage(): number {
    const total = this.totalGames();
    return total > 0 ? (this.gamesPlayed() / total) * 100 : 0;
  }

  private loadData(): void {
    this.isLoading.set(true);

    this.userService.getUser().subscribe({
      next: (user: User) => {
        // Calculate win ratio percentage
        const winRatio = Math.round(user.win_rate * 100) || 0;
        this.winRatio.set(winRatio);

        // Set games played
        this.gamesPlayed.set(user.total_matches || 0);
        this.playedCount.set(user.total_matches || 0);

        // For now, assume season total is based on some calculation
        // You might want to fetch this from a Season API endpoint
        // For MVP, let's assume a season is 25 games or current total + 10
        const seasonTotal = Math.max(25, user.total_matches + 10);
        this.totalGames.set(seasonTotal);

        // Set win streak
        this.winStreak.set(user.win_streak || 0);

        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading season progress data:', error);
        this.isLoading.set(false);
      }
    });
  }
}
