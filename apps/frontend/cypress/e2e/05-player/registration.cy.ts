/**
 * 05-player / registration.cy.ts
 * Tests: player registration flow on tournament detail page
 */

const API = Cypress.env('apiUrl');

describe('Player Tournament Registration', () => {

  beforeEach(() => {
    cy.loginAsPlayer();
  });

  it('should load tournament detail page', () => {
    cy.getAuthHeader().then(headers => {
      cy.request({ method: 'GET', url: `${API}/tournaments/`, headers }).then(resp => {
        const results = resp.body.results ?? resp.body;
        if (results.length === 0) {
          cy.log('No tournaments — skipping detail page test');
          return;
        }
        const t = results[0];
        cy.visit(`/tournaments/${t.id}`);
        cy.getByDataCy('tournament-detail-page').should('be.visible');
      });
    });
  });

  it('should show register button for REGISTRATION_OPEN tournament', () => {
    cy.getAuthHeader().then(headers => {
      cy.request({ method: 'GET', url: `${API}/tournaments/`, headers }).then(resp => {
        const results = resp.body.results ?? resp.body;
        const openTournament = results.find((t: { status: string; participant_count: number; max_participants: number }) =>
          (t.status === 'REGISTRATION' || t.status === 'UPCOMING') &&
          t.participant_count < t.max_participants
        );
        if (!openTournament) {
          cy.log('No open tournament for registration test — skipping');
          return;
        }
        cy.visit(`/tournaments/${openTournament.id}`);
        cy.getByDataCy('register-btn').should('be.visible');
      });
    });
  });

  it('should show tab navigation on tournament detail', () => {
    cy.getAuthHeader().then(headers => {
      cy.request({ method: 'GET', url: `${API}/tournaments/`, headers }).then(resp => {
        const results = resp.body.results ?? resp.body;
        if (results.length === 0) {
          cy.log('No tournaments — skipping tab test');
          return;
        }
        cy.visit(`/tournaments/${results[0].id}`);
        cy.contains('button.tab-button', 'Overview').should('be.visible');
        cy.contains('button.tab-button', 'Participants').should('be.visible');
        cy.contains('button.tab-button', 'Bracket').should('be.visible');
      });
    });
  });

  it('should show bracket section when bracket tab clicked', () => {
    cy.getAuthHeader().then(headers => {
      cy.request({ method: 'GET', url: `${API}/tournaments/`, headers }).then(resp => {
        const results = resp.body.results ?? resp.body;
        if (results.length === 0) {
          cy.log('No tournaments — skipping bracket tab test');
          return;
        }
        cy.visit(`/tournaments/${results[0].id}`);
        cy.contains('button.tab-button', 'Bracket').click();
        cy.getByDataCy('bracket-section').should('be.visible');
      });
    });
  });
});

export {};
