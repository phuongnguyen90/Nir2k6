// Tests for the pure hosts-file marker logic. Operates only on string literals
// and a temp file — never the real /etc/hosts — so it is OS-independent.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyBlock, buildBlock, removeBlock, MARKER_BEGIN, MARKER_END } from "./platform/hostsFile.js";

const BASE = "127.0.0.1 localhost\n255.255.255.255 broadcasthost\n";

test("buildBlock sinkholes each domain and its www host", () => {
  const block = buildBlock(["example.com"]);
  assert.ok(block.startsWith(MARKER_BEGIN));
  assert.ok(block.endsWith(MARKER_END));
  assert.match(block, /127\.0\.0\.1 example\.com/);
  assert.match(block, /127\.0\.0\.1 www\.example\.com/);
});

test("buildBlock does not double-prefix an already-www domain", () => {
  const block = buildBlock(["www.example.com"]);
  const wwwCount = (block.match(/www\.example\.com/g) ?? []).length;
  assert.equal(wwwCount, 1);
  assert.doesNotMatch(block, /www\.www\./);
});

test("buildBlock normalizes case and dedupes", () => {
  const block = buildBlock(["Example.com", "EXAMPLE.COM", "  example.com "]);
  const count = (block.match(/127\.0\.0\.1 example\.com\b/g) ?? []).length;
  assert.equal(count, 1);
});

test("applyBlock inserts a block into content without one", () => {
  const out = applyBlock(BASE, ["bad.com"]);
  assert.ok(out.startsWith(BASE.trimEnd()));
  assert.match(out, /# >>> hearth[\s\S]*127\.0\.0\.1 bad\.com[\s\S]*# <<< hearth/);
  // original content preserved
  assert.match(out, /127\.0\.0\.1 localhost/);
});

test("applyBlock replaces an existing block, dropping old entries", () => {
  const first = applyBlock(BASE, ["old.com"]);
  const second = applyBlock(first, ["new.com"]);
  assert.match(second, /new\.com/);
  assert.doesNotMatch(second, /old\.com/);
  // only one marker pair remains
  assert.equal((second.match(/# >>> hearth/g) ?? []).length, 1);
  assert.equal((second.match(/# <<< hearth/g) ?? []).length, 1);
  // untouched content survives
  assert.match(second, /broadcasthost/);
});

test("applyBlock with empty domains removes the block", () => {
  const withBlock = applyBlock(BASE, ["x.com"]);
  const cleared = applyBlock(withBlock, []);
  assert.doesNotMatch(cleared, /hearth/);
  assert.equal(cleared, removeBlock(withBlock));
});

test("removeBlock is idempotent and preserves surrounding content", () => {
  const withBlock = applyBlock(BASE, ["x.com"]);
  const once = removeBlock(withBlock);
  const twice = removeBlock(once);
  assert.equal(once, twice);
  assert.match(once, /127\.0\.0\.1 localhost/);
  assert.doesNotMatch(once, /hearth/);
});

test("applyBlock is stable (re-applying same domains yields same output)", () => {
  const a = applyBlock(BASE, ["a.com", "b.com"]);
  const b = applyBlock(a, ["a.com", "b.com"]);
  assert.equal(a, b);
});

test("round-trips through a real temp file", () => {
  const dir = mkdtempSync(join(tmpdir(), "hearth-hosts-"));
  const file = join(dir, "hosts");
  try {
    writeFileSync(file, BASE, "utf8");
    writeFileSync(file, applyBlock(readFileSync(file, "utf8"), ["evil.test"]), "utf8");
    assert.match(readFileSync(file, "utf8"), /evil\.test/);
    writeFileSync(file, removeBlock(readFileSync(file, "utf8")), "utf8");
    const final = readFileSync(file, "utf8");
    assert.doesNotMatch(final, /evil\.test/);
    assert.match(final, /localhost/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("markers are the documented strings", () => {
  assert.equal(MARKER_BEGIN, "# >>> hearth");
  assert.equal(MARKER_END, "# <<< hearth");
});
