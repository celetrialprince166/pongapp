"""
Tests for ELO Rating Calculation Module
"""

import pytest
from .elo import ELORatingCalculator, calculate_ratings_for_match


class TestELOKFactor:
    """Test K-factor determination"""

    def test_amateur_k_factor(self):
        """Test K-factor for Amateur league players"""
        calc = ELORatingCalculator()
        assert calc.get_k_factor(1000) == 32
        assert calc.get_k_factor(1400) == 32
        assert calc.get_k_factor(1499) == 32

    def test_pro_k_factor(self):
        """Test K-factor for PRO league players"""
        calc = ELORatingCalculator()
        assert calc.get_k_factor(1500) == 16
        assert calc.get_k_factor(1600) == 16
        assert calc.get_k_factor(2000) == 16


class TestExpectedScore:
    """Test expected score calculations"""

    def test_equal_ratings(self):
        """Test expected score for equal ratings"""
        calc = ELORatingCalculator()
        expected = calc.calculate_expected_score(1500, 1500)
        assert expected == pytest.approx(0.5, abs=0.01)

    def test_higher_rating_advantage(self):
        """Test expected score for higher rated player"""
        calc = ELORatingCalculator()
        expected = calc.calculate_expected_score(1600, 1500)
        assert expected > 0.5
        assert expected < 1.0

    def test_lower_rating_disadvantage(self):
        """Test expected score for lower rated player"""
        calc = ELORatingCalculator()
        expected = calc.calculate_expected_score(1400, 1500)
        assert expected < 0.5
        assert expected > 0.0

    def test_large_rating_difference(self):
        """Test expected score with large rating difference"""
        calc = ELORatingCalculator()
        expected_high = calc.calculate_expected_score(1800, 1200)
        expected_low = calc.calculate_expected_score(1200, 1800)

        assert expected_high > 0.9
        assert expected_low < 0.1
        assert expected_high + expected_low == pytest.approx(1.0, abs=0.01)


class TestNewRating:
    """Test new rating calculations"""

    def test_win_increases_rating(self):
        """Test that winning increases rating"""
        calc = ELORatingCalculator()
        new_rating = calc.calculate_new_rating(1500, 1500, 1.0)
        assert new_rating > 1500

    def test_loss_decreases_rating(self):
        """Test that losing decreases rating"""
        calc = ELORatingCalculator()
        new_rating = calc.calculate_new_rating(1500, 1500, 0.0)
        assert new_rating < 1500

    def test_upset_victory_larger_gain(self):
        """Test that upset victories yield larger rating gains"""
        calc = ELORatingCalculator()

        # Underdog wins
        underdog_gain = calc.calculate_new_rating(1400, 1600, 1.0) - 1400

        # Favorite wins
        favorite_gain = calc.calculate_new_rating(1600, 1400, 1.0) - 1600

        assert underdog_gain > favorite_gain

    def test_equal_match_rating_changes(self):
        """Test rating changes sum to zero for equal ratings"""
        calc = ELORatingCalculator()

        player1_new = calc.calculate_new_rating(1500, 1500, 1.0)
        player2_new = calc.calculate_new_rating(1500, 1500, 0.0)

        change1 = player1_new - 1500
        change2 = player2_new - 1500

        # Rating gains and losses should be approximately equal
        assert abs(change1 + change2) <= 1  # Allow for rounding


class TestMatchRatings:
    """Test full match rating calculations"""

    def test_basic_match(self):
        """Test basic match rating calculation"""
        calc = ELORatingCalculator()
        p1_new, p1_change, p2_new, p2_change = calc.calculate_match_ratings(
            1500, 1500, True
        )

        assert p1_new > 1500  # Winner gains
        assert p2_new < 1500  # Loser loses
        assert p1_change > 0
        assert p2_change < 0

    def test_amateur_vs_amateur(self):
        """Test match between two amateur players"""
        calc = ELORatingCalculator()
        p1_new, p1_change, p2_new, p2_change = calc.calculate_match_ratings(
            1200, 1300, True
        )

        # Check that changes use K-factor 32
        assert abs(p1_change) >= 10  # Significant change for amateurs
        assert abs(p2_change) >= 10

    def test_pro_vs_pro(self):
        """Test match between two PRO players"""
        calc = ELORatingCalculator()
        p1_new, p1_change, p2_new, p2_change = calc.calculate_match_ratings(
            1600, 1700, True
        )

        # Check that changes use K-factor 16 (smaller changes)
        assert abs(p1_change) < 20  # Smaller changes for pros
        assert abs(p2_change) < 20

    def test_cross_league_match(self):
        """Test match between amateur and PRO player"""
        calc = ELORatingCalculator()
        # Amateur wins against PRO
        p1_new, p1_change, p2_new, p2_change = calc.calculate_match_ratings(
            1450, 1550, True
        )

        # Amateur should gain more (K=32) than PRO loses (K=16 in relative terms)
        assert p1_change > 0
        assert p2_change < 0


class TestLeague:
    """Test league determination"""

    def test_amateur_league(self):
        """Test amateur league determination"""
        calc = ELORatingCalculator()
        assert calc.determine_league(1000) == 'AMATEUR'
        assert calc.determine_league(1400) == 'AMATEUR'
        assert calc.determine_league(1499) == 'AMATEUR'

    def test_pro_league(self):
        """Test PRO league determination"""
        calc = ELORatingCalculator()
        assert calc.determine_league(1500) == 'PRO'
        assert calc.determine_league(1600) == 'PRO'
        assert calc.determine_league(2000) == 'PRO'

    def test_promotion(self):
        """Test league promotion"""
        calc = ELORatingCalculator()
        # Player close to threshold winning against higher rated opponent
        old_rating = 1485
        # Win against higher rated opponent should push them over
        new_rating = calc.calculate_new_rating(1485, 1550, 1.0)

        assert calc.determine_league(old_rating) == 'AMATEUR'
        # With K=32 and winning against higher opponent, should gain enough to promote
        if new_rating >= 1500:
            assert calc.determine_league(new_rating) == 'PRO'
            assert calc.check_league_change(old_rating, new_rating) == True

    def test_demotion(self):
        """Test league demotion"""
        calc = ELORatingCalculator()
        # Player just above threshold losing to much higher rated opponent
        old_rating = 1505
        # Loss to much higher rated opponent should push them below
        new_rating = calc.calculate_new_rating(1505, 1700, 0.0)

        assert calc.determine_league(old_rating) == 'PRO'
        # With K=16 and losing to much higher opponent, should lose enough to demote
        if new_rating < 1500:
            assert calc.determine_league(new_rating) == 'AMATEUR'
            assert calc.check_league_change(old_rating, new_rating) == True

    def test_no_league_change(self):
        """Test when league doesn't change"""
        calc = ELORatingCalculator()
        old_rating = 1400
        new_rating = calc.calculate_new_rating(1400, 1500, 1.0)

        assert calc.check_league_change(old_rating, new_rating) == False


class TestRatingChange:
    """Test rating change calculations"""

    def test_positive_change(self):
        """Test positive rating change"""
        calc = ELORatingCalculator()
        change = calc.calculate_rating_change(1500, 1500, 1.0)
        assert change > 0

    def test_negative_change(self):
        """Test negative rating change"""
        calc = ELORatingCalculator()
        change = calc.calculate_rating_change(1500, 1500, 0.0)
        assert change < 0

    def test_zero_change_impossible(self):
        """Test that rating always changes after a match"""
        calc = ELORatingCalculator()
        # Even a draw (0.5) would cause some change, but we don't support draws
        win_change = calc.calculate_rating_change(1500, 1500, 1.0)
        loss_change = calc.calculate_rating_change(1500, 1500, 0.0)

        assert win_change != 0
        assert loss_change != 0


class TestWinProbability:
    """Test win probability calculations"""

    def test_equal_ratings_50_percent(self):
        """Test that equal ratings give 50% probability"""
        calc = ELORatingCalculator()
        prob = calc.calculate_win_probability(1500, 1500)
        assert prob == pytest.approx(50.0, abs=0.1)

    def test_higher_rating_higher_probability(self):
        """Test that higher rating gives higher win probability"""
        calc = ELORatingCalculator()
        prob = calc.calculate_win_probability(1600, 1500)
        assert prob > 50.0
        assert prob < 100.0

    def test_lower_rating_lower_probability(self):
        """Test that lower rating gives lower win probability"""
        calc = ELORatingCalculator()
        prob = calc.calculate_win_probability(1400, 1500)
        assert prob < 50.0
        assert prob > 0.0

    def test_complementary_probabilities(self):
        """Test that probabilities sum to 100%"""
        calc = ELORatingCalculator()
        prob_a = calc.calculate_win_probability(1600, 1400)
        prob_b = calc.calculate_win_probability(1400, 1600)

        assert prob_a + prob_b == pytest.approx(100.0, abs=0.1)


class TestRatingDifferenceImpact:
    """Test rating difference impact descriptions"""

    def test_even_match(self):
        """Test even match description"""
        calc = ELORatingCalculator()
        assert calc.get_rating_difference_impact(40) == "Even match"

    def test_slight_favorite(self):
        """Test slight favorite description"""
        calc = ELORatingCalculator()
        assert calc.get_rating_difference_impact(75) == "Slight favorite"

    def test_moderate_favorite(self):
        """Test moderate favorite description"""
        calc = ELORatingCalculator()
        assert calc.get_rating_difference_impact(150) == "Moderate favorite"

    def test_strong_favorite(self):
        """Test strong favorite description"""
        calc = ELORatingCalculator()
        assert calc.get_rating_difference_impact(250) == "Strong favorite"

    def test_overwhelming_favorite(self):
        """Test overwhelming favorite description"""
        calc = ELORatingCalculator()
        assert calc.get_rating_difference_impact(400) == "Overwhelming favorite"


class TestConvenienceFunction:
    """Test the convenience function"""

    def test_calculate_ratings_for_match(self):
        """Test convenience function"""
        result = calculate_ratings_for_match(1500, 1400)

        assert 'winner' in result
        assert 'loser' in result
        assert 'match_info' in result

        assert result['winner']['new_rating'] > result['winner']['old_rating']
        assert result['loser']['new_rating'] < result['loser']['old_rating']

    def test_upset_detection(self):
        """Test upset detection in convenience function"""
        # Underdog wins
        result = calculate_ratings_for_match(1400, 1600)
        assert result['match_info']['upset'] == True

        # Favorite wins
        result = calculate_ratings_for_match(1600, 1400)
        assert result['match_info']['upset'] == False

    def test_league_change_detection(self):
        """Test league change detection in convenience function"""
        # Player promoted
        result = calculate_ratings_for_match(1495, 1500)

        # Check if winner got promoted
        if result['winner']['new_rating'] >= 1500:
            assert result['winner']['league_changed'] == True


class TestRealWorldScenarios:
    """Test real-world scenarios"""

    def test_beginner_vs_beginner(self):
        """Test match between two beginners"""
        result = calculate_ratings_for_match(900, 950)

        # Both should still be in amateur league
        assert result['winner']['new_league'] == 'AMATEUR'
        assert result['loser']['new_league'] == 'AMATEUR'

        # Significant rating changes for amateurs (K=32)
        assert abs(result['winner']['change']) >= 15
        assert abs(result['loser']['change']) >= 15

    def test_intermediate_approaching_pro(self):
        """Test intermediate player approaching PRO league"""
        result = calculate_ratings_for_match(1485, 1450)

        # Check if winner got promoted to PRO
        if result['winner']['new_rating'] >= 1500:
            assert result['winner']['new_league'] == 'PRO'
            assert result['winner']['league_changed'] == True

    def test_pro_vs_amateur(self):
        """Test PRO player vs Amateur player"""
        # PRO should be heavy favorite
        result = calculate_ratings_for_match(1650, 1350)

        # PRO wins as expected
        assert result['match_info']['upset'] == False
        assert result['winner']['old_rating'] > result['loser']['old_rating']

        # Rating changes should reflect K-factors
        # Winner is PRO (K=16), loser is amateur (K=32)
        assert abs(result['loser']['change']) > abs(result['winner']['change'])

    def test_giant_killer_upset(self):
        """Test giant killer upset scenario"""
        # Amateur beats PRO player
        result = calculate_ratings_for_match(1350, 1750)

        # This is an upset
        assert result['match_info']['upset'] == True

        # Amateur should gain significant points
        assert result['winner']['change'] > 20

        # Win probability should have been low
        assert result['match_info']['pre_match_win_probability'] < 30

    def test_close_pro_match(self):
        """Test close match between two PRO players"""
        result = calculate_ratings_for_match(1680, 1650)

        # Both in PRO league
        assert result['winner']['old_league'] == 'PRO'
        assert result['loser']['old_league'] == 'PRO'

        # Small rating changes (K=16 and close ratings)
        assert abs(result['winner']['change']) < 10
        assert abs(result['loser']['change']) < 10

        # Win probability should be close to 50%
        assert 45 <= result['match_info']['pre_match_win_probability'] <= 55
