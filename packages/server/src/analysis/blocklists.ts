// Small bundled sample blocklists + weighted term lists.
// INTENTIONALLY SHORT — enough to demonstrate the pipeline. In production these
// are extended via an external JSON file (config.analysisTermsFile) or by loading
// full public blocklists; the explicit word lists are kept minimal and clinical.
import type { ContentCategory } from "@hearth/shared";

/** Sample domains grouped by category. Matched as domain suffixes. */
export const BUNDLED_DOMAINS: Record<string, string[]> = {
  adult: ["pornhub.com", "xvideos.com", "xnxx.com", "onlyfans.com", "redtube.com"],
  gambling: ["bet365.com", "pokerstars.com", "888casino.com", "bongda88.com"],
  malware: ["malware-traffic-analysis.net", "testsafebrowsing.appspot.com"],
  violence: ["liveleak.com", "bestgore.com"],
};

export interface Term {
  term: string; // matched case-insensitively as a word/substring
  category: ContentCategory;
  weight: number; // 1 (soft) .. 5 (strong)
  lang?: string; // informational: "en", "vi", ...
}

// Weighted, multi-language term list. Clinical and minimal by design.
// Vietnamese terms included per product spec (adult / violence / gambling).
export const BUNDLED_TERMS: Term[] = [
  // --- adult (en) ---
  { term: "porn", category: "adult", weight: 5, lang: "en" },
  { term: "nsfw", category: "adult", weight: 3, lang: "en" },
  { term: "xxx", category: "adult", weight: 4, lang: "en" },
  { term: "explicit sex", category: "adult", weight: 4, lang: "en" },
  // --- adult (vi) ---
  { term: "phim sex", category: "adult", weight: 5, lang: "vi" },
  { term: "khiêu dâm", category: "adult", weight: 5, lang: "vi" },
  { term: "đồi trụy", category: "adult", weight: 5, lang: "vi" },
  { term: "người lớn 18+", category: "adult", weight: 3, lang: "vi" },
  // --- gambling (en/vi) ---
  { term: "casino", category: "gambling", weight: 3, lang: "en" },
  { term: "online poker", category: "gambling", weight: 3, lang: "en" },
  { term: "cá độ", category: "gambling", weight: 4, lang: "vi" },
  { term: "cờ bạc", category: "gambling", weight: 4, lang: "vi" },
  { term: "lô đề", category: "gambling", weight: 4, lang: "vi" },
  // --- violence (en/vi) ---
  { term: "gore", category: "violence", weight: 4, lang: "en" },
  { term: "beheading", category: "violence", weight: 5, lang: "en" },
  { term: "bạo lực", category: "violence", weight: 3, lang: "vi" },
  { term: "chém giết", category: "violence", weight: 4, lang: "vi" },
  // --- drugs (en/vi) ---
  { term: "buy cocaine", category: "drugs", weight: 5, lang: "en" },
  { term: "ma túy", category: "drugs", weight: 4, lang: "vi" },
];

export interface TermsOverride {
  terms?: Term[];
  domains?: Record<string, string[]>;
}
