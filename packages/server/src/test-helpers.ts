// Shared helpers for the test suite (not a test file itself).
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import type { Config } from "./config.js";

export function makeTestConfig(overrides: Partial<Config> = {}): Config {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hearth-test-"));
  return {
    port: 0,
    host: "127.0.0.1",
    dataDir: dir,
    dbPath: ":memory:",
    capturesDir: path.join(dir, "captures"),
    jwtSecret: "test-secret-abc",
    jwtTtl: "1h",
    screenshotRetentionDays: 14,
    screenshotIntervalSec: 120,
    dashboardOrigin: "http://localhost:5173",
    ...overrides,
  };
}
