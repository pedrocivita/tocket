export const DEFAULT_EXECUTOR = "Claude Code";
export const DEFAULT_ARCHITECT = "Gemini";

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
