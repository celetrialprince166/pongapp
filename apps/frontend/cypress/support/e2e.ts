import './commands';

// Silence uncaught Angular errors that don't affect test outcomes
Cypress.on('uncaught:exception', (err) => {
  if (
    err.message.includes('ResizeObserver') ||
    err.message.includes('ExpressionChanged') ||
    err.message.includes('NG0') ||
    err.message.includes('hydration')
  ) {
    return false;
  }
});
