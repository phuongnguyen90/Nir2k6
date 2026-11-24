// First-run enrollment.
//
// If we have no device token but an enroll code is present, exchange the code at
// the enroll endpoint for a device id + token, persist them, and clear the used
// code from the running config so it is never reused.

import { enrollDevice } from "./api.js";
import { persistIdentity, type ResolvedConfig } from "./config.js";
import type { Logger } from "./logger.js";

export interface EnrollOutcome {
  enrolled: boolean;
  reason?: string;
}

/**
 * Ensure the agent has a device identity. Mutates `cfg` with deviceId/token on
 * success and persists them. Returns whether the agent is ready to connect.
 */
export async function ensureEnrolled(cfg: ResolvedConfig, log: Logger): Promise<EnrollOutcome> {
  const l = log.child("enroll");

  if (cfg.deviceId && cfg.deviceToken) {
    l.info(`already enrolled as device ${cfg.deviceId}`);
    return { enrolled: true };
  }

  if (!cfg.serverUrl) {
    return { enrolled: false, reason: "no server URL configured (pass --server or set HEARTH_SERVER)" };
  }
  if (!cfg.enrollCode) {
    return {
      enrolled: false,
      reason: "not enrolled and no enroll code provided (pass --enroll <CODE>)",
    };
  }

  l.info(`enrolling with server ${cfg.serverUrl}…`);
  try {
    const result = await enrollDevice(cfg.serverUrl, {
      enrollCode: cfg.enrollCode,
      name: cfg.name,
      platform: cfg.platform,
      agentVersion: cfg.agentVersion,
    });
    cfg.deviceId = result.device.id;
    cfg.deviceToken = result.token;
    cfg.enrollCode = undefined; // clear the used code
    persistIdentity(cfg);
    l.info(`enrolled successfully as device ${cfg.deviceId}`);
    return { enrolled: true };
  } catch (e) {
    return { enrolled: false, reason: `enrollment failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}
