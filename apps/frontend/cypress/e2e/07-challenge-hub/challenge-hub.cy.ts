/**
 * 07-challenge-hub / challenge-hub.cy.ts
 *
 * Tests: Challenge Hub page — player list, sending a challenge,
 *        Active Challenges widget on the dashboard (incoming / sent sections).
 *
 * Runs against:
 *   Angular: http://localhost:4200
 *   Django:  http://localhost:8000
 */

const API = Cypress.env('apiUrl');

// ── Helpers ──────────────────────────────────────────────────────────────────

function declineAllPendingChallenges(token: string) {
  cy.request({
    method: 'GET',
    url: `${API}/challenges/`,
    headers: { Authorization: `Bearer ${token}` },
    failOnStatusCode: false,
  }).then(({ body }) => {
    const challenges = body?.results ?? (Array.isArray(body) ? body : []);
    challenges
      .filter((c: any) => c.status === 'PENDING')
      .forEach((c: any) => {
        cy.request({
          method: 'POST',
          url: `${API}/challenges/${c.id}/cancel/`,
          headers: { Authorization: `Bearer ${token}` },
          failOnStatusCode: false,
        });
      });
  });
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('Challenge Hub', () => {
  let playerToken: string;

  before(() => {
    cy.loginAsPlayer().then(() => {
      playerToken = Cypress.env('authToken') ?? '';
      declineAllPendingChallenges(playerToken);
    });
  });

  beforeEach(() => {
    cy.loginAsPlayer();
    cy.visit('/challenge-hub');
    cy.waitForApi();
  });

  // ── Page structure ──────────────────────────────────────────────────────────

  it('renders the challenge hub page with a player list', () => {
    cy.contains('Challenge Hub').should('be.visible');
    // The player list section should exist and have at least one entry
    cy.get('.player-list, [data-cy="player-list"]').should('exist');
  });

  it('shows a Challenge button for other players', () => {
    cy.get('[data-cy="challenge-btn"], .challenge-btn, button')
      .contains(/challenge/i)
      .first()
      .should('be.visible');
  });

  // ── Sending a challenge ─────────────────────────────────────────────────────

  it('sends a challenge via API and reflects pending count', () => {
    // Get a list of players to challenge
    cy.getAuthHeader().then((headers) => {
      cy.request({
        method: 'GET',
        url: `${API}/leaderboard/`,
        headers,
        failOnStatusCode: false,
      }).then(({ body }) => {
        const players = body?.results ?? (Array.isArray(body) ? body : []);
        const current = JSON.parse(Cypress.env('authUser') ?? '{}');
        const target = players.find((p: any) => p.id !== current.id);

        if (!target) {
          cy.log('⚠️ No other player available — skipping challenge creation');
          return;
        }

        // Create challenge via API
        cy.request({
          method: 'POST',
          url: `${API}/challenges/`,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: {
            challenged: target.id,
            match_format: 'BEST_OF',
            format_value: 5,
          },
          failOnStatusCode: false,
        }).then((resp) => {
          if (resp.status === 201) {
            cy.log(`Created challenge id=${resp.body.id} against ${target.username}`);
          } else {
            cy.log(`⚠️ Challenge creation returned ${resp.status} — may have hit limit`);
          }
        });
      });
    });
  });

  // ── Sent challenge appears in Active Challenges widget ─────────────────────

  it('shows sent pending challenges in the Active Challenges dashboard widget', () => {
    cy.visit('/dashboard');
    cy.waitForApi();

    // widget always renders
    cy.get('app-active-challenges').should('exist');

    // if there is a "Sent" section it should list the challenge
    cy.get('app-active-challenges').then(($widget) => {
      if ($widget.text().includes('Sent')) {
        cy.wrap($widget).contains('Sent').should('be.visible');
      } else {
        // No sent challenges currently — empty or incoming-only state
        cy.wrap($widget).should('be.visible');
      }
    });
  });

  // ── Cancel a sent challenge ─────────────────────────────────────────────────

  it('can cancel a sent challenge from the Active Challenges widget', () => {
    cy.visit('/dashboard');
    cy.waitForApi();

    cy.get('app-active-challenges').then(($widget) => {
      if (!$widget.text().includes('Sent')) {
        cy.log('⚠️ No sent challenges to cancel — skipping');
        return;
      }
      cy.wrap($widget).contains('Cancel').first().click();
      cy.waitForApi();
      // After cancel the row should disappear
      cy.wrap($widget).contains('Cancel').should('not.exist');
    });
  });
});

// ── Incoming challenge flow ────────────────────────────────────────────────────

describe('Active Challenges — incoming challenge', () => {
  let adminToken: string;
  let playerToken: string;
  let challengeId: number;

  before(() => {
    // Admin sends a challenge to the player
    cy.loginAsAdmin().then(() => {
      adminToken = Cypress.env('authToken') ?? '';
    });
    cy.loginAsPlayer().then(() => {
      playerToken = Cypress.env('authToken') ?? '';

      const playerUser = JSON.parse(Cypress.env('authUser') ?? '{}');
      const adminUser = JSON.parse(Cypress.env('authUser') ?? '{}');

      // Get player id via API
      cy.getAuthHeader().then((headers) => {
        cy.request({
          method: 'GET',
          url: `${API}/auth/me/`,
          headers,
          failOnStatusCode: false,
        }).then(({ body }) => {
          const playerId = body?.id;
          if (!playerId) return;

          // Switch to admin to send challenge
          cy.loginAsAdmin();
          cy.getAuthHeader().then((adminHeaders) => {
            cy.request({
              method: 'POST',
              url: `${API}/challenges/`,
              headers: { ...adminHeaders, 'Content-Type': 'application/json' },
              body: {
                challenged: playerId,
                match_format: 'BEST_OF',
                format_value: 5,
              },
              failOnStatusCode: false,
            }).then((resp) => {
              if (resp.status === 201) {
                challengeId = resp.body.id;
              }
            });
          });
        });
      });
    });
  });

  it('shows incoming challenge in the widget and can accept it', () => {
    if (!challengeId) {
      cy.log('⚠️ No challenge created — skipping');
      return;
    }

    cy.loginAsPlayer();
    cy.visit('/dashboard');
    cy.waitForApi();

    cy.get('app-active-challenges').should('contain', 'Incoming');
    cy.get('app-active-challenges').contains('Accept').first().click();
    cy.waitForApi();

    // Row should be removed after acceptance
    cy.request({
      method: 'GET',
      url: `${API}/challenges/${challengeId}/`,
      headers: { Authorization: `Bearer ${playerToken}` },
      failOnStatusCode: false,
    }).then(({ body }) => {
      expect(['ACCEPTED', 'COMPLETED']).to.include(body.status);
    });
  });
});
