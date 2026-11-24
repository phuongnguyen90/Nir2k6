// Configuration resolution: CLI flags > env vars > persisted JSON config file.
//
// The persisted file lives in the data dir (default: the OS per-user config dir,
// e.g. ~/.config/hearth-agent) and stores what survives restarts: the server
// URL, the device identity (id + token) obtained at enrollment, and the name.

import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Platform } from "@hearth/shared";

const require = createRequire(import.meta.url);

function readAgentVersion(): string {
  try {
    const pkg = require("../package.json") as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export const AGENT_VERSION = readAgentVersion();
const CONFIG_FILENAME = "config.json";
const APP_DIR = "hearth-agent";

/** Map Node's process.platform to the shared Platform union. Defaults to linux. */
export function detectPlatform(p: NodeJS.Platform = process.platform): Platform {
  switch (p) {
    case "win32":
      return "windows";
    case "darwin":
      return "macos";
    case "linux":
      return "linux";
    default:
      return "linux";
  }
}

/** The OS-appropriate per-user config directory for the agent. */
export function defaultDataDir(p: NodeJS.Platform = process.platform, env = process.env): string {
  if (p === "win32") {
    const base = env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    return join(base, APP_DIR);
  }
  if (p === "darwin") {
    return join(homedir(), "Library", "Application Support", APP_DIR);
  }
  const base = env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(base, APP_DIR);
}

/** What we persist to disk between runs. */
export interface PersistedConfig {
  serverUrl?: string;
  deviceId?: string;
  deviceToken?: string;
  name?: string;
}

/** Parsed command-line flags. */
export interface CliFlags {
  server?: string;
  enroll?: string;
  name?: string;
  dataDir?: string;
  help?: boolean;
}

/** Fully resolved runtime configuration. */
export interface ResolvedConfig {
  serverUrl?: string;
  enrollCode?: string;
  name: string;
  dataDir: string;
  configPath: string;
  platform: Platform;
  agentVersion: string;
  deviceId?: string;
  deviceToken?: string;
}

export function parseArgs(argv: string[]): CliFlags {
  const flags: CliFlags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = (): string | undefined => argv[++i];
    switch (arg) {
      case "--server":
        flags.server = next();
        break;
      case "--enroll":
        flags.enroll = next();
        break;
      case "--name":
        flags.name = next();
        break;
      case "--data-dir":
        flags.dataDir = next();
        break;
      case "--help":
      case "-h":
        flags.help = true;
        break;
      default:
        if (arg?.startsWith("--")) {
          const eq = arg.indexOf("=");
          if (eq > 0) {
            const key = arg.slice(2, eq);
            const value = arg.slice(eq + 1);
            if (key === "server") flags.server = value;
            else if (key === "enroll") flags.enroll = value;
            else if (key === "name") flags.name = value;
            else if (key === "data-dir") flags.dataDir = value;
          }
        }
        break;
    }
  }
  return flags;
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function loadPersisted(dataDir: string): PersistedConfig {
  const file = join(dataDir, CONFIG_FILENAME);
  try {
    if (!existsSync(file)) return {};
    const raw = readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") return parsed as PersistedConfig;
    return {};
  } catch {
    return {};
  }
}

export function savePersisted(dataDir: string, cfg: PersistedConfig): void {
  ensureDir(dataDir);
  const file = join(dataDir, CONFIG_FILENAME);
  writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}

/**
 * Resolve config from flags + env + persisted file. Precedence (high→low):
 * CLI flag, environment variable, persisted file, built-in default.
 */
export function resolveConfig(argv = process.argv.slice(2), env = process.env): ResolvedConfig {
  const flags = parseArgs(argv);
  const platform = detectPlatform();

  const dataDir = flags.dataDir ?? env.HEARTH_DATA_DIR ?? defaultDataDir();
  ensureDir(dataDir);
  const persisted = loadPersisted(dataDir);

  const serverUrl = flags.server ?? env.HEARTH_SERVER ?? persisted.serverUrl;
  const enrollCode = flags.enroll ?? env.HEARTH_ENROLL_CODE;
  const name = flags.name ?? env.HEARTH_NAME ?? persisted.name ?? `${platform}-device`;

  return {
    serverUrl,
    enrollCode,
    name,
    dataDir,
    configPath: join(dataDir, CONFIG_FILENAME),
    platform,
    agentVersion: AGENT_VERSION,
    deviceId: persisted.deviceId,
    deviceToken: persisted.deviceToken,
  };
}

/** Persist the enrolled identity + chosen server/name back to disk. */
export function persistIdentity(cfg: ResolvedConfig): void {
  savePersisted(cfg.dataDir, {
    serverUrl: cfg.serverUrl,
    deviceId: cfg.deviceId,
    deviceToken: cfg.deviceToken,
    name: cfg.name,
  });
}
