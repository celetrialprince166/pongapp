/**
 * 04-match-scoring / score-match.cy.ts
 * Tests: match correction modal via brackets tab on tournaments IN_PROGRESS
 */

const API = Cypress.env('apiUrl');

describe('Match Scoring & Correction', () => {

  beforeEach(() => {
    cy.loginAsAdmin();
  });

  /**
   * Find a tournament that is IN_PROGRESS, then verify bracket/match UI.
   * If no in-progress tournament exists, the tests are skipped gracefully.
   */
  it('should show brackets tab for an in-progress tournament', () => {
    cy.getAuthHeader().then(headers => {
      cy.request({ method: 'GET', url: `${API}/tournaments/`, headers }).then(resp => {
        const results = resp.body.results ?? resp.body;
        const inProgress = results.find((t: { status: string }) => t.status === 'IN_PROGRESS');
        if (!inProgress) {
          cy.log('No IN_PROGRESS tournament found — skipping brackets test');
          return;
        }

        cy.visit(`/admin/tournaments/${inProgress.id}`);
        cy.getByDataCy('tab-brackets').should('be.visible').click();
        cy.get('[data-cy="match-row"], .empty-state').should('exist');
      });
    });
  });

  it('should open correct score modal from brackets tab', () => {
    cy.getAuthHeader().then(headers => {
      cy.request({ method: 'GET', url: `${API}/tournaments/`, headers }).then(resp => {
        const results = resp.body.results ?? resp.body;
        const inProgress = results.find((t: { status: string }) =>
          t.status === 'IN_PROGRESS' || t.status === 'COMPLETED'
        );
        if (!inProgress) {
          cy.log('No IN_PROGRESS/COMPLETED tournament — skipping score modal test');
          return;
        }

        cy.visit(`/admin/tournaments/${inProgress.id}`);
        cy.getByDataCy('tab-brackets').should('be.visible').click();

        cy.get('[data-cy="correct-score-btn"]').then($btns => {
          if ($btns.length === 0) {
            cy.log('No completed matches to correct — skipping');
            return;
          }
          cy.wrap($btns.first()).click();
          cy.getByDataCy('score-modal').should('be.visible');
          cy.getByDataCy('player1-name').should('be.visible');
          cy.getByDataCy('player2-name').should('be.visible');
          cy.getByDataCy('cancel-btn').click();
          cy.getByDataCy('score-modal').should('not.exist');
        });
      });
    });
  });

  it('should close score modal with cancel button', () => {
    cy.getAuthHeader().then(headers => {
      cy.request({ method: 'GET', url: `${API}/tournaments/`, headers }).then(resp => {
        const results = resp.body.results ?? resp.body;
        const t = results.find((x: { status: string }) =>
          x.status === 'IN_PROGRESS' || x.status === 'COMPLETED'
        );
        if (!t) {
          cy.log('No suitable tournament for modal cancel test — skipping');
          return;
        }

        cy.visit(`/admin/tournaments/${t.id}`);
        cy.getByDataCy('tab-brackets').click();

        cy.get('[data-cy="correct-score-btn"], [data-cy="score-match-btn"]').then($btns => {
          if ($btns.length === 0) {
            cy.log('No match action buttons — skipping');
            return;
          }
          cy.wrap($btns.first()).click();
          cy.getByDataCy('score-modal').should('be.visible');
          cy.getByDataCy('cancel-btn').click();
          cy.getByDataCy('score-modal').should('not.exist');
        });
      });
    });
  });
});

export {};
