import { Component } from '@angular/core';
import { ActionButtons } from '../components/action-buttons/action-buttons';
import { RouterLink } from '@angular/router';
import { OvertimeRatings } from '../components/overtime-ratings/overtime-ratings';
import { RatingBox } from '../components/rating-box/rating-box';
import { RecentMatches } from '../components/recent-matches/recent-matches';
import { SeasonProgress } from '../components/season-progress/season-progress';
import { UpcomingTournaments } from '../components/upcoming-tournaments/upcoming-tournaments';
import { WelcomeBox } from '../components/welcome-box/welcome-box';
import { ActiveChallenges } from '../components/active-challenges/active-challenges';
import { LucideAngularModule, Sword, Swords, CalendarPlus } from "lucide-angular";

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [ActionButtons, OvertimeRatings, RatingBox, RecentMatches, SeasonProgress, UpcomingTournaments, WelcomeBox, ActiveChallenges, LucideAngularModule, RouterLink],
  templateUrl: './dashboard-page.html',
  styleUrls: ['./dashboard-page.css'],
})
export class DashboardPage {
  readonly challengeIcon = Swords
  readonly calendarIcon = CalendarPlus

}
