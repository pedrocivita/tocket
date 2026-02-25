import chalk from "chalk";

// ── Brand colors ──────────────────────────────────────────────────────
export const purple = chalk.hex("#7C3AED");
export const green = chalk.green;
export const red = chalk.red;
export const yellow = chalk.yellow;
export const dimmed = chalk.dim;
export const bold = chalk.bold;

// ── ASCII banner ──────────────────────────────────────────────────────
export function banner(): string {
  const art = `
  ████████╗ ██████╗  ██████╗██╗  ██╗███████╗████████╗
  ╚══██╔══╝██╔═══██╗██╔════╝██║ ██╔╝██╔════╝╚══██╔══╝
     ██║   ██║   ██║██║     █████╔╝ █████╗     ██║
     ██║   ██║   ██║██║     ██╔═██╗ ██╔══╝     ██║
     ██║   ╚██████╔╝╚██████╗██║  ██╗███████╗   ██║
     ╚═╝    ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝   ╚═╝`;

  return purple(art) + "\n" + dimmed("  Context Engineering Framework\n");
}

// ── Semantic helpers ──────────────────────────────────────────────────
export function success(msg: string): string {
  return `${green("\u2713")} ${msg}`;
}

export function error(msg: string): string {
  return `${red("\u2717")} ${msg}`;
}

export function warn(msg: string): string {
  return `${yellow("\u26A0")} ${msg}`;
}

export function info(msg: string): string {
  return `${purple("\u203A")} ${msg}`;
}

export function heading(msg: string): string {
  return bold(purple(msg));
}

export function dim(msg: string): string {
  return dimmed(msg);
}
