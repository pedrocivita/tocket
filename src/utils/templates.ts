import { homedir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

export interface TemplateVars {
  projectName: string;
  description: string;
  date: string;
  architectName: string;
  executorName: string;
  architectFile: string;
  executorFile: string;
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
    .replaceAll("{{date}}", vars.date)
    .replaceAll("{{architectName}}", vars.architectName)
    .replaceAll("{{executorName}}", vars.executorName)
    .replaceAll("{{architectFile}}", vars.architectFile)
    .replaceAll("{{executorFile}}", vars.executorFile);
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
