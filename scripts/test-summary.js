// Runs the test suite with a JSON reporter and writes docs/assets/test-summary.json,
// which the README badge reads. Usage: npm run test:summary
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const out = path.join(__dirname, "..", "docs", "assets", "test-summary.json");
fs.mkdirSync(path.dirname(out), { recursive: true });

let raw;
try {
  raw = execSync("npx hardhat test", {
    env: { ...process.env, MOCHA_REPORTER: "json" },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (e) {
  raw = e.stdout || "";
}

const start = raw.indexOf("{");
const report = JSON.parse(raw.slice(start));
const s = report.stats;
let coverage = null;
const covFile = path.join(__dirname, "..", "coverage", "coverage-summary.json");
if (fs.existsSync(covFile)) {
  const c = JSON.parse(fs.readFileSync(covFile, "utf8")).total;
  coverage = { lines: c.lines.pct, statements: c.statements.pct, functions: c.functions.pct, branches: c.branches.pct };
}

const summary = {
  generatedAt: new Date().toISOString(),
  tests: s.tests,
  passing: s.passes,
  failing: s.failures,
  pending: s.pending,
  durationMs: s.duration,
  coverage,
  // shields.io endpoint format, so the README badge can read this file directly
  schemaVersion: 1,
  label: "tests",
  message: `${s.passes} passing${s.failures ? `, ${s.failures} failing` : ""}`,
  color: s.failures ? "red" : "brightgreen",
};
fs.writeFileSync(out, JSON.stringify(summary, null, 2) + "\n");
console.log(`wrote ${out}: ${summary.message}`);
process.exit(s.failures ? 1 : 0);
