/**
 * 01-auth / admin-login.cy.ts
 * Tests: admin login flow, route guard, dashboard access
 */

const API = Cypress.env('apiUrl');

describe('Admin Login', () => {

  it('should display the login form', () => {
    cy.visit('/login');
    cy.getByDataCy('login-username-input').should('be.visible');
    cy.getByDataCy('login-password-input').should('be.visible');
    cy.getByDataCy('login-submit-btn').should('be.visible');
  });

  it('should show error for invalid credentials', () => {
    cy.visit('/login');
    cy.getByDataCy('login-username-input').type('notauser');
    cy.getByDataCy('login-password-input').type('wrongpassword');
    cy.getByDataCy('login-submit-btn').click();
    cy.getByDataCy('login-error-msg').should('be.visible');
  });

  it('should redirect to login when accessing admin route unauthenticated', () => {
    cy.visit('/admin/dashboard');
    cy.url().should('include', '/login');
  });

  it('should log in as admin and reach the dashboard', () => {
    cy.visit('/login');
    cy.getByDataCy('login-username-input').type(Cypress.env('adminUsername'));
    cy.getByDataCy('login-password-input').type(Cypress.env('adminPassword'));
    cy.getByDataCy('login-submit-btn').click();
    cy.url({ timeout: 10000 }).should('include', '/admin/dashboard');
    cy.getByDataCy('dashboard-page').should('be.visible');
  });

  it('should show admin dashboard stats after login', () => {
    cy.loginAsAdmin();
    cy.visit('/admin/dashboard');
    cy.getByDataCy('dashboard-page').should('be.visible');
    cy.getByDataCy('stat-active-seasons').should('be.visible');
    cy.getByDataCy('stat-tournaments').should('be.visible');
    cy.getByDataCy('stat-players').should('be.visible');
  });

  it('should show link to signup page on login form', () => {
    cy.visit('/login');
    cy.getByDataCy('signup-link').should('be.visible').and('have.attr', 'href', '/signup');
  });

  it('should redirect to login after logout', () => {
    cy.loginAsAdmin();
    cy.visit('/admin/dashboard');
    cy.logout();
    cy.url().should('include', '/login');
    cy.visit('/admin/dashboard');
    cy.url().should('include', '/login');
  });
});

export {};
