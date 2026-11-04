/// <reference types="cypress" />
import type { DataTable } from "@badeball/cypress-cucumber-preprocessor";

type LoginRow = Cypress.LoginRow;

// Localisateurs
const pageLocators = {
  usernameInput: `input[name="username"]`,
  passwordInput: `input[name="password"]`,
  signInButton: `button[type="submit"]`,
  errorMessageLogin: `.oxd-alert-content-text`,
};

// Variables
const pageVariables = {
  messageErrorlogin: `Invalid credentials`,
};

// Page object dédié aux scénarios de connexion pilotés par différentes sources de données.
class DataDriven {
  // Exécute les tentatives séquentiellement afin d'attendre le rerender de la page
  // après chaque soumission d'identifiants invalides.
  private loginRows(rows: LoginRow[]): Cypress.Chainable<LoginRow[]> {
    // La chaîne initiale permet d'ajouter chaque tentative dans l'ordre.
    let chain: Cypress.Chainable = cy.wrap(null);

    for (const row of rows) {
      chain = chain.then(() => {
        // Chaque tentative attend le message d'erreur avant de poursuivre.
        return cy
          .fillInput(pageLocators.usernameInput, row.username)
          .then(() => cy.fillInput(pageLocators.passwordInput, row.password))
          .then(() => cy.push(pageLocators.signInButton))
          .then(() =>
            cy.textCompare(
              pageLocators.errorMessageLogin,
              pageVariables.messageErrorlogin,
            ),
          );
      });
    }

    return chain.then(() => rows);
  }

  // Lit la feuille demandée du classeur Excel, puis teste chaque ligne d'identifiants.
  xlsxLogin(
    fileName: string,
    sheetName: string,
  ): Cypress.Chainable<LoginRow[]> {
    return cy
      .readExcel(fileName, sheetName)
      // Le parsing est effectué par cy.readExcel avant les tentatives de connexion.
      .then((user) => this.loginRows(user));
  }

  // Charge la fixture JSON et teste chaque ligne du tableau "user".
  jsonLogin(fileName: string): Cypress.Chainable<{ user: LoginRow[] }> {
    return cy
      .fixture<{ user: LoginRow[] }>(`json/${fileName}.json`)
      // La fixture contient les identifiants sous la propriété "user".
      .then(({ user }) => this.loginRows(user))
      .then((user) => ({ user }));
  }

  // Soumet une paire d'identifiants fournie directement par une DataTable.
  loginWithTable(username: string, password: string): Cypress.Chainable {
    // Le message d'erreur confirme que la soumission invalide est bien traitée.
    return cy
      .fillInput(pageLocators.usernameInput, username)
      .then(() => cy.fillInput(pageLocators.passwordInput, password))
      .then(() => cy.push(pageLocators.signInButton))
      .then(() =>
        cy.textCompare(
          pageLocators.errorMessageLogin,
          pageVariables.messageErrorlogin,
        ),
      );
  }

  // Soumet des identifiants valides sans vérifier le message d'erreur.
  loginWithValidCredentials(
    username: string,
    password: string,
  ): Cypress.Chainable {
    // La redirection est vérifiée séparément par orangehrmDashboard().
    return cy
      .fillInput(pageLocators.usernameInput, username)
      .then(() => cy.fillInput(pageLocators.passwordInput, password))
      .then(() => cy.push(pageLocators.signInButton));
  }

  // Confirme la redirection vers le dashboard après une connexion réussie.
  orangehrmDashboard(): Cypress.Chainable {
    // La présence du nom utilisateur confirme que le dashboard est chargé.
    return cy
      .url()
      .should("include", "/web/index.php/dashboard/index")
      .then(() => cy.get("p.oxd-userdropdown-name").should("be.visible"));
  }

  // Sélectionne une ligne au hasard et vérifie le message d'identifiants invalides.
  loginWithRandomTable(data: DataTable): Cypress.Chainable<undefined> {
    return cy.dataRandom(data).then((login) => {
      if (login.length < 3) {
        throw new Error(
          "The login table must contain a row, username, and password.",
        );
      }

      // Les index correspondent à la ligne, au nom utilisateur et au mot de passe.
      return cy
        .logDescription("La ligne choisi est la ligne: " + login[0])
        .then(() => cy.fillInput(pageLocators.usernameInput, login[1]))
        .then(() => cy.fillInput(pageLocators.passwordInput, login[2]))
        .then(() => cy.push(pageLocators.signInButton))
        .then(() =>
          cy.textCompare(
            pageLocators.errorMessageLogin,
            pageVariables.messageErrorlogin,
          ),
        );
    });
  }

  // Vérifie que l'URL de connexion et les deux champs sont disponibles.
  orangehrmLoginPage(): Cypress.Chainable {
    // Les assertions en chaîne attendent le chargement complet de la page.
    return cy
      .url()
      .should("include", "/web/index.php/auth/login")
      .then(() => cy.get(pageLocators.usernameInput).should("be.visible"))
      .then(() => cy.get(pageLocators.passwordInput).should("be.visible"));
  }

  // Vérifie que l'utilisateur reste sur la page de connexion après un échec.
  orangehrmLoginPageAfterInvalidLogin(): Cypress.Chainable {
    // Cette méthode réutilise la vérification commune de la page de login.
    return this.orangehrmLoginPage();
  }
}

export default new DataDriven();
