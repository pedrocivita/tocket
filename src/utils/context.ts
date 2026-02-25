/** Shared constants and helpers for .context/ file operations. */

/** Number of days after which activeContext.md is considered stale. */
export const STALENESS_THRESHOLD_DAYS = 7;

/**
 * Extract the first meaningful line from the "## Current Focus" section
 * of an activeContext.md file. Returns empty string if no focus is set.
 */
export function extractFocus(content: string): string {
  const match = content.match(/## Current Focus\s*\n+(.+)/);
  if (!match?.[1]) return "";
  const line = match[1].trim();
  if (line.startsWith("_") || line.includes("No active tasks")) return "";
  return line.length > 80 ? line.substring(0, 77) + "..." : line;
}
