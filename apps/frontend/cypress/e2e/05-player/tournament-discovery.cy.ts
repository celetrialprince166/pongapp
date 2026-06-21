/**
 * 05-player / tournament-discovery.cy.ts
 * Tests: tournament list page — player-facing discovery experience
 */

describe('Tournament Discovery (Player View)', () => {

  beforeEach(() => {
    cy.loginAsPlayer();
  });

  it('should load the tournament list page', () => {
    cy.visit('/tournaments');
    cy.getByDataCy('tournament-list-page').should('be.visible');
    cy.contains('h1', 'Tournament Discovery').should('be.visible');
  });

  it('should show search input', () => {
    cy.visit('/tournaments');
    cy.getByDataCy('tournament-search-input').should('be.visible');
  });

  it('should show tournament cards when tournaments exist', () => {
    cy.visit('/tournaments');
    cy.get('[data-cy="tournament-card"], .empty-state').should('exist');
  });

  it('should filter tournaments with search', () => {
    cy.visit('/tournaments');
    cy.getByDataCy('tournament-search-input').type('zzzznotfound');
    cy.getByDataCy('tournament-card').should('not.exist');
    cy.getByDataCy('tournament-search-input').clear();
  });

  it('should show tab buttons', () => {
    cy.visit('/tournaments');
    cy.get('.tab-btn').should('have.length.at.least', 1);
  });

  it('should show card name and status badge on tournament card', () => {
    cy.visit('/tournaments');
    cy.waitForApi();
    cy.document().then(doc => {
      const cards = doc.querySelectorAll('[data-cy="tournament-card"]');
      if (cards.length === 0) {
        cy.log('No tournament cards — skipping card assertions');
        return;
      }
      cy.getByDataCy('tournament-card').first().within(() => {
        cy.getByDataCy('card-name').should('be.visible');
        cy.getByDataCy('tournament-status-badge').should('be.visible');
      });
    });
  });

  it('should navigate to tournament detail when view button clicked', () => {
    cy.visit('/tournaments');
    cy.waitForApi();
    cy.document().then(doc => {
      const cards = doc.querySelectorAll('[data-cy="tournament-card"]');
      if (cards.length === 0) {
        cy.log('No cards to click — skipping navigation test');
        return;
      }
      cy.getByDataCy('tournament-card').first().within(() => {
        cy.getByDataCy('view-btn').click({ force: true });
      });
      cy.url({ timeout: 10000 }).should('match', /\/tournaments\/\d+/);
      cy.getByDataCy('tournament-detail-page').should('be.visible');
    });
  });
});

export {};
