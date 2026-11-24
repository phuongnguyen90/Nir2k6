// Pure string helpers for editing a hosts file between Hearth markers.
//
// The agent owns ONLY the region it writes between these two marker lines, so
// it can add, replace, or remove its block without disturbing anything else in
// the file. All functions here are pure (string in, string out) and are unit
// tested against a temp file / literals — they never touch the real /etc/hosts.

export const MARKER_BEGIN = "# >>> hearth";
export const MARKER_END = "# <<< hearth";

const SINKHOLE = "127.0.0.1";

function normalizeDomains(domains: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of domains) {
    const d = raw.trim().toLowerCase();
    if (d) seen.add(d);
  }
  return [...seen];
}

/** Render the marker-wrapped block that sinkholes each domain (and its www. host). */
export function buildBlock(domains: string[]): string {
  const lines: string[] = [MARKER_BEGIN];
  for (const d of normalizeDomains(domains)) {
    lines.push(`${SINKHOLE} ${d}`);
    if (!d.startsWith("www.")) lines.push(`${SINKHOLE} www.${d}`);
  }
  lines.push(MARKER_END);
  return lines.join("\n");
}

/**
 * Return `content` with any existing Hearth block removed. Trailing blank lines
 * left behind by the removal are collapsed; the result ends with a single
 * newline when non-empty, or is "" when the file had nothing but our block.
 */
export function removeBlock(content: string): string {
  const lines = content.split(/\r?\n/);
  const kept: string[] = [];
  let inside = false;
  for (const line of lines) {
    const t = line.trim();
    if (t === MARKER_BEGIN) {
      inside = true;
      continue;
    }
    if (t === MARKER_END) {
      inside = false;
      continue;
    }
    if (!inside) kept.push(line);
  }
  while (kept.length > 0 && kept[kept.length - 1]!.trim() === "") kept.pop();
  return kept.length > 0 ? kept.join("\n") + "\n" : "";
}

/**
 * Return `content` with the Hearth block set to sinkhole `domains`. Any prior
 * Hearth block is replaced. An empty domain list removes the block entirely
 * (equivalent to {@link removeBlock}).
 */
export function applyBlock(content: string, domains: string[]): string {
  const base = removeBlock(content);
  const uniq = normalizeDomains(domains);
  if (uniq.length === 0) return base;
  return base + buildBlock(uniq) + "\n";
}
