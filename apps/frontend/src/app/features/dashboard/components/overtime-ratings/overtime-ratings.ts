import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService, User } from 'src/app/core/services/user.service';
import { RatingService } from 'src/app/core/services/rating.service';
import { RatingHistory } from 'src/app/core/models/rating.model';

@Component({
  selector: 'app-overtime-ratings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './overtime-ratings.html',
  styleUrls: ['./overtime-ratings.css'],
})
export class OvertimeRatings implements OnInit {
  ratingHistory = signal<RatingHistory[]>([]);
  isLoading = signal<boolean>(true);
  timePeriod = signal<'1W' | '1M' | 'ALL'>('1M');

  // Filtered rating history based on time period
  filteredRatingHistory = computed(() => {
    const history = this.ratingHistory();
    const period = this.timePeriod();

    if (period === 'ALL' || history.length === 0) {
      return history;
    }

    const now = new Date();
    const cutoffDate = new Date();

    if (period === '1W') {
      cutoffDate.setDate(now.getDate() - 7);
    } else if (period === '1M') {
      cutoffDate.setMonth(now.getMonth() - 1);
    }

    return history.filter(h => new Date(h.timestamp) >= cutoffDate);
  });

  // Chart dimensions
  readonly chartWidth = 600;
  readonly chartHeight = 200;
  readonly padding = 40;

  constructor(
    private userService: UserService,
    private ratingService: RatingService
  ) { }

  ngOnInit(): void {
    this.loadData();
  }

  setTimePeriod(period: '1W' | '1M' | 'ALL'): void {
    this.timePeriod.set(period);
  }

  private loadData(): void {
    this.isLoading.set(true);

    this.userService.getUser().subscribe({
      next: (user: User) => {
        this.ratingService.getRatingHistory(user.id).subscribe({
          next: (history) => {
            // Sort by timestamp (oldest first for chart)
            const sortedHistory = history.sort((a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
            this.ratingHistory.set(sortedHistory);
            this.isLoading.set(false);
          },
          error: (error) => {
            console.error('Error loading rating history:', error);
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

  get chartPoints(): string {
    const history = this.filteredRatingHistory();
    if (history.length === 0) return '';

    const ratings = history.map(h => h.rating);
    const minRating = Math.min(...ratings);
    const maxRating = Math.max(...ratings);
    const ratingRange = maxRating - minRating || 1; // Avoid division by zero

    const points = history.map((item, index) => {
      const x = this.padding + (index / (history.length - 1 || 1)) * (this.chartWidth - 2 * this.padding);
      const y = this.chartHeight - this.padding - ((item.rating - minRating) / ratingRange) * (this.chartHeight - 2 * this.padding);
      return `${x},${y}`;
    });

    return points.join(' ');
  }

  get minRating(): number {
    const history = this.filteredRatingHistory();
    if (history.length === 0) return 0;
    return Math.min(...history.map(h => h.rating));
  }

  get maxRating(): number {
    const history = this.filteredRatingHistory();
    if (history.length === 0) return 0;
    return Math.max(...history.map(h => h.rating));
  }

  get hasData(): boolean {
    return this.filteredRatingHistory().length > 0;
  }
}
