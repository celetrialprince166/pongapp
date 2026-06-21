/**
 * 01-auth / player-signup-login.cy.ts
 * Tests: player signup form validation, login, and route access
 */

describe('Player Signup & Login', () => {

  it('should display the signup form', () => {
    cy.visit('/signup');
    cy.getByDataCy('signup-username-input').should('be.visible');
    cy.getByDataCy('signup-email-input').should('be.visible');
    cy.getByDataCy('signup-password-input').should('be.visible');
    cy.getByDataCy('signup-submit-btn').should('be.visible');
  });

  it('should show validation error for short username', () => {
    cy.visit('/signup');
    cy.getByDataCy('signup-username-input').type('ab').blur();
    cy.contains('at least 3 characters').should('be.visible');
  });

  it('should show validation error for invalid email', () => {
    cy.visit('/signup');
    cy.getByDataCy('signup-email-input').type('notanemail').blur();
    cy.contains('valid email').should('be.visible');
  });

  it('should show link to login page on signup form', () => {
    cy.visit('/signup');
    cy.getByDataCy('login-link').should('be.visible').and('have.attr', 'href', '/login');
  });

  it('should log in as a test player and access tournament list', () => {
    cy.loginAsPlayer();
    cy.visit('/tournaments');
    cy.getByDataCy('tournament-list-page').should('be.visible');
  });

  it('should redirect player away from admin routes', () => {
    cy.loginAsPlayer();
    cy.visit('/admin/dashboard');
    // Should be redirected (either to /login or /tournaments)
    cy.url().should('not.include', '/admin/dashboard');
  });

  it('player login via UI should reach tournaments page', () => {
    cy.visit('/login');
    cy.getByDataCy('login-username-input').type(Cypress.env('playerUsername'));
    cy.getByDataCy('login-password-input').type(Cypress.env('playerPassword'));
    cy.getByDataCy('login-submit-btn').click();
    // Players land on tournaments or dashboard
    cy.url({ timeout: 10000 }).should('satisfy', (url: string) =>
      url.includes('/tournaments') || url.includes('/dashboard')
    );
  });
});

export {};
