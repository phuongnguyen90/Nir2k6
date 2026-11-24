// Typed repository helpers: prepared statements + snake_case<->camelCase and
// JSON-column mappers, so route handlers stay clean and never touch raw SQL.
import { nanoid, customAlphabet } from "nanoid";
import type {
  Parent,
  Child,
  Device,
  DeviceStatus,
  Platform,
  Rule,
  RuleKind,
  RuleAction,
  ContentCategory,
  Schedule,
  ScheduleType,
  ActivityEvent,
  ActivityType,
  Capture,
  Alert,
  AlertSeverity,
} from "@hearth/shared";
import type { DB } from "./index.js";

// Human-friendlier, unambiguous code for device enrollment.
const enrollAlphabet = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

function nowIso(): string {
  return new Date().toISOString();
}

function toJson(v: unknown): string | null {
  return v === undefined || v === null ? null : JSON.stringify(v);
}

function parseJson<T>(v: unknown): T | undefined {
  if (typeof v !== "string" || v.length === 0) return undefined;
  try {
    return JSON.parse(v) as T;
  } catch {
    return undefined;
  }
}

function orUndef(v: unknown): string | undefined {
  return v === null || v === undefined ? undefined : String(v);
}

function numOrUndef(v: unknown): number | undefined {
  return v === null || v === undefined ? undefined : Number(v);
}

// ---- row shapes (as stored in SQLite) ----
interface ParentRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  created_at: string;
}
interface ChildRow {
  id: string;
  parent_id: string;
  name: string;
  birth_year: number | null;
  avatar_color: string | null;
  created_at: string;
}
interface DeviceRow {
  id: string;
  child_id: string;
  name: string;
  platform: string;
  status: string;
  agent_version: string | null;
  last_seen_at: string | null;
  created_at: string;
}
interface EnrollCodeRow {
  code: string;
  child_id: string;
  name: string;
  platform: string;
  created_at: string;
  used_at: string | null;
}
interface RuleRow {
  id: string;
  child_id: string;
  kind: string;
  pattern: string;
  action: string;
  category: string | null;
  note: string | null;
  created_at: string;
}
interface ScheduleRow {
  id: string;
  child_id: string;
  name: string;
  type: string;
  days_of_week: string;
  start_minute: number;
  end_minute: number;
  daily_quota_minutes: number | null;
  enabled: number;
  created_at: string;
}
interface ActivityRow {
  id: string;
  device_id: string;
  ts: string;
  type: string;
  title: string | null;
  url: string | null;
  app: string | null;
  meta: string | null;
  created_at: string;
}
interface CaptureRow {
  id: string;
  device_id: string;
  ts: string;
  kind: string;
  ref: string;
  width: number | null;
  height: number | null;
  analyzed: number;
  created_at: string;
}
interface AlertRow {
  id: string;
  child_id: string;
  device_id: string | null;
  ts: string;
  severity: string;
  category: string;
  message: string;
  evidence: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

// ---- mappers ----
function mapParent(r: ParentRow): Parent {
  return { id: r.id, email: r.email, displayName: r.display_name, createdAt: r.created_at };
}
function mapChild(r: ChildRow): Child {
  return {
    id: r.id,
    parentId: r.parent_id,
    name: r.name,
    birthYear: numOrUndef(r.birth_year),
    avatarColor: orUndef(r.avatar_color),
    createdAt: r.created_at,
  };
}
function mapDevice(r: DeviceRow): Device {
  return {
    id: r.id,
    childId: r.child_id,
    name: r.name,
    platform: r.platform as Platform,
    status: r.status as DeviceStatus,
    agentVersion: orUndef(r.agent_version),
    lastSeenAt: orUndef(r.last_seen_at),
    createdAt: r.created_at,
  };
}
function mapRule(r: RuleRow): Rule {
  return {
    id: r.id,
    childId: r.child_id,
    kind: r.kind as RuleKind,
    pattern: r.pattern,
    action: r.action as RuleAction,
    category: (orUndef(r.category) as ContentCategory | undefined),
    note: orUndef(r.note),
    createdAt: r.created_at,
  };
}
function mapSchedule(r: ScheduleRow): Schedule {
  return {
    id: r.id,
    childId: r.child_id,
    name: r.name,
    type: r.type as ScheduleType,
    daysOfWeek: parseJson<number[]>(r.days_of_week) ?? [],
    startMinute: r.start_minute,
    endMinute: r.end_minute,
    dailyQuotaMinutes: numOrUndef(r.daily_quota_minutes),
    enabled: r.enabled !== 0,
    createdAt: r.created_at,
  };
}
function mapActivity(r: ActivityRow): ActivityEvent {
  return {
    id: r.id,
    deviceId: r.device_id,
    ts: r.ts,
    type: r.type as ActivityType,
    title: orUndef(r.title),
    url: orUndef(r.url),
    app: orUndef(r.app),
    meta: parseJson<Record<string, unknown>>(r.meta),
  };
}
function mapCapture(r: CaptureRow): Capture {
  return {
    id: r.id,
    deviceId: r.device_id,
    ts: r.ts,
    kind: "screenshot",
    ref: r.ref,
    width: numOrUndef(r.width),
    height: numOrUndef(r.height),
    analyzed: r.analyzed !== 0,
    createdAt: r.created_at,
  };
}
function mapAlert(r: AlertRow): Alert {
  return {
    id: r.id,
    childId: r.child_id,
    deviceId: orUndef(r.device_id),
    ts: r.ts,
    severity: r.severity as AlertSeverity,
    category: r.category as ContentCategory,
    message: r.message,
    evidence: parseJson<Alert["evidence"]>(r.evidence),
    acknowledgedAt: orUndef(r.acknowledged_at),
    createdAt: r.created_at,
  };
}

// ---- input types ----
export interface CreateParentInput {
  email: string;
  displayName: string;
  passwordHash: string;
}
export interface CreateChildInput {
  parentId: string;
  name: string;
  birthYear?: number;
  avatarColor?: string;
}
export interface UpdateChildInput {
  name?: string;
  birthYear?: number;
  avatarColor?: string;
}
export interface CreateDeviceInput {
  childId: string;
  name: string;
  platform: Platform;
  status?: DeviceStatus;
  agentVersion?: string;
}
export interface CreateEnrollCodeInput {
  childId: string;
  name: string;
  platform: Platform;
}
export interface CreateRuleInput {
  childId: string;
  kind: RuleKind;
  pattern: string;
  action: RuleAction;
  category?: ContentCategory;
  note?: string;
}
export interface UpdateRuleInput {
  kind?: RuleKind;
  pattern?: string;
  action?: RuleAction;
  category?: ContentCategory;
  note?: string;
}
export interface CreateScheduleInput {
  childId: string;
  name: string;
  type: ScheduleType;
  daysOfWeek: number[];
  startMinute: number;
  endMinute: number;
  dailyQuotaMinutes?: number;
  enabled: boolean;
}
export interface UpdateScheduleInput {
  name?: string;
  type?: ScheduleType;
  daysOfWeek?: number[];
  startMinute?: number;
  endMinute?: number;
  dailyQuotaMinutes?: number;
  enabled?: boolean;
}
export interface IngestActivityEvent {
  ts: string;
  type: ActivityType;
  title?: string;
  url?: string;
  app?: string;
  meta?: Record<string, unknown>;
}
export interface CreateCaptureInput {
  id?: string;
  deviceId: string;
  ts: string;
  ref: string;
  width?: number;
  height?: number;
}
export interface CreateAlertInput {
  childId: string;
  deviceId?: string;
  ts: string;
  severity: AlertSeverity;
  category: ContentCategory;
  message: string;
  evidence?: Alert["evidence"];
}
export interface ParentWithHash extends Parent {
  passwordHash: string;
}
export interface AlertFilter {
  childId?: string;
  severity?: AlertSeverity;
  acknowledged?: boolean;
}

export function createRepos(db: DB) {
  // These getters are referenced by other methods; defining them as locally
  // typed functions (instead of via `this`) keeps TS return-type inference cheap.
  const getChild = (id: string): Child | undefined => {
    const row = db.prepare(`SELECT * FROM children WHERE id = ?`).get(id) as ChildRow | undefined;
    return row ? mapChild(row) : undefined;
  };
  const getRule = (id: string): Rule | undefined => {
    const row = db.prepare(`SELECT * FROM rules WHERE id = ?`).get(id) as RuleRow | undefined;
    return row ? mapRule(row) : undefined;
  };
  const getSchedule = (id: string): Schedule | undefined => {
    const row = db.prepare(`SELECT * FROM schedules WHERE id = ?`).get(id) as ScheduleRow | undefined;
    return row ? mapSchedule(row) : undefined;
  };

  return {
    // ---------- parents ----------
    createParent(input: CreateParentInput): Parent {
      const id = nanoid();
      const createdAt = nowIso();
      db.prepare(
        `INSERT INTO parents (id, email, display_name, password_hash, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(id, input.email.toLowerCase(), input.displayName, input.passwordHash, createdAt);
      return { id, email: input.email.toLowerCase(), displayName: input.displayName, createdAt };
    },
    getParentById(id: string): Parent | undefined {
      const row = db.prepare(`SELECT * FROM parents WHERE id = ?`).get(id) as ParentRow | undefined;
      return row ? mapParent(row) : undefined;
    },
    getParentByEmailWithHash(email: string): ParentWithHash | undefined {
      const row = db.prepare(`SELECT * FROM parents WHERE email = ?`).get(email.toLowerCase()) as
        | ParentRow
        | undefined;
      return row ? { ...mapParent(row), passwordHash: row.password_hash } : undefined;
    },

    // ---------- children ----------
    createChild(input: CreateChildInput): Child {
      const id = nanoid();
      const createdAt = nowIso();
      db.prepare(
        `INSERT INTO children (id, parent_id, name, birth_year, avatar_color, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(id, input.parentId, input.name, input.birthYear ?? null, input.avatarColor ?? null, createdAt);
      return {
        id,
        parentId: input.parentId,
        name: input.name,
        birthYear: input.birthYear,
        avatarColor: input.avatarColor,
        createdAt,
      };
    },
    listChildrenByParent(parentId: string): Child[] {
      const rows = db
        .prepare(`SELECT * FROM children WHERE parent_id = ? ORDER BY created_at ASC`)
        .all(parentId) as ChildRow[];
      return rows.map(mapChild);
    },
    getChild,
    /** Child scoped to its owning parent (ownership check). */
    getChildOwned(id: string, parentId: string): Child | undefined {
      const row = db.prepare(`SELECT * FROM children WHERE id = ? AND parent_id = ?`).get(id, parentId) as
        | ChildRow
        | undefined;
      return row ? mapChild(row) : undefined;
    },
    updateChild(id: string, patch: UpdateChildInput): Child | undefined {
      const existing = getChild(id);
      if (!existing) return undefined;
      const next = {
        name: patch.name ?? existing.name,
        birthYear: patch.birthYear ?? existing.birthYear ?? null,
        avatarColor: patch.avatarColor ?? existing.avatarColor ?? null,
      };
      db.prepare(`UPDATE children SET name = ?, birth_year = ?, avatar_color = ? WHERE id = ?`).run(
        next.name,
        next.birthYear,
        next.avatarColor,
        id,
      );
      return getChild(id);
    },
    deleteChild(id: string): boolean {
      return db.prepare(`DELETE FROM children WHERE id = ?`).run(id).changes > 0;
    },

    // ---------- devices ----------
    createDevice(input: CreateDeviceInput): Device {
      const id = nanoid();
      const createdAt = nowIso();
      const status: DeviceStatus = input.status ?? "offline";
      db.prepare(
        `INSERT INTO devices (id, child_id, name, platform, status, agent_version, last_seen_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(id, input.childId, input.name, input.platform, status, input.agentVersion ?? null, null, createdAt);
      return {
        id,
        childId: input.childId,
        name: input.name,
        platform: input.platform,
        status,
        agentVersion: input.agentVersion,
        createdAt,
      };
    },
    getDevice(id: string): Device | undefined {
      const row = db.prepare(`SELECT * FROM devices WHERE id = ?`).get(id) as DeviceRow | undefined;
      return row ? mapDevice(row) : undefined;
    },
    /** Device scoped to the owning parent (joins through children). */
    getDeviceOwned(id: string, parentId: string): Device | undefined {
      const row = db
        .prepare(
          `SELECT d.* FROM devices d JOIN children c ON c.id = d.child_id
           WHERE d.id = ? AND c.parent_id = ?`,
        )
        .get(id, parentId) as DeviceRow | undefined;
      return row ? mapDevice(row) : undefined;
    },
    listDevicesByParent(parentId: string, childId?: string): Device[] {
      const rows = childId
        ? (db
            .prepare(
              `SELECT d.* FROM devices d JOIN children c ON c.id = d.child_id
               WHERE c.parent_id = ? AND d.child_id = ? ORDER BY d.created_at ASC`,
            )
            .all(parentId, childId) as DeviceRow[])
        : (db
            .prepare(
              `SELECT d.* FROM devices d JOIN children c ON c.id = d.child_id
               WHERE c.parent_id = ? ORDER BY d.created_at ASC`,
            )
            .all(parentId) as DeviceRow[]);
      return rows.map(mapDevice);
    },
    updateDeviceSeen(id: string, lastSeenAt: string, status: DeviceStatus, agentVersion?: string): void {
      if (agentVersion !== undefined) {
        db.prepare(`UPDATE devices SET last_seen_at = ?, status = ?, agent_version = ? WHERE id = ?`).run(
          lastSeenAt,
          status,
          agentVersion,
          id,
        );
      } else {
        db.prepare(`UPDATE devices SET last_seen_at = ?, status = ? WHERE id = ?`).run(lastSeenAt, status, id);
      }
    },
    setDeviceStatus(id: string, status: DeviceStatus): void {
      db.prepare(`UPDATE devices SET status = ? WHERE id = ?`).run(status, id);
    },

    // ---------- device tokens ----------
    createDeviceToken(deviceId: string): string {
      const token = `dt_${nanoid(40)}`;
      db.prepare(`INSERT INTO device_tokens (token, device_id, created_at) VALUES (?, ?, ?)`).run(
        token,
        deviceId,
        nowIso(),
      );
      return token;
    },
    /** Resolve a non-revoked device token to its device (id + childId). */
    getDeviceByToken(token: string): { id: string; childId: string } | undefined {
      const row = db
        .prepare(
          `SELECT d.id AS id, d.child_id AS child_id
           FROM device_tokens t JOIN devices d ON d.id = t.device_id
           WHERE t.token = ? AND t.revoked_at IS NULL`,
        )
        .get(token) as { id: string; child_id: string } | undefined;
      return row ? { id: row.id, childId: row.child_id } : undefined;
    },

    // ---------- enroll codes ----------
    createEnrollCode(input: CreateEnrollCodeInput): { code: string; createdAt: string } {
      const code = enrollAlphabet();
      const createdAt = nowIso();
      db.prepare(
        `INSERT INTO enroll_codes (code, child_id, name, platform, created_at) VALUES (?, ?, ?, ?, ?)`,
      ).run(code, input.childId, input.name, input.platform, createdAt);
      return { code, createdAt };
    },
    getEnrollCode(code: string): EnrollCodeRow | undefined {
      return db.prepare(`SELECT * FROM enroll_codes WHERE code = ?`).get(code) as EnrollCodeRow | undefined;
    },
    markEnrollCodeUsed(code: string): void {
      db.prepare(`UPDATE enroll_codes SET used_at = ? WHERE code = ?`).run(nowIso(), code);
    },

    // ---------- rules ----------
    createRule(input: CreateRuleInput): Rule {
      const id = nanoid();
      const createdAt = nowIso();
      db.prepare(
        `INSERT INTO rules (id, child_id, kind, pattern, action, category, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        input.childId,
        input.kind,
        input.pattern,
        input.action,
        input.category ?? null,
        input.note ?? null,
        createdAt,
      );
      return { id, createdAt, ...input };
    },
    getRule,
    listRulesByChild(childId: string): Rule[] {
      const rows = db
        .prepare(`SELECT * FROM rules WHERE child_id = ? ORDER BY created_at ASC`)
        .all(childId) as RuleRow[];
      return rows.map(mapRule);
    },
    updateRule(id: string, patch: UpdateRuleInput): Rule | undefined {
      const existing = getRule(id);
      if (!existing) return undefined;
      const next: Rule = {
        ...existing,
        kind: patch.kind ?? existing.kind,
        pattern: patch.pattern ?? existing.pattern,
        action: patch.action ?? existing.action,
        category: patch.category ?? existing.category,
        note: patch.note ?? existing.note,
      };
      db.prepare(`UPDATE rules SET kind = ?, pattern = ?, action = ?, category = ?, note = ? WHERE id = ?`).run(
        next.kind,
        next.pattern,
        next.action,
        next.category ?? null,
        next.note ?? null,
        id,
      );
      return next;
    },
    deleteRule(id: string): boolean {
      return db.prepare(`DELETE FROM rules WHERE id = ?`).run(id).changes > 0;
    },

    // ---------- schedules ----------
    createSchedule(input: CreateScheduleInput): Schedule {
      const id = nanoid();
      const createdAt = nowIso();
      db.prepare(
        `INSERT INTO schedules
           (id, child_id, name, type, days_of_week, start_minute, end_minute, daily_quota_minutes, enabled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        input.childId,
        input.name,
        input.type,
        JSON.stringify(input.daysOfWeek),
        input.startMinute,
        input.endMinute,
        input.dailyQuotaMinutes ?? null,
        input.enabled ? 1 : 0,
        createdAt,
      );
      return { id, createdAt, ...input };
    },
    getSchedule,
    listSchedulesByChild(childId: string): Schedule[] {
      const rows = db
        .prepare(`SELECT * FROM schedules WHERE child_id = ? ORDER BY created_at ASC`)
        .all(childId) as ScheduleRow[];
      return rows.map(mapSchedule);
    },
    updateSchedule(id: string, patch: UpdateScheduleInput): Schedule | undefined {
      const existing = getSchedule(id);
      if (!existing) return undefined;
      const next: Schedule = {
        ...existing,
        name: patch.name ?? existing.name,
        type: patch.type ?? existing.type,
        daysOfWeek: patch.daysOfWeek ?? existing.daysOfWeek,
        startMinute: patch.startMinute ?? existing.startMinute,
        endMinute: patch.endMinute ?? existing.endMinute,
        dailyQuotaMinutes: patch.dailyQuotaMinutes ?? existing.dailyQuotaMinutes,
        enabled: patch.enabled ?? existing.enabled,
      };
      db.prepare(
        `UPDATE schedules SET name = ?, type = ?, days_of_week = ?, start_minute = ?, end_minute = ?,
           daily_quota_minutes = ?, enabled = ? WHERE id = ?`,
      ).run(
        next.name,
        next.type,
        JSON.stringify(next.daysOfWeek),
        next.startMinute,
        next.endMinute,
        next.dailyQuotaMinutes ?? null,
        next.enabled ? 1 : 0,
        id,
      );
      return next;
    },
    deleteSchedule(id: string): boolean {
      return db.prepare(`DELETE FROM schedules WHERE id = ?`).run(id).changes > 0;
    },

    // ---------- activity ----------
    insertActivityEvents(deviceId: string, events: IngestActivityEvent[]): ActivityEvent[] {
      const createdAt = nowIso();
      const stmt = db.prepare(
        `INSERT INTO activity_events (id, device_id, ts, type, title, url, app, meta, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const out: ActivityEvent[] = [];
      const insertAll = db.transaction((rows: IngestActivityEvent[]) => {
        for (const e of rows) {
          const id = nanoid();
          stmt.run(
            id,
            deviceId,
            e.ts,
            e.type,
            e.title ?? null,
            e.url ?? null,
            e.app ?? null,
            toJson(e.meta),
            createdAt,
          );
          out.push({ id, deviceId, ts: e.ts, type: e.type, title: e.title, url: e.url, app: e.app, meta: e.meta });
        }
      });
      insertAll(events);
      return out;
    },
    listActivityByDevice(deviceId: string, limit: number, offset: number): ActivityEvent[] {
      const rows = db
        .prepare(`SELECT * FROM activity_events WHERE device_id = ? ORDER BY ts DESC LIMIT ? OFFSET ?`)
        .all(deviceId, limit, offset) as ActivityRow[];
      return rows.map(mapActivity);
    },
    countActivityByDevice(deviceId: string): number {
      const row = db.prepare(`SELECT COUNT(*) AS n FROM activity_events WHERE device_id = ?`).get(deviceId) as {
        n: number;
      };
      return row.n;
    },

    // ---------- captures ----------
    createCapture(input: CreateCaptureInput): Capture {
      const id = input.id ?? nanoid();
      const createdAt = nowIso();
      db.prepare(
        `INSERT INTO captures (id, device_id, ts, kind, ref, width, height, analyzed, created_at)
         VALUES (?, ?, ?, 'screenshot', ?, ?, ?, 0, ?)`,
      ).run(id, input.deviceId, input.ts, input.ref, input.width ?? null, input.height ?? null, createdAt);
      return {
        id,
        deviceId: input.deviceId,
        ts: input.ts,
        kind: "screenshot",
        ref: input.ref,
        width: input.width,
        height: input.height,
        analyzed: false,
        createdAt,
      };
    },
    getCapture(id: string): Capture | undefined {
      const row = db.prepare(`SELECT * FROM captures WHERE id = ?`).get(id) as CaptureRow | undefined;
      return row ? mapCapture(row) : undefined;
    },
    /** Capture scoped to the owning parent (joins capture->device->child). */
    getCaptureOwned(id: string, parentId: string): Capture | undefined {
      const row = db
        .prepare(
          `SELECT cap.* FROM captures cap
           JOIN devices d ON d.id = cap.device_id
           JOIN children c ON c.id = d.child_id
           WHERE cap.id = ? AND c.parent_id = ?`,
        )
        .get(id, parentId) as CaptureRow | undefined;
      return row ? mapCapture(row) : undefined;
    },
    listCapturesByDevice(deviceId: string, limit: number, offset: number): Capture[] {
      const rows = db
        .prepare(`SELECT * FROM captures WHERE device_id = ? ORDER BY ts DESC LIMIT ? OFFSET ?`)
        .all(deviceId, limit, offset) as CaptureRow[];
      return rows.map(mapCapture);
    },

    // ---------- alerts ----------
    createAlert(input: CreateAlertInput): Alert {
      const id = nanoid();
      const createdAt = nowIso();
      db.prepare(
        `INSERT INTO alerts (id, child_id, device_id, ts, severity, category, message, evidence, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        input.childId,
        input.deviceId ?? null,
        input.ts,
        input.severity,
        input.category,
        input.message,
        toJson(input.evidence),
        createdAt,
      );
      return {
        id,
        childId: input.childId,
        deviceId: input.deviceId,
        ts: input.ts,
        severity: input.severity,
        category: input.category,
        message: input.message,
        evidence: input.evidence,
        createdAt,
      };
    },
    getAlertOwned(id: string, parentId: string): Alert | undefined {
      const row = db
        .prepare(
          `SELECT a.* FROM alerts a JOIN children c ON c.id = a.child_id
           WHERE a.id = ? AND c.parent_id = ?`,
        )
        .get(id, parentId) as AlertRow | undefined;
      return row ? mapAlert(row) : undefined;
    },
    listAlertsByParent(parentId: string, filter: AlertFilter, limit: number, offset: number): Alert[] {
      const clauses: string[] = ["c.parent_id = ?"];
      const params: unknown[] = [parentId];
      if (filter.childId) {
        clauses.push("a.child_id = ?");
        params.push(filter.childId);
      }
      if (filter.severity) {
        clauses.push("a.severity = ?");
        params.push(filter.severity);
      }
      if (filter.acknowledged !== undefined) {
        clauses.push(filter.acknowledged ? "a.acknowledged_at IS NOT NULL" : "a.acknowledged_at IS NULL");
      }
      const rows = db
        .prepare(
          `SELECT a.* FROM alerts a JOIN children c ON c.id = a.child_id
           WHERE ${clauses.join(" AND ")} ORDER BY a.ts DESC LIMIT ? OFFSET ?`,
        )
        .all(...params, limit, offset) as AlertRow[];
      return rows.map(mapAlert);
    },
    ackAlert(id: string, acknowledged: boolean): Alert | undefined {
      const existing = db.prepare(`SELECT * FROM alerts WHERE id = ?`).get(id) as AlertRow | undefined;
      if (!existing) return undefined;
      db.prepare(`UPDATE alerts SET acknowledged_at = ? WHERE id = ?`).run(
        acknowledged ? nowIso() : null,
        id,
      );
      const updated = db.prepare(`SELECT * FROM alerts WHERE id = ?`).get(id) as AlertRow;
      return mapAlert(updated);
    },

    // ---------- retention ----------
    listCapturesOlderThan(cutoffIso: string): Capture[] {
      const rows = db.prepare(`SELECT * FROM captures WHERE created_at < ?`).all(cutoffIso) as CaptureRow[];
      return rows.map(mapCapture);
    },
    deleteCapture(id: string): void {
      db.prepare(`DELETE FROM captures WHERE id = ?`).run(id);
    },
  };
}

export type Repos = ReturnType<typeof createRepos>;
