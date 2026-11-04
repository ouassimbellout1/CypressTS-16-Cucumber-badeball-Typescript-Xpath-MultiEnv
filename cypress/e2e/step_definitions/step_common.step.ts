/// <reference types="cypress" />

import { Given } from '@badeball/cypress-cucumber-preprocessor';

//***************************************************************************************** */
// Given :

Given(`J'accède a l'url {string}`, (url: string) => {
    cy.navigateToURL(url);
  });