import { test } from "node:test";
import assert from "node:assert/strict";
import { inWindow, isLockedBySchedules, clockFromDate, minuteToHHMM } from "./policy.js";
import type { Schedule } from "./types.js";

test("inWindow normal window", () => {
  assert.equal(inWindow(600, 540, 1020), true); // 10:00 within 09:00-17:00
  assert.equal(inWindow(1030, 540, 1020), false);
});

test("inWindow wrapping midnight (bedtime 21:00-07:00)", () => {
  assert.equal(inWindow(1380, 1260, 420), true); // 23:00
  assert.equal(inWindow(120, 1260, 420), true); // 02:00
  assert.equal(inWindow(600, 1260, 420), false); // 10:00
});

const mk = (p: Partial<Schedule>): Schedule => ({
  id: "s", childId: "c", name: "n", type: "lock",
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startMinute: 1260, endMinute: 420,
  enabled: true, createdAt: "", ...p,
});

test("bedtime lock active at 02:00", () => {
  const r = isLockedBySchedules([mk({})], { dayOfWeek: 3, minuteOfDay: 120 });
  assert.equal(r.locked, true);
});

test("not locked at noon", () => {
  const r = isLockedBySchedules([mk({})], { dayOfWeek: 3, minuteOfDay: 720 });
  assert.equal(r.locked, false);
});

test("allowance mode locks outside window", () => {
  const sched = mk({ type: "allowance", startMinute: 1020, endMinute: 1140, name: "evening" }); // 17-19
  assert.equal(isLockedBySchedules([sched], { dayOfWeek: 3, minuteOfDay: 720 }).locked, true);
  assert.equal(isLockedBySchedules([sched], { dayOfWeek: 3, minuteOfDay: 1050 }).locked, false);
});

test("helpers", () => {
  assert.equal(minuteToHHMM(1260), "21:00");
  assert.ok(clockFromDate(new Date()).minuteOfDay >= 0);
});
