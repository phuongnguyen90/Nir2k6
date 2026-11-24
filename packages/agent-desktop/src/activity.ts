// Foreground-activity sampler.
//
// Polls the foreground window on an interval, dedupes consecutive identical
// windows, and buffers ActivityEvent-like records. Buffered records are flushed
// in batches by a caller-supplied sink (WS when connected, REST otherwise).
// Honors policy.activityLogging.

import type { ActivityType, EffectivePolicy } from "@hearth/shared";
import type { PlatformAdapter } from "./platform/index.js";
import type { ActivityRecord } from "./api.js";
import type { Logger } from "./logger.js";

export interface ActivityDeps {
  adapter: PlatformAdapter;
  getPolicy: () => EffectivePolicy | null;
  flush: (events: ActivityRecord[]) => Promise<void>;
  log: Logger;
  pollMs?: number;
  flushEvery?: number; // flush when the buffer reaches this many records
}

const DEFAULT_POLL_MS = 20_000;
const DEFAULT_FLUSH_EVERY = 10;

const BROWSER_HINTS = [
  "chrome",
  "chromium",
  "firefox",
  "safari",
  "edge",
  "brave",
  "opera",
  "vivaldi",
  "browser",
];

function looksLikeBrowser(app: string | undefined, title: string | undefined): boolean {
  const hay = `${app ?? ""} ${title ?? ""}`.toLowerCase();
  return BROWSER_HINTS.some((h) => hay.includes(h));
}

export class ActivityService {
  private readonly deps: ActivityDeps;
  private readonly log: Logger;
  private readonly pollMs: number;
  private readonly flushEvery: number;

  private timer: NodeJS.Timeout | null = null;
  private buffer: ActivityRecord[] = [];
  private lastSignature: string | null = null;

  constructor(deps: ActivityDeps) {
    this.deps = deps;
    this.log = deps.log.child("activity");
    this.pollMs = deps.pollMs ?? DEFAULT_POLL_MS;
    this.flushEvery = deps.flushEvery ?? DEFAULT_FLUSH_EVERY;
  }

  start(): void {
    if (this.timer) return;
    if (!this.deps.adapter.capabilities().foreground) {
      this.log.info("foreground capability unavailable; activity sampling disabled");
      return;
    }
    this.timer = setInterval(() => void this.sample(), this.pollMs);
    this.log.info(`sampling foreground activity every ${Math.round(this.pollMs / 1000)}s`);
  }

  private async sample(): Promise<void> {
    const policy = this.deps.getPolicy();
    if (policy && !policy.activityLogging) return;

    let win;
    try {
      win = await this.deps.adapter.getForegroundWindow();
    } catch (e) {
      this.log.debug("foreground probe failed:", e);
      return;
    }
    if (!win) return;

    const signature = `${win.app ?? ""}|${win.title ?? ""}|${win.url ?? ""}`;
    if (signature === this.lastSignature) return; // dedupe consecutive identical windows
    this.lastSignature = signature;

    const isWeb = looksLikeBrowser(win.app, win.title);
    const type: ActivityType = isWeb ? "web" : "app";
    const record: ActivityRecord = {
      ts: new Date().toISOString(),
      type,
      title: win.title,
      url: win.url,
      app: win.app,
    };
    this.buffer.push(record);
    if (this.buffer.length >= this.flushEvery) await this.flush();
  }

  /** Flush buffered records through the sink. Keeps them on failure to retry. */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer;
    this.buffer = [];
    try {
      await this.deps.flush(batch);
      this.log.debug(`flushed ${batch.length} activity records`);
    } catch (e) {
      // put them back (front) so nothing is lost; cap to avoid unbounded growth.
      this.buffer = [...batch, ...this.buffer].slice(0, 500);
      this.log.warn("activity flush failed; will retry:", e instanceof Error ? e.message : e);
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
