// File I/O wrapper around the pure hostsFile string helpers.
//
// Reads the current hosts file, rewrites only the Hearth marker block, and
// writes it back. Editing the hosts file needs root/Administrator; on EACCES we
// log a clear, actionable warning and continue rather than crashing.

import { readFile, writeFile } from "node:fs/promises";
import { applyBlock, removeBlock } from "./hostsFile.js";
import type { Logger } from "../logger.js";

function isErrno(e: unknown): e is NodeJS.ErrnoException {
  return e instanceof Error && "code" in e;
}

async function readHosts(path: string, log: Logger): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (e) {
    if (isErrno(e) && e.code === "ENOENT") return "";
    log.warn(`cannot read hosts file ${path}:`, isErrno(e) ? e.code : e);
    return null;
  }
}

async function writeHosts(path: string, content: string, log: Logger): Promise<boolean> {
  try {
    await writeFile(path, content, "utf8");
    return true;
  } catch (e) {
    if (isErrno(e) && e.code === "EACCES") {
      log.warn(
        `cannot write hosts file ${path} (permission denied) — the agent needs ` +
          `root/Administrator to enforce domain blocking. Skipping hosts enforcement.`,
      );
    } else {
      log.warn(`cannot write hosts file ${path}:`, isErrno(e) ? e.code : e);
    }
    return false;
  }
}

export async function setHostsBlock(path: string, domains: string[], log: Logger): Promise<boolean> {
  const current = await readHosts(path, log);
  if (current === null) return false;
  const next = applyBlock(current, domains);
  if (next === current) return true; // already in desired state
  return writeHosts(path, next, log);
}

export async function clearHostsBlock(path: string, log: Logger): Promise<boolean> {
  const current = await readHosts(path, log);
  if (current === null) return false;
  const next = removeBlock(current);
  if (next === current) return true;
  return writeHosts(path, next, log);
}
