/**
 * 03-tournament / create-tournament.cy.ts
 * Tests: tournament creation wizard using data-cy selectors
 */

const TOURNAMENT_NAME = `E2E Tournament ${Date.now()}`;
const API = Cypress.env('apiUrl');
let tournamentId: number | null = null;

describe('Tournament Creation Wizard', () => {

  beforeEach(() => {
    cy.loginAsAdmin();
  });

  after(() => {
    if (!tournamentId) return;
    cy.getAuthHeader().then(headers => {
      cy.request({
        method: 'DELETE',
        url: `${API}/tournaments/${tournamentId}/`,
        headers,
        failOnStatusCode: false,
      });
    });
  });

  it('should load the wizard page', () => {
    cy.visit('/admin/tournaments/create');
    cy.getByDataCy('wizard-page').should('be.visible');
    cy.get('.stepper').should('be.visible');
    cy.contains('General Details').should('be.visible');
  });

  it('should show validation error when advancing with empty Step 1', () => {
    cy.visit('/admin/tournaments/create');
    cy.getByDataCy('wizard-next-btn').click();
    cy.get('.field-error').should('have.length.at.least', 1);
  });

  it('should fill Step 1 and advance to Step 2', () => {
    cy.visit('/admin/tournaments/create');
    cy.getByDataCy('wizard-name-input').type(TOURNAMENT_NAME);
    cy.get('input[formControlName="startDate"]').type('2027-03-01');
    cy.get('input[formControlName="maxPlayers"]').clear().type('16');
    cy.getByDataCy('wizard-next-btn').click();
    cy.contains('Registration Setup').should('be.visible');
  });

  it('should show tournament overview page', () => {
    cy.visit('/admin/tournament-overview');
    cy.getByDataCy('tournament-overview-page').should('be.visible');
    cy.getByDataCy('tournament-search-input').should('be.visible');
  });

  it('should navigate to create via Host Tournament card', () => {
    cy.visit('/admin/tournament-overview');
    cy.getByDataCy('create-tournament-btn').click();
    cy.url().should('include', '/admin/tournaments/create');
  });

  it('should complete full wizard and create tournament', () => {
    cy.visit('/admin/tournaments/create');

    // Step 1
    cy.getByDataCy('wizard-name-input').type(TOURNAMENT_NAME);
    cy.get('input[formControlName="startDate"]').type('2027-03-01');
    cy.get('input[formControlName="location"]').type('E2E Test Venue');
    cy.contains('.format-card', 'Round Robin').click();
    cy.get('input[formControlName="maxPlayers"]').clear().type('8');
    cy.getByDataCy('wizard-next-btn').click();

    // Step 2
    cy.contains('.reg-mode-card', 'Manual Start').click();
    cy.getByDataCy('wizard-next-btn').click();

    // Step 3
    cy.get('textarea[formControlName="generalRules"]').type('Standard ITTF rules apply.');
    cy.getByDataCy('wizard-next-btn').click();

    // Review
    cy.contains('Review Summary').should('be.visible');
    cy.contains(TOURNAMENT_NAME).should('be.visible');
    cy.getByDataCy('wizard-create-btn').click();

    // Lands on tournament detail page
    cy.url({ timeout: 30000 }).should('match', /\/admin\/tournaments\/\d+/);
    cy.getByDataCy('tournament-title').should('contain', TOURNAMENT_NAME);

    cy.url().then(url => {
      const match = url.match(/\/tournaments\/(\d+)/);
      if (match) tournamentId = parseInt(match[1], 10);
    });
  });

  it('should show tabs on the admin tournament detail page', () => {
    if (!tournamentId) {
      cy.log('No tournamentId — skipping tab test');
      return;
    }
    cy.visit(`/admin/tournaments/${tournamentId}`);
    cy.getByDataCy('tab-overview').should('be.visible');
    cy.getByDataCy('tab-participants').should('be.visible');
    cy.getByDataCy('tab-awards').should('be.visible');
  });
});

export {};
