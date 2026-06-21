import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService, User } from 'src/app/core/services/user.service';
import { LeaderboardService } from 'src/app/core/services/leaderboard.service';
import { RatingService } from 'src/app/core/services/rating.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-rating-box',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rating-box.html',
  styleUrls: ['./rating-box.css'],
})
export class RatingBox implements OnInit {
  user: User | undefined;
  rank = signal<string>('--- / ---');
  ratingChange = signal<number>(0);
  isLoading = signal<boolean>(true);

  constructor(
    private userService: UserService,
    private leaderboardService: LeaderboardService,
    private ratingService: RatingService
  ) { }

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.isLoading.set(true);

    this.userService.getUser().subscribe({
      next: (user) => {
        this.user = user;

        // Fetch rank and rating change in parallel
        forkJoin({
          rank: this.leaderboardService.getUserRank(user.id),
          ratingHistory: this.ratingService.getRatingHistory(user.id)
        }).subscribe({
          next: ({ rank, ratingHistory }) => {
            // Set rank
            this.rank.set(`#${rank.rank} / ${rank.total}`);

            // Calculate rating change from last two entries
            if (ratingHistory && ratingHistory.length >= 2) {
              const latestChange = ratingHistory[0].change;
              this.ratingChange.set(latestChange);
            } else if (ratingHistory && ratingHistory.length === 1) {
              this.ratingChange.set(ratingHistory[0].change);
            }

            this.isLoading.set(false);
          },
          error: (error) => {
            console.error('Error loading rating box data:', error);
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
}
