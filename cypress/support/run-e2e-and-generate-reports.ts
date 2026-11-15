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
  statusDetails?: {
    message?: string;
    trace?: string;
  };
  labels?: Array<{
    name: string;
    value: string;
  }>;
}

interface RawAllureFile {
  path: string;
  content: string;
}

interface AllureSummary {
  generatedAt: string;
  totals: {
    tests: number;
    statuses: Record<string, number>;
  };
  tests: AllureTestResult[];
  rawFiles: RawAllureFile[];
}

const projectDir = path.resolve(__dirname, "..", "..");
const resultsDir = path.join(projectDir, "allure-results");
const summaryPath = path.join(resultsDir, "allure-e2e-report.json");
const xmlReportPath = path.join(resultsDir, "allure-e2e-report.xml");
const reportDir = path.join(projectDir, "allure-report");
const allureCli = path.join(projectDir, "node_modules", "allure", "cli.js");
const generateOnly = process.argv.includes("--generate-only");
const openMode = process.argv.includes("--open");
const cypressArgs = process.argv
  .slice(2)
  .filter(
    (argument: string) =>
      argument !== "--generate-only" && argument !== "--open",
  );

const collectRawFiles = (
  directory: string,
  relativeDirectory = "",
): RawAllureFile[] => {
  const files: RawAllureFile[] = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.join(relativeDirectory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectRawFiles(absolutePath, relativePath));
    } else if (entry.isFile()) {
      files.push({
        path: relativePath,
        content: fs.readFileSync(absolutePath).toString("base64"),
      });
    }
  }

  return files;
};

const escapeXml = (value: string): string =>
  value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[&<>"']/g, (character: string) => {
      const entities: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      };
      return entities[character];
    });

const generateXmlReport = (tests: AllureTestResult[]): void => {
  let failures = 0;
  let errors = 0;
  let skipped = 0;
  let totalDuration = 0;

  const testCases = tests
    .map((test) => {
      const duration =
        test.start !== undefined && test.stop !== undefined
          ? Math.max(0, (test.stop - test.start) / 1000)
          : 0;
      totalDuration += duration;

      let resultElement = "";
      if (test.status === "failed") {
        failures += 1;
        const message = test.statusDetails?.message ?? "Test failed";
        resultElement = `<failure message="${escapeXml(message)}" type="AssertionError">${escapeXml(test.statusDetails?.trace ?? message)}</failure>`;
      } else if (test.status === "broken") {
        errors += 1;
        const message = test.statusDetails?.message ?? "Test errored";
        resultElement = `<error message="${escapeXml(message)}" type="Error">${escapeXml(test.statusDetails?.trace ?? message)}</error>`;
      } else if (test.status === "skipped") {
        skipped += 1;
        resultElement = "<skipped/>";
      } else if (test.status !== "passed") {
        errors += 1;
        const message = `Unexpected Allure status: ${test.status}`;
        resultElement = `<error message="${escapeXml(message)}" type="Error">${escapeXml(message)}</error>`;
      }

      const className =
        test.labels?.find((label) => label.name === "package")?.value ??
        test.fullName ??
        "Cypress";

      return `    <testcase classname="${escapeXml(className)}" name="${escapeXml(test.name ?? "Test sans nom")}" time="${duration.toFixed(3)}">${resultElement}</testcase>`;
    })
    .join("\n");

  const suiteDuration = totalDuration.toFixed(3);
  const junitXml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="${tests.length}" failures="${failures}" errors="${errors}" skipped="${skipped}" time="${suiteDuration}">
  <testsuite name="Cypress E2E" tests="${tests.length}" failures="${failures}" errors="${errors}" skipped="${skipped}" time="${suiteDuration}">
${testCases}
  </testsuite>
</testsuites>
`;
  fs.writeFileSync(xmlReportPath, junitXml);
};

const hasResultFiles = (directory: string): boolean =>
  fs.existsSync(directory) &&
  fs
    .readdirSync(directory)
    .some((file: string) => file.endsWith("-result.json"));

const buildSummaryFromRawResults = (directory: string): AllureSummary => {
  if (!fs.existsSync(directory)) {
    return {
      generatedAt: new Date().toISOString(),
      totals: { tests: 0, statuses: {} },
      tests: [],
      rawFiles: [],
    };
  }

  const resultFiles = fs
    .readdirSync(directory)
    .filter((file: string) => file.endsWith("-result.json"));

  const tests = resultFiles.map(
    (file: string) =>
      JSON.parse(
        fs.readFileSync(path.join(directory, file), "utf8"),
      ) as AllureTestResult,
  );

  const rawFiles = collectRawFiles(directory);
  const statuses: Record<string, number> = {};

  for (const test of tests) {
    statuses[test.status] = (statuses[test.status] ?? 0) + 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      tests: tests.length,
      statuses,
    },
    tests,
    rawFiles,
  };
};

const writeNoResultsPlaceholder = (): void => {
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(
    path.join(reportDir, "NO_RESULTS.txt"),
    "No Allure results were available for this run.\n",
  );
};

const generateAllureReport = (summary: AllureSummary): number => {
  const hasResultFiles =
    Array.isArray(summary.tests) &&
    summary.tests.length > 0 &&
    Array.isArray(summary.rawFiles) &&
    summary.rawFiles.some((file) => file.path.endsWith("-result.json"));

  if (!hasResultFiles) {
    console.warn(`No raw Allure result files found in ${summaryPath}. Skipping HTML generation.`);
    writeNoResultsPlaceholder();
    return 0;
  }

  generateXmlReport(summary.tests);

  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), "allure-results-"));

  try {
    for (const file of summary.rawFiles) {
      const relativePath = file.path.replace(/[\\/]+/g, path.sep);
      const destination = path.resolve(stagingDir, relativePath);

      if (!destination.startsWith(`${stagingDir}${path.sep}`)) {
        throw new Error(`Invalid path in merged results: ${file.path}`);
      }

      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, Buffer.from(file.content, "base64"));
    }

    const reportRun = spawnSync(
      process.execPath,
      [allureCli, "generate", stagingDir, "--clean", "-o", reportDir],
      { stdio: "inherit" },
    );

    if (reportRun.error) {
      console.error(reportRun.error);
      return 1;
    }

    return reportRun.status ?? 1;
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
};

let cypressRun: { error?: Error; status: number | null } | undefined;

if (!generateOnly) {
  fs.rmSync(resultsDir, { recursive: true, force: true });
  fs.mkdirSync(resultsDir, { recursive: true });

  const cypressPackagePath = require.resolve("cypress/package.json");
  const cypressBin = path.resolve(
    path.dirname(cypressPackagePath),
    "bin",
    "cypress",
  );
  cypressRun = spawnSync(
    process.execPath,
    [cypressBin, openMode ? "open" : "run", ...cypressArgs],
    { stdio: "inherit" },
  );

  const summary = buildSummaryFromRawResults(resultsDir);
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
}

if (!fs.existsSync(summaryPath) && !hasResultFiles(resultsDir)) {
  console.warn(
    `Merged test results not found: ${summaryPath}. Creating a placeholder report.`,
  );
  writeNoResultsPlaceholder();
  process.exitCode = 0;
} else {
  const summary = fs.existsSync(summaryPath)
    ? (JSON.parse(fs.readFileSync(summaryPath, "utf8")) as AllureSummary)
    : buildSummaryFromRawResults(resultsDir);
  const reportStatus = generateAllureReport(summary);

  if (reportStatus !== 0) {
    process.exitCode = reportStatus;
  } else if (cypressRun?.error) {
    console.error(cypressRun.error);
    process.exitCode = 1;
  } else if (cypressRun) {
    process.exitCode = cypressRun.status ?? 1;
  }
}
