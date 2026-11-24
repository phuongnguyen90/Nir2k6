// Resolve the enforceable policy for a device from its child's rules + schedules.
import type { EffectivePolicy } from "@hearth/shared";
import { isLockedBySchedules, clockFromDate } from "@hearth/shared";
import type { Config } from "../config.js";
import type { Repos } from "../db/repos.js";

export function computeEffectivePolicy(
  repos: Repos,
  config: Config,
  deviceId: string,
  now: Date = new Date(),
): EffectivePolicy | undefined {
  const device = repos.getDevice(deviceId);
  if (!device) return undefined;

  const rules = repos.listRulesByChild(device.childId);
  const schedules = repos.listSchedulesByChild(device.childId);

  const lock = isLockedBySchedules(schedules, clockFromDate(now));

  const blockedDomains = rules
    .filter((r) => r.kind === "domain" && r.action === "block")
    .map((r) => r.pattern);
  const allowedDomains = rules
    .filter((r) => r.kind === "domain" && r.action === "allow")
    .map((r) => r.pattern);
  const blockedApps = rules.filter((r) => r.kind === "app" && r.action === "block").map((r) => r.pattern);

  // Tightest enabled daily quota wins (if any schedule sets one).
  const quotas = schedules
    .filter((s) => s.enabled && typeof s.dailyQuotaMinutes === "number")
    .map((s) => s.dailyQuotaMinutes as number);
  const dailyQuotaMinutes = quotas.length > 0 ? Math.min(...quotas) : null;

  return {
    deviceId,
    computedAt: now.toISOString(),
    locked: lock.locked,
    lockReason: lock.reason,
    blockedDomains,
    allowedDomainsOnly: allowedDomains.length > 0 ? allowedDomains : null,
    blockedApps,
    capturesEnabled: true,
    screenshotIntervalSec: config.screenshotIntervalSec,
    activityLogging: true,
    dailyQuotaMinutes,
  };
}
