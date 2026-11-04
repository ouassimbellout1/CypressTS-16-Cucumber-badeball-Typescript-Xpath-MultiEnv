/// <reference types="cypress" />

import {
  Given,
  When,
  Then,
  DataTable,
} from "@badeball/cypress-cucumber-preprocessor";
import dataDriven from "../../pages/dataDrivenXlsx/dataDrivenXLSX.page";

//***************************************************************************************** */
// When :

When(`J'accède à la page login`, () => {
  dataDriven.orangehrmLoginPage();
});

//**************************************************************************************** */
// Then :

When(`Je me connecte avec les identifiants valides :`, (data: DataTable) => {
  const [credentials] = data.hashes();

  if (!credentials?.username || !credentials.password) {
    throw new Error(
      "The valid login table must contain username and password.",
    );
  }

  dataDriven.loginWithValidCredentials(
    credentials.username,
    credentials.password,
  );
});

Then(`Je vérifie que le dashboard OrangeHRM est affiché`, () => {
  dataDriven.orangehrmDashboard();
});

When(
  `J'utilise {string} pour se connecter`,
  (contexte: string, data: DataTable): Cypress.Chainable => {
    switch (contexte) {
      case "XLSX":
        return dataDriven.xlsxLogin(`orangehrm.login`, `invalid-users`);

      case "Json":
        return dataDriven.jsonLogin(`orangehrm.login`);

      case "table":
        return data.hashes().reduce(
          (chain, element) =>
            chain.then(() =>
              dataDriven.loginWithTable(element.username, element.password),
            ),
          cy.wrap(null),
        );

      case "table Random":
        return dataDriven.loginWithRandomTable(data);

      default:
        throw new Error(`Unknown login data context: "${contexte}"`);
    }
  },
);

When(
  `J'utiliser table pour se connecter with {string} and {string}`,
  (username: string, password: string): void => {
    dataDriven.loginWithTable(username, password);
  },
);

Then(`Je vérifie que la page de login OrangeHRM est affichée`, () => {
  dataDriven.orangehrmLoginPageAfterInvalidLogin();
});
