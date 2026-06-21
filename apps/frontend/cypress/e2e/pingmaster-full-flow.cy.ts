/**
 * PingMaster Full Flow E2E Suite
 *
 * Flow 1 — Season Creation
 * Flow 2 — Tournament Creation (uses season from Flow 1)
 * Flow 3 — Award Tier Verification
 *
 * Runs against:
 *   Angular: http://localhost:4200
 *   Django:  http://localhost:8000
 */

const SEASON_NAME         = 'Cypress Test Season 2026';
const SEASON_NAME_UPDATED = 'Cypress Test Season 2026 Updated';
const TOURNAMENT_NAME     = 'Cypress Test Tournament 2026';
const WIZARD_URL          = '/admin/tournaments/create';
const API = Cypress.env('apiUrl');

// Shared state across describe blocks
let seasonId: number;
let tournamentId: number;
let accessToken: string;

// ─────────────────────────────────────────────────────────────────────────────
// PRE-FLIGHT
// ─────────────────────────────────────────────────────────────────────────────

before(() => {
  cy.login().then(token => {
    accessToken = token as unknown as string;

    // ── Clean up stale test data from previous runs ──────────────────────────
    // Archive any existing test seasons (they can't be deleted)
    cy.request({
      method: 'GET',
      url: `${API}/ratings/seasons/`,
      headers: { Authorization: `Bearer ${token}` },
      failOnStatusCode: false,
    }).then(resp => {
      const results: any[] = resp.body.results ?? resp.body;
      results
        .filter(s => (s.name === SEASON_NAME || s.name === SEASON_NAME_UPDATED) && !s.ended_at)
        .forEach(s => {
          cy.request({
            method: 'POST',
            url: `${API}/ratings/seasons/${s.id}/end/`,
            headers: { Authorization: `Bearer ${token}` },
            failOnStatusCode: false,
          });
        });
    });

    // Delete any existing test tournaments
    cy.request({
      method: 'GET',
      url: `${API}/tournaments/`,
      headers: { Authorization: `Bearer ${token}` },
      failOnStatusCode: false,
    }).then(resp => {
      const results: any[] = resp.body.results ?? resp.body;
      results
        .filter(t => t.name === TOURNAMENT_NAME)
        .forEach(t => {
          cy.request({
            method: 'DELETE',
            url: `${API}/tournaments/${t.id}/`,
            headers: { Authorization: `Bearer ${token}` },
            failOnStatusCode: false,
          });
        });
    });
  });
});

after(() => {
  const token = Cypress.env('authToken') ?? accessToken;
  const headers = { Authorization: `Bearer ${token}` };

  // Cleanup tournament
  if (tournamentId) {
    cy.request({
      method: 'DELETE',
      url: `${API}/tournaments/${tournamentId}/`,
      headers,
      failOnStatusCode: false,
    }).then(r => {
      if (r.status >= 400) cy.log(`⚠️ Tournament cleanup: ${r.status}`);
    });
  }

  // Cleanup season (archive via /end/ since no DELETE endpoint)
  if (seasonId) {
    cy.request({
      method: 'POST',
      url: `${API}/ratings/seasons/${seasonId}/end/`,
      headers,
      failOnStatusCode: false,
    }).then(r => {
      cy.log(`Season cleanup /end/: ${r.status}`);
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// FLOW 1 — SEASON CREATION
// ═════════════════════════════════════════════════════════════════════════════

describe('Flow 1 — Season Creation', () => {

  beforeEach(() => {
    cy.login();
  });

  // TEST 1
  it('should navigate to Season Management page', () => {
    cy.visit('/admin/season-management');
    cy.contains('h1', 'Season Management').should('be.visible');
    cy.get('.filter-tabs').should('exist');
  });

  // TEST 2
  it('should open season creation form', () => {
    cy.visit('/admin/season-management');
    cy.contains('button', 'Create New Season').click();
    cy.get('#season-name').should('be.visible');
    cy.get('#start-date').should('be.visible');
    cy.get('#end-date').should('be.visible');
    cy.get('[name="is_active"]').should('exist');
  });

  // TEST 3
  it('should validate required season fields', () => {
    cy.visit('/admin/season-management');
    cy.contains('button', 'Create New Season').click();
    cy.contains('button', 'Create Season').click();
    cy.get('.error-message').should('have.length.at.least', 2);
    cy.contains('.error-message', /name is required/i).should('be.visible');
    cy.contains('.error-message', /start date is required/i).should('be.visible');
    cy.contains('.error-message', /end date is required/i).should('be.visible');
  });

  // TEST 4
  it('should validate end date must be after start date', () => {
    cy.visit('/admin/season-management');
    cy.contains('button', 'Create New Season').click();
    cy.get('#season-name').type('Date Test');
    cy.get('#start-date').type('2026-06-01');
    cy.get('#end-date').type('2026-01-01'); // before start
    cy.contains('button', 'Create Season').click();
    cy.contains('.error-message', /after start date/i).should('be.visible');
  });

  // TEST 5
  it('should successfully create a season', () => {
    cy.visit('/admin/season-management');
    cy.contains('button', 'Create New Season').click();

    cy.get('#season-name').type(SEASON_NAME);
    cy.get('#start-date').type('2026-01-01');
    cy.get('#end-date').type('2026-12-31');
    // Uncheck is_active to avoid conflict with existing active season
    cy.get('[name="is_active"]').uncheck({ force: true });

    cy.contains('button', 'Create Season').click();

    // Modal should close and new season visible in table
    cy.get('.modal-overlay').should('not.exist');
    cy.contains('.season-name', SEASON_NAME).should('be.visible');

    // Capture the season ID from the API for later use
    cy.request({
      method: 'GET',
      url: `${API}/ratings/seasons/`,
      headers: { Authorization: `Bearer ${Cypress.env('authToken') ?? accessToken}` },
    }).then(resp => {
      const results = resp.body.results ?? resp.body;
      const season = results.find((s: { name: string }) => s.name === SEASON_NAME);
      expect(season).to.exist;
      seasonId = season.id;
    });
  });

  // TEST 6
  it('should display created season details in list', () => {
    cy.visit('/admin/season-management');
    cy.contains('.season-name', SEASON_NAME).should('be.visible');
    cy.contains('Jan 1, 2026').should('be.visible');
    cy.contains('Dec 31, 2026').should('be.visible');
  });

  // TEST 7
  it('should be able to edit a season', () => {
    cy.visit('/admin/season-management');
    // Find the row with SEASON_NAME and open kebab menu to edit
    cy.contains('[data-cy="season-name"]', SEASON_NAME).parents('tr').first().within(() => {
      cy.get('[data-cy="season-kebab-btn"]').click();
      cy.get('[data-cy="kebab-update"]').click();
    });
    cy.get('#edit-season-name').clear().type(SEASON_NAME_UPDATED);
    cy.contains('button', 'Save Changes').click();
    cy.get('.modal-overlay').should('not.exist');
    cy.contains('.season-name', SEASON_NAME_UPDATED).should('be.visible');
  });

  // TEST 8
  it('created season appears in tournament creation dropdown', () => {
    cy.visit(WIZARD_URL);
    // The wizard only shows the season select for ACTIVE seasons.
    // The test season was created as inactive, so the no-season-notice is shown.
    cy.get('.creation-page').should('be.visible');
    cy.get('.no-season-notice').should('be.visible');
    cy.go('back');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// FLOW 2 — TOURNAMENT CREATION
// ═════════════════════════════════════════════════════════════════════════════

describe('Flow 2 — Tournament Creation', () => {

  beforeEach(() => {
    cy.login();
  });

  // TEST 9
  it('should load Basic Info step correctly', () => {
    cy.visit(WIZARD_URL);
    cy.get('.stepper').should('exist');
    cy.contains('General Details').should('be.visible');
    cy.get('input[formControlName="tournamentName"]').should('be.visible');
    cy.get('input[formControlName="startDate"]').should('be.visible');
    // Single Elimination selected by default
    cy.get('.format-card.format-card-selected').should('be.visible');
  });

  // TEST 10
  it('should validate required fields on Step 1', () => {
    cy.visit(WIZARD_URL);
    cy.contains('button', 'Next Step').click();
    cy.get('.field-error').should('have.length.at.least', 1);
  });

  // TEST 11
  it('should complete Step 1 with season selected', () => {
    cy.visit(WIZARD_URL);

    cy.get('input[formControlName="tournamentName"]').type(TOURNAMENT_NAME);
    cy.get('input[formControlName="startDate"]').type('2026-03-01');
    cy.get('input[formControlName="location"]').type('Test Venue Hall A');

    // Test season is inactive so the wizard shows no-season-notice — skip season selection
    cy.get('.no-season-notice').should('be.visible');

    // Select Round Robin format card
    cy.contains('.format-card', 'Round Robin').click();
    cy.contains('.format-card', 'Round Robin').should('have.class', 'format-card-selected');

    cy.get('input[formControlName="maxPlayers"]').clear().type('16');
    cy.contains('button', 'Next Step').click();

    // Should be on step 2
    cy.contains('Registration Setup').should('be.visible');
  });

  // TEST 12
  it('should load Registration Setup correctly', () => {
    cy.visit(WIZARD_URL);
    // Navigate to step 2
    cy.get('input[formControlName="tournamentName"]').type(TOURNAMENT_NAME);
    cy.get('input[formControlName="startDate"]').type('2026-03-01');
    cy.get('input[formControlName="maxPlayers"]').clear().type('16');
    cy.contains('button', 'Next Step').click();

    cy.contains('Automatic Start').should('be.visible');
    cy.contains('Manual Start').should('be.visible');
    cy.get('.toggle-row').should('exist');
  });

  // TEST 13
  it('should block advance without deadline in AUTOMATIC mode', () => {
    cy.visit(WIZARD_URL);
    cy.get('input[formControlName="tournamentName"]').type(TOURNAMENT_NAME);
    cy.get('input[formControlName="startDate"]').type('2026-03-01');
    cy.get('input[formControlName="maxPlayers"]').clear().type('16');
    cy.contains('button', 'Next Step').click();

    cy.contains('.reg-mode-card', 'Automatic Start').click();
    cy.contains('button', 'Next Step').click();

    // Should show validation error and remain on step 2
    cy.get('.field-error').should('be.visible');
    // Step 3 textarea should not be visible (didn't advance)
    cy.get('textarea[formControlName="generalRules"]').should('not.exist');
  });

  // TEST 14
  it('should complete Step 2 with MANUAL mode', () => {
    cy.visit(WIZARD_URL);
    cy.get('input[formControlName="tournamentName"]').type(TOURNAMENT_NAME);
    cy.get('input[formControlName="startDate"]').type('2026-03-01');
    cy.get('input[formControlName="maxPlayers"]').clear().type('16');
    cy.contains('button', 'Next Step').click();

    cy.contains('.reg-mode-card', 'Manual Start').click();
    cy.contains('button', 'Next Step').click();

    cy.contains('Tournament Rules').should('be.visible');
    cy.get('textarea[formControlName="generalRules"]').should('be.visible');
  });

  // TEST 15
  it('should load Rules & Rewards step correctly', () => {
    cy.visit(WIZARD_URL);
    cy.get('input[formControlName="tournamentName"]').type(TOURNAMENT_NAME);
    cy.get('input[formControlName="startDate"]').type('2026-03-01');
    cy.get('input[formControlName="maxPlayers"]').clear().type('16');
    cy.contains('button', 'Next Step').click();
    cy.contains('.reg-mode-card', 'Manual Start').click();
    cy.contains('button', 'Next Step').click();

    cy.get('textarea[formControlName="generalRules"]').should('be.visible');
    cy.get('.toggle-row').should('exist');
    cy.contains('Prize Structure').should('be.visible');
    cy.contains('button', 'Add Reward').should('be.visible');
  });

  // TEST 16
  it('should add a POSITION award tier', () => {
    cy.visit(WIZARD_URL);
    cy.get('input[formControlName="tournamentName"]').type(TOURNAMENT_NAME);
    cy.get('input[formControlName="startDate"]').type('2026-03-01');
    cy.get('input[formControlName="maxPlayers"]').clear().type('16');
    cy.contains('button', 'Next Step').click();
    cy.contains('.reg-mode-card', 'Manual Start').click();
    cy.contains('button', 'Next Step').click();

    cy.contains('button', 'Add Reward').click();
    cy.get('select[formControlName="tierType"]').select('POSITION');
    cy.get('input[formControlName="position"]').type('1');
    cy.get('input[formControlName="points"]').clear().type('500');
    cy.get('input[formControlName="label"]').type('Champion');
    cy.contains('button', 'Save Tier').click();

    cy.contains('.tier-row', 'Champion').should('be.visible');
    cy.contains('.tier-row', '500 Pts').should('be.visible');
    cy.contains('.tier-row', '1st Place').should('be.visible');
  });

  // TEST 17
  it('should add a second POSITION tier', () => {
    cy.visit(WIZARD_URL);
    cy.get('input[formControlName="tournamentName"]').type(TOURNAMENT_NAME);
    cy.get('input[formControlName="startDate"]').type('2026-03-01');
    cy.get('input[formControlName="maxPlayers"]').clear().type('16');
    cy.contains('button', 'Next Step').click();
    cy.contains('.reg-mode-card', 'Manual Start').click();
    cy.contains('button', 'Next Step').click();

    cy.contains('button', 'Add Reward').click();
    cy.get('select[formControlName="tierType"]').select('POSITION');
    cy.get('input[formControlName="position"]').type('2');
    cy.get('input[formControlName="points"]').clear().type('250');
    cy.get('input[formControlName="label"]').type('Runner Up');
    cy.contains('button', 'Save Tier').click();

    cy.contains('.tier-row', 'Runner Up').should('be.visible');
    cy.contains('.tier-row', '250 Pts').should('be.visible');
    cy.contains('.tier-row', '2nd Place').should('be.visible');
  });

  // TEST 18
  it('should add ALL_PARTICIPANTS tier', () => {
    cy.visit(WIZARD_URL);
    cy.get('input[formControlName="tournamentName"]').type(TOURNAMENT_NAME);
    cy.get('input[formControlName="startDate"]').type('2026-03-01');
    cy.get('input[formControlName="maxPlayers"]').clear().type('16');
    cy.contains('button', 'Next Step').click();
    cy.contains('.reg-mode-card', 'Manual Start').click();
    cy.contains('button', 'Next Step').click();

    cy.contains('button', 'Add Reward').click();
    cy.get('select[formControlName="tierType"]').select('ALL_PARTICIPANTS');
    cy.get('input[formControlName="points"]').clear().type('50');
    cy.get('input[formControlName="label"]').type('Participation');
    cy.contains('button', 'Save Tier').click();

    cy.contains('.tier-row', 'Participation').should('be.visible');
    cy.contains('.tier-row', '50 Pts').should('be.visible');
  });

  // TEST 19
  it('should validate POSITION tier missing position field', () => {
    cy.visit(WIZARD_URL);
    cy.get('input[formControlName="tournamentName"]').type(TOURNAMENT_NAME);
    cy.get('input[formControlName="startDate"]').type('2026-03-01');
    cy.get('input[formControlName="maxPlayers"]').clear().type('16');
    cy.contains('button', 'Next Step').click();
    cy.contains('.reg-mode-card', 'Manual Start').click();
    cy.contains('button', 'Next Step').click();

    cy.contains('button', 'Add Reward').click();
    cy.get('select[formControlName="tierType"]').select('POSITION');
    // Leave position empty
    cy.get('input[formControlName="points"]').clear().type('100');
    cy.contains('button', 'Save Tier').click();

    cy.get('.field-error').should('be.visible');
    cy.get('.add-tier-panel').should('be.visible'); // panel still open
  });

  // TEST 20 — Full step 3 flow with delete
  it('should complete Step 3 and verify tier delete works', () => {
    cy.visit(WIZARD_URL);
    cy.get('input[formControlName="tournamentName"]').type(TOURNAMENT_NAME);
    cy.get('input[formControlName="startDate"]').type('2026-03-01');
    cy.get('input[formControlName="location"]').type('Test Venue Hall A');
    // No season selection — test season is inactive
    cy.contains('.format-card', 'Round Robin').click();
    cy.get('input[formControlName="maxPlayers"]').clear().type('16');
    cy.contains('button', 'Next Step').click();

    cy.contains('.reg-mode-card', 'Manual Start').click();
    cy.contains('button', 'Next Step').click();

    // Add Participation tier (on top of 2 default tiers)
    cy.contains('button', 'Add Reward').click();
    cy.get('select[formControlName="tierType"]').select('ALL_PARTICIPANTS');
    cy.get('input[formControlName="points"]').clear().type('50');
    cy.get('input[formControlName="label"]').type('Participation');
    cy.contains('button', 'Save Tier').click();
    cy.contains('.tier-row', 'Participation').should('be.visible');

    // Delete the Participation tier
    cy.contains('.tier-row', 'Participation').within(() => {
      cy.get('.tier-action-delete').click();
    });
    cy.contains('.tier-row', 'Participation').should('not.exist');

    // Fill rules and advance to review
    cy.get('textarea[formControlName="generalRules"]')
      .type('Best of 5 sets. 11 points per set. Standard ITTF rules apply.');
    cy.contains('button', 'Next Step').click();

    cy.contains('Review Summary').should('be.visible');
  });

  // TEST 21 — Review shows correct data
  it('should display complete review summary', () => {
    cy.visit(WIZARD_URL);
    cy.get('input[formControlName="tournamentName"]').type(TOURNAMENT_NAME);
    cy.get('input[formControlName="startDate"]').type('2026-03-01');
    cy.get('input[formControlName="location"]').type('Test Venue Hall A');
    // No season selection — test season is inactive
    cy.contains('.format-card', 'Round Robin').click();
    cy.get('input[formControlName="maxPlayers"]').clear().type('16');
    cy.contains('button', 'Next Step').click();

    cy.contains('.reg-mode-card', 'Manual Start').click();
    cy.contains('button', 'Next Step').click();

    cy.get('textarea[formControlName="generalRules"]')
      .type('Best of 5 sets. Standard ITTF rules apply.');
    cy.contains('button', 'Next Step').click();

    // Review assertions
    cy.contains(TOURNAMENT_NAME).should('be.visible');
    cy.contains('Test Venue Hall A').should('be.visible');
    cy.contains('Round Robin').should('be.visible');
    cy.contains('Manual').should('be.visible');
  });

  // TEST 22 — Edit navigates back with data preserved
  it('should navigate back to step 1 when Edit clicked and preserve data', () => {
    cy.visit(WIZARD_URL);
    cy.get('input[formControlName="tournamentName"]').type(TOURNAMENT_NAME);
    cy.get('input[formControlName="startDate"]').type('2026-03-01');
    cy.contains('.format-card', 'Round Robin').click();
    cy.get('input[formControlName="maxPlayers"]').clear().type('16');
    cy.contains('button', 'Next Step').click();
    cy.contains('.reg-mode-card', 'Manual Start').click();
    cy.contains('button', 'Next Step').click();
    cy.contains('button', 'Next Step').click();

    // On review — click Edit on Basic Info
    cy.contains('button', 'Edit').first().click();

    // Back on step 1 with data intact
    cy.get('input[formControlName="tournamentName"]').should('have.value', TOURNAMENT_NAME);
    cy.contains('.format-card', 'Round Robin').should('have.class', 'format-card-selected');
  });

  // TEST 23 — Full end-to-end create tournament
  it('should successfully create the tournament and navigate to detail', () => {
    cy.visit(WIZARD_URL);

    // Step 1
    cy.get('input[formControlName="tournamentName"]').type(TOURNAMENT_NAME);
    cy.get('input[formControlName="startDate"]').type('2026-03-01');
    cy.get('input[formControlName="location"]').type('Test Venue Hall A');
    // No season selection — test season is inactive
    cy.contains('.format-card', 'Round Robin').click();
    cy.get('input[formControlName="maxPlayers"]').clear().type('16');
    cy.contains('button', 'Next Step').click();

    // Step 2
    cy.contains('.reg-mode-card', 'Manual Start').click();
    cy.contains('button', 'Next Step').click();

    // Step 3 — add Champion tier (in addition to defaults)
    cy.contains('button', 'Add Reward').click();
    cy.get('select[formControlName="tierType"]').select('POSITION');
    cy.get('input[formControlName="position"]').type('1');
    cy.get('input[formControlName="points"]').clear().type('500');
    cy.get('input[formControlName="label"]').type('Champion');
    cy.contains('button', 'Save Tier').click();

    cy.get('textarea[formControlName="generalRules"]')
      .type('Best of 5 sets. Standard ITTF rules apply.');
    cy.contains('button', 'Next Step').click();

    // Review step — click Create Tournament
    cy.contains('button', 'Create Tournament').click();

    // Assert navigation to tournament detail (with generous timeout for API calls)
    cy.url({ timeout: 30000 }).should('match', /\/admin\/tournaments\/\d+/);
    cy.contains(TOURNAMENT_NAME).should('be.visible');

    // Store tournament ID
    cy.url().then(url => {
      const match = url.match(/\/tournaments\/(\d+)/);
      if (match) tournamentId = parseInt(match[1], 10);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// FLOW 3 — AWARD TIER VERIFICATION
// ═════════════════════════════════════════════════════════════════════════════

describe('Flow 3 — Award Tier Verification', () => {

  beforeEach(() => {
    cy.login();
  });

  // TEST 24 — Awards tab on detail page
  it('should show award tiers saved during creation', () => {
    cy.request({
      method: 'GET',
      url: `${API}/tournaments/`,
      headers: { Authorization: `Bearer ${Cypress.env('authToken') ?? accessToken}` },
    }).then(resp => {
      const results = resp.body.results ?? resp.body;
      const t = results.find((x: { name: string }) => x.name === TOURNAMENT_NAME);
      if (t) tournamentId = t.id;
    }).then(() => {
      cy.visit(`/admin/tournaments/${tournamentId}`);

      // Find and click the Awards tab
      cy.contains('button.tab-btn', 'Awards').click();

      // Champion tier from wizard defaults
      cy.contains('.tier-row', 'Champion').should('be.visible');
      cy.contains('.tier-row', '500').should('be.visible');
      cy.contains('.tier-row', '1st Place').should('be.visible');
    });
  });

  // TEST 25 — Add tier from awards tab
  it('should add a new award tier from the Awards tab', () => {
    cy.request({
      method: 'GET',
      url: `${API}/tournaments/`,
      headers: { Authorization: `Bearer ${Cypress.env('authToken') ?? accessToken}` },
    }).then(resp => {
      const results = resp.body.results ?? resp.body;
      const t = results.find((x: { name: string }) => x.name === TOURNAMENT_NAME);
      if (t) tournamentId = t.id;
    }).then(() => {
      cy.visit(`/admin/tournaments/${tournamentId}`);
      cy.contains('button.tab-btn', 'Awards').click();

      // Add 3rd Place via Awards tab
      cy.contains('button', 'Add Tier').click();
      cy.get('select[formControlName="tierType"]').select('POSITION');
      cy.get('input[formControlName="position"]').type('3');
      cy.get('input[formControlName="points"]').clear().type('100');
      cy.get('input[formControlName="label"]').type('3rd Place');
      cy.contains('button', 'Save Tier').click();

      cy.contains('.tier-row', '3rd Place').should('be.visible');
      cy.contains('.tier-row', '100 Pts').should('be.visible');
    });
  });

  // TEST 26 — Delete a tier from awards tab
  it('should delete a tier from the Awards tab', () => {
    cy.request({
      method: 'GET',
      url: `${API}/tournaments/`,
      headers: { Authorization: `Bearer ${Cypress.env('authToken') ?? accessToken}` },
    }).then(resp => {
      const results = resp.body.results ?? resp.body;
      const t = results.find((x: { name: string }) => x.name === TOURNAMENT_NAME);
      if (t) tournamentId = t.id;
    }).then(() => {
      cy.visit(`/admin/tournaments/${tournamentId}`);
      cy.contains('button.tab-btn', 'Awards').click();

      // Wait for tiers to load
      cy.get('.tier-row').should('have.length.at.least', 1);

      // Count tiers before
      cy.get('.tier-row').then($rows => {
        const countBefore = $rows.length;
        // Delete the last tier
        cy.get('.tier-row').last().within(() => {
          cy.get('.tier-action-delete').click();
        });
        cy.get('.tier-row', { timeout: 10000 }).should('have.length', countBefore - 1);
      });
    });
  });
});
