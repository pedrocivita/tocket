import { existsSync } from "node:fs";
import { join } from "node:path";

export const DEFAULT_EXECUTOR = "Claude Code";
export const DEFAULT_ARCHITECT = "Gemini";
export const EXECUTOR_CHOICES = ["Claude Code", "Cursor", "Windsurf", "Copilot"] as const;
export const ARCHITECT_CHOICES = ["Gemini"] as const;

export const EXECUTOR_FILE_MAP: Record<string, string> = {
  "claude code": "CLAUDE.md",
  "claude": "CLAUDE.md",
  "cursor": ".cursorrules",
  "windsurf": ".windsurfrules",
  "copilot": ".github/copilot-instructions.md",
};

export const ARCHITECT_FILE_MAP: Record<string, string> = {
  "gemini": "GEMINI.md",
};

export function getExecutorFileName(agentName?: string): string {
  if (!agentName) return EXECUTOR_FILE_MAP["claude code"]!;
  return EXECUTOR_FILE_MAP[agentName.toLowerCase()] ?? "EXECUTOR.md";
}

export function getArchitectFileName(agentName?: string): string {
  if (!agentName) return ARCHITECT_FILE_MAP["gemini"]!;
  return ARCHITECT_FILE_MAP[agentName.toLowerCase()] ?? "ARCHITECT.md";
}

export function getExecutorDisplayName(agentName?: string): string {
  return agentName || DEFAULT_EXECUTOR;
}

export function getArchitectDisplayName(agentName?: string): string {
  return agentName || DEFAULT_ARCHITECT;
}

export type AgentDetectSource = "flag" | "config" | "file" | "env" | "default";

export interface DetectedAgents {
  executor?: string;
  architect?: string;
  executorSource: "file" | "env" | "none";
  architectSource: "file" | "env" | "none";
}

const EXECUTOR_FILE_HINTS: ReadonlyArray<{ file: string; agent: string }> = [
  { file: ".cursorrules", agent: "Cursor" },
  { file: ".github/copilot-instructions.md", agent: "Copilot" },
  { file: ".windsurfrules", agent: "Windsurf" },
  { file: "CLAUDE.md", agent: "Claude Code" },
];

/** Detect preferred agents from existing instruction files or env (Cursor / Claude). */
export function detectPreferredAgents(
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): DetectedAgents {
  let executor: string | undefined;
  let architect: string | undefined;
  let executorSource: DetectedAgents["executorSource"] = "none";
  let architectSource: DetectedAgents["architectSource"] = "none";

  for (const hint of EXECUTOR_FILE_HINTS) {
    if (existsSync(join(cwd, hint.file))) {
      executor = hint.agent;
      executorSource = "file";
      break;
    }
  }
  if (existsSync(join(cwd, "GEMINI.md"))) {
    architect = "Gemini";
    architectSource = "file";
  }

  if (!executor) {
    if (env.CURSOR_TRACE_ID || env.CURSOR_AGENT || env.CURSOR) {
      executor = "Cursor";
      executorSource = "env";
    } else if (env.CLAUDECODE || env.CLAUDE_CODE) {
      executor = "Claude Code";
      executorSource = "env";
    }
  }

  return { executor, architect, executorSource, architectSource };
}

export function resolveInitAgents(input: {
  executorFlag?: string;
  architectFlag?: string;
  configExecutor?: string;
  configArchitect?: string;
  detected: DetectedAgents;
}): { executor: string; architect: string; executorSource: AgentDetectSource; architectSource: AgentDetectSource } {
  const executorFlag = input.executorFlag?.trim();
  const architectFlag = input.architectFlag?.trim();
  const configExecutor = input.configExecutor?.trim();
  const configArchitect = input.configArchitect?.trim();

  let executor: string;
  let executorSource: AgentDetectSource;
  if (executorFlag) {
    executor = executorFlag;
    executorSource = "flag";
  } else if (configExecutor) {
    executor = configExecutor;
    executorSource = "config";
  } else if (input.detected.executor) {
    executor = input.detected.executor;
    executorSource = input.detected.executorSource === "env" ? "env" : "file";
  } else {
    executor = DEFAULT_EXECUTOR;
    executorSource = "default";
  }

  let architect: string;
  let architectSource: AgentDetectSource;
  if (architectFlag) {
    architect = architectFlag;
    architectSource = "flag";
  } else if (configArchitect) {
    architect = configArchitect;
    architectSource = "config";
  } else if (input.detected.architect) {
    architect = input.detected.architect;
    architectSource = input.detected.architectSource === "env" ? "env" : "file";
  } else {
    architect = DEFAULT_ARCHITECT;
    architectSource = "default";
  }

  return { executor, architect, executorSource, architectSource };
}
