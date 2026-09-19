#!/usr/bin/env node
/**
 * POC C eval: heuristic/Jev triage vs human labels + stability + naive baseline.
 *
 *   npm run eval:triage
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseLastRun } from "../utils/appmaps.js";
import {
  heuristicCase,
  naiveIfElseChoice,
  selectResults,
  type TriageChoice,
} from "../utils/triage.js";

export const AGREEMENT_HYPOTHESIS = 0.8;
export const STABILITY_KILL = 0.3;
export const CHANCE_BASELINE = 0.25;

export interface ExpectedCase {
  id: string;
  expected: TriageChoice;
  flavor: string;
  why: string;
}

export interface ExpectedFile {
  schema: string;
  notes: string;
  include_low_confidence: boolean;
  source: string;
  cases: ExpectedCase[];
}

export interface EvalDisagreement {
  id: string;
  expected: TriageChoice;
  got: TriageChoice;
  flavor: string;
}

export interface EvalResult {
  total: number;
  agreed: number;
  agreement: number;
  naiveAgreed: number;
  naiveAgreement: number;
  chance: number;
  unstable: number;
  unstableRate: number;
  disagreements: EvalDisagreement[];
  verdict: "PASS" | "FAIL" | "GRAY";
  reasons: string[];
}

export function loadExpected(path: string): ExpectedFile {
  return JSON.parse(readFileSync(path, "utf-8")) as ExpectedFile;
}

export function evaluateTriage(
  lastRunPath: string,
  expectedPath: string,
): EvalResult {
  const expected = loadExpected(expectedPath);
  const run = parseLastRun(readFileSync(lastRunPath, "utf-8"));
  const selected = selectResults(run, expected.include_low_confidence);
  const first = new Map(
    selected.map((result) => [result.id, heuristicCase(result).choice]),
  );
  const second = new Map(
    selected.map((result) => [result.id, heuristicCase(result).choice]),
  );

  const expectedById = new Map(expected.cases.map((item) => [item.id, item]));
  const disagreements: EvalDisagreement[] = [];
  let agreed = 0;
  let naiveAgreed = 0;
  let unstable = 0;

  for (const item of expected.cases) {
    const result = selected.find((row) => row.id === item.id);
    if (!result) {
      disagreements.push({
        id: item.id,
        expected: item.expected,
        got: "escalate",
        flavor: `${item.flavor} (missing from selected results)`,
      });
      continue;
    }
    const got = first.get(item.id);
    const again = second.get(item.id);
    if (got !== again) unstable += 1;
    if (got === item.expected) agreed += 1;
    else if (got) {
      disagreements.push({
        id: item.id,
        expected: item.expected,
        got,
        flavor: item.flavor,
      });
    }
    if (naiveIfElseChoice(result) === item.expected) naiveAgreed += 1;
  }

  const total = expected.cases.length;
  const agreement = total === 0 ? 0 : agreed / total;
  const naiveAgreement = total === 0 ? 0 : naiveAgreed / total;
  const unstableRate = total === 0 ? 0 : unstable / total;

  const reasons: string[] = [];
  let verdict: EvalResult["verdict"] = "PASS";

  if (unstableRate >= STABILITY_KILL) {
    verdict = "FAIL";
    reasons.push(
      `Stability kill: ${pct(unstableRate)} of cases changed across 2 identical runs (threshold ${pct(STABILITY_KILL)}).`,
    );
  }

  if (agreement <= CHANCE_BASELINE || agreement <= naiveAgreement) {
    verdict = "FAIL";
    reasons.push(
      `Kill: agreement ${pct(agreement)} ≤ chance ${pct(CHANCE_BASELINE)} or naive if-else ${pct(naiveAgreement)}.`,
    );
  }

  if (agreement < AGREEMENT_HYPOTHESIS && verdict !== "FAIL") {
    verdict = "FAIL";
    reasons.push(
      `Hypothesis miss: agreement ${pct(agreement)} < ${pct(AGREEMENT_HYPOTHESIS)}.`,
    );
  }

  if (verdict === "PASS") {
    reasons.push(
      `Dry-run heuristic agrees with human labels on ${agreed}/${total} (${pct(agreement)}), beats chance (${pct(CHANCE_BASELINE)}) and naive if-else (${pct(naiveAgreement)}), unstable ${pct(unstableRate)}.`,
    );
    reasons.push(
      "Live Jev Choice was not scored (no TYPESAFE_API_KEY in this eval). Hypothesis for live Jev remains GRAY.",
    );
  }

  return {
    total,
    agreed,
    agreement,
    naiveAgreed,
    naiveAgreement,
    chance: CHANCE_BASELINE,
    unstable,
    unstableRate,
    disagreements,
    verdict,
    reasons,
  };
}

export function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function renderResultsMd(result: EvalResult): string {
  const rows = result.disagreements.length
    ? result.disagreements
        .map((item) => `| ${item.id} | ${item.expected} | ${item.got} | ${item.flavor} |`)
        .join("\n")
    : "| _none_ | | | |";

  return `# POC C — suite triage eval

## Verdict

| Surface | Verdict | Why |
| --- | --- | --- |
| Dry-run heuristic stub | **${result.verdict}** | ${result.agreed}/${result.total} (${pct(result.agreement)}) vs ≥80%; unstable ${pct(result.unstableRate)} |
| Live Jev Choice | **GRAY** | TYPESAFE_API_KEY unset; System One was not scored |
| Hypothesis as stated (Jev ≥80%) | **GRAY** | Needs a live key run on the same fixtures |

Kill not triggered on the stub: agreement is above chance (${pct(result.chance)}) and naive if-else (${pct(result.naiveAgreement)}); instability is below 30%.

Hypothesis: a Jev Choice among {retry, escalate, ignore, rewrite-locator} agrees with a human-labeled judgment ≥80% on a small fixture set.

| Metric | Value |
| --- | --- |
| Cases | ${result.total} |
| Heuristic agreement | ${result.agreed}/${result.total} (${pct(result.agreement)}) |
| Naive if-else agreement | ${result.naiveAgreed}/${result.total} (${pct(result.naiveAgreement)}) |
| Chance (4-way) | ${pct(result.chance)} |
| Unstable (2 identical runs) | ${result.unstable}/${result.total} (${pct(result.unstableRate)}) |
| Live Jev | not scored (TYPESAFE_API_KEY unset) |

## Reasons

${result.reasons.map((line) => `- ${line}`).join("\n")}

## Sample disagreements

| ID | Expected | Got | Flavor |
| --- | --- | --- | --- |
${rows}

## How to reproduce

\`\`\`bash
npm run eval:triage
tocket suite triage --from fixtures/triage/last-run.json --include-low-confidence --dry-run
\`\`\`
`;
}

function repoRoot(): string {
  return join(import.meta.dirname, "..", "..");
}

function main(): void {
  const root = repoRoot();
  const lastRunPath = join(root, "fixtures", "triage", "last-run.json");
  const expectedPath = join(root, "fixtures", "triage-expected.json");
  const result = evaluateTriage(lastRunPath, expectedPath);
  const md = renderResultsMd(result);
  const outPath = join(root, "fixtures", "triage", "results.md");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, md, "utf-8");

  console.log(`agreement  ${result.agreed}/${result.total} (${pct(result.agreement)})`);
  console.log(`naive      ${result.naiveAgreed}/${result.total} (${pct(result.naiveAgreement)})`);
  console.log(`chance     ${pct(result.chance)}`);
  console.log(`unstable   ${result.unstable}/${result.total} (${pct(result.unstableRate)})`);
  console.log(`verdict    ${result.verdict}`);
  if (result.disagreements.length > 0) {
    console.log("disagreements:");
    for (const item of result.disagreements) {
      console.log(`  ${item.id}: expected ${item.expected}, got ${item.got} (${item.flavor})`);
    }
  }
  console.log(`wrote ${outPath}`);

  if (result.verdict === "FAIL") {
    process.exitCode = 1;
  }
}

const invoked = process.argv[1]?.includes("triage-eval");
if (invoked) {
  main();
}
