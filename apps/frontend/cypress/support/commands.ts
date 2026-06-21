/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      // Legacy
      login(): Chainable<any>;
      apiDelete(url: string): Chainable<void>;
      // New
      resetDb(): Chainable<void>;
      loginAsAdmin(): Chainable<void>;
      loginAsPlayer(username?: string, password?: string): Chainable<void>;
      loginAs(username: string, password: string): Chainable<void>;
      logout(): Chainable<void>;
      waitForApi(): Chainable<void>;
      getByDataCy(selector: string): Chainable<JQuery<HTMLElement>>;
      getAuthHeader(): Chainable<{ Authorization: string }>;
      createUserViaApi(
        firstName: string,
        lastName: string,
        email: string,
        role: string,
      ): Chainable<void>;
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function storeTokens(body: any) {
  // Support both { tokens: { access, refresh }, user } and { access, refresh, user }
  const access = body?.tokens?.access ?? body?.access ?? '';
  const refresh = body?.tokens?.refresh ?? body?.refresh ?? '';
  const user = body?.user ?? {};
  // Store in Cypress.env for use in API calls that happen before cy.visit
  Cypress.env('authToken', access);
  Cypress.env('authRefreshToken', refresh);
  Cypress.env('authUser', JSON.stringify(user));
}

// ─── Inject sessionStorage into the AUT before each page load ─────────────────
// This runs before every cy.visit so Angular's AuthService can read the tokens.

Cypress.on('window:before:load', (win) => {
  const access = Cypress.env('authToken');
  if (access) {
    win.sessionStorage.setItem('access_token', access);
    win.sessionStorage.setItem('refresh_token', Cypress.env('authRefreshToken') ?? '');
    const user = Cypress.env('authUser');
    if (user) {
      win.sessionStorage.setItem('current_user', user);
    }
  }
});

// ─── Legacy: cy.login() ───────────────────────────────────────────────────────

Cypress.Commands.add('login', () => {
  return cy.fixture('auth').then(({ username, password }) => {
    return cy.request({
      method: 'POST',
      url: `${Cypress.env('apiUrl')}/auth/login/`,
      body: { username, password },
    }).then(response => {
      storeTokens(response.body);
      const access = response.body?.tokens?.access ?? response.body?.access ?? '';
      return cy.wrap(access);
    });
  });
});

// ─── Legacy: cy.apiDelete() ───────────────────────────────────────────────────

Cypress.Commands.add('apiDelete', (url: string) => {
  const token = Cypress.env('authToken') ?? '';
  cy.request({
    method: 'DELETE',
    url: `${Cypress.env('apiUrl')}${url}`,
    headers: { Authorization: `Bearer ${token}` },
    failOnStatusCode: false,
  }).then(resp => {
    if (resp.status >= 400 && resp.status !== 404 && resp.status !== 405) {
      cy.log(`⚠️ Cleanup DELETE ${url} returned ${resp.status}`);
    }
  });
});

// ─── resetDb ──────────────────────────────────────────────────────────────────

Cypress.Commands.add('resetDb', () => {
  cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/test/reset-db/`,
    failOnStatusCode: false,
  }).then((response) => {
    if (response.status !== 200) {
      cy.log(`⚠️ resetDb returned ${response.status}: ${JSON.stringify(response.body)}`);
    }
  });
});

// ─── loginAsAdmin ─────────────────────────────────────────────────────────────

Cypress.Commands.add('loginAsAdmin', () => {
  cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/auth/login/`,
    body: {
      username: Cypress.env('adminUsername'),
      password: Cypress.env('adminPassword'),
    },
  }).then((response) => {
    storeTokens(response.body);
  });
});

// ─── loginAsPlayer ────────────────────────────────────────────────────────────

Cypress.Commands.add('loginAsPlayer',
  (
    username = Cypress.env('playerUsername'),
    password = Cypress.env('playerPassword'),
  ) => {
    cy.request({
      method: 'POST',
      url: `${Cypress.env('apiUrl')}/auth/login/`,
      body: { username, password },
    }).then((response) => {
      storeTokens(response.body);
    });
  }
);

// ─── loginAs ──────────────────────────────────────────────────────────────────

Cypress.Commands.add('loginAs', (username: string, password: string) => {
  cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/auth/login/`,
    body: { username, password },
  }).then((response) => {
    storeTokens(response.body);
  });
});

// ─── logout ───────────────────────────────────────────────────────────────────

Cypress.Commands.add('logout', () => {
  Cypress.env('authToken', null);
  Cypress.env('authRefreshToken', null);
  Cypress.env('authUser', null);
  cy.window().then((win) => {
    win.sessionStorage.clear();
  });
  cy.visit('/login');
});

// ─── waitForApi ───────────────────────────────────────────────────────────────

Cypress.Commands.add('waitForApi', () => {
  cy.wait(600);
});

// ─── getByDataCy ──────────────────────────────────────────────────────────────

Cypress.Commands.add('getByDataCy', (selector: string) => {
  return cy.get(`[data-cy="${selector}"]`);
});

// ─── getAuthHeader ────────────────────────────────────────────────────────────

Cypress.Commands.add('getAuthHeader', () => {
  const token = Cypress.env('authToken') ?? '';
  return cy.wrap({ Authorization: `Bearer ${token}` });
});

// ─── createUserViaApi ─────────────────────────────────────────────────────────

Cypress.Commands.add('createUserViaApi', (
  firstName: string,
  lastName: string,
  email: string,
  role: string,
) => {
  const token = Cypress.env('authToken') ?? '';
  cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/users/`,
    headers: { Authorization: `Bearer ${token}` },
    body: { first_name: firstName, last_name: lastName, email, role },
    failOnStatusCode: false,
  }).then((resp) => {
    if (resp.status !== 201) {
      cy.log(`createUserViaApi: ${resp.status} — ${JSON.stringify(resp.body)}`);
    }
  });
});

export {};
