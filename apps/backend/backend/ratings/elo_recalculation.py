"""
ELO Rating Recalculation Service

Replays all completed matches for a season in chronological order to rebuild
LeagueStanding ratings and RatingHistory records from scratch.
"""

import logging
from django.db import transaction

from .elo import ELORatingCalculator
from .models import Season, LeagueStanding, RatingHistory

logger = logging.getLogger(__name__)

STARTING_RATING = 1000


class ELORatingRecalculationService:
    """
    Full replay recalculation of ELO ratings for a season.
    Deletes existing RatingHistory for the season's matches, resets all
    LeagueStanding ratings to STARTING_RATING, then replays each match
    in completed_at ASC order using ELORatingCalculator.
    """

    def recalculate_all_for_season(self, season_id: int) -> dict:
        """
        Full replay of all completed matches for a season.

        Returns:
            {"matches_processed": N, "players_affected": M}
        """
        with transaction.atomic():
            try:
                season = Season.objects.get(id=season_id)
            except Season.DoesNotExist:
                logger.warning("ELORecalc: season %s not found", season_id)
                return {"matches_processed": 0, "players_affected": 0}

            from matches.models import Match

            # 1. Get all completed matches for this season in chronological order
            matches = list(
                Match.objects.filter(
                    season=season,
                    status='COMPLETED',
                    winner__isnull=False,
                ).select_related('player1', 'player2', 'winner')
                .order_by('completed_at', 'id')
            )

            # 2. Reset all LeagueStandings for this season
            LeagueStanding.objects.filter(season=season).update(
                rating=STARTING_RATING,
                wins=0,
                losses=0,
                matches_played=0,
                rating_change=0,
                rank=0,
            )

            # 3. Delete existing RatingHistory records for these matches
            match_ids = [m.id for m in matches]
            RatingHistory.objects.filter(match_id__in=match_ids, season=season).delete()

            # 4. Replay each match
            # Track running ratings per user for this replay
            # (LeagueStanding.rating IS the running state we read from)
            calc = ELORatingCalculator()
            affected_users: set = set()

            for match in matches:
                winner = match.winner
                loser = match.player2 if winner == match.player1 else match.player1

                # Get current ratings from standings (or STARTING_RATING if new player)
                winner_standing = self._get_or_create_standing(winner, season)
                loser_standing = self._get_or_create_standing(loser, season)

                winner_old = winner_standing.rating
                loser_old = loser_standing.rating

                # Calculate new ratings
                winner_new, winner_change, loser_new, loser_change = \
                    calc.calculate_match_ratings(winner_old, loser_old, True)

                winner_old_league = calc.determine_league(winner_old)
                winner_new_league = calc.determine_league(winner_new)
                loser_old_league = calc.determine_league(loser_old)
                loser_new_league = calc.determine_league(loser_new)

                # Update winner standing
                winner_standing.rating = winner_new
                winner_standing.league = winner_new_league
                winner_standing.wins += 1
                winner_standing.matches_played += 1
                winner_standing.rating_change = winner_change
                winner_standing.save(update_fields=[
                    'rating', 'league', 'wins', 'matches_played', 'rating_change', 'updated_at'
                ])

                # Update loser standing
                loser_standing.rating = loser_new
                loser_standing.league = loser_new_league
                loser_standing.losses += 1
                loser_standing.matches_played += 1
                loser_standing.rating_change = loser_change
                loser_standing.save(update_fields=[
                    'rating', 'league', 'losses', 'matches_played', 'rating_change', 'updated_at'
                ])

                # Recreate RatingHistory records
                RatingHistory.objects.create(
                    user=winner,
                    match=match,
                    season=season,
                    old_rating=winner_old,
                    new_rating=winner_new,
                    rating_change=winner_change,
                    was_winner=True,
                    opponent=loser,
                    opponent_rating=loser_old,
                    old_league=winner_old_league,
                    new_league=winner_new_league,
                    league_changed=(winner_old_league != winner_new_league),
                )
                RatingHistory.objects.create(
                    user=loser,
                    match=match,
                    season=season,
                    old_rating=loser_old,
                    new_rating=loser_new,
                    rating_change=loser_change,
                    was_winner=False,
                    opponent=winner,
                    opponent_rating=winner_old,
                    old_league=loser_old_league,
                    new_league=loser_new_league,
                    league_changed=(loser_old_league != loser_new_league),
                )

                affected_users.add(winner.id)
                affected_users.add(loser.id)

            # 5. Recalculate rank for all players ordered by rating DESC
            standings = list(
                LeagueStanding.objects.filter(season=season).order_by('-rating', '-wins')
            )
            for i, standing in enumerate(standings, start=1):
                standing.rank = i
                standing.save(update_fields=['rank'])

            return {
                "matches_processed": len(matches),
                "players_affected": len(affected_users),
            }

    def _get_or_create_standing(self, user, season) -> LeagueStanding:
        profile = getattr(user, 'player_profile', None)
        league = profile.league if profile else 'AMATEUR'
        standing, _ = LeagueStanding.objects.get_or_create(
            user=user,
            season=season,
            defaults={
                'league': league,
                'rating': STARTING_RATING,
                'rank': 0,
            }
        )
        return standing
