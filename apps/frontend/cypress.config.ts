import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1440,
    viewportHeight: 900,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    env: {
      apiUrl: 'http://127.0.0.1:8080/api',
      adminUsername: 'testadmin',
      adminPassword: 'AdminPass123!',
      playerUsername: 'testplayer1',
      playerPassword: 'testpass123',
    },
  },
});
