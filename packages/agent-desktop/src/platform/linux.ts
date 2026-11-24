// Linux platform adapter (best-effort, real implementation).
//
// - lockScreen: tries loginctl, then xdg-screensaver, then gnome-screensaver.
// - hosts block: edits /etc/hosts between Hearth markers (needs root; EACCES is
//   logged and ignored).
// - foreground: active-win.
// On a headless CI box none of the lock commands exist and /etc/hosts is not
// writable — every path degrades to a warning, never a crash.

import { HOSTS_PATH, LOCK_COMMANDS } from "./constants.js";
import { setHostsBlock, clearHostsBlock } from "./hostsIO.js";
import { getForegroundWindow } from "./foreground.js";
import { runFirst } from "./run.js";
import type { AdapterCapabilities, AdapterContext, PlatformAdapter } from "./index.js";
import type { ForegroundWindow } from "./foreground.js";
import type { Logger } from "../logger.js";

export class LinuxAdapter implements PlatformAdapter {
  readonly platform = "linux" as const;
  private readonly log: Logger;

  constructor(ctx: AdapterContext) {
    this.log = ctx.log.child("linux");
  }

  async lockScreen(): Promise<void> {
    const ok = await runFirst(LOCK_COMMANDS.linux, this.log);
    if (!ok) this.log.warn("no working screen-lock command found (loginctl/xdg-screensaver/gnome)");
  }

  unlockHint(): void {
    this.log.info("unlock hint — the agent will stop enforcing the lock (it cannot force-unlock)");
  }

  async applyHostsBlock(domains: string[]): Promise<void> {
    await setHostsBlock(HOSTS_PATH.linux, domains, this.log);
  }

  async clearHostsBlock(): Promise<void> {
    await clearHostsBlock(HOSTS_PATH.linux, this.log);
  }

  getForegroundWindow(): Promise<ForegroundWindow | null> {
    return getForegroundWindow();
  }

  capabilities(): AdapterCapabilities {
    return { lock: true, hosts: true, foreground: true };
  }
}
