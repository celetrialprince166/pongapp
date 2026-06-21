describe('User Management', () => {
  // Unique suffix per spec run prevents email collisions across separate runs
  const ts = Date.now();

  beforeEach(() => {
    cy.resetDb();
    cy.loginAsAdmin();
    cy.visit('/admin/user-management');
  });

  // ─── User Creation ───────────────────────────────────────────────

  it('creates a new player with auto-generated username', () => {
    cy.get('[data-cy="add-user-btn"]').click();

    // Modal opens with correct layout
    cy.get('[data-cy="user-modal"]').should('be.visible');
    cy.get('[data-cy="modal-title"]')
      .should('be.visible')
      .and('contain', 'Add New User');
    cy.get('[data-cy="modal-subtitle"]')
      .should('be.visible')
      .and('contain', 'auto-generated');

    // Fill form
    cy.get('[data-cy="input-first-name"]').type('Cypress');
    cy.get('[data-cy="input-last-name"]').type('Player');
    cy.get('[data-cy="input-email"]').type(`cypress.player.${ts}@test.com`);
    cy.get('[data-cy="select-role"]').select('PLAYER');

    // Submit
    cy.get('[data-cy="btn-create-user"]').click();

    // User appears in list
    cy.get('[data-cy="user-list"]').should('contain', 'CypressPlayer');
  });

  it('auto-increments username on collision', () => {
    // Create first user via API then reload (loginAsAdmin + visit) so the
    // component loads with CollisionTest already in the DB — the same pattern
    // used by the pagination test.
    cy.createUserViaApi('Collision', 'Test', `collision1.${ts}@test.com`, 'PLAYER');
    cy.loginAsAdmin();
    cy.visit('/admin/user-management');

    // Create second user with the same first/last name via the form
    cy.get('[data-cy="add-user-btn"]').click();
    cy.get('[data-cy="input-first-name"]').type('Collision');
    cy.get('[data-cy="input-last-name"]').type('Test');
    cy.get('[data-cy="input-email"]').type(`collision2.${ts}@test.com`);
    cy.get('[data-cy="btn-create-user"]').click();

    cy.get('[data-cy="user-list"]').should('contain', 'CollisionTest1');
  });

  it('shows validation error for duplicate email', () => {
    cy.createUserViaApi('Dupe', 'Email', `dupe.${ts}@test.com`, 'PLAYER');

    cy.get('[data-cy="add-user-btn"]').click();
    cy.get('[data-cy="input-first-name"]').type('Another');
    cy.get('[data-cy="input-last-name"]').type('User');
    cy.get('[data-cy="input-email"]').type(`dupe.${ts}@test.com`);
    cy.get('[data-cy="btn-create-user"]').click();

    cy.get('[data-cy="error-email"]')
      .should('be.visible')
      .and('contain', 'already exists');
  });

  it('creates an admin user with correct role badge', () => {
    cy.get('[data-cy="add-user-btn"]').click();
    cy.get('[data-cy="input-first-name"]').type('Admin');
    cy.get('[data-cy="input-last-name"]').type('User');
    cy.get('[data-cy="input-email"]').type(`adminuser.${ts}@test.com`);
    cy.get('[data-cy="select-role"]').select('ADMIN');
    cy.get('[data-cy="btn-create-user"]').click();

    cy.get('[data-cy="user-list"]')
      .contains('AdminUser')
      .closest('[data-cy="user-row"]')
      .find('[data-cy="role-badge"]')
      .should('contain', 'Admin');
  });

  // ─── Pagination ───────────────────────────────────────────────────

  it('paginates user list correctly', () => {
    // Create 12 extra users to trigger pagination (need >10 total)
    for (let i = 0; i < 12; i++) {
      cy.createUserViaApi(`Paging${i}`, 'User', `paging${i}.${ts}@test.com`, 'PLAYER');
    }
    cy.loginAsAdmin();
    cy.visit('/admin/user-management');

    // Page 1
    cy.get('[data-cy="pagination-info"]').should('contain', 'Showing 1 to 10');
    cy.get('[data-cy="page-btn-next"]').should('not.be.disabled');

    // Go to page 2
    cy.get('[data-cy="page-btn-next"]').click();
    cy.get('[data-cy="pagination-info"]').should('contain', 'Showing 11 to');

    // Prev button
    cy.get('[data-cy="page-btn-prev"]').click();
    cy.get('[data-cy="pagination-info"]').should('contain', 'Showing 1 to 10');

    // Prev disabled on page 1
    cy.get('[data-cy="page-btn-prev"]').should('be.disabled');
  });

  // ─── Role Management ──────────────────────────────────────────────

  it('updates user role', () => {
    cy.createUserViaApi('Role', 'Change', `rolechange.${ts}@test.com`, 'PLAYER');
    cy.loginAsAdmin();
    cy.visit('/admin/user-management');

    cy.get('[data-cy="user-list"]')
      .contains('RoleChange')
      .closest('[data-cy="user-row"]')
      .find('[data-cy="btn-edit-role"]')
      .click();

    cy.get('[data-cy="role-select"]').select('MODERATOR');
    cy.get('[data-cy="btn-update-role"]').click();

    cy.get('[data-cy="user-list"]')
      .contains('RoleChange')
      .closest('[data-cy="user-row"]')
      .find('[data-cy="role-badge"]')
      .should('contain', 'Moderator');
  });

  // ─── User Actions ─────────────────────────────────────────────────

  it('deactivates and reactivates a user', () => {
    cy.createUserViaApi('Toggle', 'User', `toggle.${ts}@test.com`, 'PLAYER');
    cy.loginAsAdmin();
    cy.visit('/admin/user-management');

    // Deactivate
    cy.get('[data-cy="user-list"]')
      .contains('ToggleUser')
      .closest('[data-cy="user-row"]')
      .find('[data-cy="btn-toggle-status"]')
      .click();

    cy.get('[data-cy="deactivation-reason"]').type('Test deactivation');
    cy.get('[data-cy="btn-confirm-status"]').click();

    cy.get('[data-cy="user-list"]')
      .contains('ToggleUser')
      .closest('[data-cy="user-row"]')
      .find('[data-cy="status-label"]')
      .should('contain', 'Inactive');

    // Reactivate
    cy.get('[data-cy="user-list"]')
      .contains('ToggleUser')
      .closest('[data-cy="user-row"]')
      .find('[data-cy="btn-toggle-status"]')
      .click();

    cy.get('[data-cy="btn-confirm-status"]').click();

    cy.get('[data-cy="user-list"]')
      .contains('ToggleUser')
      .closest('[data-cy="user-row"]')
      .find('[data-cy="status-label"]')
      .should('contain', 'Active');
  });

  it('deletes a user with confirmation', () => {
    cy.createUserViaApi('Delete', 'Me', `deleteme.${ts}@test.com`, 'PLAYER');
    cy.loginAsAdmin();
    cy.visit('/admin/user-management');

    cy.get('[data-cy="user-list"]')
      .contains('DeleteMe')
      .closest('[data-cy="user-row"]')
      .find('[data-cy="btn-delete"]')
      .click();

    cy.get('[data-cy="btn-confirm-delete"]').click();

    cy.get('[data-cy="user-list"]').should('not.contain', 'DeleteMe');
  });
});
