const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

interface AllureTestResult {
  name?: string;
  fullName?: string;
  status: string;
  start?: number;
  stop?: number;
  titlePath?: string[];
  statusDetails?: { message?: string; trace?: string };
  labels?: { name: string; value: string }[];
}

const projectDir = path.resolve(__dirname, "..", "..");
const resultsDir = path.join(projectDir, "allure-results");
const rawResultsDir = path.join(projectDir, "allure-results-raw");
const summaryPath = path.join(resultsDir, "allure-e2e-report.json");
const xmlReportPath = path.join(resultsDir, "allure-e2e-report.xml");
const reportDir = path.join(projectDir, "allure-report");
const allureCli = path.join(projectDir, "node_modules", "allure", "cli.js");
const generateOnly = process.argv.includes("--generate-only");
const openMode = process.argv.includes("--open");
const preserveRawResults = process.argv.includes("--preserve-raw");
const cypressArgs = process.argv
  .slice(2)
  .filter(
    (argument: string) =>
      argument !== "--generate-only" &&
      argument !== "--open" &&
      argument !== "--preserve-raw",
  );

/** 01 Échappe les caractères réservés et retire les caractères interdits en XML. */
const escapeXml = (value: string): string =>
  value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(
    /[&<>"']/g,
    (char: string) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[char] ?? char,
  );

/** 02 Écrit un rapport JUnit XML à partir des résultats Allure. */
const generateXmlReport = (tests: AllureTestResult[]): void => {
  const counts = { failures: 0, errors: 0, skipped: 0, duration: 0 };
  const cases = tests.map((test) => {
    const duration =
      test.start !== undefined && test.stop !== undefined
        ? Math.max(0, (test.stop - test.start) / 1000)
        : 0;
    counts.duration += duration;
    if (test.status === "failed") counts.failures++;
    else if (test.status === "skipped") counts.skipped++;
    else if (test.status !== "passed") counts.errors++;

    const kind = test.status === "failed" ? "failure" : "error";
    const message =
      test.statusDetails?.message ??
      (test.status === "failed"
        ? "Test failed"
        : test.status === "broken"
          ? "Test errored"
          : `Unexpected Allure status: ${test.status}`);
    const result =
      test.status === "skipped"
        ? "<skipped/>"
        : test.status === "passed"
          ? ""
          : `<${kind} message="${escapeXml(message)}" type="${kind === "failure" ? "AssertionError" : "Error"}">${escapeXml(test.statusDetails?.trace ?? message)}</${kind}>`;
    const className =
      test.labels?.find((label) => label.name === "package")?.value ??
      test.fullName ??
      "Cypress";

    return `<testcase classname="${escapeXml(className)}" name="${escapeXml(test.name ?? "Test sans nom")}" time="${duration.toFixed(3)}">${result}</testcase>`;
  });
  const attrs = `tests="${tests.length}" failures="${counts.failures}" errors="${counts.errors}" skipped="${counts.skipped}" time="${counts.duration.toFixed(3)}"`;
  fs.writeFileSync(
    xmlReportPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<testsuites ${attrs}><testsuite name="Cypress E2E" ${attrs}>
${cases.join("\n")}
</testsuite></testsuites>
`,
  );
};

/** 03 Réduit la hiérarchie Allure au projet, au dossier features et au fichier. */
const normalizeTestHierarchy = (
  directory: string,
  file: string,
): AllureTestResult => {
  const resultPath = path.join(directory, file);
  const test = JSON.parse(
    fs.readFileSync(resultPath, "utf8"),
  ) as AllureTestResult;
  const featureFile = path.basename(
    test.titlePath?.find((part) => part.endsWith(".feature")) ??
      "unknown.feature",
  );

  test.titlePath = ["Cypress", "e2e", "features", featureFile];
  test.fullName = `Cypress:e2e/features/${featureFile}#${test.name ?? ""}`;
  test.labels = [
    ...(test.labels ?? []).filter(
      ({ name }) =>
        !["parentSuite", "suite", "subSuite", "package"].includes(name),
    ),
    { name: "package", value: `Cypress.e2e.features.${featureFile}` },
  ];
  fs.writeFileSync(resultPath, JSON.stringify(test));
  return test;
};

/** 04 Crée un fichier explicatif lorsque cette exécution n'a aucun résultat. */
const writeNoResultsPlaceholder = (): void => {
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(
    path.join(reportDir, "NO_RESULTS.txt"),
    "No Allure results were available for this run.\n",
  );
};

/** 05 Prépare les sections Allure avec seul le corps du test ouvert par défaut. */
const configureTestBodyExpansion = (): boolean => {
  const dataDir = path.join(reportDir, "data", "test-results");
  const testIds = fs
    .readdirSync(dataDir)
    .filter((file: string) => /^[a-f0-9]{32}\.json$/i.test(file))
    .map((file: string) => file.slice(0, -5));

  if (testIds.length === 0) {
    console.error(`No Allure test result IDs found in ${dataDir}.`);
    return false;
  }

  const indexPath = path.join(reportDir, "index.html");
  const html = fs.readFileSync(indexPath, "utf8");
  if (!html.includes("</head>")) {
    console.error(`Could not inject the Allure section defaults into ${indexPath}.`);
    return false;
  }

  const script = `<script>
(() => {
  const ids = ${JSON.stringify(testIds)};
  const read = (key) => new Set(JSON.parse(localStorage.getItem(key) || "[]"));
  const expanded = read("expandedTrees");
  const collapsed = read("collapsedTrees");
  const isTestSection = (id) => /^[a-f0-9]{32}-(steps|setup|teardown)$/i.test(id);
  for (const trees of [expanded, collapsed]) {
    for (const id of trees) if (isTestSection(id)) trees.delete(id);
  }
  for (const id of ids) {
    expanded.add(\`\${id}-steps\`);
    expanded.delete(\`\${id}-setup\`);
    expanded.delete(\`\${id}-teardown\`);
    collapsed.delete(\`\${id}-steps\`);
    collapsed.add(\`\${id}-setup\`);
    collapsed.add(\`\${id}-teardown\`);
  }
  localStorage.setItem("expandedTrees", JSON.stringify([...expanded]));
  localStorage.setItem("collapsedTrees", JSON.stringify([...collapsed]));
})();
</script>`;
  fs.writeFileSync(indexPath, html.replace("</head>", `${script}\n</head>`));
  return true;
};

/** 06 Génère les rapports JUnit et HTML Allure, ou un placeholder sans résultats. */
const generateAllureReport = (
  tests: AllureTestResult[],
  sourceDir: string,
): number => {
  fs.rmSync(reportDir, { recursive: true, force: true });

  if (tests.length === 0) {
    console.warn(
      `No raw Allure result files found in ${sourceDir}. Skipping HTML generation.`,
    );
    writeNoResultsPlaceholder();
    return 0;
  }

  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "allure-config-"));
  try {
    const configPath = path.join(configDir, "allurerc.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        plugins: {
          awesome: {
            options: {
              stepTreeExpansion: "collapsed",
            },
          },
        },
      }),
    );
    const reportRun = spawnSync(
      process.execPath,
      [
        allureCli,
        "generate",
        sourceDir,
        "--clean",
        "-o",
        reportDir,
        "--config",
        configPath,
      ],
      { stdio: "inherit" },
    );

    if (reportRun.error) {
      console.error(reportRun.error);
      return 1;
    }

    const reportStatus = reportRun.status ?? 1;
    if (reportStatus !== 0) return reportStatus;
    return configureTestBodyExpansion() ? 0 : 1;
  } finally {
    fs.rmSync(configDir, { recursive: true, force: true });
  }
};

let cypressRun: { error?: Error; status: number | null } | undefined;

if (!generateOnly) {
  fs.rmSync(resultsDir, { recursive: true, force: true });
  fs.rmSync(rawResultsDir, { recursive: true, force: true });
}
fs.mkdirSync(resultsDir, { recursive: true });

const sourceDir =
  generateOnly && fs.existsSync(rawResultsDir) ? rawResultsDir : resultsDir;
if (generateOnly) {
  fs.rmSync(summaryPath, { force: true });
  fs.rmSync(xmlReportPath, { force: true });
}
fs.mkdirSync(sourceDir, { recursive: true });

if (!generateOnly) {
  const cypressBin = path.resolve(
    path.dirname(require.resolve("cypress/package.json")),
    "bin",
    "cypress",
  );
  cypressRun = spawnSync(
    process.execPath,
    [cypressBin, openMode ? "open" : "run", ...cypressArgs],
    { stdio: "inherit" },
  );
}

const tests: AllureTestResult[] = fs
  .readdirSync(sourceDir)
  .filter((file: string) => file.endsWith("-result.json"))
  .map((file: string) => normalizeTestHierarchy(sourceDir, file));
const statuses: Record<string, number> = {};
tests.forEach(({ status }) => (statuses[status] = (statuses[status] ?? 0) + 1));
const summary = {
  generatedAt: new Date().toISOString(),
  totals: { tests: tests.length, statuses },
  tests,
};

if (sourceDir === resultsDir) {
  fs.rmSync(rawResultsDir, { recursive: true, force: true });
  fs.cpSync(resultsDir, rawResultsDir, { recursive: true });
  if (tests.length === 0) {
    fs.writeFileSync(
      path.join(rawResultsDir, "NO_RESULTS.txt"),
      "No raw Allure results were generated.\n",
    );
  }
}

const reportStatus = generateAllureReport(tests, sourceDir);
generateXmlReport(tests);
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
for (const file of fs.readdirSync(resultsDir)) {
  if (
    ![path.basename(summaryPath), path.basename(xmlReportPath)].includes(file)
  ) {
    fs.rmSync(path.join(resultsDir, file), { recursive: true, force: true });
  }
}
if (!preserveRawResults) {
  fs.rmSync(rawResultsDir, { recursive: true, force: true });
}

if (reportStatus !== 0) {
  process.exitCode = reportStatus;
} else if (cypressRun?.error) {
  console.error(cypressRun.error);
  process.exitCode = 1;
} else if (cypressRun) {
  process.exitCode = cypressRun.status ?? 1;
}
