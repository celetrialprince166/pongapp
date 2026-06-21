"""
ELO Rating Calculation Module

Implements Chess.com style ELO rating system:
- K-factor: 32 for Amateur league (< 1500), 16 for PRO league (>= 1500)
- Standard ELO formula
- Automatic league promotion/demotion at 1500 threshold
"""

import math
from typing import Tuple


class ELORatingCalculator:
    """
    ELO Rating Calculator for Table Tennis matches
    """

    # K-factors for different leagues
    K_FACTOR_AMATEUR = 32
    K_FACTOR_PRO = 16

    # League thresholds
    PRO_THRESHOLD = 1500
    AMATEUR_THRESHOLD = 1500

    @staticmethod
    def get_k_factor(rating: int) -> int:
        """
        Get K-factor based on player rating

        Args:
            rating: Player's current rating

        Returns:
            K-factor (32 for Amateur, 16 for PRO)
        """
        if rating >= ELORatingCalculator.PRO_THRESHOLD:
            return ELORatingCalculator.K_FACTOR_PRO
        return ELORatingCalculator.K_FACTOR_AMATEUR

    @staticmethod
    def calculate_expected_score(rating_a: int, rating_b: int) -> float:
        """
        Calculate expected score for player A against player B

        Uses standard ELO formula:
        E_A = 1 / (1 + 10^((R_B - R_A) / 400))

        Args:
            rating_a: Player A's current rating
            rating_b: Player B's current rating

        Returns:
            Expected score (probability of winning, 0-1)
        """
        exponent = (rating_b - rating_a) / 400
        expected = 1 / (1 + math.pow(10, exponent))
        return expected

    @staticmethod
    def calculate_new_rating(
        current_rating: int,
        opponent_rating: int,
        actual_score: float,
        k_factor: int = None
    ) -> int:
        """
        Calculate new rating after a match

        Uses ELO formula:
        R_new = R_old + K * (S - E)

        Where:
        - R_new: New rating
        - R_old: Old rating
        - K: K-factor
        - S: Actual score (1 for win, 0 for loss, 0.5 for draw)
        - E: Expected score

        Args:
            current_rating: Player's current rating
            opponent_rating: Opponent's current rating
            actual_score: Actual match result (1.0 for win, 0.0 for loss)
            k_factor: Optional K-factor override (calculated if not provided)

        Returns:
            New rating (integer)
        """
        if k_factor is None:
            k_factor = ELORatingCalculator.get_k_factor(current_rating)

        expected_score = ELORatingCalculator.calculate_expected_score(
            current_rating, opponent_rating
        )

        rating_change = k_factor * (actual_score - expected_score)
        new_rating = current_rating + rating_change

        # Round to nearest integer
        return round(new_rating)

    @staticmethod
    def calculate_rating_change(
        current_rating: int,
        opponent_rating: int,
        actual_score: float,
        k_factor: int = None
    ) -> int:
        """
        Calculate the rating change amount

        Args:
            current_rating: Player's current rating
            opponent_rating: Opponent's current rating
            actual_score: Actual match result (1.0 for win, 0.0 for loss)
            k_factor: Optional K-factor override

        Returns:
            Rating change (positive or negative integer)
        """
        new_rating = ELORatingCalculator.calculate_new_rating(
            current_rating, opponent_rating, actual_score, k_factor
        )
        return new_rating - current_rating

    @staticmethod
    def calculate_match_ratings(
        player1_rating: int,
        player2_rating: int,
        player1_won: bool
    ) -> Tuple[int, int, int, int]:
        """
        Calculate new ratings for both players after a match

        Args:
            player1_rating: Player 1's current rating
            player2_rating: Player 2's current rating
            player1_won: True if player 1 won, False if player 2 won

        Returns:
            Tuple of (player1_new_rating, player1_change, player2_new_rating, player2_change)
        """
        # Determine actual scores
        player1_score = 1.0 if player1_won else 0.0
        player2_score = 0.0 if player1_won else 1.0

        # Calculate new ratings
        player1_new = ELORatingCalculator.calculate_new_rating(
            player1_rating, player2_rating, player1_score
        )
        player2_new = ELORatingCalculator.calculate_new_rating(
            player2_rating, player1_rating, player2_score
        )

        # Calculate changes
        player1_change = player1_new - player1_rating
        player2_change = player2_new - player2_rating

        return player1_new, player1_change, player2_new, player2_change

    @staticmethod
    def determine_league(rating: int) -> str:
        """
        Determine league based on rating

        Args:
            rating: Player's rating

        Returns:
            'PRO' if rating >= 1500, 'AMATEUR' otherwise
        """
        if rating >= ELORatingCalculator.PRO_THRESHOLD:
            return 'PRO'
        return 'AMATEUR'

    @staticmethod
    def check_league_change(old_rating: int, new_rating: int) -> bool:
        """
        Check if rating change caused a league change

        Args:
            old_rating: Rating before match
            new_rating: Rating after match

        Returns:
            True if league changed, False otherwise
        """
        old_league = ELORatingCalculator.determine_league(old_rating)
        new_league = ELORatingCalculator.determine_league(new_rating)
        return old_league != new_league

    @staticmethod
    def get_rating_difference_impact(rating_diff: int) -> str:
        """
        Get descriptive impact of rating difference

        Args:
            rating_diff: Absolute difference between ratings

        Returns:
            Description of expected outcome
        """
        if rating_diff < 50:
            return "Even match"
        elif rating_diff < 100:
            return "Slight favorite"
        elif rating_diff < 200:
            return "Moderate favorite"
        elif rating_diff < 300:
            return "Strong favorite"
        else:
            return "Overwhelming favorite"

    @staticmethod
    def calculate_win_probability(rating_a: int, rating_b: int) -> float:
        """
        Calculate win probability for player A

        Args:
            rating_a: Player A's rating
            rating_b: Player B's rating

        Returns:
            Win probability as percentage (0-100)
        """
        expected_score = ELORatingCalculator.calculate_expected_score(rating_a, rating_b)
        return round(expected_score * 100, 2)


def calculate_ratings_for_match(
    winner_rating: int,
    loser_rating: int
) -> dict:
    """
    Convenience function to calculate ratings after a match

    Args:
        winner_rating: Winner's current rating
        loser_rating: Loser's current rating

    Returns:
        Dictionary with rating information
    """
    calc = ELORatingCalculator()

    # Calculate new ratings
    winner_new, winner_change, loser_new, loser_change = calc.calculate_match_ratings(
        winner_rating, loser_rating, True
    )

    # Check for league changes
    winner_league_change = calc.check_league_change(winner_rating, winner_new)
    loser_league_change = calc.check_league_change(loser_rating, loser_new)

    return {
        'winner': {
            'old_rating': winner_rating,
            'new_rating': winner_new,
            'change': winner_change,
            'old_league': calc.determine_league(winner_rating),
            'new_league': calc.determine_league(winner_new),
            'league_changed': winner_league_change,
        },
        'loser': {
            'old_rating': loser_rating,
            'new_rating': loser_new,
            'change': loser_change,
            'old_league': calc.determine_league(loser_rating),
            'new_league': calc.determine_league(loser_new),
            'league_changed': loser_league_change,
        },
        'match_info': {
            'rating_difference': abs(winner_rating - loser_rating),
            'upset': winner_rating < loser_rating,
            'winner_k_factor': calc.get_k_factor(winner_rating),
            'loser_k_factor': calc.get_k_factor(loser_rating),
            'pre_match_win_probability': calc.calculate_win_probability(winner_rating, loser_rating),
        }
    }
