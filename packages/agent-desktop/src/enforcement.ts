// Reconciles an EffectivePolicy against actual device state.
//
// Enforcement is idempotent and edge-triggered: we remember what we last applied
// and only act on changes (lock on the unlocked→locked edge, rewrite the hosts
// block only when the domain set changes). This keeps the local tick cheap and
// avoids hammering the hosts file.

import type { EffectivePolicy } from "@hearth/shared";
import type { PlatformAdapter } from "./platform/index.js";
import type { Logger } from "./logger.js";

const LOCK_BANNER = "Time's up — this device is locked by Hearth.";

export class Enforcer {
  private readonly log: Logger;
  private readonly adapter: PlatformAdapter;

  private lastLocked: boolean | null = null;
  private lastDomainsKey: string | null = null;
  private warnedAllowList = false;

  constructor(adapter: PlatformAdapter, log: Logger) {
    this.adapter = adapter;
    this.log = log.child("enforce");
  }

  /** Apply `policy`, acting only on what changed since the last call. */
  async reconcile(policy: EffectivePolicy): Promise<void> {
    await this.reconcileLock(policy);
    await this.reconcileHosts(policy);
    // M5 TODO: blockedApps enforcement (kill/prevent launch of policy.blockedApps)
    // is out of scope for now. It needs per-OS process control (job objects on
    // Windows, launchd/ptrace on macOS, cgroups on Linux) and careful UX so the
    // child sees *why* an app closed.
    if (policy.blockedApps.length > 0) {
      this.log.debug(`blockedApps enforcement not yet implemented (M5): ${policy.blockedApps.join(", ")}`);
    }
  }

  private async reconcileLock(policy: EffectivePolicy): Promise<void> {
    if (policy.locked === this.lastLocked) return;

    if (policy.locked) {
      const reason = policy.lockReason ? ` (${policy.lockReason})` : "";
      this.log.info(`${LOCK_BANNER}${reason}`);
      if (this.adapter.capabilities().lock) {
        await this.adapter.lockScreen();
      } else {
        this.log.warn("lock requested but this platform adapter reports no lock capability");
      }
    } else {
      this.log.info("Device unlocked by Hearth — enforcement stopped.");
      this.adapter.unlockHint();
    }
    this.lastLocked = policy.locked;
  }

  private async reconcileHosts(policy: EffectivePolicy): Promise<void> {
    if (!this.adapter.capabilities().hosts) return;

    // allow-list mode cannot be expressed with a sinkhole block (you cannot
    // "allow only these" by listing hosts to block). We still apply the
    // block-list; true allow-list enforcement needs a local proxy/DNS resolver.
    if (policy.allowedDomainsOnly !== null && !this.warnedAllowList) {
      this.log.warn(
        "policy is in allow-list mode (allowedDomainsOnly), which hosts-file blocking cannot express. " +
          "TODO: implement a local DNS/proxy allow-list mode. Applying the block-list only for now.",
      );
      this.warnedAllowList = true;
    }
    if (policy.allowedDomainsOnly === null) this.warnedAllowList = false;

    const domains = [...policy.blockedDomains].map((d) => d.trim().toLowerCase()).filter(Boolean);
    domains.sort();
    const key = domains.join("\n");
    if (key === this.lastDomainsKey) return;

    await this.adapter.applyHostsBlock(domains);
    this.lastDomainsKey = key;
    this.log.info(`applied domain block (${domains.length} domains)`);
  }

  /** Remove any installed hosts block (used on clean shutdown). */
  async teardown(): Promise<void> {
    if (!this.adapter.capabilities().hosts) return;
    try {
      await this.adapter.clearHostsBlock();
      this.lastDomainsKey = null;
      this.log.info("cleared hosts block on shutdown");
    } catch (e) {
      this.log.warn("failed to clear hosts block on shutdown:", e);
    }
  }
}
