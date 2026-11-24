// Platform adapter contract + factory.
//
// Each OS has quirks for locking the screen and installing a network block, but
// the enforcement layer should not care which OS it runs on. Adapters hide the
// differences behind this single interface and degrade gracefully when a
// capability is unavailable (headless, no root, missing tools).

import type { Platform } from "@hearth/shared";
import type { ForegroundWindow } from "./foreground.js";
import type { Logger } from "../logger.js";

export interface AdapterCapabilities {
  lock: boolean;
  hosts: boolean;
  foreground: boolean;
}

export interface PlatformAdapter {
  readonly platform: Platform;
  /** Lock the interactive session. Best-effort; never throws. */
  lockScreen(): Promise<void>;
  /** We cannot force an unlock; this just signals we should stop enforcing a lock. */
  unlockHint(): void;
  /** Install a block for the given domains via the hosts file. Never throws. */
  applyHostsBlock(domains: string[]): Promise<void>;
  /** Remove any Hearth-installed hosts block. Never throws. */
  clearHostsBlock(): Promise<void>;
  /** Current foreground window, or null if unavailable. */
  getForegroundWindow(): Promise<ForegroundWindow | null>;
  capabilities(): AdapterCapabilities;
}

export interface AdapterContext {
  log: Logger;
}

export async function getAdapter(platform: Platform, ctx: AdapterContext): Promise<PlatformAdapter> {
  switch (platform) {
    case "windows": {
      const { WindowsAdapter } = await import("./win.js");
      return new WindowsAdapter(ctx);
    }
    case "macos": {
      const { MacAdapter } = await import("./mac.js");
      return new MacAdapter(ctx);
    }
    case "linux": {
      const { LinuxAdapter } = await import("./linux.js");
      return new LinuxAdapter(ctx);
    }
    default: {
      // android / ios have no desktop agent; use a no-op linux-like adapter.
      const { LinuxAdapter } = await import("./linux.js");
      return new LinuxAdapter(ctx);
    }
  }
}
