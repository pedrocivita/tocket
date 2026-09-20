/**
 * Optional stub eval for `tocket decide` vs a fixture label.
 *
 *   Used by src/tests/decide.test.ts (no live Jev).
 */

import { readFileSync } from "node:fs";
import { stubChoice, stubNoul, parseStateInput } from "../utils/decide.js";

export interface DecideExpectedFile {
  schema: string;
  source: string;
  choice: {
    spec: string;
    expected: string;
  };
  noul: {
    name: string;
    expected_max: number;
  };
}

export interface DecideEvalResult {
  choice: string;
  expectedChoice: string;
  choiceOk: boolean;
  noul: number;
  expectedMax: number;
  noulOk: boolean;
  ok: boolean;
}

export function loadDecideExpected(path: string): DecideExpectedFile {
  return JSON.parse(readFileSync(path, "utf-8")) as DecideExpectedFile;
}

export function evaluateDecideStub(statePath: string, expectedPath: string): DecideEvalResult {
  const expected = loadDecideExpected(expectedPath);
  const state = parseStateInput(readFileSync(statePath, "utf-8"));
  const colon = expected.choice.spec.indexOf(":");
  const name = expected.choice.spec.slice(0, colon);
  const options = expected.choice.spec
    .slice(colon + 1)
    .split(",")
    .map((item) => item.trim());
  const choice = stubChoice(name, options, state);
  const noul = stubNoul(expected.noul.name, state);
  const choiceOk = choice.choice === expected.choice.expected;
  const noulOk = noul.noul <= expected.noul.expected_max;
  return {
    choice: choice.choice,
    expectedChoice: expected.choice.expected,
    choiceOk,
    noul: noul.noul,
    expectedMax: expected.noul.expected_max,
    noulOk,
    ok: choiceOk && noulOk,
  };
}
