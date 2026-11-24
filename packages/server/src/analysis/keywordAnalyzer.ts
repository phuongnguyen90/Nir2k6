// Keyword / title heuristics: scan the window title, URL and app name for
// weighted multi-language terms and emit a per-category risk signal.
import type { ContentCategory } from "@hearth/shared";
import type { AnalysisResult, AnalyzableEvent, Analyzer } from "./index.js";
import { severityFromScore } from "./index.js";
import { BUNDLED_TERMS, type Term } from "./blocklists.js";

export class KeywordAnalyzer implements Analyzer {
  readonly name = "keyword";
  private readonly terms: Term[];

  constructor(terms: Term[] = BUNDLED_TERMS) {
    this.terms = terms;
  }

  analyze(event: AnalyzableEvent): AnalysisResult[] {
    const haystack = [event.title, event.url, event.app].filter(Boolean).join(" \u0001 ").toLowerCase();
    if (!haystack) return [];

    // Accumulate weight per category, remembering the strongest matched term.
    const byCategory = new Map<ContentCategory, { weight: number; hits: string[] }>();
    for (const t of this.terms) {
      if (haystack.includes(t.term.toLowerCase())) {
        const acc = byCategory.get(t.category) ?? { weight: 0, hits: [] };
        acc.weight += t.weight;
        acc.hits.push(t.term);
        byCategory.set(t.category, acc);
      }
    }

    const results: AnalysisResult[] = [];
    for (const [category, acc] of byCategory) {
      // Map accumulated weight (1..~10) onto 0..100; weight 5 => ~70 (alert).
      const score = Math.min(100, acc.weight * 14);
      results.push({
        category,
        severity: severityFromScore(score),
        score,
        message: `Matched ${category} keyword(s): ${acc.hits.join(", ")}`,
        evidence: { url: event.url, title: event.title, app: event.app, score },
      });
    }
    return results;
  }
}
