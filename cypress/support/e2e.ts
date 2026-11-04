// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'
import 'allure-cypress';
import type { DataTable } from '@badeball/cypress-cucumber-preprocessor';
require('cypress-xpath');

// Alternatively you can use CommonJS syntax:
// require('./commands')

declare global {
    namespace Cypress {
        interface Chainable<Subject = any> {
            googleSearch(search: string): Chainable<Subject>;
            navigateToURL(url: string): Chainable<Subject>;
            navigateToPage(locatorHomePage: string): Chainable<Subject>;
            readExcel(fileName: string, sheetName: string): Chainable<LoginRow[]>;
            logDescription(description: string): Chainable<Subject>;
            fillInput(locator: string, text: string): Chainable<Subject>;
            textCompare(locator: string, text: string): Chainable<Subject>;
            push(locator: string): Chainable<Subject>;
            getRandomIntInclusive(range: { min: number; max: number }): Chainable<number>;
            dataRandom(data: DataTable): Chainable<string[]>;
        }

        interface LoginRow {
            username: string;
            password: string;
        }

        type TableRow = Record<string, string>;

        interface RandomIntRange {
            min: number;
            max: number;
        }
    }
}