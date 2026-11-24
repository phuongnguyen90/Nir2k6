// Windows platform adapter.
//
// - lockScreen: `rundll32.exe user32.dll,LockWorkStation`.
// - hosts block: C:\Windows\System32\drivers\etc\hosts (needs Administrator).
// - foreground: active-win.
// This compiles and is a real implementation; it does not run on the Linux CI
// box, where the lock command and the hosts path simply do not exist.

import { HOSTS_PATH, LOCK_COMMANDS } from "./constants.js";
import { setHostsBlock, clearHostsBlock } from "./hostsIO.js";
import { getForegroundWindow } from "./foreground.js";
import { runFirst } from "./run.js";
import type { AdapterCapabilities, AdapterContext, PlatformAdapter } from "./index.js";
import type { ForegroundWindow } from "./foreground.js";
import type { Logger } from "../logger.js";

export class WindowsAdapter implements PlatformAdapter {
  readonly platform = "windows" as const;
  private readonly log: Logger;

  constructor(ctx: AdapterContext) {
    this.log = ctx.log.child("win");
  }

  async lockScreen(): Promise<void> {
    const ok = await runFirst(LOCK_COMMANDS.windows, this.log);
    if (!ok) this.log.warn("LockWorkStation failed");
  }

  unlockHint(): void {
    this.log.info("unlock hint — the agent will stop enforcing the lock (it cannot force-unlock)");
  }

  async applyHostsBlock(domains: string[]): Promise<void> {
    await setHostsBlock(HOSTS_PATH.windows, domains, this.log);
  }

  async clearHostsBlock(): Promise<void> {
    await clearHostsBlock(HOSTS_PATH.windows, this.log);
  }

  getForegroundWindow(): Promise<ForegroundWindow | null> {
    return getForegroundWindow();
  }

  capabilities(): AdapterCapabilities {
    return { lock: true, hosts: true, foreground: true };
  }
}
