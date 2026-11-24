// Best-effort command runner for OS lock commands.
//
// Tries each candidate command in order and returns true on the first that
// exits 0. Any spawn error (ENOENT for a missing binary, non-zero exit, etc.)
// is swallowed so a missing tool never crashes the agent.

import { spawn } from "node:child_process";
import type { Logger } from "../logger.js";

export interface Command {
  cmd: string;
  args: string[];
}

function runOnce(cmd: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean): void => {
      if (!settled) {
        settled = true;
        resolve(ok);
      }
    };
    try {
      const child = spawn(cmd, args, { stdio: "ignore" });
      child.on("error", () => done(false));
      child.on("close", (code) => done(code === 0));
    } catch {
      done(false);
    }
  });
}

/** Try each command in order; resolves true as soon as one succeeds. */
export async function runFirst(commands: Command[], log: Logger): Promise<boolean> {
  for (const c of commands) {
    const ok = await runOnce(c.cmd, c.args);
    if (ok) {
      log.debug(`ran ${c.cmd} ${c.args.join(" ")}`);
      return true;
    }
  }
  return false;
}
