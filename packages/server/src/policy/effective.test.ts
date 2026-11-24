import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../db/index.js";
import { createRepos } from "../db/repos.js";
import { makeTestConfig } from "../test-helpers.js";
import { computeEffectivePolicy } from "./effective.js";

function seed() {
  const config = makeTestConfig();
  const db = openDatabase(config.dbPath, { capturesDir: config.capturesDir });
  const repos = createRepos(db);
  const parent = repos.createParent({ email: "p@example.com", displayName: "P", passwordHash: "x" });
  const child = repos.createChild({ parentId: parent.id, name: "Kid" });
  const device = repos.createDevice({ childId: child.id, name: "Laptop", platform: "windows" });
  return { config, db, repos, child, device };
}

test("locked during a bedtime lock schedule (wraps midnight)", () => {
  const { config, db, repos, child, device } = seed();
  // 21:00 (1260) -> 07:00 (420), every day.
  repos.createSchedule({
    childId: child.id,
    name: "Bedtime",
    type: "lock",
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    startMinute: 1260,
    endMinute: 420,
    enabled: true,
  });

  const night = computeEffectivePolicy(repos, config, device.id, new Date(2025, 0, 1, 23, 0, 0));
  assert.ok(night);
  assert.equal(night.locked, true);
  assert.match(night.lockReason ?? "", /Bedtime/);

  const noon = computeEffectivePolicy(repos, config, device.id, new Date(2025, 0, 1, 12, 0, 0));
  assert.ok(noon);
  assert.equal(noon.locked, false);
  db.close();
});

test("domain block and allow-list rules surface in the policy", () => {
  const { config, db, repos, child, device } = seed();
  repos.createRule({ childId: child.id, kind: "domain", pattern: "badsite.com", action: "block" });
  repos.createRule({ childId: child.id, kind: "app", pattern: "steam.exe", action: "block" });

  let policy = computeEffectivePolicy(repos, config, device.id)!;
  assert.deepEqual(policy.blockedDomains, ["badsite.com"]);
  assert.deepEqual(policy.blockedApps, ["steam.exe"]);
  assert.equal(policy.allowedDomainsOnly, null);
  assert.equal(policy.screenshotIntervalSec, 120);
  assert.equal(policy.capturesEnabled, true);

  repos.createRule({ childId: child.id, kind: "domain", pattern: "khan-academy.org", action: "allow" });
  policy = computeEffectivePolicy(repos, config, device.id)!;
  assert.deepEqual(policy.allowedDomainsOnly, ["khan-academy.org"]);
  db.close();
});

test("tightest daily quota wins", () => {
  const { config, db, repos, child, device } = seed();
  repos.createSchedule({
    childId: child.id, name: "A", type: "allowance", daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    startMinute: 0, endMinute: 1439, dailyQuotaMinutes: 120, enabled: true,
  });
  repos.createSchedule({
    childId: child.id, name: "B", type: "allowance", daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    startMinute: 0, endMinute: 1439, dailyQuotaMinutes: 60, enabled: true,
  });
  const policy = computeEffectivePolicy(repos, config, device.id)!;
  assert.equal(policy.dailyQuotaMinutes, 60);
  db.close();
});
