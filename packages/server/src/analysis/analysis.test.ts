import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../db/index.js";
import { createRepos } from "../db/repos.js";
import { createNotifier } from "../notify.js";
import { makeTestConfig } from "../test-helpers.js";
import { DomainCategorizer } from "./domainCategorizer.js";
import { KeywordAnalyzer } from "./keywordAnalyzer.js";
import { scoreResults } from "./scoring.js";
import { createPipeline } from "./pipeline.js";

test("domain categorizer flags a known adult URL", () => {
  const cat = new DomainCategorizer();
  const results = cat.analyze({ url: "https://www.pornhub.com/view?id=1" });
  assert.equal(results.length >= 1, true);
  const adult = results.find((r) => r.category === "adult");
  assert.ok(adult);
  const verdict = scoreResults(results)!;
  assert.equal(verdict.severity, "alert");
  assert.equal(verdict.category, "adult");
});

test("domain categorizer flags a parent-blocked domain", () => {
  const cat = new DomainCategorizer({}, ["blocked.example"]);
  const results = cat.analyze({ url: "http://sub.blocked.example/path" });
  assert.equal(results.length, 1);
  assert.equal(results[0].category, "custom");
});

test("keyword analyzer flags Vietnamese adult term in a title", () => {
  const kw = new KeywordAnalyzer();
  const results = kw.analyze({ title: "xem phim sex online full hd", type: "web" });
  const adult = results.find((r) => r.category === "adult");
  assert.ok(adult);
  assert.equal(scoreResults(results)!.severity, "alert");
});

test("clean content produces no alert-worthy verdict", () => {
  const kw = new KeywordAnalyzer();
  const cat = new DomainCategorizer();
  const ev = { url: "https://en.wikipedia.org/wiki/Cat", title: "Cat - Wikipedia" };
  const results = [...cat.analyze(ev), ...kw.analyze(ev)];
  assert.equal(scoreResults(results), undefined);
});

test("pipeline persists an alert for an adult URL", () => {
  const config = makeTestConfig();
  const db = openDatabase(config.dbPath, { capturesDir: config.capturesDir });
  const repos = createRepos(db);
  const notifier = createNotifier(config);
  const pipeline = createPipeline({ repos, config, notifier });

  const parent = repos.createParent({ email: "p@x.com", displayName: "P", passwordHash: "x" });
  const child = repos.createChild({ parentId: parent.id, name: "Kid" });
  const device = repos.createDevice({ childId: child.id, name: "PC", platform: "windows" });

  const created = pipeline.runAnalysis(device.id, [
    { ts: new Date().toISOString(), type: "web", url: "https://xvideos.com/x", title: "x" },
    { ts: new Date().toISOString(), type: "web", url: "https://example.com", title: "safe" },
  ]);
  assert.equal(created.length, 1);
  assert.equal(created[0].category, "adult");

  const alerts = repos.listAlertsByParent(parent.id, {}, 50, 0);
  assert.equal(alerts.length, 1);
  db.close();
});
