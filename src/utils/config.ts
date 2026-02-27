import { homedir } from "node:os";
import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

export interface TocketConfig {
  author?: string;
  defaultAgent?: string;
  agents?: {
    architect?: string;
    executor?: string;
  };
  defaults?: {
    priority?: "high" | "medium" | "low";
    skills?: string;
  };
  theme?: {
    disableBanner?: boolean;
  };
}

export function getConfigPath(): string {
  return join(homedir(), ".tocketrc.json");
}

export async function getConfig(
  configPath?: string,
): Promise<TocketConfig> {
  const path = configPath ?? getConfigPath();
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as TocketConfig;
  } catch {
    return {};
  }
}

export async function saveConfig(
  config: TocketConfig,
  configPath?: string,
): Promise<void> {
  const path = configPath ?? getConfigPath();
  await writeFile(path, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export async function updateConfig(
  partial: Partial<TocketConfig>,
  configPath?: string,
): Promise<void> {
  const current = await getConfig(configPath);
  const merged: TocketConfig = {
    ...current,
    ...partial,
    agents: { ...current.agents, ...partial.agents },
    defaults: { ...current.defaults, ...partial.defaults },
    theme: { ...current.theme, ...partial.theme },
  };
  await saveConfig(merged, configPath);
}

export async function resetConfig(configPath?: string): Promise<void> {
  await saveConfig({}, configPath);
}
