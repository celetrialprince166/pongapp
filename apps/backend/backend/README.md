# Table Tennis App - Backend

Django REST API backend for the Table Tennis Web Application.

## Project Overview

This backend provides a comprehensive API for managing table tennis competitions, including:
- User authentication and profiles
- ELO-based rating system
- Two-tier league system (Amateur & PRO)
- Season-based competition
- Challenge/Duel system
- Tournament management (Multiple formats)
- Match scoring and history
- Achievements and badges

## Tech Stack

- **Framework**: Django 5.0.1
- **API**: Django REST Framework 3.14.0
- **Authentication**: JWT (Simple JWT)
- **Database**: SQLite (MVP), PostgreSQL (Production)
- **Real-time**: Django Channels + Redis
- **Image Processing**: Pillow 12.0.0

## Project Structure

```
backend/
├── table_tennis_app/     # Main project settings
├── users/                # User management & authentication
├── ratings/              # ELO ratings, seasons, leaderboards
├── matches/              # Match management & scoring
├── tournaments/          # Tournament system
├── challenges/           # Challenge/Duel system
├── manage.py
├── requirements.txt
└── db.sqlite3           # SQLite database
```

## Database Models

### Users App
- **User**: Custom user model with rating, league, stats
- **Achievement**: Badge system for player accomplishments

### Ratings App
- **Season**: Rating periods (default 2 weeks)
- **RatingHistory**: Track all ELO changes
- **LeagueStanding**: Per-season league standings

### Matches App
- **Match**: Match records (rated/unrated)
- **Game**: Individual games within matches
- **MatchEvent**: Point-by-point tracking

### Tournaments App
- **Tournament**: Tournament management
- **TournamentParticipant**: Player registrations
- **TournamentRound**: Tournament rounds
- **TournamentBracket**: Bracket structure
- **TournamentGroup**: Group stage management
- **TournamentGroupStanding**: Group standings

### Challenges App
- **Challenge**: Player-to-player challenges
- **ChallengeHistory**: Challenge statistics

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
source venv/Scripts/activate  # On Windows Git Bash
pip install -r requirements.txt
```

### 2. Set Admin Password

The superuser account has been created with:
- Username: `admin`
- Email: `admin@tabletennis.com`

Set the password by running:

```bash
python manage.py shell
```

Then in the Python shell:

```python
from users.models import User
admin = User.objects.get(username='admin')
admin.set_password('your_secure_password')
admin.save()
exit()
```

### 3. Run Development Server

```bash
python manage.py runserver
```

The server will start at `http://localhost:8000`

### 4. Access Admin Interface

Navigate to `http://localhost:8000/admin` and login with:
- Username: `admin`
- Password: (the one you set above)

## API Endpoints (Coming Soon)

The following API endpoints will be implemented:

### Authentication
- `POST /api/auth/signup/` - User registration
- `POST /api/auth/login/` - User login (JWT)
- `POST /api/auth/refresh/` - Refresh JWT token
- `GET /api/auth/me/` - Get current user profile

### Users
- `GET /api/users/` - List users
- `GET /api/users/{id}/` - User detail
- `PUT /api/users/{id}/` - Update user profile
- `GET /api/users/{id}/achievements/` - User achievements

### Leaderboard
- `GET /api/leaderboard/` - Global leaderboard
- `GET /api/leaderboard/amateur/` - Amateur league
- `GET /api/leaderboard/pro/` - PRO league

### Matches
- `GET /api/matches/` - List matches
- `POST /api/matches/` - Create match
- `GET /api/matches/{id}/` - Match detail
- `POST /api/matches/{id}/score/` - Update match score

### Challenges
- `GET /api/challenges/` - List challenges
- `POST /api/challenges/` - Create challenge
- `POST /api/challenges/{id}/accept/` - Accept challenge
- `POST /api/challenges/{id}/decline/` - Decline challenge

### Tournaments
- `GET /api/tournaments/` - List tournaments
- `POST /api/tournaments/` - Create tournament
- `GET /api/tournaments/{id}/` - Tournament detail
- `POST /api/tournaments/{id}/register/` - Register for tournament

## Key Features

### ELO Rating System
- Starting rating: 1000
- K-factor: 32 (Amateur), 16 (PRO)
- League promotion at 1500 rating

### Two-Tier Leagues
- **Amateur League**: Rating < 1500
- **PRO League**: Rating ≥ 1500

### Season System
- Default duration: 2 weeks
- Configurable settings per season
- Season-based statistics and standings

### Challenge System
- Max 4 outgoing challenges per season
- 24-hour expiry time
- Forced acceptance for top 7 players

### Match Types
- **Rated**: Admin-refereed, affects rankings
- **Unrated**: Player-managed, practice matches

### Tournament Formats
- Single Elimination
- Double Elimination
- Round Robin
- Swiss System
- Group Stage + Knockout

### Achievement Badges
- Undefeated Champion
- Giant Slayer
- Comeback King
- Perfect Game
- Marathon Player
- Dominant Performance
- Underdog Victory
- The Bully

## Development Notes

### Adding New Features

1. Create models in appropriate app
2. Run `python manage.py makemigrations`
3. Run `python manage.py migrate`
4. Register models in `admin.py`
5. Create serializers in `serializers.py`
6. Create views in `views.py`
7. Add URL patterns in `urls.py`

### Running Tests

```bash
pytest
```

### Environment Variables

Create a `.env` file in the backend directory:

```env
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=sqlite:///db.sqlite3
```

## Next Steps

1. Implement authentication API endpoints
2. Create user registration/login views
3. Build ELO rating calculation module
4. Implement leaderboard API
5. Create match scoring API
6. Build challenge system API
7. Implement tournament management API

## Support

For issues or questions, please refer to the project documentation in the `docs/` directory.
