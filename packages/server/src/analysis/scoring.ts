// Combine the analyzers' per-signal results into a single verdict:
// take the highest-scoring result and derive the final alert severity.
import type { AnalysisResult } from "./index.js";
import { severityFromScore } from "./index.js";

export interface ScoredVerdict extends AnalysisResult {
  signals: number;
}

export function scoreResults(results: AnalysisResult[]): ScoredVerdict | undefined {
  if (results.length === 0) return undefined;
  const top = results.reduce((best, r) => (r.score > best.score ? r : best), results[0]);
  // Multiple independent signals nudge the score up a little (capped at 100).
  const boosted = Math.min(100, top.score + (results.length - 1) * 5);
  return {
    ...top,
    score: boosted,
    severity: severityFromScore(boosted),
    signals: results.length,
  };
}
