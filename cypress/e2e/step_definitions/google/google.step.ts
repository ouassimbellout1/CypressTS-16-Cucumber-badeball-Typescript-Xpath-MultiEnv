/// <reference types="cypress" />
/// <reference types="cypress-xpath" />

import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';
import GoogleSearch  from "../../pages/google/page-googleSearch.page";

//***************************************************************************************** */
// When :

When(`Google est affiché`, () => {
  cy.url().should('eq', 'https://www.google.com/');
})

//***************************************************************************************** */
// Then :

Then(`First search`, () => {
  GoogleSearch.say(`hello world`);
  console.log(GoogleSearch.localFunctionWithTypes(1,2) === 2);
  cy.googleSearch('cypress 10');
});

Then(`Second search : {string}`, (textSearch: string) => {
  GoogleSearch.say(`hello world`);
  console.log(GoogleSearch.localFunctionWithTypes(1,2) === 2);
  cy.googleSearch(textSearch);
});