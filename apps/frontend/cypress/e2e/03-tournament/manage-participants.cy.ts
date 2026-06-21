/**
 * 03-tournament / manage-participants.cy.ts
 * Tests: tournament detail admin — participant management
 */

const API = Cypress.env('apiUrl');
let createdTournamentId: number | null = null;

describe('Tournament Participant Management', () => {

  before(() => {
    // Ensure at least one tournament exists for the detail tests
    cy.loginAsAdmin();
    cy.getAuthHeader().then(headers => {
      cy.request({
        method: 'POST',
        url: `${API}/tournaments/`,
        headers,
        body: {
          name: `E2E Participant Test ${Date.now()}`,
          description: '',
          location: 'E2E Test Venue',
          is_public: true,
          tournament_format: 'ROUND_ROBIN',
          status: 'UPCOMING',
          start_date: '2027-06-01T00:00:00Z',
          end_date: '2027-06-02T00:00:00Z',
          max_participants: 8,
          min_participants: 4,
          registration_mode: 'MANUAL',
          is_rated: true,
          prize_label: '',
        },
        failOnStatusCode: false,
      }).then(resp => {
        if (resp.status === 201) {
          createdTournamentId = resp.body.id;
        } else {
          cy.log(`Tournament creation failed: ${resp.status} ${JSON.stringify(resp.body)}`);
        }
      });
    });
  });

  after(() => {
    if (!createdTournamentId) return;
    cy.getAuthHeader().then(headers => {
      cy.request({
        method: 'DELETE',
        url: `${API}/tournaments/${createdTournamentId}/`,
        headers,
        failOnStatusCode: false,
      });
    });
  });

  beforeEach(() => {
    cy.loginAsAdmin();
  });

  it('should load tournament overview and show tournaments', () => {
    cy.visit('/admin/tournament-overview');
    cy.getByDataCy('tournament-overview-page').should('be.visible');
  });

  it('should search tournaments by name', () => {
    cy.visit('/admin/tournament-overview');
    cy.getByDataCy('tournament-search-input').type('zzzznotfound');
    cy.getByDataCy('tournament-row').should('not.exist');
    cy.getByDataCy('tournament-search-input').clear();
  });

  it('should navigate to tournament detail when view button clicked', () => {
    cy.visit('/admin/tournament-overview');
    cy.getByDataCy('tournament-row').first().then($card => {
      // Click the view button if it exists, otherwise click the card
      const viewBtn = $card.find('[data-cy="tournament-view-btn"]');
      if (viewBtn.length > 0) {
        cy.wrap(viewBtn).click({ force: true });
      } else {
        cy.wrap($card).click();
      }
    });
    cy.url({ timeout: 10000 }).should('match', /\/admin\/tournaments\/\d+/);
    cy.getByDataCy('tournament-title').should('be.visible');
  });

  it('should show tournament status badge in overview', () => {
    cy.visit('/admin/tournament-overview');
    cy.getByDataCy('tournament-row').first().within(() => {
      cy.getByDataCy('tournament-status-badge').should('be.visible');
    });
  });

  it('should show action buttons on tournament detail', () => {
    cy.visit('/admin/tournament-overview');
    cy.getByDataCy('tournament-row').first().click();
    cy.url({ timeout: 10000 }).should('match', /\/admin\/tournaments\/\d+/);
    // At least one of these should be visible
    cy.get('[data-cy="edit-details-btn"], [data-cy="delete-tournament-btn"]').should('exist');
  });

  it('should open participants tab', () => {
    cy.visit('/admin/tournament-overview');
    cy.getByDataCy('tournament-row').first().click();
    cy.url({ timeout: 10000 }).should('match', /\/admin\/tournaments\/\d+/);
    // Wait for tournament content to fully load (title visible means loading is done)
    cy.getByDataCy('tournament-title').should('be.visible');
    cy.getByDataCy('tab-participants').click();
    cy.waitForApi();
    // Either shows participant rows or participants empty state
    cy.get('[data-cy="participant-row"], [data-cy="participants-empty-state"]', { timeout: 15000 }).should('exist');
  });

  it('should open awards tab and show add tier button', () => {
    cy.visit('/admin/tournament-overview');
    cy.getByDataCy('tournament-row').first().click();
    cy.url({ timeout: 10000 }).should('match', /\/admin\/tournaments\/\d+/);
    cy.getByDataCy('tab-awards').click();
    cy.getByDataCy('add-tier-btn').should('be.visible');
  });

  it('should open and cancel delete tournament modal', () => {
    cy.visit('/admin/tournament-overview');
    cy.getByDataCy('tournament-row').first().click();
    cy.url({ timeout: 10000 }).should('match', /\/admin\/tournaments\/\d+/);
    cy.getByDataCy('delete-tournament-btn').click();
    cy.getByDataCy('delete-tournament-modal').should('be.visible');
    cy.getByDataCy('delete-tournament-confirm-btn').should('be.visible');
    cy.contains('button', 'Cancel').click();
    cy.getByDataCy('delete-tournament-modal').should('not.exist');
  });
});

export {};
