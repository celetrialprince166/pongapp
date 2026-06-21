/**
 * 02-season / create-season.cy.ts
 * Tests: season management CRUD via data-cy selectors
 */

const SEASON_NAME = `E2E Season ${Date.now()}`;
const API = Cypress.env('apiUrl');
let seasonId: number | null = null;

describe('Season Management', () => {

  beforeEach(() => {
    cy.loginAsAdmin();
  });

  after(() => {
    // Best-effort cleanup
    if (!seasonId) return;
    cy.getAuthHeader().then(headers => {
      cy.request({
        method: 'POST',
        url: `${API}/ratings/seasons/${seasonId}/end/`,
        headers,
        failOnStatusCode: false,
      });
    });
  });

  it('should load the season management page', () => {
    cy.visit('/admin/season-management');
    cy.getByDataCy('season-management-page').should('be.visible');
    cy.contains('h1', 'Season Management').should('be.visible');
  });

  it('should show filter tabs', () => {
    cy.visit('/admin/season-management');
    cy.getByDataCy('tab-all').should('be.visible');
    cy.getByDataCy('tab-active').should('be.visible');
    cy.getByDataCy('tab-upcoming').should('be.visible');
    cy.getByDataCy('tab-archive').should('be.visible');
    cy.getByDataCy('tab-deleted').should('be.visible');
  });

  it('should filter seasons via search input', () => {
    cy.visit('/admin/season-management');
    cy.getByDataCy('season-search-input').type('zzzznotfound');
    cy.getByDataCy('season-row').should('not.exist');
    cy.getByDataCy('season-search-input').clear();
  });

  it('should open create season modal', () => {
    cy.visit('/admin/season-management');
    cy.getByDataCy('create-season-btn').click();
    cy.getByDataCy('season-name-input').should('be.visible');
    cy.getByDataCy('season-start-date-input').should('be.visible');
    cy.getByDataCy('season-end-date-input').should('be.visible');
  });

  it('should show validation errors when submitting empty create form', () => {
    cy.visit('/admin/season-management');
    cy.getByDataCy('create-season-btn').click();
    cy.getByDataCy('season-save-btn').click();
    cy.get('.error-message').should('have.length.at.least', 2);
  });

  it('should cancel create modal without creating a season', () => {
    cy.visit('/admin/season-management');
    cy.getByDataCy('create-season-btn').click();
    cy.getByDataCy('season-name-input').type('Should not be created');
    cy.getByDataCy('season-cancel-btn').click();
    cy.get('.modal-overlay').should('not.exist');
    cy.contains('.season-name', 'Should not be created').should('not.exist');
  });

  it('should create a new season', () => {
    cy.visit('/admin/season-management');
    cy.getByDataCy('create-season-btn').click();

    cy.getByDataCy('season-name-input').type(SEASON_NAME);
    cy.getByDataCy('season-start-date-input').type('2027-01-01');
    cy.getByDataCy('season-end-date-input').type('2027-12-31');
    cy.get('[name="is_active"]').uncheck({ force: true });

    cy.getByDataCy('season-save-btn').click();

    cy.get('.modal-overlay', { timeout: 10000 }).should('not.exist');
    cy.contains('[data-cy="season-name"]', SEASON_NAME).should('be.visible');

    // Capture ID for cleanup
    cy.getAuthHeader().then(headers => {
      cy.request({ method: 'GET', url: `${API}/ratings/seasons/`, headers }).then(resp => {
        const results = resp.body.results ?? resp.body;
        const s = results.find((x: { name: string }) => x.name === SEASON_NAME);
        if (s) seasonId = s.id;
      });
    });
  });

  it('should display season status badge', () => {
    cy.visit('/admin/season-management');
    cy.getByDataCy('season-row').first().within(() => {
      cy.getByDataCy('season-status-badge').should('be.visible');
    });
  });

  it('should show kebab menu options for non-deleted season', () => {
    cy.visit('/admin/season-management');
    cy.getByDataCy('season-row').first().within(() => {
      cy.getByDataCy('season-kebab-btn').click();
    });
    // One of these should be visible
    cy.get('[data-cy="kebab-update"], [data-cy="kebab-archive"], [data-cy="kebab-delete"]')
      .should('exist');
  });

  it('should open and cancel delete modal', () => {
    cy.visit('/admin/season-management');
    // Navigate to Archive tab to find an archived season (which has delete option)
    cy.getByDataCy('tab-archive').click();
    cy.waitForApi();
    cy.document().then(doc => {
      const rows = doc.querySelectorAll('[data-cy="season-row"]');
      if (rows.length === 0) {
        cy.log('No archived seasons available for delete test — skipping');
        return;
      }
      cy.getByDataCy('season-row').first().within(() => {
        cy.getByDataCy('season-kebab-btn').click();
      });
      cy.getByDataCy('kebab-delete').click();
      cy.getByDataCy('delete-season-modal').should('be.visible');
      cy.getByDataCy('delete-season-confirm-btn').should('be.visible');
      // Cancel by pressing the Cancel button
      cy.contains('button', 'Cancel').click();
      cy.getByDataCy('delete-season-modal').should('not.exist');
    });
  });
});

export {};
