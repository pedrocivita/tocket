/** Normalize CRLF so fixture/template equality does not depend on git autocrlf. */
export function lf(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

/** Normalize OS separators for assertions against filesystem paths. */
export function posixPath(text: string): string {
  return text.split(/[\\/]/g).join("/");
}

/** True when hay contains needle after both sides use posix separators. */
export function includesPath(hay: string, needle: string): boolean {
  return posixPath(hay).includes(posixPath(needle));
}
