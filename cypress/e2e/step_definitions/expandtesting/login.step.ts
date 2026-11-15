/// <reference types="cypress" />

import {
  Given,
  When,
  Then,
} from "@badeball/cypress-cucumber-preprocessor";
import expandTestingLogin from "../../pages/expandtesting/login.page";

Given("La page de connexion ExpandTesting est affichée", () => {
  expandTestingLogin.assertLoginPage();
});

When("Je me connecte avec les identifiants valides sur ExpandTesting", () => {
  expandTestingLogin.loginWithValidCredentials();
});

When(
  "Je me connecte avec {string} et {string}",
  (username: string, password: string) => {
    expandTestingLogin.login(username, password);
  },
);

Then("Je suis redirigé vers la zone sécurisée ExpandTesting", () => {
  expandTestingLogin.assertSecureArea();
});

Then(
  "Je vois le message d'erreur {string} sur ExpandTesting",
  (message: string) => {
    expandTestingLogin.assertLoginError(message);
  },
);

Then("Je reste sur la page de connexion ExpandTesting", () => {
  expandTestingLogin.assertLoginPage();
});
