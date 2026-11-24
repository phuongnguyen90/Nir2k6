// Tests for platform detection, data-dir resolution, and arg parsing. Pure /
// deterministic — passes explicit inputs so it is OS-independent.

import { test } from "node:test";
import assert from "node:assert/strict";
import { detectPlatform, defaultDataDir, parseArgs } from "./config.js";

test("detectPlatform maps node platforms to the shared union", () => {
  assert.equal(detectPlatform("win32"), "windows");
  assert.equal(detectPlatform("darwin"), "macos");
  assert.equal(detectPlatform("linux"), "linux");
});

test("detectPlatform falls back to linux for unknown platforms", () => {
  assert.equal(detectPlatform("aix" as NodeJS.Platform), "linux");
  assert.equal(detectPlatform("freebsd" as NodeJS.Platform), "linux");
});

test("defaultDataDir honors XDG_CONFIG_HOME on linux", () => {
  const dir = defaultDataDir("linux", { XDG_CONFIG_HOME: "/custom/cfg" } as NodeJS.ProcessEnv);
  assert.equal(dir, "/custom/cfg/hearth-agent");
});

test("defaultDataDir uses APPDATA on windows", () => {
  const dir = defaultDataDir("win32", { APPDATA: "C:\\Users\\Kid\\AppData\\Roaming" } as NodeJS.ProcessEnv);
  assert.ok(dir.endsWith("hearth-agent"));
  assert.ok(dir.includes("Roaming"));
});

test("defaultDataDir uses Application Support on macos", () => {
  const dir = defaultDataDir("darwin", {} as NodeJS.ProcessEnv);
  assert.ok(dir.includes("Library/Application Support/hearth-agent"));
});

test("parseArgs reads space-separated flags", () => {
  const flags = parseArgs(["--server", "http://h:8080", "--enroll", "ABCD", "--name", "Laptop"]);
  assert.equal(flags.server, "http://h:8080");
  assert.equal(flags.enroll, "ABCD");
  assert.equal(flags.name, "Laptop");
});

test("parseArgs reads --key=value form", () => {
  const flags = parseArgs(["--server=http://h:8080", "--data-dir=/tmp/x"]);
  assert.equal(flags.server, "http://h:8080");
  assert.equal(flags.dataDir, "/tmp/x");
});

test("parseArgs recognizes help", () => {
  assert.equal(parseArgs(["--help"]).help, true);
  assert.equal(parseArgs(["-h"]).help, true);
  assert.equal(parseArgs([]).help, undefined);
});
