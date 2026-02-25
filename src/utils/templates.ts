import { homedir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

export interface TemplateVars {
  projectName: string;
  description: string;
  date: string;
}

export function getGlobalTemplatesPath(baseDir?: string): string {
  return join(baseDir ?? homedir(), ".tocket", "templates");
}

export function interpolateTemplate(
  content: string,
  vars: TemplateVars,
): string {
  return content
    .replaceAll("{{projectName}}", vars.projectName)
    .replaceAll("{{description}}", vars.description)
    .replaceAll("{{date}}", vars.date);
}

export async function readGlobalTemplate(
  filePath: string,
  vars: TemplateVars,
  templatesDir?: string,
): Promise<string | null> {
  const dir = templatesDir ?? getGlobalTemplatesPath();
  const fullPath = join(dir, filePath);
  try {
    const raw = await readFile(fullPath, "utf-8");
    return interpolateTemplate(raw, vars);
  } catch {
    return null;
  }
}
