// Idempotent schema migrations, guarded by PRAGMA user_version.
import type Database from "better-sqlite3";

type DB = Database.Database;
type Migration = (db: DB) => void;

const migration001: Migration = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS parents (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      display_name  TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS children (
      id           TEXT PRIMARY KEY,
      parent_id    TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
      name         TEXT NOT NULL,
      birth_year   INTEGER,
      avatar_color TEXT,
      created_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_children_parent ON children(parent_id);

    CREATE TABLE IF NOT EXISTS devices (
      id            TEXT PRIMARY KEY,
      child_id      TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      platform      TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'unenrolled',
      agent_version TEXT,
      last_seen_at  TEXT,
      created_at    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_devices_child ON devices(child_id);

    CREATE TABLE IF NOT EXISTS device_tokens (
      token      TEXT PRIMARY KEY,
      device_id  TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      revoked_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_device_tokens_device ON device_tokens(device_id);

    CREATE TABLE IF NOT EXISTS enroll_codes (
      code       TEXT PRIMARY KEY,
      child_id   TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      platform   TEXT NOT NULL,
      created_at TEXT NOT NULL,
      used_at    TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_enroll_codes_child ON enroll_codes(child_id);

    CREATE TABLE IF NOT EXISTS rules (
      id         TEXT PRIMARY KEY,
      child_id   TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      kind       TEXT NOT NULL,
      pattern    TEXT NOT NULL,
      action     TEXT NOT NULL,
      category   TEXT,
      note       TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_rules_child ON rules(child_id);

    CREATE TABLE IF NOT EXISTS schedules (
      id                  TEXT PRIMARY KEY,
      child_id            TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      name                TEXT NOT NULL,
      type                TEXT NOT NULL,
      days_of_week        TEXT NOT NULL,
      start_minute        INTEGER NOT NULL,
      end_minute          INTEGER NOT NULL,
      daily_quota_minutes INTEGER,
      enabled             INTEGER NOT NULL DEFAULT 1,
      created_at          TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_schedules_child ON schedules(child_id);

    CREATE TABLE IF NOT EXISTS activity_events (
      id         TEXT PRIMARY KEY,
      device_id  TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      ts         TEXT NOT NULL,
      type       TEXT NOT NULL,
      title      TEXT,
      url        TEXT,
      app        TEXT,
      meta       TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_activity_device_ts ON activity_events(device_id, ts DESC);

    CREATE TABLE IF NOT EXISTS captures (
      id         TEXT PRIMARY KEY,
      device_id  TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      ts         TEXT NOT NULL,
      kind       TEXT NOT NULL DEFAULT 'screenshot',
      ref        TEXT NOT NULL,
      width      INTEGER,
      height     INTEGER,
      analyzed   INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_captures_device_ts ON captures(device_id, ts DESC);

    CREATE TABLE IF NOT EXISTS alerts (
      id              TEXT PRIMARY KEY,
      child_id        TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      device_id       TEXT REFERENCES devices(id) ON DELETE SET NULL,
      ts              TEXT NOT NULL,
      severity        TEXT NOT NULL,
      category        TEXT NOT NULL,
      message         TEXT NOT NULL,
      evidence        TEXT,
      acknowledged_at TEXT,
      created_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_alerts_child_ts ON alerts(child_id, ts DESC);
  `);
};

const MIGRATIONS: Migration[] = [migration001];

export function runMigrations(db: DB): void {
  const current = db.pragma("user_version", { simple: true }) as number;
  for (let i = current; i < MIGRATIONS.length; i++) {
    const migrate = MIGRATIONS[i];
    const apply = db.transaction(() => {
      migrate(db);
      // user_version does not accept bound parameters; i+1 is a trusted integer.
      db.pragma(`user_version = ${i + 1}`);
    });
    apply();
  }
}
