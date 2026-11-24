// URL/domain categorization: match a visited URL's host against bundled
// category blocklists and the parent's own block rules (domain patterns).
import type { ContentCategory } from "@hearth/shared";
import type { AnalysisResult, AnalyzableEvent, Analyzer } from "./index.js";
import { severityFromScore } from "./index.js";
import { BUNDLED_DOMAINS } from "./blocklists.js";

function extractHost(raw: string): string | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  try {
    const url = new URL(s.includes("://") ? s : `http://${s}`);
    return url.hostname.toLowerCase();
  } catch {
    // Fall back to a bare token that looks like a domain.
    const m = s.toLowerCase().match(/[a-z0-9.-]+\.[a-z]{2,}/);
    return m ? m[0] : undefined;
  }
}

function hostMatches(host: string, pattern: string): boolean {
  const p = pattern.toLowerCase().replace(/^\*\./, "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!p) return false;
  return host === p || host.endsWith(`.${p}`);
}

export class DomainCategorizer implements Analyzer {
  readonly name = "domain";
  private readonly categoryDomains: Record<string, string[]>;
  private readonly userBlockedDomains: string[];

  constructor(
    categoryDomains: Record<string, string[]> = BUNDLED_DOMAINS,
    userBlockedDomains: string[] = [],
  ) {
    this.categoryDomains = categoryDomains;
    this.userBlockedDomains = userBlockedDomains;
  }

  analyze(event: AnalyzableEvent): AnalysisResult[] {
    const source = event.url ?? "";
    const host = source ? extractHost(source) : undefined;
    if (!host) return [];
    const results: AnalysisResult[] = [];

    for (const [category, domains] of Object.entries(this.categoryDomains)) {
      if (domains.some((d) => hostMatches(host, d))) {
        const score = category === "malware" || category === "adult" ? 85 : 65;
        results.push({
          category: category as ContentCategory,
          severity: severityFromScore(score),
          score,
          message: `Visited a known ${category} domain (${host})`,
          evidence: { url: event.url, title: event.title, score },
        });
      }
    }

    if (this.userBlockedDomains.some((d) => hostMatches(host, d))) {
      const score = 60;
      results.push({
        category: "custom",
        severity: severityFromScore(score),
        score,
        message: `Visited a parent-blocked domain (${host})`,
        evidence: { url: event.url, title: event.title, score },
      });
    }

    return results;
  }
}
