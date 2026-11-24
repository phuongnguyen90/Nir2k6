#!/usr/bin/env node
/**
 * Hearth desktop agent — runs in the background on a child's computer, connects
 * to the Hearth server, and enforces the parent's policy (web/app blocking,
 * time-based screen lock) while logging foreground activity and periodic
 * screenshots.
 *
 * Hearth is a TRANSPARENT parental-control tool, not stalkerware: the agent
 * announces itself (see the startup banner) and is designed to be visible.
 *
 * Run:
 *   hearth-agent --server http://host:8080 --enroll CODE
 *   hearth-agent --server http://host:8080 --enroll CODE --name "Kid's Laptop"
 *
 * Config precedence: CLI flags > env (HEARTH_SERVER, HEARTH_ENROLL_CODE,
 * HEARTH_DATA_DIR, HEARTH_NAME) > persisted config file in the data dir.
 * After first-run enrollment the device id + token are persisted, so later runs
 * need only `--server` (or nothing, if it was persisted too).
 */

import "dotenv/config";
import { AGENT_VERSION, resolveConfig, persistIdentity, type ResolvedConfig } from "./config.js";
import { ensureEnrolled } from "./enroll.js";
import { getAdapter } from "./platform/index.js";
import { Enforcer } from "./enforcement.js";
import { PolicyEngine } from "./policyEval.js";
import { CaptureService } from "./capture.js";
import { ActivityService } from "./activity.js";
import { WsClient } from "./ws-client.js";
import { fetchPolicy, postActivity, type ActivityRecord } from "./api.js";
import { createLogger, type Logger } from "./logger.js";
import type { EffectivePolicy } from "@hearth/shared";

const log = createLogger("agent");

function printUsage(): void {
  console.log(
    [
      `Hearth desktop agent v${AGENT_VERSION}`,
      "",
      "Usage:",
      "  hearth-agent --server <url> --enroll <code> [--name <name>] [--data-dir <dir>]",
      "",
      "Options:",
      "  --server <url>     Hearth server base URL (or env HEARTH_SERVER)",
      "  --enroll <code>    One-time enrollment code (or env HEARTH_ENROLL_CODE)",
      "  --name <name>      Device display name (or env HEARTH_NAME)",
      "  --data-dir <dir>   Where to store config + captures (or env HEARTH_DATA_DIR)",
      "  -h, --help         Show this help",
      "",
      "Hearth is a transparent parental-control tool. It identifies itself on the",
      "managed device and is not designed to hide from its user.",
    ].join("\n"),
  );
}

function printBanner(cfg: ResolvedConfig): void {
  const lines = [
    "──────────────────────────────────────────────────────────",
    "  Hearth — this device is managed by Hearth",
    `  Agent version : ${cfg.agentVersion}`,
    `  Device name   : ${cfg.name}`,
    `  Platform      : ${cfg.platform}`,
    `  Server        : ${cfg.serverUrl ?? "(not set)"}`,
    `  Data dir      : ${cfg.dataDir}`,
    "  A parent/guardian configured this device-management agent.",
    "──────────────────────────────────────────────────────────",
  ];
  console.log(lines.join("\n"));
}

async function main(): Promise<void> {
  const cfg = resolveConfig();

  if (process.argv.slice(2).includes("--help") || process.argv.slice(2).includes("-h")) {
    printUsage();
    return;
  }

  printBanner(cfg);

  const outcome = await ensureEnrolled(cfg, log);
  if (!outcome.enrolled) {
    log.warn(`not starting: ${outcome.reason}`);
    log.info("Provide an enroll code to activate, e.g.: hearth-agent --server <url> --enroll <CODE>");
    return; // graceful exit — nothing to enforce yet
  }
  if (!cfg.serverUrl || !cfg.deviceId || !cfg.deviceToken) {
    log.warn("not starting: missing server URL or device identity after enrollment");
    return;
  }
  // Persist resolved server/name alongside the enrolled identity for next run.
  persistIdentity(cfg);

  await run(cfg, log);
}

async function run(cfg: ResolvedConfig, logger: Logger): Promise<void> {
  const serverUrl = cfg.serverUrl!;
  const deviceId = cfg.deviceId!;
  const token = cfg.deviceToken!;

  const adapter = await getAdapter(cfg.platform, { log: logger });
  logger.info("platform capabilities:", JSON.stringify(adapter.capabilities()));

  const enforcer = new Enforcer(adapter, logger);
  const engine = new PolicyEngine(enforcer, logger);

  const capture = new CaptureService({
    dataDir: cfg.dataDir,
    serverUrl,
    getToken: () => cfg.deviceToken,
    getPolicy: () => engine.getPolicy(),
    log: logger,
  });

  // forward-declared so the activity sink can reach the ws client.
  let ws: WsClient | null = null;

  const flushSink = async (events: ActivityRecord[]): Promise<void> => {
    if (ws?.sendActivity(events)) return;
    await postActivity(serverUrl, token, events); // REST fallback
  };

  const activity = new ActivityService({
    adapter,
    getPolicy: () => engine.getPolicy(),
    flush: flushSink,
    log: logger,
  });

  const applyPolicy = (policy: EffectivePolicy): void => {
    void engine.setPolicy(policy).then(() => capture.sync());
  };

  ws = new WsClient({
    serverUrl,
    token,
    platform: cfg.platform,
    agentVersion: cfg.agentVersion,
    log: logger,
    onPolicy: (policy) => applyPolicy(policy),
    onCommand: async (action, args) => handleCommand(action, args, { adapter, capture, engine, serverUrl, deviceId, token, logger }),
    onReady: () => {
      void activity.flush();
      capture.sync();
    },
    fetchPolicyFallback: async () => {
      const policy = await fetchPolicy(serverUrl, deviceId, token);
      await engine.setPolicy(policy);
      capture.sync();
    },
  });

  // Start loops.
  ws.start();
  engine.start();
  activity.start();

  logger.info("agent started");

  // Clean shutdown: clear the hosts block and stop timers/sockets.
  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`received ${signal}; shutting down…`);
    activity.stop();
    capture.stop();
    engine.stop();
    ws?.stop();
    await enforcer.teardown();
    logger.info("goodbye");
    // With every timer cleared and the socket closed, the event loop drains and
    // Node exits 0 on its own (flushing stdout). The unref'd timer is only a
    // safety net that force-exits if some handle lingers; it never blocks exit.
    setTimeout(() => process.exit(0), 1500).unref();
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

interface CommandCtx {
  adapter: Awaited<ReturnType<typeof getAdapter>>;
  capture: CaptureService;
  engine: PolicyEngine;
  serverUrl: string;
  deviceId: string;
  token: string;
  logger: Logger;
}

async function handleCommand(
  action: string,
  _args: Record<string, unknown> | undefined,
  ctx: CommandCtx,
): Promise<{ ok: boolean; detail?: string }> {
  switch (action) {
    case "lock":
      await ctx.adapter.lockScreen();
      return { ok: true };
    case "unlock":
      ctx.adapter.unlockHint();
      return { ok: true };
    case "screenshot": {
      const ok = await ctx.capture.captureOnce();
      return { ok, detail: ok ? undefined : "capture failed (headless?)" };
    }
    case "refresh": {
      try {
        const policy = await fetchPolicy(ctx.serverUrl, ctx.deviceId, ctx.token);
        await ctx.engine.setPolicy(policy);
        ctx.capture.sync();
        return { ok: true };
      } catch (e) {
        return { ok: false, detail: e instanceof Error ? e.message : String(e) };
      }
    }
    default:
      return { ok: false, detail: `unknown action: ${action}` };
  }
}

main().catch((e) => {
  log.error("fatal:", e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});
