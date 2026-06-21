# PingMaster — Table Tennis League Management System

A full-featured table tennis tournament and league management platform
built with Django REST Framework, Django Channels, and PostgreSQL.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Authentication](#authentication)
- [WebSocket Events](#websocket-events)
- [ELO Rating System](#elo-rating-system)
- [Tournament Formats](#tournament-formats)
- [Deployment](#deployment)
- [Running Tests](#running-tests)
- [Project Structure](#project-structure)

---

## Overview

PingMaster manages the full lifecycle of table tennis tournaments and leagues:

- **Season management** — create and manage competitive seasons with ELO-based standings
- **Tournament management** — 5 formats (Single Elimination, Double Elimination, Round Robin, Swiss, Groups + KO)
- **Match scoring** — real-time scoring via WebSocket with ELO updates
- **Challenge system** — player-to-player challenges with forced challenge rules
- **Award distribution** — configurable tier-based point rewards per tournament
- **User management** — role-based access (Admin, Moderator, Player) with auto-credential emails

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Django 5.0.1 |
| API | Django REST Framework 3.15 |
| Real-time | Django Channels 4.0 + Redis |
| Database | PostgreSQL (Neon cloud) / SQLite (dev) |
| Auth | JWT via djangorestframework-simplejwt |
| Email | Gmail SMTP (port 465, SSL) |
| ASGI Server | Daphne 4.0 |
| Documentation | drf-spectacular (OpenAPI 3.0) |

---

## Architecture

```
+--------------------------------------------------+
|                 Angular Frontend                  |
|         (CloudFront + S3 / localhost:4200)        |
+------------------+-------------------------------+
                   | HTTP/WS
+------------------v-------------------------------+
|              Nginx Reverse Proxy                  |
|   /api/* -> Daphne  |  /ws/* -> Daphne           |
+------------------+-------------------------------+
                   |
+------------------v-------------------------------+
|           Daphne ASGI Server                      |
|  ProtocolTypeRouter: HTTP + WebSocket             |
+--------+-----------------------+-----------------+
         | HTTP                  | WebSocket
+--------v--------+   +----------v--------------+
|  Django + DRF   |   |   Django Channels        |
|  REST API       |   |   MatchConsumer          |
+--------+--------+   +----------+--------------+
         |                        |
+--------v--------+   +----------v--------------+
|   PostgreSQL    |   |        Redis             |
|   (Neon)        |   |   Channel Layer          |
+-----------------+   +-------------------------+
```

---

## Getting Started

### Prerequisites

- Python 3.13+
- PostgreSQL or SQLite (dev)
- Redis (required for WebSocket support)
- Git

### Local Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd backend

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env with your values (see Environment Variables section)

# 5. Run migrations
python manage.py migrate

# 6. Create admin user
python manage.py createsuperuser

# 7. Start development server
# With WebSocket support (recommended):
daphne -p 8080 table_tennis_app.asgi:application

# Without WebSocket (basic):
python manage.py runserver 8080
```

### Redis Setup (Windows)

```bash
# Download from: https://github.com/tporadowski/redis/releases
# Install .msi and start:
redis-server
redis-cli ping  # should return PONG
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```env
# Django
DJANGO_SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database (choose one)
USE_POSTGRES=False           # True = Neon/Postgres, False = SQLite
DB_NAME=neondb
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_HOST=your-neon-host.neon.tech
DB_PORT=5432
DB_SSLMODE=require

# Redis (for WebSockets)
REDIS_HOST=127.0.0.1

# Email (Gmail SMTP)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_USE_TLS=False
EMAIL_USE_SSL=True
EMAIL_HOST_USER=your-gmail@gmail.com
EMAIL_HOST_PASSWORD=your-16-char-app-password
DEFAULT_FROM_EMAIL=PingMaster <your-gmail@gmail.com>
SITE_URL=http://localhost:4200
```

> **Gmail App Password:** Generate at https://myaccount.google.com/apppasswords
> (requires 2-Step Verification to be enabled)

---

## API Reference

Full interactive documentation available at:

- **Swagger UI:** `http://localhost:8080/api/docs/`
- **ReDoc:** `http://localhost:8080/api/redoc/`
- **OpenAPI Schema:** `http://localhost:8080/api/schema/`

### Base URL

```
Development: http://localhost:8080/api
Production:  http://ttl-app-alb-436585712.eu-west-1.elb.amazonaws.com/api
```

### Authentication

All endpoints except login/signup require a JWT Bearer token:

```
Authorization: Bearer <access_token>
```

### Endpoint Groups

#### Auth (`/api/auth/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login/` | Login — returns access + refresh tokens |
| POST | `/auth/signup/` | Register new account |
| POST | `/auth/token/refresh/` | Refresh access token |
| POST | `/auth/logout/` | Blacklist refresh token |

#### Users (`/api/users/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/` | List all users (admin) |
| POST | `/users/` | Create user — auto-generates username/password, emails credentials |
| GET | `/users/:id/` | Get user detail |
| PATCH | `/admin/users/:id/role/` | Update user role |
| POST | `/admin/users/:id/deactivate/` | Deactivate user |
| POST | `/admin/users/:id/reactivate/` | Reactivate user |
| POST | `/admin/users/:id/reset-password/` | Reset password + email new credentials |

#### Seasons (`/api/ratings/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/ratings/seasons/` | List seasons |
| POST | `/ratings/seasons/` | Create season |
| GET | `/ratings/seasons/:id/standings/` | Season standings ordered by ELO |
| POST | `/ratings/seasons/:id/recalculate-elo/` | Replay all matches and recalculate ELO |
| GET | `/ratings/seasons/:id/point-config/` | Get ELO point config |
| PATCH | `/ratings/seasons/:id/point-config/` | Update ELO config |
| GET | `/ratings/history/:user_id/` | Player ELO history |

#### Tournaments (`/api/tournaments/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tournaments/` | List tournaments |
| POST | `/tournaments/` | Create tournament |
| GET | `/tournaments/:id/` | Tournament detail |
| PATCH | `/tournaments/:id/` | Update tournament |
| DELETE | `/tournaments/:id/` | Soft delete tournament |
| POST | `/tournaments/:id/start/` | Start tournament — generates bracket + matches |
| POST | `/tournaments/:id/complete/` | Complete tournament — assigns final ranks |
| POST | `/tournaments/:id/register/` | Player registers for tournament |
| POST | `/tournaments/:id/unregister/` | Player unregisters |
| GET | `/tournaments/:id/bracket/` | Get bracket with rounds and matches |
| GET | `/tournaments/:id/participants/` | List participants with tournament points |
| GET | `/tournaments/:id/award-tiers/` | List award tiers |
| POST | `/tournaments/:id/award-tiers/` | Create award tier (admin) |
| PATCH | `/tournaments/:id/award-tiers/:tid/` | Update award tier (admin) |
| DELETE | `/tournaments/:id/award-tiers/:tid/` | Delete award tier (admin) |
| POST | `/tournaments/:id/distribute-awards/` | Distribute award points to ranked players |
| POST | `/tournaments/:id/reset-awards/` | Reset distributed awards |
| GET | `/tournaments/:id/player-awards/` | Get awarded players |
| GET | `/tournaments/:id/round-formats/` | Get per-round match formats |
| PUT | `/tournaments/:id/round-formats/` | Update per-round match formats |
| GET | `/tournaments/round-formats/preview/` | Preview default formats for given type + player count |

#### Matches (`/api/matches/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/matches/` | List matches |
| POST | `/matches/` | Create match |
| GET | `/matches/:id/` | Match detail |
| POST | `/matches/:id/start/` | Start match |
| POST | `/matches/:id/add-point/` | Add point to player (triggers ELO + WebSocket broadcast) |
| POST | `/matches/:id/complete/` | Complete match — triggers ELO update |
| GET | `/matches/:id/scoreboard/` | Get current scoreboard |

#### Challenges (`/api/challenges/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/challenges/` | List challenges |
| POST | `/challenges/` | Send challenge (auto-sets is_forced if opponent in top 7) |
| GET | `/challenges/:id/` | Challenge detail |
| POST | `/challenges/:id/accept/` | Accept challenge — creates linked match |
| POST | `/challenges/:id/decline/` | Decline challenge |
| POST | `/challenges/:id/cancel/` | Cancel challenge |
| GET | `/challenges/sent/` | Sent challenges |
| GET | `/challenges/received/` | Received challenges |
| GET | `/challenges/pending-count/` | Count of pending challenges |
| GET | `/challenges/history/` | Challenge history aggregates |
| GET | `/challenges/stats/:user_id/` | User challenge stats |

#### Admin Dashboard (`/api/admin/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/dashboard/stats/` | Dashboard stats with previous-period deltas |
| GET | `/admin/dashboard/activity/` | Recent activity feed |
| GET | `/admin/dashboard/quick-actions/` | Quick action items |

---

## Authentication

PingMaster uses JWT authentication via `djangorestframework-simplejwt`.

### Login

```http
POST /api/auth/login/
Content-Type: application/json

{
  "username": "your_username",
  "password": "your_password"
}
```

Response:

```json
{
  "access": "eyJ...",
  "refresh": "eyJ...",
  "user": {
    "id": 1,
    "username": "hugo",
    "role": "ADMIN"
  }
}
```

### Using the token

```http
GET /api/tournaments/
Authorization: Bearer eyJ...
```

### Refreshing the token

```http
POST /api/auth/token/refresh/
Content-Type: application/json

{
  "refresh": "eyJ..."
}
```

### Roles

| Role | Access |
|------|--------|
| `ADMIN` | Full access to all endpoints |
| `MODERATOR` | Can manage matches and view admin data |
| `PLAYER` | Can register for tournaments, send challenges, view standings |

---

## WebSocket Events

Connect to a match room for real-time score updates:

```javascript
const ws = new WebSocket('wss://your-domain.com/ws/matches/<match_id>/');
// Requires valid JWT — unauthenticated connections are rejected (code 4001)
```

### Incoming event: `match_update`

```json
{
  "type": "match_update",
  "match": {
    "id": 12,
    "player1": 5,
    "player1_username": "MarkThree",
    "player2": 6,
    "player2_username": "MarkOne",
    "player1_games_won": 2,
    "player2_games_won": 1,
    "status": "IN_PROGRESS",
    "match_format": "BEST_OF_5"
  }
}
```

Broadcasts after every `add-point` and match completion.
Falls back to 3-second polling if Redis/WebSocket is unavailable.

---

## ELO Rating System

PingMaster uses a standard ELO rating system for all rated matches.

| Parameter | Value |
|-----------|-------|
| Starting rating | 1000 |
| K-factor (Amateur, < 1500) | 32 |
| K-factor (Pro, >= 1500) | 16 |

### Formula

```
Expected score: E = 1 / (1 + 10^((opponent_rating - player_rating) / 400))
New rating: R_new = R_old + K * (actual_score - expected_score)
```

Where `actual_score` = 1 for a win, 0 for a loss.

### Recalculation

Admins can replay all completed matches in chronological order:

```http
POST /api/ratings/seasons/:id/recalculate-elo/
```

Returns `{ matches_processed: N, players_affected: M }`.

---

## Tournament Formats

| Format | Description | Round Formats |
|--------|-------------|---------------|
| Single Elimination | One loss = eliminated | R1: Bo3, QF: Bo5, SF: Bo7, Final: Bo7 |
| Double Elimination | Two losses = eliminated | Same as above |
| Round Robin | Everyone plays everyone | All matches: Bo5 |
| Swiss | Paired by score | All matches: Bo5 |
| Groups + KO | Group stage then knockout | Groups: Bo3, KO: Bo5/7/7 |

Round formats are configurable per tournament in the creation wizard.

### Match Formats

| Format | Win Condition |
|--------|---------------|
| `BEST_OF_3` | First to 2 games |
| `BEST_OF_5` | First to 3 games |
| `BEST_OF_7` | First to 4 games |
| `RACE_TO_5` | First to 5 points |
| `RACE_TO_11` | First to 11 points |
| `RACE_TO_21` | First to 21 points |

---

## Deployment

### Infrastructure (AWS)

```
CloudFront -> S3 (Angular)
           -> ALB -> EC2 t2.micro (Daphne + Nginx + Redis)
                       |
                    Neon PostgreSQL (serverless)
```

### Production startup

```bash
# Start Redis
redis-server --daemonize yes

# Start Daphne (ASGI — supports WebSockets)
daphne -b 127.0.0.1 -p 8000 table_tennis_app.asgi:application

# Or via systemd
sudo systemctl start daphne
sudo systemctl start nginx
```

Set `USE_POSTGRES=True` and `DEBUG=False` in production `.env`.

---

## Running Tests

```bash
# Django unit tests
python manage.py test

# Cypress E2E tests (from frontend repo)
npx cypress run
npx cypress open  # interactive mode
```

---

## Project Structure

```
backend/
├── admin_api/           # Admin dashboard endpoints
├── challenges/          # Challenge system (send, accept, decline)
├── matches/             # Match scoring, WebSocket consumer
│   ├── consumers.py     # MatchConsumer (WebSocket)
│   ├── routing.py       # WebSocket URL routing
│   └── services.py      # MatchResultService (ELO updates)
├── ratings/             # ELO system, seasons, standings
│   └── elo.py           # ELORatingCalculator
├── tournaments/         # Tournament CRUD, bracket generation
│   └── round_formats.py # Default round format configs
├── users/               # Custom user model, auth, signals
└── table_tennis_app/
    ├── asgi.py          # ProtocolTypeRouter (HTTP + WebSocket)
    └── settings.py
```
