// Content-analysis contracts shared by the analyzers and the pipeline.
import type { ContentCategory, AlertSeverity } from "@hearth/shared";

/** The subset of an activity event the analyzers inspect. */
export interface AnalyzableEvent {
  ts?: string;
  type?: string;
  title?: string;
  url?: string;
  app?: string;
  meta?: Record<string, unknown>;
}

export interface AnalysisResult {
  category: ContentCategory;
  severity: AlertSeverity;
  score: number; // 0..100
  message: string;
  evidence: { url?: string; title?: string; app?: string; score?: number };
}

export interface Analyzer {
  readonly name: string;
  analyze(event: AnalyzableEvent): AnalysisResult[];
}

/** Map a numeric risk score (0..100) to an alert severity. */
export function severityFromScore(score: number): AlertSeverity {
  if (score >= 70) return "alert";
  if (score >= 40) return "warn";
  return "info";
}

export { DomainCategorizer } from "./domainCategorizer.js";
export { KeywordAnalyzer } from "./keywordAnalyzer.js";
export { scoreResults } from "./scoring.js";
export { createPipeline } from "./pipeline.js";
export type { Pipeline } from "./pipeline.js";
