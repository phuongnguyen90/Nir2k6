// The analysis pipeline: run each ingested activity event through the analyzers,
// persist alerts for warn/alert verdicts, and fire best-effort notifications.
import fs from "node:fs";
import type { Alert } from "@hearth/shared";
import type { Config } from "../config.js";
import type { Repos, IngestActivityEvent } from "../db/repos.js";
import type { Notifier } from "../notify.js";
import { DomainCategorizer } from "./domainCategorizer.js";
import { KeywordAnalyzer } from "./keywordAnalyzer.js";
import { scoreResults } from "./scoring.js";
import { BUNDLED_DOMAINS, BUNDLED_TERMS, type Term, type TermsOverride } from "./blocklists.js";

function loadOverrides(config: Config): { terms: Term[]; domains: Record<string, string[]> } {
  let terms = BUNDLED_TERMS;
  let domains = BUNDLED_DOMAINS;
  if (config.analysisTermsFile) {
    try {
      const raw = fs.readFileSync(config.analysisTermsFile, "utf8");
      const parsed = JSON.parse(raw) as TermsOverride;
      if (Array.isArray(parsed.terms)) terms = [...BUNDLED_TERMS, ...parsed.terms];
      if (parsed.domains) {
        domains = { ...BUNDLED_DOMAINS };
        for (const [cat, list] of Object.entries(parsed.domains)) {
          domains[cat] = [...(domains[cat] ?? []), ...list];
        }
      }
    } catch (err) {
      console.warn(`[analysis] could not load ANALYSIS_TERMS_FILE (${config.analysisTermsFile}):`, err);
    }
  }
  return { terms, domains };
}

export interface PipelineDeps {
  repos: Repos;
  config: Config;
  notifier: Notifier;
}

export function createPipeline({ repos, config, notifier }: PipelineDeps) {
  const { terms, domains } = loadOverrides(config);
  const keyword = new KeywordAnalyzer(terms);

  /** Analyze a batch of events for one device; returns the alerts created. */
  function runAnalysis(deviceId: string, events: IngestActivityEvent[]): Alert[] {
    const device = repos.getDevice(deviceId);
    if (!device) return [];

    const childRules = repos.listRulesByChild(device.childId);
    const userBlocked = childRules
      .filter((r) => r.kind === "domain" && r.action === "block")
      .map((r) => r.pattern);
    const domainCat = new DomainCategorizer(domains, userBlocked);

    const created: Alert[] = [];
    for (const ev of events) {
      const results = [...domainCat.analyze(ev), ...keyword.analyze(ev)];
      const verdict = scoreResults(results);
      if (!verdict || verdict.severity === "info") continue;

      const alert = repos.createAlert({
        childId: device.childId,
        deviceId,
        ts: ev.ts || new Date().toISOString(),
        severity: verdict.severity,
        category: verdict.category,
        message: verdict.message,
        evidence: verdict.evidence,
      });
      created.push(alert);
      // Fire-and-forget notification (errors are swallowed inside the notifier).
      void notifier.sendAlertNotification(alert);
    }
    return created;
  }

  return { runAnalysis };
}

export type Pipeline = ReturnType<typeof createPipeline>;
