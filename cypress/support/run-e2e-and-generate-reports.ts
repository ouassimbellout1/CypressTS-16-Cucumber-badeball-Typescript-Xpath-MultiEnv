const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

interface AllureTestResult {
  name?: string;
  fullName?: string;
  status: string;
  start?: number;
  stop?: number;
  statusDetails?: { message?: string; trace?: string };
  labels?: { name: string; value: string }[];
}

const projectDir = path.resolve(__dirname, "..", "..");
const resultsDir = path.join(projectDir, "allure-results");
const summaryPath = path.join(resultsDir, "allure-e2e-report.json");
const xmlReportPath = path.join(resultsDir, "allure-e2e-report.xml");
const reportDir = path.join(projectDir, "allure-report");
const allureCli = path.join(projectDir, "node_modules", "allure", "cli.js");
const generateOnly = process.argv.includes("--generate-only");
const openMode = process.argv.includes("--open");
const cypressArgs = process.argv.slice(2).filter(
  (argument: string) => argument !== "--generate-only" && argument !== "--open",
);

const escapeXml = (value: string): string =>
  value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[&<>"']/g, (char: string) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[
        char
      ] ?? char,
    );

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
      test.status === "skipped" ? "<skipped/>" :
      test.status === "passed" ? "" :
      `<${kind} message="${escapeXml(message)}" type="${kind === "failure" ? "AssertionError" : "Error"}">${escapeXml(test.statusDetails?.trace ?? message)}</${kind}>`;
    const className =
      test.labels?.find((label) => label.name === "package")?.value ??
      test.fullName ??
      "Cypress";

    return `<testcase classname="${escapeXml(className)}" name="${escapeXml(test.name ?? "Test sans nom")}" time="${duration.toFixed(3)}">${result}</testcase>`;
  });
  const attrs = `tests="${tests.length}" failures="${counts.failures}" errors="${counts.errors}" skipped="${counts.skipped}" time="${counts.duration.toFixed(3)}"`;
  fs.writeFileSync(xmlReportPath, `<?xml version="1.0" encoding="UTF-8"?>
<testsuites ${attrs}><testsuite name="Cypress E2E" ${attrs}>
${cases.join("\n")}
</testsuite></testsuites>
`);
};

const writeNoResultsPlaceholder = (): void => {
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(
    path.join(reportDir, "NO_RESULTS.txt"),
    "No Allure results were available for this run.\n",
  );
};

const generateAllureReport = (tests: AllureTestResult[]): number => {
  fs.rmSync(reportDir, { recursive: true, force: true });

  if (tests.length === 0) {
    console.warn(
      `No raw Allure result files found in ${resultsDir}. Skipping HTML generation.`,
    );
    writeNoResultsPlaceholder();
    return 0;
  }

  generateXmlReport(tests);

  const reportRun = spawnSync(
    process.execPath,
    [allureCli, "generate", resultsDir, "--clean", "-o", reportDir],
    { stdio: "inherit" },
  );

  if (reportRun.error) {
    console.error(reportRun.error);
    return 1;
  }

  return reportRun.status ?? 1;
};

let cypressRun: { error?: Error; status: number | null } | undefined;

if (!generateOnly) {
  fs.rmSync(resultsDir, { recursive: true, force: true });
}
fs.mkdirSync(resultsDir, { recursive: true });

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
  .readdirSync(resultsDir)
  .filter((file: string) => file.endsWith("-result.json"))
  .map(
    (file: string) =>
      JSON.parse(
        fs.readFileSync(path.join(resultsDir, file), "utf8"),
      ) as AllureTestResult,
  );
const statuses: Record<string, number> = {};
tests.forEach(({ status }) => (statuses[status] = (statuses[status] ?? 0) + 1));
const summary = {
  generatedAt: new Date().toISOString(),
  totals: { tests: tests.length, statuses },
  tests,
};
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

const reportStatus = generateAllureReport(tests);

if (reportStatus !== 0) {
  process.exitCode = reportStatus;
} else if (cypressRun?.error) {
  console.error(cypressRun.error);
  process.exitCode = 1;
} else if (cypressRun) {
  process.exitCode = cypressRun.status ?? 1;
}
