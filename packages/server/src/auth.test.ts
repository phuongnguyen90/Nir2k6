import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, createAuth } from "./auth.js";
import { openDatabase } from "./db/index.js";
import { createRepos } from "./db/repos.js";
import { makeTestConfig } from "./test-helpers.js";

test("password hash round-trips", () => {
  const stored = hashPassword("correct horse battery staple");
  assert.ok(stored.startsWith("scrypt$"));
  assert.equal(verifyPassword("correct horse battery staple", stored), true);
});

test("wrong password fails verification", () => {
  const stored = hashPassword("s3cret-password");
  assert.equal(verifyPassword("wrong-password", stored), false);
});

test("tampered hash fails and does not throw", () => {
  assert.equal(verifyPassword("whatever", "not-a-valid-hash"), false);
  assert.equal(verifyPassword("whatever", "scrypt$16384$zzzz$zzzz"), false);
});

test("two hashes of same password differ (random salt)", () => {
  assert.notEqual(hashPassword("samepw"), hashPassword("samepw"));
});

test("JWT sign/verify round-trips with parentId", () => {
  const config = makeTestConfig();
  const db = openDatabase(config.dbPath, { capturesDir: config.capturesDir });
  const repos = createRepos(db);
  const auth = createAuth(repos, config);
  const token = auth.signToken("parent-123");
  const payload = auth.verifyToken(token);
  assert.deepEqual(payload, { parentId: "parent-123" });
  assert.equal(auth.verifyToken("garbage.token.value"), undefined);
  db.close();
});
