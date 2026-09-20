/** Thin TypeSafe System One (Jev) client. No SDK dependency. */

export const JEV_SYSTEMONE_URL = "https://api.typesafe.ai/v1/systemone";
export const JEV_MODEL = "jev-latest";

export const TRIAGE_CHOICES = [
  "retry",
  "escalate",
  "ignore",
  "rewrite-locator",
] as const;

export type TriageChoice = (typeof TRIAGE_CHOICES)[number];

export const TRIAGE_CHOICE_CRITERIA: Record<TriageChoice, string> = {
  retry:
    "Transient flake, navigation timeout, connection reset, or HTTP 5xx. Re-run the same goal without changing the map.",
  escalate:
    "Real product or assertion failure, empty error, or unknown failure that needs a human.",
  ignore:
    "Benign noise, known warning, or a pass (including low-confidence) that does not need action.",
  "rewrite-locator":
    "Selector or locator drift: missing element, stale node, strict-mode violation, or timeout waiting for a locator.",
};

export interface JevTriageAnswers {
  choice: TriageChoice;
  confidence: number;
  locatorDrift: number;
  model: string;
  probabilities?: Record<string, number>;
}

export interface JevAskOptions {
  apiKey: string;
  state: unknown;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface JevChoiceQuestion {
  type: "choice";
  instructions?: string;
  criteria: Record<string, string>;
}

export interface JevNoulQuestion {
  type: "noul";
  instructions?: string;
  criteria?: Record<string, string>;
}

export interface JevScoreQuestion {
  type: "score";
  instructions?: string;
  min?: number;
  max?: number;
  criteria?: Record<string, string>;
}

export type JevQuestion = JevChoiceQuestion | JevNoulQuestion | JevScoreQuestion;

export interface JevChoiceAnswer {
  type: "choice";
  choice: string;
  confidence: number;
  probabilities?: Record<string, number>;
}

export interface JevNoulAnswer {
  type: "noul";
  noul: number;
  confidence: number;
}

export interface JevScoreAnswer {
  type: "score";
  score: number;
  confidence: number;
}

export type JevAnswer = JevChoiceAnswer | JevNoulAnswer | JevScoreAnswer;

export interface PostJevOptions {
  apiKey: string;
  state: unknown;
  questions: Record<string, unknown>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  model?: string;
}

export interface JevResponse {
  model: string;
  answers: Record<string, unknown>;
  raw: Record<string, unknown>;
}

export class JevRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JevRequestError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTriageChoice(value: unknown): value is TriageChoice {
  return typeof value === "string" && (TRIAGE_CHOICES as readonly string[]).includes(value);
}

function parseNamedChoice(
  value: unknown,
  allowed: readonly string[],
): { choice: string; confidence: number; probabilities?: Record<string, number> } {
  if (!isRecord(value)) {
    throw new JevRequestError("Jev action answer is not an object");
  }
  const choice = value.choice;
  if (typeof choice !== "string" || !allowed.includes(choice)) {
    throw new JevRequestError(`Jev returned unknown choice: ${String(choice)}`);
  }
  const confidence =
    typeof value.confidence === "number" && Number.isFinite(value.confidence)
      ? value.confidence
      : 0;
  const probabilities = isRecord(value.probabilities)
    ? Object.fromEntries(
        Object.entries(value.probabilities).filter((entry): entry is [string, number] => typeof entry[1] === "number"),
      )
    : undefined;
  return { choice, confidence, probabilities };
}

function parseChoiceAnswer(value: unknown): { choice: TriageChoice; confidence: number; probabilities?: Record<string, number> } {
  const parsed = parseNamedChoice(value, TRIAGE_CHOICES);
  if (!isTriageChoice(parsed.choice)) {
    throw new JevRequestError(`Jev returned unknown choice: ${parsed.choice}`);
  }
  return { choice: parsed.choice, confidence: parsed.confidence, probabilities: parsed.probabilities };
}

function parseNoulAnswer(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (isRecord(value) && typeof value.noul === "number" && Number.isFinite(value.noul)) {
    return value.noul;
  }
  return 0;
}

function parseScoreAnswer(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (isRecord(value) && typeof value.score === "number" && Number.isFinite(value.score)) {
    return value.score;
  }
  return 0;
}

function answerConfidence(value: unknown, fallback: number): number {
  if (isRecord(value) && typeof value.confidence === "number" && Number.isFinite(value.confidence)) {
    return value.confidence;
  }
  return fallback;
}

export function buildTriageQuestions(): Record<string, unknown> {
  return {
    action: {
      type: "choice",
      instructions:
        "What should a suite maintainer do about this AppMap goal result? Pick one action.",
      criteria: TRIAGE_CHOICE_CRITERIA,
    },
    locator_drift: {
      type: "noul",
      instructions:
        "Is this a locator drift (selector changed, element missing, stale node, or wait-for-locator timeout)?",
      criteria: {
        true: "The failure is explained by a broken or drifted locator or selector.",
        false: "The failure is not locator-related.",
      },
    },
  };
}

/** POST state + questions to TypeSafe System One. */
export async function postJev(options: PostJevOptions): Promise<JevResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const model = options.model ?? JEV_MODEL;

  let response: Response;
  try {
    response = await fetchImpl(JEV_SYSTEMONE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        state: options.state,
        questions: options.questions,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new JevRequestError(`Jev request failed: ${message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new JevRequestError(`Jev HTTP ${response.status}${body ? `: ${body.slice(0, 240)}` : ""}`);
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload)) {
    throw new JevRequestError("Jev response is not an object");
  }

  const answers = isRecord(payload.answers) ? payload.answers : payload;
  const resolvedModel = typeof payload.model === "string" ? payload.model : model;

  return { model: resolvedModel, answers, raw: payload };
}

/** Call Jev with arbitrary Choice / Noul questions. */
export async function askJev(
  options: PostJevOptions & { questions: Record<string, JevQuestion> },
): Promise<{ model: string; answers: Record<string, JevAnswer> }> {
  const payload = await postJev(options);
  const answers: Record<string, JevAnswer> = {};

  for (const [name, question] of Object.entries(options.questions)) {
    const raw = payload.answers[name];
    if (raw === undefined) {
      throw new JevRequestError(`Jev response missing answer for "${name}"`);
    }
    if (question.type === "choice") {
      const parsed = parseNamedChoice(raw, Object.keys(question.criteria));
      answers[name] = {
        type: "choice",
        choice: parsed.choice,
        confidence: parsed.confidence,
        probabilities: parsed.probabilities,
      };
    } else if (question.type === "noul") {
      answers[name] = {
        type: "noul",
        noul: parseNoulAnswer(raw),
        confidence: answerConfidence(raw, 0.7),
      };
    } else {
      answers[name] = {
        type: "score",
        score: parseScoreAnswer(raw),
        confidence: answerConfidence(raw, 0.7),
      };
    }
  }

  return { model: payload.model, answers };
}

/** Call Jev Choice + optional Noul for one triage case. */
export async function askJevTriage(options: JevAskOptions): Promise<JevTriageAnswers> {
  const payload = await postJev({
    apiKey: options.apiKey,
    state: options.state,
    questions: buildTriageQuestions(),
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs,
  });
  const parsed = parseChoiceAnswer(payload.answers.action);
  const locatorDrift = parseNoulAnswer(payload.answers.locator_drift);

  return {
    choice: parsed.choice,
    confidence: parsed.confidence,
    locatorDrift,
    model: payload.model,
    probabilities: parsed.probabilities,
  };
}

export function readTypesafeApiKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const key = env.TYPESAFE_API_KEY?.trim();
  return key ? key : undefined;
}
