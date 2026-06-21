# ELO Rating System

Comprehensive Chess.com-style ELO rating system for Table Tennis matches.

## Overview

The ELO rating system calculates player ratings based on match results, with automatic league promotion/demotion and achievement tracking.

## Features

- **K-Factor System**: 32 for Amateur league, 16 for PRO league
- **League System**: Amateur (< 1500), PRO (≥ 1500)
- **Automatic Promotion/Demotion**: At 1500 rating threshold
- **Win Probability Calculations**: Pre-match predictions
- **Rating History Tracking**: Complete history of all rating changes
- **Achievement System**: Automatic achievement detection

## Usage

### Calculate Ratings for a Match

```python
from ratings.elo import calculate_ratings_for_match

# Winner rating: 1500, Loser rating: 1400
result = calculate_ratings_for_match(1500, 1400)

print(result['winner']['new_rating'])  # New rating for winner
print(result['loser']['change'])       # Rating change for loser
print(result['match_info']['upset'])   # Was this an upset?
```

### Process Match Results

```python
from matches.services import MatchResultService
from matches.models import Match
from users.models import User

# Get match and winner
match = Match.objects.get(id=1)
winner = User.objects.get(id=1)

# Complete the match
service = MatchResultService()
result = service.complete_match(match, winner)

print(result['rating_changes'])  # Rating changes for both players
print(result['achievements'])    # Any achievements earned
```

## ELO Calculation

### Formula

```
New Rating = Old Rating + K * (Actual Score - Expected Score)
```

Where:
- **K**: K-factor (32 for Amateur, 16 for PRO)
- **Actual Score**: 1.0 for win, 0.0 for loss
- **Expected Score**: `1 / (1 + 10^((OpponentRating - PlayerRating) / 400))`

### K-Factors

| League | Rating Range | K-Factor | Impact |
|--------|--------------|----------|--------|
| Amateur | < 1500 | 32 | Larger rating swings |
| PRO | ≥ 1500 | 16 | Smaller rating swings |

### Examples

#### Equal Match (Both 1500)
- **Winner**: 1500 → 1516 (+16)
- **Loser**: 1500 → 1484 (-16)

#### Upset Victory (1400 beats 1600)
- **Winner**: 1400 → 1428 (+28)  - Large gain
- **Loser**: 1600 → 1592 (-8)    - Small loss

#### Expected Victory (1600 beats 1400)
- **Winner**: 1600 → 1608 (+8)   - Small gain
- **Loser**: 1400 → 1372 (-28)   - Large loss

## League System

### Leagues

1. **Amateur League**: Rating < 1500
   - K-factor: 32
   - Faster rating changes
   - Entry point for new players

2. **PRO League**: Rating ≥ 1500
   - K-factor: 16
   - More stable ratings
   - Requires consistent performance

### Promotion/Demotion

- **Automatic**: Players are promoted/demoted immediately when crossing 1500
- **Tracked**: League changes are recorded in rating history
- **Visible**: League badges displayed on profiles

## Rating History

All rating changes are tracked in the `RatingHistory` model:

```python
from ratings.models import RatingHistory

# Get user's rating history
history = RatingHistory.objects.filter(user=user).order_by('-created_at')

for record in history:
    print(f"{record.old_rating} → {record.new_rating} ({record.rating_change:+d})")
    print(f"vs {record.opponent.username} (Rating: {record.opponent_rating})")
    if record.league_changed:
        print(f"League changed: {record.old_league} → {record.new_league}")
```

## Achievements

The system automatically detects and awards achievements:

### Achievement Types

1. **Giant Slayer**: Beat someone 200+ rating points higher
2. **Perfect Game**: Win without losing a single game
3. **Marathon Player**: Play match lasting 60+ minutes
4. **Undefeated Champion**: Win streak of 10+ matches
5. **Dominant Performance**: Gain 30+ rating points in one match
6. **Comeback King**: Win after being down significantly
7. **Underdog Victory**: Win as the underdog
8. **The Bully**: Win streak against lower-rated opponents

## Testing

Comprehensive test suite with 39 tests covering:

### Test Coverage

- K-factor determination
- Expected score calculations
- New rating calculations
- Match rating calculations
- League determination and changes
- Win probability calculations
- Rating difference impact
- Real-world scenarios

### Run Tests

```bash
cd backend
source venv/Scripts/activate  # On Windows: venv/Scripts/activate
pytest ratings/tests.py -v
```

### Test Results

```
============================= 39 passed in 0.16s ==============================
```

## API Integration

The ELO system integrates with the match API:

```python
# When a match is completed via API
POST /api/matches/<id>/complete/
{
    "winner_id": 1
}

# Response includes rating changes
{
    "match_id": 1,
    "winner": "player1",
    "loser": "player2",
    "rating_changes": {
        "winner": {
            "old_rating": 1500,
            "new_rating": 1516,
            "change": 16,
            "league_changed": false
        },
        "loser": {
            "old_rating": 1480,
            "new_rating": 1464,
            "change": -16,
            "league_changed": false
        }
    },
    "achievements": []
}
```

## Win Probability

Calculate win probability before a match:

```python
from ratings.elo import ELORatingCalculator

calc = ELORatingCalculator()

# Player A (1600) vs Player B (1500)
prob_a = calc.calculate_win_probability(1600, 1500)
print(f"Player A win probability: {prob_a}%")  # ~64%

prob_b = calc.calculate_win_probability(1500, 1600)
print(f"Player B win probability: {prob_b}%")  # ~36%
```

## Rating Difference Impact

Get descriptive impact of rating differences:

```python
calc = ELORatingCalculator()

diff = abs(1600 - 1500)
impact = calc.get_rating_difference_impact(diff)
print(impact)  # "Slight favorite"
```

### Impact Levels

| Difference | Description |
|------------|-------------|
| < 50 | Even match |
| 50-99 | Slight favorite |
| 100-199 | Moderate favorite |
| 200-299 | Strong favorite |
| 300+ | Overwhelming favorite |

## Database Models

### RatingHistory

Tracks all rating changes:

```python
class RatingHistory(models.Model):
    user = ForeignKey(User)
    match = ForeignKey(Match)
    season = ForeignKey(Season)
    old_rating = IntegerField()
    new_rating = IntegerField()
    rating_change = IntegerField()
    was_winner = BooleanField()
    opponent = ForeignKey(User)
    opponent_rating = IntegerField()
    old_league = CharField()
    new_league = CharField()
    league_changed = BooleanField()
    created_at = DateTimeField()
```

### Season

Tracks rating periods:

```python
class Season(models.Model):
    name = CharField()
    start_date = DateTimeField()
    end_date = DateTimeField()
    is_active = BooleanField()
    duration_days = IntegerField(default=14)
    max_challenges_per_player = IntegerField(default=4)
```

## Configuration

### Adjust K-Factors

```python
from ratings.elo import ELORatingCalculator

# Default values
ELORatingCalculator.K_FACTOR_AMATEUR = 32
ELORatingCalculator.K_FACTOR_PRO = 16
```

### Adjust League Threshold

```python
# Default: 1500
ELORatingCalculator.PRO_THRESHOLD = 1500
```

## Best Practices

1. **Always use rated matches for ranking**: Unrated matches don't affect ratings
2. **Set match as admin-refereed**: For accurate scoring and rating updates
3. **Complete matches promptly**: To maintain accurate leaderboards
4. **Review rating history**: To understand player progression
5. **Monitor league changes**: Celebrate promotions!

## Technical Details

### Transaction Safety

Match completion uses database transactions:

```python
@transaction.atomic
def complete_match(self, match, winner):
    # All rating updates, stats, and achievements
    # are committed together or rolled back
    pass
```

### Performance

- **Optimized queries**: Minimal database hits
- **Bulk operations**: Where possible
- **Indexed fields**: For fast lookups

### Error Handling

The system validates:
- Match state before completion
- Winner is valid participant
- No duplicate completions
- Season existence

## Future Enhancements

Potential improvements:

1. **Rating volatility**: Track rating stability
2. **Provisional ratings**: Special handling for new players
3. **Rating floors**: Prevent extreme rating drops
4. **Historical analysis**: Rating progression graphs
5. **Matchmaking**: Suggest balanced matches

## Support

For issues or questions:
- Check test suite for examples
- Review service code in `matches/services.py`
- Consult ELO calculator in `ratings/elo.py`
