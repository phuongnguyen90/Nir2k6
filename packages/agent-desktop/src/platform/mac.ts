// macOS platform adapter.
//
// - lockScreen: `pmset displaysleepnow`, falling back to CGSession -suspend.
//   (A hard lock additionally requires "require password immediately" in System
//   Settings; sleeping the display is the sanctioned, no-extra-privilege path.)
// - hosts block: /etc/hosts (needs root; also run `dscacheutil -flushcache` out
//   of band in production to drop cached lookups).
// - foreground: active-win (may need Accessibility permission for titles/URLs).
// Compiles everywhere; the lock commands do not exist on the Linux CI box.

import { HOSTS_PATH, LOCK_COMMANDS } from "./constants.js";
import { setHostsBlock, clearHostsBlock } from "./hostsIO.js";
import { getForegroundWindow } from "./foreground.js";
import { runFirst } from "./run.js";
import type { AdapterCapabilities, AdapterContext, PlatformAdapter } from "./index.js";
import type { ForegroundWindow } from "./foreground.js";
import type { Logger } from "../logger.js";

export class MacAdapter implements PlatformAdapter {
  readonly platform = "macos" as const;
  private readonly log: Logger;

  constructor(ctx: AdapterContext) {
    this.log = ctx.log.child("mac");
  }

  async lockScreen(): Promise<void> {
    const ok = await runFirst(LOCK_COMMANDS.macos, this.log);
    if (!ok) this.log.warn("no working screen-lock command found (pmset/CGSession)");
  }

  unlockHint(): void {
    this.log.info("unlock hint — the agent will stop enforcing the lock (it cannot force-unlock)");
  }

  async applyHostsBlock(domains: string[]): Promise<void> {
    await setHostsBlock(HOSTS_PATH.macos, domains, this.log);
  }

  async clearHostsBlock(): Promise<void> {
    await clearHostsBlock(HOSTS_PATH.macos, this.log);
  }

  getForegroundWindow(): Promise<ForegroundWindow | null> {
    return getForegroundWindow();
  }

  capabilities(): AdapterCapabilities {
    return { lock: true, hosts: true, foreground: true };
  }
}
