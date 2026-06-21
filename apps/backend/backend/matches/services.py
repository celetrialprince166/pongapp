"""
Match Services Module

Handles match completion, rating updates, and statistics tracking
"""

from django.db import transaction
from django.utils import timezone
from users.models import User, Achievement
from ratings.models import RatingHistory, Season, LeagueStanding
from ratings.elo import ELORatingCalculator
from .models import Match


class MatchResultService:
    """
    Service for processing match results and updating player ratings
    """

    def __init__(self):
        self.elo_calc = ELORatingCalculator()

    @transaction.atomic
    def complete_match(self, match: Match, winner: User) -> dict:
        """
        Complete a match and update all related data

        Args:
            match: Match instance to complete
            winner: User who won the match

        Returns:
            Dictionary with rating changes and other details

        Raises:
            ValueError: If match is not in valid state or winner is invalid
        """
        # Validate match state
        if match.status == 'COMPLETED':
            raise ValueError("Match is already completed")

        if match.status != 'IN_PROGRESS':
            raise ValueError(f"Match must be in progress to complete (current: {match.status})")

        # Validate winner
        if winner not in [match.player1, match.player2]:
            raise ValueError("Winner must be one of the match players")

        # Enforce format-based game threshold — prevent premature completion
        if match.match_format and match.match_format.startswith('BEST_OF'):
            required_wins = {'BEST_OF_3': 2, 'BEST_OF_5': 3, 'BEST_OF_7': 4}
            required = required_wins.get(match.match_format, 2)
            max_games_won = max(match.player1_games_won, match.player2_games_won)
            if max_games_won < required:
                raise ValueError(
                    f"{match.match_format} requires {required} game wins to complete. "
                    f"Current leader has {max_games_won}."
                )

        # Reconcile unresolved game records before marking the match complete
        unresolved_games = match.games.filter(is_completed=False)
        partially_scored = unresolved_games.filter(
            player1_score__gt=0
        ) | unresolved_games.filter(player2_score__gt=0)
        if partially_scored.exists():
            raise ValueError(
                "Cannot complete match: one or more games have partial scores but are not marked complete. "
                "Resolve all in-progress games before completing the match."
            )
        # Delete trailing games that were never played (both scores = 0)
        unresolved_games.filter(player1_score=0, player2_score=0).delete()

        # Get loser
        loser = match.player2 if winner == match.player1 else match.player1

        # Only update ratings for rated matches
        rating_info = None
        if match.is_rated:
            rating_info = self._update_ratings(match, winner, loser)

        # Update match record
        match.winner = winner
        match.completed_at = timezone.now()
        match.status = 'COMPLETED'
        match.save()

        # Update player statistics
        self._update_player_stats(winner, loser, match)

        # Check for achievements
        achievements = self._check_achievements(match, winner, loser, rating_info)

        return {
            'match_id': match.id,
            'winner': winner.username,
            'loser': loser.username,
            'rating_changes': rating_info,
            'achievements': achievements,
            'match_duration': match.duration_minutes,
        }

    def _update_ratings(self, match: Match, winner: User, loser: User) -> dict:
        """
        Update ELO ratings for both players

        Args:
            match: Match instance
            winner: Winner user
            loser: Loser user

        Returns:
            Dictionary with rating change information
        """
        # Get current ratings
        winner_profile = winner.player_profile
        loser_profile = loser.player_profile

        winner_old_rating = winner_profile.current_rating
        loser_old_rating = loser_profile.current_rating

        # Calculate new ratings
        winner_new, winner_change, loser_new, loser_change = \
            self.elo_calc.calculate_match_ratings(
                winner_old_rating,
                loser_old_rating,
                True  # Winner won
            )

        # Get leagues
        winner_old_league = winner_profile.league
        loser_old_league = loser_profile.league

        # Update winner
        winner_profile.current_rating = winner_new
        winner_profile.highest_rating = max(winner_profile.highest_rating, winner_new)
        winner_profile.update_league()
        winner_new_league = winner_profile.league

        # Update loser
        loser_profile.current_rating = loser_new
        loser_profile.update_league()
        loser_new_league = loser_profile.league

        # Save profiles
        winner_profile.save()
        loser_profile.save()

        # Use match.season if set, otherwise fall back to the active season
        season = match.season if match.season else self._get_current_season()

        # Create rating history records
        RatingHistory.objects.create(
            user=winner,
            match=match,
            season=season,
            old_rating=winner_old_rating,
            new_rating=winner_new,
            rating_change=winner_change,
            was_winner=True,
            opponent=loser,
            opponent_rating=loser_old_rating,
            old_league=winner_old_league,
            new_league=winner_new_league,
            league_changed=(winner_old_league != winner_new_league)
        )

        RatingHistory.objects.create(
            user=loser,
            match=match,
            season=season,
            old_rating=loser_old_rating,
            new_rating=loser_new,
            rating_change=loser_change,
            was_winner=False,
            opponent=winner,
            opponent_rating=winner_old_rating,
            old_league=loser_old_league,
            new_league=loser_new_league,
            league_changed=(loser_old_league != loser_new_league)
        )

        # Update LeagueStanding for this season (if match is linked to a season)
        if match.season:
            self._update_league_standings(
                season=match.season,
                winner=winner, winner_old_rating=winner_old_rating,
                winner_new_rating=winner_new, winner_change=winner_change,
                winner_league=winner_new_league,
                loser=loser, loser_old_rating=loser_old_rating,
                loser_new_rating=loser_new, loser_change=loser_change,
                loser_league=loser_new_league,
            )

        return {
            'winner': {
                'old_rating': winner_old_rating,
                'new_rating': winner_new,
                'change': winner_change,
                'old_league': winner_old_league,
                'new_league': winner_new_league,
                'league_changed': winner_old_league != winner_new_league,
            },
            'loser': {
                'old_rating': loser_old_rating,
                'new_rating': loser_new,
                'change': loser_change,
                'old_league': loser_old_league,
                'new_league': loser_new_league,
                'league_changed': loser_old_league != loser_new_league,
            },
            'upset': winner_old_rating < loser_old_rating,
        }

    def _update_league_standings(
        self, season: Season,
        winner: User, winner_old_rating: int, winner_new_rating: int, winner_change: int, winner_league: str,
        loser: User, loser_old_rating: int, loser_new_rating: int, loser_change: int, loser_league: str,
    ) -> None:
        """
        Update or create LeagueStanding records for both players after a rated match.
        Called inside the existing transaction.atomic() from complete_match().
        """
        STARTING_RATING = 1000

        winner_standing, _ = LeagueStanding.objects.get_or_create(
            user=winner,
            season=season,
            defaults={'league': winner_league, 'rating': STARTING_RATING, 'rank': 0}
        )
        winner_standing.rating = winner_new_rating
        winner_standing.league = winner_league
        winner_standing.wins += 1
        winner_standing.matches_played += 1
        winner_standing.rating_change = winner_change
        winner_standing.save(update_fields=['rating', 'league', 'wins', 'matches_played', 'rating_change', 'updated_at'])

        loser_standing, _ = LeagueStanding.objects.get_or_create(
            user=loser,
            season=season,
            defaults={'league': loser_league, 'rating': STARTING_RATING, 'rank': 0}
        )
        loser_standing.rating = loser_new_rating
        loser_standing.league = loser_league
        loser_standing.losses += 1
        loser_standing.matches_played += 1
        loser_standing.rating_change = loser_change
        loser_standing.save(update_fields=['rating', 'league', 'losses', 'matches_played', 'rating_change', 'updated_at'])

    def _update_player_stats(self, winner: User, loser: User, match: Match):
        """
        Update player statistics

        Args:
            winner: Winner user
            loser: Loser user
            match: Match instance
        """
        # Update winner stats
        winner_profile = winner.player_profile
        winner_profile.total_matches += 1
        winner_profile.wins += 1
        winner_profile.win_streak += 1
        winner_profile.longest_win_streak = max(winner_profile.longest_win_streak, winner_profile.win_streak)
        winner_profile.last_match_date = timezone.now()
        winner_profile.save()

        # Update loser stats
        loser_profile = loser.player_profile
        loser_profile.total_matches += 1
        loser_profile.losses += 1
        loser_profile.win_streak = 0  # Reset win streak
        loser_profile.last_match_date = timezone.now()
        loser_profile.save()

    def _get_current_season(self) -> Season:
        """
        Get or create current season

        Returns:
            Current active season
        """
        now = timezone.now()
        season = Season.objects.filter(
            start_date__lte=now,
            end_date__gte=now,
            is_active=True
        ).first()

        if not season:
            # Create a new season if none exists
            from datetime import timedelta
            season = Season.objects.create(
                name=f"Season {Season.objects.count() + 1}",
                start_date=now,
                duration_days=14,  # 2 weeks
                is_active=True
            )

        return season

    def _check_achievements(
        self,
        match: Match,
        winner: User,
        loser: User,
        rating_info: dict
    ) -> list:
        """
        Check and award achievements

        Args:
            match: Match instance
            winner: Winner user
            loser: Loser user
            rating_info: Rating change information

        Returns:
            List of awarded achievements
        """
        achievements = []

        if not match.is_rated:
            return achievements  # No achievements for unrated matches

        # Giant Slayer - Beat someone 200+ rating points higher
        if rating_info and rating_info['upset']:
            rating_diff = loser.player_profile.current_rating - winner.player_profile.current_rating
            if rating_diff >= 200:
                achievement = Achievement.objects.create(
                    user=winner,
                    achievement_type='GIANT_SLAYER',
                    match=match,
                    description=f"Defeated {loser.username} who was {rating_diff} points higher!"
                )
                achievements.append(achievement)

        # Perfect Game - Win with maximum games in match format
        if match.match_format == 'BEST_OF_3' and winner == match.player1:
            if match.player1_games_won == 2 and match.player2_games_won == 0:
                achievement = Achievement.objects.create(
                    user=winner,
                    achievement_type='PERFECT_GAME',
                    match=match,
                    description=f"Perfect 2-0 victory against {loser.username}!"
                )
                achievements.append(achievement)

        # Marathon - Match lasted more than 60 minutes
        if match.is_marathon:
            for player in [winner, loser]:
                achievement = Achievement.objects.create(
                    user=player,
                    achievement_type='MARATHON',
                    match=match,
                    description=f"Played a marathon match lasting {match.duration_minutes:.1f} minutes!"
                )
                achievements.append(achievement)

        # Undefeated Champion - Win streak of 10+
        if winner.player_profile.win_streak >= 10:
            # Check if this is a new streak milestone
            if not Achievement.objects.filter(
                user=winner,
                achievement_type='UNDEFEATED',
                earned_date__gte=timezone.now() - timezone.timedelta(days=7)
            ).exists():
                achievement = Achievement.objects.create(
                    user=winner,
                    achievement_type='UNDEFEATED',
                    match=match,
                    description=f"Undefeated! {winner.player_profile.win_streak} wins in a row!"
                )
                achievements.append(achievement)

        # Dominant Performance - Won with rating gain of 30+
        if rating_info and rating_info['winner']['change'] >= 30:
            achievement = Achievement.objects.create(
                user=winner,
                achievement_type='DOMINANT',
                match=match,
                description=f"Dominant performance! Gained {rating_info['winner']['change']} rating points!"
            )
            achievements.append(achievement)

        return achievements

    def cancel_match(self, match: Match, reason: str = None):
        """
        Cancel a match

        Args:
            match: Match to cancel
            reason: Optional cancellation reason
        """
        if match.status == 'COMPLETED':
            raise ValueError("Cannot cancel a completed match")

        match.status = 'CANCELLED'
        match.save()

    def start_match(self, match: Match):
        """
        Start a match

        Args:
            match: Match to start
        """
        if match.status != 'SCHEDULED':
            raise ValueError(f"Can only start scheduled matches (current: {match.status})")

        match.start_match()


# Convenience functions
def complete_match(match_id: int, winner_id: int) -> dict:
    """
    Convenience function to complete a match

    Args:
        match_id: Match ID
        winner_id: Winner user ID

    Returns:
        Result dictionary
    """
    match = Match.objects.get(id=match_id)
    winner = User.objects.get(id=winner_id)

    service = MatchResultService()
    return service.complete_match(match, winner)


def start_match(match_id: int):
    """
    Convenience function to start a match

    Args:
        match_id: Match ID
    """
    match = Match.objects.get(id=match_id)
    service = MatchResultService()
    service.start_match(match)
