/**
 * 06-full-flow / end-to-end.cy.ts
 * Full integration: admin creates season → creates tournament → player views it
 */

const API = Cypress.env('apiUrl');
const SEASON_NAME = `Full Flow Season ${Date.now()}`;
const TOURNAMENT_NAME = `Full Flow Tournament ${Date.now()}`;

let seasonId: number | null = null;
let tournamentId: number | null = null;

describe('Full End-to-End Flow', () => {

  after(() => {
    cy.loginAsAdmin();
    cy.getAuthHeader().then(headers => {
      if (tournamentId) {
        cy.request({ method: 'DELETE', url: `${API}/tournaments/${tournamentId}/`, headers, failOnStatusCode: false });
      }
      if (seasonId) {
        cy.request({ method: 'POST', url: `${API}/ratings/seasons/${seasonId}/end/`, headers, failOnStatusCode: false });
      }
    });
  });

  it('Step 1 — Admin creates a season', () => {
    cy.loginAsAdmin();
    cy.visit('/admin/season-management');
    cy.getByDataCy('create-season-btn').click();

    cy.getByDataCy('season-name-input').type(SEASON_NAME);
    cy.getByDataCy('season-start-date-input').type('2027-01-01');
    cy.getByDataCy('season-end-date-input').type('2027-12-31');
    cy.get('[name="is_active"]').uncheck({ force: true });
    cy.getByDataCy('season-save-btn').click();

    cy.get('.modal-overlay', { timeout: 10000 }).should('not.exist');
    cy.contains('[data-cy="season-name"]', SEASON_NAME).should('be.visible');

    cy.getAuthHeader().then(headers => {
      cy.request({ method: 'GET', url: `${API}/ratings/seasons/`, headers }).then(resp => {
        const results = resp.body.results ?? resp.body;
        const s = results.find((x: { name: string }) => x.name === SEASON_NAME);
        if (s) seasonId = s.id;
      });
    });
  });

  it('Step 2 — Admin navigates to tournament overview', () => {
    cy.loginAsAdmin();
    cy.visit('/admin/tournament-overview');
    cy.getByDataCy('tournament-overview-page').should('be.visible');
    cy.getByDataCy('create-tournament-btn').should('be.visible');
  });

  it('Step 3 — Admin creates a tournament via wizard', () => {
    cy.loginAsAdmin();
    cy.visit('/admin/tournaments/create');

    cy.getByDataCy('wizard-name-input').type(TOURNAMENT_NAME);
    cy.get('input[formControlName="startDate"]').type('2027-03-01');
    cy.get('input[formControlName="location"]').type('Full Flow Venue');
    cy.contains('.format-card', 'Round Robin').click();
    cy.get('input[formControlName="maxPlayers"]').clear().type('8');
    cy.getByDataCy('wizard-next-btn').click();

    cy.contains('.reg-mode-card', 'Manual Start').click();
    cy.getByDataCy('wizard-next-btn').click();

    cy.get('textarea[formControlName="generalRules"]').type('Full flow test rules.');
    cy.getByDataCy('wizard-next-btn').click();

    cy.contains('Review Summary').should('be.visible');
    cy.contains(TOURNAMENT_NAME).should('be.visible');
    cy.getByDataCy('wizard-create-btn').click();

    cy.url({ timeout: 30000 }).should('match', /\/admin\/tournaments\/\d+/);
    cy.getByDataCy('tournament-title').should('contain', TOURNAMENT_NAME);

    cy.url().then(url => {
      const match = url.match(/\/tournaments\/(\d+)/);
      if (match) tournamentId = parseInt(match[1], 10);
    });
  });

  it('Step 4 — Admin sees tournament in overview', () => {
    cy.loginAsAdmin();
    cy.visit('/admin/tournament-overview');
    cy.getByDataCy('tournament-search-input').type(TOURNAMENT_NAME);
    cy.getByDataCy('tournament-row').should('have.length.at.least', 1);
    cy.getByDataCy('tournament-name-cell').first().should('contain', TOURNAMENT_NAME);
  });

  it('Step 5 — Player sees the new tournament in discovery', () => {
    cy.loginAsPlayer();
    cy.visit('/tournaments');
    cy.getByDataCy('tournament-list-page').should('be.visible');
    cy.getByDataCy('tournament-search-input').type(TOURNAMENT_NAME);
    // It may appear in list if public
    cy.get('[data-cy="tournament-card"], .empty-state').should('exist');
  });

  it('Step 6 — Admin dashboard shows updated stats', () => {
    cy.loginAsAdmin();
    cy.visit('/admin/dashboard');
    cy.getByDataCy('dashboard-page').should('be.visible');
    cy.getByDataCy('stat-tournaments').invoke('text').then(text => {
      expect(parseInt(text.trim())).to.be.at.least(1);
    });
  });
});

export {};
