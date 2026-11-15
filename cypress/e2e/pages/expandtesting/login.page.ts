/// <reference types="cypress" />

const locators = {
  username: "#username",
  password: "#password",
  submit: "#submit-login",
};

const validCredentials = {
  username: "practice",
  password: "SuperSecretPassword!",
};

class ExpandTestingLogin {
  assertLoginPage(): Cypress.Chainable {
    return cy
      .url()
      .should("include", "/login")
      .then(() =>
        cy
          .contains("h1", "Test Login page for Automation Testing Practice")
          .should("be.visible"),
      )
      .then(() => cy.get(locators.username).should("be.visible"))
      .then(() => cy.get(locators.password).should("be.visible"));
  }

  login(username: string, password: string): Cypress.Chainable {
    return cy
      .fillInput(locators.username, username)
      .then(() => cy.fillInput(locators.password, password))
      .then(() => cy.push(locators.submit));
  }

  loginWithValidCredentials(): Cypress.Chainable {
    return this.login(validCredentials.username, validCredentials.password);
  }

  assertSecureArea(): Cypress.Chainable {
    return cy
      .url()
      .should("include", "/secure")
      .then(() =>
        cy.contains("You logged into a secure area!").should("be.visible"),
      )
      .then(() => cy.contains("a", "Logout").should("be.visible"));
  }

  assertLoginError(message: string): Cypress.Chainable {
    return cy.contains(message).should("be.visible");
  }
}

export default new ExpandTestingLogin();
