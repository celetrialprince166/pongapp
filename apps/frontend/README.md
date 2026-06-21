# PingMaster — Frontend

Angular 17+ frontend for the PingMaster table tennis league management system.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Application Structure](#application-structure)
- [Features](#features)
- [User Roles](#user-roles)
- [Running Tests](#running-tests)
- [Build and Deployment](#build-and-deployment)

---

## Overview

PingMaster frontend provides separate experiences for:

- **Admins** — tournament creation wizard, bracket management, scoring, user management
- **Players** — tournament discovery, registration, live bracket viewing, challenge system

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Angular | 17+ | Framework (standalone components) |
| TypeScript | 5+ | Language |
| RxJS | 7+ | Reactive state management |
| Angular Signals | 17+ | Local component state |
| Lucide Angular | latest | Icon library |
| Cypress | 13 | E2E testing |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Angular CLI 17+

### Local Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd table_tennis_frontend

# 2. Install dependencies
npm install

# 3. Start development server
ng serve

# App runs at http://localhost:4200
# API proxied to http://localhost:8080 via proxy.conf.json
```

The Angular dev server proxies `/api/` and `/ws/` to `http://localhost:8080`.
Start the Django backend before running the frontend.

---

## Environment Configuration

### Development (`src/environments/environment.ts`)

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:8080/api'
};
```

### Production (`src/environments/environment.prod.ts`)

```typescript
export const environment = {
  production: true,
  apiUrl: 'http://ttl-app-alb-436585712.eu-west-1.elb.amazonaws.com/api'
};
```

The production build automatically uses `environment.prod.ts`:

```bash
ng build --configuration production
```

---

## Application Structure

```
src/app/
├── core/
│   ├── services/             # API service layer
│   │   ├── auth.service.ts
│   │   ├── tournament.service.ts
│   │   ├── match.service.ts
│   │   ├── challenge.service.ts
│   │   ├── award-tier.service.ts
│   │   ├── match-websocket.service.ts  # WebSocket + polling fallback
│   │   └── ...
│   ├── interceptors/
│   │   ├── auth.interceptor.ts         # Attaches JWT + handles 401 refresh
│   │   └── error.interceptor.ts
│   └── guards/
│       ├── auth.guard.ts
│       └── admin.guard.ts
├── features/
│   ├── auth/                 # Login, signup
│   ├── admin/                # Admin dashboard, user/player management
│   ├── tournaments/
│   │   ├── tournament-list-page/           # Discovery page (player)
│   │   ├── tournament-detail-page/         # Player view (5 tabs)
│   │   ├── tournament-detail-admin/        # Admin view (5 tabs)
│   │   ├── tournament-creation-wizard/     # 5-step creation wizard
│   │   └── components/
│   │       └── tournament-bracket/         # SVG bracket visualization
│   ├── matches/
│   │   ├── live-scoring/                   # Player live scoring view
│   │   └── admin-match-scoring/            # Admin full-page scoring
│   ├── challenge-hub/        # Send challenges
│   ├── dashboard/            # Player dashboard with ELO + active challenges
│   └── league-standings/     # Season standings table
└── shared/
    └── components/
        ├── delta-badge/                    # Percentage change indicator
        ├── match-correction-modal/         # Admin score correction modal
        ├── toast/                          # Toast notification service
        └── tournament-card/               # Reusable tournament card
```

---

## Features

### Admin Features

| Feature | Route |
|---------|-------|
| Dashboard with delta badges | `/admin/dashboard` |
| Season management (CRUD + archive/restore) | `/admin/seasons` |
| Tournament creation wizard (5 steps) | `/admin/tournaments/create` |
| Tournament detail (brackets, participants, awards) | `/admin/tournaments/:id` |
| Full-page match scoring | `/admin/matches/:id/score` |
| User management (create, reset password, roles) | `/admin/user-management` |
| Player management | `/admin/player-management` |
| Point allocation | `/admin/point-allocation` |

### Player Features

| Feature | Route |
|---------|-------|
| Dashboard with ELO rating | `/dashboard` |
| Tournament discovery | `/tournaments` |
| Tournament detail (bracket, matches, awards) | `/tournaments/:id` |
| Challenge hub | `/challenge-hub` |
| League standings | `/league-standings` |

### Tournament Creation Wizard (5 Steps)

1. **Basic Info** — Name, date, location, format, max players
2. **Registration** — Mode, deadline, public/private toggle
3. **Rules** — Rated event, general rules text
4. **Match Rules** — Per-round format configuration (auto-populated defaults)
5. **Review** — Full summary before submission

### Visual Bracket

- SVG connector lines between match cards
- Live match pulse animation (red border)
- Completed match connectors (green)
- Bracket / List view toggle
- Group standings table for Groups + KO format
- Admin Score Live button on IN_PROGRESS matches

### Real-time Scoring

- WebSocket primary connection via `MatchWebSocketService`
- Automatic fallback to 3-second polling when WebSocket unavailable
- Score updates pushed to all connected clients
- Serve indicator (rotates every 2 points)
- Game history table with per-game submit

---

## User Roles

| Role | Sidebar | Capabilities |
|------|---------|-------------|
| `ADMIN` | Full admin sidebar | All features — create tournaments, manage users, score matches |
| `MODERATOR` | Admin sidebar | View and score matches, limited management |
| `PLAYER` | Player sidebar | Register for tournaments, send challenges, view standings |

Auth uses **sessionStorage** — each browser tab maintains an independent session.
Tokens refresh silently on 401 responses via the auth interceptor.

---

## Running Tests

### E2E Tests (Cypress)

```bash
# Run all tests headlessly
npx cypress run

# Open interactive test runner
npx cypress open

# Run specific spec
npx cypress run --spec "cypress/e2e/03-tournament-management/tournament-management.cy.ts"
```

### Test Coverage

| Spec File | Coverage |
|-----------|---------|
| `01-auth/` | Login, signup, role redirects |
| `02-season-management/` | Season CRUD, archive, restore |
| `03-tournament-management/` | Create, update, bracket |
| `04-match-scoring/` | Point by point, completion |
| `05-player-tournament-discovery/` | Discovery, registration |
| `06-full-flow/` | End-to-end admin to player journey |
| `07-challenge-hub/` | Send, accept, decline challenges |
| `08-user-management/` | Create, paginate, reset password |

**Total: 85+ tests passing**

Cypress uses `POST /api/test/reset-db/` to seed test data between runs.
This endpoint is only active when `DEBUG=True` on the backend.

---

## Build and Deployment

### Production build

```bash
ng build --configuration production
# Output: dist/table_tennis_frontend/browser/
```

### Deploy to S3 + CloudFront

```bash
# Sync assets (long cache)
aws s3 sync dist/table_tennis_frontend/browser s3://your-bucket \
  --delete \
  --cache-control "max-age=31536000,immutable" \
  --exclude "index.html"

# Upload index.html (no cache)
aws s3 cp dist/table_tennis_frontend/browser/index.html \
  s3://your-bucket/index.html \
  --cache-control "no-cache,no-store,must-revalidate"

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DIST_ID \
  --paths "/*"
```

---

## Proxy Configuration

`proxy.conf.json` routes dev server requests to the backend:

```json
{
  "/api": {
    "target": "http://localhost:8080",
    "changeOrigin": true
  },
  "/ws": {
    "target": "ws://localhost:8080",
    "ws": true,
    "changeOrigin": true
  }
}
```
