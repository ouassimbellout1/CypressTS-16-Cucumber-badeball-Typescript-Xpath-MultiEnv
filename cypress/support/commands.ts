import type { DataTable } from '@badeball/cypress-cucumber-preprocessor';
import * as XLSX from 'xlsx';

// Enters a search term in Google's visible search field and submits it.
Cypress.Commands.add(`googleSearch`, (search: string): Cypress.Chainable => {
    return cy.get(`textarea[name="q"], input[name="q"]`)
        .first()
        .should(`be.visible`)
        .type(search, { delay: 120 })
        .should('have.value', search)
        .type('{enter}');
});

// Visits a public URL registered in Cypress configuration.
Cypress.Commands.add(`navigateToURL`, (url: string): Cypress.Chainable => {
    // URLs are resolved from Cypress.expose() instead of accepting arbitrary values.
    const targetUrl = Cypress.expose(url);

    if (typeof targetUrl !== 'string' || targetUrl.length === 0) {
        throw new Error(`Unknown public URL exposed by Cypress: "${url}"`);
    }

    return cy.visit(targetUrl);
});

// Clicks a page element identified by its locator.
Cypress.Commands.add(`navigateToPage`, (locatorHomePage: string): Cypress.Chainable => {
    return cy.get(locatorHomePage).click();
});

// Loads a named worksheet from an Excel fixture and returns its login rows.
Cypress.Commands.add(`readExcel`, (
    fileName: string,
    sheetName: string,
): Cypress.Chainable<Cypress.LoginRow[]> => {
    // Fixtures are read as binary data so XLSX can parse the workbook in the browser.
    return cy
        .readFile(`cypress/fixtures/xlsx/${fileName}.xlsx`, 'binary')
        .then((content) => {
            const workbook = XLSX.read(content, { type: 'binary' });
            const worksheet = workbook.Sheets[sheetName];

            // Fail explicitly when the requested sheet is not present.
            if (!worksheet) {
                throw new Error(`Excel sheet not found: "${sheetName}"`);
            }

            return XLSX.utils.sheet_to_json<Cypress.LoginRow>(worksheet, {
                raw: false,
            });
        });
});

// Writes a formatted description to the Cypress command log.
Cypress.Commands.add(`logDescription`, (description: string): Cypress.Chainable => {
    return cy.log(`**[${description}](http://example.com)**`);
});

// Sets an enabled input value without relying on keyboard events during rerenders.
Cypress.Commands.add(`fillInput`, (locator: string, text: string): Cypress.Chainable => {
    return cy.get(locator)
        .should('be.visible')
        .and('not.be.disabled')
        .then(($input) => {
            const input = $input[0] as HTMLInputElement;
            const valueSetter = Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype,
                'value',
            )?.set;

            if (!valueSetter) {
                throw new Error('Unable to set the input value through the native setter.');
            }

            valueSetter.call(input, text);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        })
        .then(() => cy.get(locator).should('have.value', text));
});

// Asserts that an element contains the expected text.
Cypress.Commands.add(`textCompare`, (locator: string, text: string): Cypress.Chainable => {
    return cy.get(locator)
        .should('be.visible')
        .and('contain.text', text);
});

// Clicks an enabled element, including elements covered during a page rerender.
Cypress.Commands.add(`push`, (locator: string): Cypress.Chainable => {
    // Force is intentional for the OrangeHRM button, which may be covered during rerender.
    return cy.get(locator)
        .should('be.visible')
        .and('not.be.disabled')
        .click({ force: true });
});

// Returns an inclusive random integer between the supplied bounds.
Cypress.Commands.add(
    `getRandomIntInclusive`,
    ({ min, max }: Cypress.RandomIntRange): Cypress.Chainable<number> => {
        // Round bounds first so decimal inputs still produce an inclusive integer range.
        const minProcessed = Math.ceil(min);
        const maxProcessed = Math.floor(max);
        return cy.wrap(
            Math.floor(Math.random() * (maxProcessed - minProcessed + 1) + minProcessed),
        );
    },
);

// Selects one row from a Cucumber data table and returns its cell values.
Cypress.Commands.add(`dataRandom`, (data: DataTable): Cypress.Chainable<string[]> => {
    const rows: Cypress.TableRow[] = data.hashes();

    // An empty table cannot provide credentials and would produce an invalid index.
    if (rows.length === 0) {
        throw new Error('The data table must contain at least one row.');
    }

    return cy
        .getRandomIntInclusive({ min: 0, max: rows.length - 1 })
        .then((index) => Object.values(rows[index]));
});
