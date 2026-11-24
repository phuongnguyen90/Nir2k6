// SQLite connection + boot-time migrations.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { runMigrations } from "./migrations.js";

export type DB = Database.Database;

export interface OpenDatabaseOptions {
  /** Directory where capture files live; created on open when provided. */
  capturesDir?: string;
}

export function openDatabase(dbPath: string, opts: OpenDatabaseOptions = {}): DB {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  if (opts.capturesDir) {
    fs.mkdirSync(opts.capturesDir, { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

export { runMigrations };
