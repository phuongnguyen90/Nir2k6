// Periodic + on-demand screenshot capture.
//
// Honors policy.capturesEnabled and policy.screenshotIntervalSec. Each shot is a
// PNG written under <dataDir>/captures and then uploaded via the captures
// endpoint. On a headless box screenshot-desktop rejects; we log and skip so the
// agent keeps running.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import screenshot from "screenshot-desktop";
import { nanoid } from "nanoid";
import { postCapture } from "./api.js";
import type { EffectivePolicy } from "@hearth/shared";
import type { Logger } from "./logger.js";

export interface CaptureDeps {
  dataDir: string;
  serverUrl?: string;
  getToken: () => string | undefined;
  getPolicy: () => EffectivePolicy | null;
  log: Logger;
}

const MIN_INTERVAL_SEC = 15;

export class CaptureService {
  private readonly deps: CaptureDeps;
  private readonly log: Logger;
  private timer: NodeJS.Timeout | null = null;
  private currentIntervalSec = 0;
  private busy = false;

  constructor(deps: CaptureDeps) {
    this.deps = deps;
    this.log = deps.log.child("capture");
  }

  /** (Re)start the periodic loop based on the current policy. Safe to call often. */
  sync(): void {
    const policy = this.deps.getPolicy();
    if (!policy || !policy.capturesEnabled) {
      this.stop();
      return;
    }
    const interval = Math.max(MIN_INTERVAL_SEC, Math.floor(policy.screenshotIntervalSec || 0));
    if (this.timer && interval === this.currentIntervalSec) return; // already running at this cadence
    this.stop();
    this.currentIntervalSec = interval;
    this.timer = setInterval(() => void this.tick(), interval * 1000);
    this.log.info(`screenshot capture every ${interval}s`);
  }

  private async tick(): Promise<void> {
    const policy = this.deps.getPolicy();
    if (!policy || !policy.capturesEnabled) {
      this.stop();
      return;
    }
    await this.captureAndUpload();
  }

  /** Take one screenshot now (on-demand command). Returns true on success. */
  async captureOnce(): Promise<boolean> {
    return this.captureAndUpload();
  }

  private async captureAndUpload(): Promise<boolean> {
    if (this.busy) {
      this.log.debug("capture already in progress; skipping");
      return false;
    }
    this.busy = true;
    try {
      const buf = await screenshot({ format: "png" });
      const dir = join(this.deps.dataDir, "captures");
      await mkdir(dir, { recursive: true });
      const ts = new Date().toISOString();
      const file = join(dir, `shot-${Date.now()}-${nanoid(6)}.png`);
      await writeFile(file, buf);
      this.log.debug(`captured ${file} (${buf.byteLength} bytes)`);

      const token = this.deps.getToken();
      if (this.deps.serverUrl && token) {
        try {
          await postCapture(this.deps.serverUrl, token, file, { ts });
          this.log.debug("uploaded capture");
        } catch (e) {
          this.log.warn("capture upload failed (kept locally):", e instanceof Error ? e.message : e);
        }
      }
      return true;
    } catch (e) {
      this.log.warn("screenshot failed (headless or no display?):", e instanceof Error ? e.message : e);
      return false;
    } finally {
      this.busy = false;
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.currentIntervalSec = 0;
    }
  }
}
