/**
 * Modèle de configuration Cypress Component Testing avec Cucumber et Vite.
 *
 * Ce modèle peut servir de point de départ dans tout projet utilisant Cypress
 * Component Testing, Vite et le préprocesseur Cucumber de Badeball. Il est conservé
 * ici à titre documentaire : dans ce dépôt, les commandes `open:ct` et `test:ct`
 * chargent `cypress.component.config.ts`.
 *
 * Avant de reprendre ce modèle, adapter les chemins des scénarios et des rapports,
 * les dossiers autorisés par Vite, le support Cypress et la configuration Cucumber
 * du `package.json` du projet cible. La conversion Gherkin repose sur esbuild et
 * Badeball; Cypress exécute ensuite le JavaScript généré dans le navigateur.
 */

// Dépendances du modèle : Cypress, Vite, le préprocesseur Cucumber Badeball,
// esbuild pour transformer les fichiers Gherkin, et fs pour écrire le résumé.
const { defineConfig } = require('cypress');
const path = require('node:path');
const cypressOnFix: typeof import('cypress-on-fix') = require('cypress-on-fix');
const { defineConfig: defineConfigVite, createLogger } = require('vite');
const {
  addCucumberPreprocessorPlugin,
  afterRunHandler,
} = require('@badeball/cypress-cucumber-preprocessor');
const createEsbuildPlugin = require('@badeball/cypress-cucumber-preprocessor/esbuild');
const esbuild = require('esbuild');
const fs = require('fs').promises;

// La configuration résolue par Cypress est transmise au plugin Cucumber quand
// Vite démarre. Chaque projet peut y définir ses propres étapes Cucumber.
let componentConfig: Cypress.PluginConfigOptions | undefined;

// Ignore un avertissement connu du préprocesseur sur les source maps. Les autres
// avertissements Vite restent visibles dans la console.
const componentViteLogger = createLogger();
const originalComponentViteWarn = componentViteLogger.warn.bind(componentViteLogger);
componentViteLogger.warn = (message: string, options?: import('vite').LogOptions) => {
  if (
    message.includes(
      'cypress-cucumber-preprocessor: Unable to find source mapping URL within the response.',
    )
  ) {
    return;
  }

  originalComponentViteWarn(message, options);
};

/**
 * Écrit un résumé de l'environnement dans lequel les tests ont été exécutés.
 * Le dossier des rapports est créé au besoin. Adapter `outputDirectory` à
 * l'organisation des rapports du projet cible. Le fichier `results.json` contient
 * le navigateur, le système, les versions de Node et Cypress, ainsi que les heures
 * de début et de fin. Le détail des scénarios reste dans le rapport Cucumber.
 */
async function writeRunResults(results: any) {
  // Crée le dossier s'il n'existe pas déjà.
  const outputDirectory = 'cypress/reports/component';
  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.writeFile(
    `${outputDirectory}/results.json`,
    JSON.stringify(
      {
        browserName: results.browserName,
        browserVersion: results.browserVersion,
        osName: results.osName,
        osVersion: results.osVersion,
        nodeVersion: results.config.resolvedNodeVersion,
        cypressVersion: results.cypressVersion,
        startedTestsAt: results.startedTestsAt,
        endedTestsAt: results.endedTestsAt,
      },
      null,
      '\t',
    ),
  );
}

/**
 * Crée le plugin Vite qui transforme les scénarios `.feature` en JavaScript.
 * La configuration Cypress est transmise à Badeball pour trouver les définitions
 * Given, When et Then. Chaque projet doit déclarer ses propres chemins d'étapes
 * dans la configuration `cypress-cucumber-preprocessor` de son `package.json`.
 */
function createCucumberFeaturePlugin(config: Cypress.PluginConfigOptions) {
  return {
    // Nom du plugin pour Vite. Il est utilisé dans les messages de log.
    name: 'cypress-cucumber-feature',
    // Traite les fichiers .feature avant que Vite ne les interprète comme du code.
    enforce: 'pre' as const,
    /**
     * Vérifie chaque fichier demandé par Vite. Les fichiers autres que `.feature`
     * continuent leur parcours normal. Pour un scénario, esbuild et le préprocesseur
     * Cucumber produisent du JavaScript en mémoire, prêt à être lancé par Cypress.
     */
    async transform(_code: string, id: string) {
      // Retire les paramètres ajoutés par Vite pour vérifier le nom du fichier.
      const featurePath = id.split('?')[0];
      if (!featurePath.endsWith('.feature')) {
        return null;
      }

      // Convertit le scénario et ses étapes en un module destiné au navigateur.
      // Le résultat reste en mémoire : aucun fichier temporaire n'est créé.
      const result = await esbuild.build({
        entryPoints: [featurePath],
        bundle: true,
        format: 'esm',
        platform: 'browser',
        write: false,
        plugins: [createEsbuildPlugin.default(config)],
      });

      return { code: result.outputFiles[0].text, map: null };
    },
  };
}

module.exports = defineConfig({
  component: {
    /**
     * Prépare les événements Node de Cypress avant le lancement des tests. Cette
     * méthode initialise Cucumber et ajoute la création du résumé après le run.
     * Si le projet cible possède déjà des tâches ou des événements Cypress, les
     * enregistrer ici également.
     */
    async setupNodeEvents(cypressOn: Cypress.PluginEvents, config: any) {
      // Permet d'enregistrer plusieurs traitements sur les événements Cypress.
      const on = cypressOnFix(cypressOn);
      await addCucumberPreprocessorPlugin(on, config, {
        // Le traitement de fin est défini ci-dessous pour compléter le rapport.
        omitAfterRunHandler: true,
      });
      componentConfig = config;
      /**
       * Termine les rapports Cucumber puis écrit le résumé de l'environnement.
       */
      on('after:run', async (results: any) => {
        if (results) {
          // Finalise le rapport Cucumber avant d'écrire le résumé JSON.
          await afterRunHandler(config, results);
          await writeRunResults(results);
        }
      });
      return config;
    },
    devServer: {
      bundler: 'vite',
      /**
       * Fournit à Cypress les réglages Vite utilisés pour afficher les composants
       * et convertir les scénarios Cucumber. Adapter les options du serveur selon
       * l'emplacement du code source et le bundler du projet cible.
       */
      viteConfig: async () => {
        // La configuration doit avoir été enregistrée par setupNodeEvents.
        if (!componentConfig) {
          throw new Error('Cucumber component configuration was not initialized.');
        }

        return defineConfigVite({
          customLogger: componentViteLogger,
          server: {
            fs: {
              // Autorise Vite à servir les fichiers du projet situés hors de
              // cypress/. Réduire ou élargir cette liste selon l'arborescence cible.
              allow: [path.resolve(__dirname, '..')],
            },
          },
          // Ajoute la conversion des scénarios Gherkin.
          plugins: [createCucumberFeaturePlugin(componentConfig)],
          optimizeDeps: {
            // Évite que Vite tente de préparer cette entrée comme une dépendance.
            exclude: ['./'],
          },
        });
      },
    },
    // À adapter au dossier .feature du projet cible.
    specPattern: './cypress/components/**/*.feature',
  },
});

export {};
