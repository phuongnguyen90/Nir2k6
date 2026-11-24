import type { Platform, ContentCategory } from "@hearth/shared";
import { minutesToHHMM } from "./components/TimeField";

export const PLATFORM_LABEL: Record<Platform, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  android: "Android",
  ios: "iPhone / iPad",
};

export const CATEGORY_LABEL: Record<ContentCategory, string> = {
  adult: "Adult",
  gambling: "Gambling",
  violence: "Violence",
  drugs: "Drugs",
  social: "Social",
  games: "Games",
  video: "Video",
  malware: "Malware",
  custom: "Custom",
  unknown: "Unknown",
};

/** Compact "2 min ago" / "in 3 hours" style relative time from an ISO string. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const diffMs = then - Date.now();
  const abs = Math.abs(diffMs);
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [1000 * 60 * 60 * 24 * 365, "year"],
    [1000 * 60 * 60 * 24 * 30, "month"],
    [1000 * 60 * 60 * 24 * 7, "week"],
    [1000 * 60 * 60 * 24, "day"],
    [1000 * 60 * 60, "hour"],
    [1000 * 60, "minute"],
    [1000, "second"],
  ];
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [ms, unit] of units) {
    if (abs >= ms || unit === "second") {
      return rtf.format(Math.round(diffMs / ms), unit);
    }
  }
  return "just now";
}

/** Absolute local date-time, e.g. "Nov 24, 14:03". */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "21:00–07:00" from start/end minutes. */
export function formatMinuteRange(startMinute: number, endMinute: number): string {
  return `${minutesToHHMM(startMinute)}–${minutesToHHMM(endMinute)}`;
}
