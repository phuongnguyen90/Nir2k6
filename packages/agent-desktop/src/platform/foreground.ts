// Foreground-window probe shared by every platform adapter.
//
// `active-win` is a CommonJS module (`export = `) whose default import gives the
// callable. On a headless box (no display) or without macOS accessibility
// permission it throws or returns undefined — all of which we treat as "no
// window" rather than letting it crash the agent.

import activeWindowDefault from "active-win";

export interface ForegroundWindow {
  app?: string;
  title?: string;
  url?: string;
}

interface ActiveWinResult {
  title?: string;
  owner?: { name?: string };
  url?: string;
}

// The default export may be undefined depending on interop; guard before use.
const activeWindow: unknown = activeWindowDefault;

export async function getForegroundWindow(): Promise<ForegroundWindow | null> {
  try {
    if (typeof activeWindow !== "function") return null;
    const fn = activeWindow as (opts?: { screenRecordingPermission?: boolean }) => Promise<unknown>;
    // Avoid prompting for macOS screen-recording permission just to read titles.
    const res = (await fn({ screenRecordingPermission: false })) as ActiveWinResult | undefined;
    if (!res) return null;
    const app = res.owner?.name || undefined;
    const title = res.title || undefined;
    const url = typeof res.url === "string" && res.url ? res.url : undefined;
    if (!app && !title && !url) return null;
    return { app, title, url };
  } catch {
    return null;
  }
}
