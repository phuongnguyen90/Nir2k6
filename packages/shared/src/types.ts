// Domain types — single source of truth, shared by server, dashboard and agents.

export type Platform = "windows" | "macos" | "linux" | "android" | "ios";
export type DeviceStatus = "online" | "offline" | "locked" | "unenrolled";
export type RuleKind = "domain" | "app";
export type RuleAction = "block" | "allow";
export type ContentCategory =
  | "adult"
  | "gambling"
  | "violence"
  | "drugs"
  | "social"
  | "games"
  | "video"
  | "malware"
  | "custom"
  | "unknown";
export type AlertSeverity = "info" | "warn" | "alert";
export type ActivityType = "web" | "app" | "system";
export type ScheduleType = "lock" | "allowance";

export interface Parent {
  id: string;
  email: string;
  displayName: string;
  createdAt: string; // ISO
}

export interface Child {
  id: string;
  parentId: string;
  name: string;
  birthYear?: number;
  avatarColor?: string;
  createdAt: string;
}

export interface Device {
  id: string;
  childId: string;
  name: string;
  platform: Platform;
  status: DeviceStatus;
  agentVersion?: string;
  lastSeenAt?: string;
  createdAt: string;
}

export interface Rule {
  id: string;
  childId: string;
  kind: RuleKind;
  pattern: string; // domain glob or app identifier
  action: RuleAction;
  category?: ContentCategory;
  note?: string;
  createdAt: string;
}

// Minutes since local midnight, 0..1439. daysOfWeek: 0=Sun..6=Sat.
export interface Schedule {
  id: string;
  childId: string;
  name: string;
  type: ScheduleType; // "lock" = device locked in window; "allowance" = only usable in window
  daysOfWeek: number[];
  startMinute: number;
  endMinute: number; // may wrap past midnight if end < start
  dailyQuotaMinutes?: number; // optional screen-time budget per day
  enabled: boolean;
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  deviceId: string;
  ts: string;
  type: ActivityType;
  title?: string;
  url?: string;
  app?: string;
  meta?: Record<string, unknown>;
}

export interface Capture {
  id: string;
  deviceId: string;
  ts: string;
  kind: "screenshot";
  ref: string; // storage reference / filename
  width?: number;
  height?: number;
  analyzed: boolean;
  createdAt: string;
}

export interface Alert {
  id: string;
  childId: string;
  deviceId?: string;
  ts: string;
  severity: AlertSeverity;
  category: ContentCategory;
  message: string;
  evidence?: { url?: string; title?: string; app?: string; captureId?: string; score?: number };
  acknowledgedAt?: string;
  createdAt: string;
}

// The resolved, ready-to-enforce policy the server pushes to an agent.
export interface EffectivePolicy {
  deviceId: string;
  computedAt: string;
  locked: boolean;
  lockReason?: string;
  blockedDomains: string[];
  // when non-null, ONLY these domains are allowed (allow-list mode)
  allowedDomainsOnly: string[] | null;
  blockedApps: string[];
  capturesEnabled: boolean;
  screenshotIntervalSec: number;
  activityLogging: boolean;
  dailyQuotaMinutes: number | null;
}
