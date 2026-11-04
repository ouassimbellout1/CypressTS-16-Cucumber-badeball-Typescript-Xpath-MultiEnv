const { defineConfig } = require("cypress");
const createBundler = require("@bahmutov/cypress-esbuild-preprocessor");
const preprocessor = require("@badeball/cypress-cucumber-preprocessor");
const createEsbuildPlugin = require("@badeball/cypress-cucumber-preprocessor/esbuild");
const { allureCypress } = require("allure-cypress/reporter");

module.exports = defineConfig({
  expose: {
    local: 'https://www.google.com/',
    google: 'https://www.google.com/',
    orangehrm: 'https://opensource-demo.orangehrmlive.com/web/index.php/auth/login'
  },
  e2e: {
    setupNodeEvents(on: Cypress.PluginEvents, config: Cypress.PluginConfigOptions): Cypress.PluginConfigOptions {
      on("file:preprocessor",
      createBundler({
        plugins: [createEsbuildPlugin.default(config)],
      }));
      preprocessor.addCucumberPreprocessorPlugin(on, config);
      allureCypress(on, config, {
        resultsDir: "allure-results",
      });
      return config;
    },
	specPattern: "./cypress/e2e/**/*.feature",
  },
});