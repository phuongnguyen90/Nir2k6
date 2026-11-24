// Local policy store + periodic re-evaluation.
//
// The server pushes a fully-resolved EffectivePolicy, which we trust and re-apply
// on every tick so enforcement continues even with no network. If the child's
// schedules are also known locally (optional, future), we recompute the `locked`
// flag with the shared evaluator so a schedule boundary can flip the lock while
// offline.

import { clockFromDate, isLockedBySchedules, type EffectivePolicy, type Schedule } from "@hearth/shared";
import type { Enforcer } from "./enforcement.js";
import type { Logger } from "./logger.js";

const DEFAULT_TICK_MS = 30_000;

export class PolicyEngine {
  private readonly enforcer: Enforcer;
  private readonly log: Logger;
  private readonly tickMs: number;

  private current: EffectivePolicy | null = null;
  private schedules: Schedule[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(enforcer: Enforcer, log: Logger, tickMs: number = DEFAULT_TICK_MS) {
    this.enforcer = enforcer;
    this.log = log.child("policy");
    this.tickMs = tickMs;
  }

  getPolicy(): EffectivePolicy | null {
    return this.current;
  }

  /** Accept a server-pushed policy and enforce it immediately. */
  async setPolicy(policy: EffectivePolicy): Promise<void> {
    this.current = policy;
    await this.applyNow();
  }

  /** Optionally provide schedules for offline lock recomputation. */
  setSchedules(schedules: Schedule[]): void {
    this.schedules = schedules;
  }

  /** Re-evaluate and enforce the current policy (incl. offline schedule check). */
  async tick(): Promise<void> {
    await this.applyNow();
  }

  private async applyNow(): Promise<void> {
    if (!this.current) return;
    const effective = this.withScheduleLock(this.current);
    try {
      await this.enforcer.reconcile(effective);
    } catch (e) {
      this.log.warn("enforcement tick failed:", e instanceof Error ? e.message : e);
    }
  }

  // If local schedules say we should be locked, honor that even if the last
  // server policy predates the boundary. We never *unlock* purely locally — the
  // server remains authoritative for relaxing a lock.
  private withScheduleLock(policy: EffectivePolicy): EffectivePolicy {
    if (this.schedules.length === 0) return policy;
    const { locked, reason } = isLockedBySchedules(this.schedules, clockFromDate(new Date()));
    if (locked && !policy.locked) {
      return { ...policy, locked: true, lockReason: reason ?? policy.lockReason };
    }
    return policy;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.tickMs);
    this.log.info(`local policy tick every ${Math.round(this.tickMs / 1000)}s`);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
