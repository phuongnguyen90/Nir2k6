// Pure, dependency-free helpers for schedule/policy evaluation.
// Shared so the server and the agent compute identical results.
import type { Schedule } from "./types.js";

export interface Clock {
  dayOfWeek: number; // 0=Sun..6=Sat
  minuteOfDay: number; // 0..1439
}

export function clockFromDate(d: Date): Clock {
  return { dayOfWeek: d.getDay(), minuteOfDay: d.getHours() * 60 + d.getMinutes() };
}

// Is `minute` inside [start,end), handling windows that wrap past midnight?
export function inWindow(minute: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start < end) return minute >= start && minute < end;
  return minute >= start || minute < end; // wraps midnight
}

// A "lock" schedule active now means the device should be LOCKED.
// An "allowance" schedule active means usage is ALLOWED; outside all allowance windows => locked.
export function isLockedBySchedules(schedules: Schedule[], clock: Clock): { locked: boolean; reason?: string } {
  const enabled = schedules.filter((s) => s.enabled);
  const allowances = enabled.filter((s) => s.type === "allowance");

  for (const s of enabled.filter((s) => s.type === "lock")) {
    if (!s.daysOfWeek.includes(clock.dayOfWeek)) continue;
    if (inWindow(clock.minuteOfDay, s.startMinute, s.endMinute)) {
      return { locked: true, reason: `Locked by schedule "${s.name}"` };
    }
  }

  if (allowances.length > 0) {
    const anyAllow = allowances.some(
      (s) => s.daysOfWeek.includes(clock.dayOfWeek) && inWindow(clock.minuteOfDay, s.startMinute, s.endMinute),
    );
    if (!anyAllow) return { locked: true, reason: "Outside allowed hours" };
  }

  return { locked: false };
}

export function minuteToHHMM(minute: number): string {
  const h = Math.floor(minute / 60).toString().padStart(2, "0");
  const m = (minute % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}
