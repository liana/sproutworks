// Checks on model output. Pure: nothing the model says about the user or the job is shown unless code can trace it.
import { normalizeCompanyName } from "../companies/normalize.ts";

const norm = (s: string) => s.toLowerCase().replace(/[“”"]/g, '"').replace(/[‘’']/g, "'").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();

export function quoteAppears(quote: string, source: string): boolean {
  const q = norm(quote).replace(/^["'.,\s]+|["'.,\s]+$/g, "");
  return q.length >= 8 && norm(source).includes(q);
}

export function employerKnown(employer: string, positions: { company: string }[]): boolean {
  const e = normalizeCompanyName(employer);
  return !!e && positions.some((p) => normalizeCompanyName(p.company) === e);
}

// Numbers and capitalized names in the letter that appear in neither the profile, the job description, nor the fixed text.
export function unverifiedTerms(letter: string, sources: string[]): string[] {
  const hay = norm(sources.join(" \n "));
  const COMMON = new Set(["I", "At", "Earlier", "Previously", "My", "Dear", "Best", "While", "Having", "Most", "Whether", "The", "A", "An", "AI", "In", "This", "That", "With", "As", "For", "And", "But", "It", "It's", "I'm", "I'd", "I've", "We", "Our"]);
  const found = new Set<string>();
  for (const m of letter.matchAll(/\$?\d[\d,.]*\s?(?:%|[MBK]\b|million|billion|years?)?|(?:[A-Z][a-zA-Z0-9&'’-]+)(?:\s+[A-Z][a-zA-Z0-9&'’-]+)*/g)) {
    const t = m[0].trim().split(/\s+/).filter((w, i, all) => !(i < all.length - 1 && COMMON.has(w) && all.slice(0, i).every((x) => COMMON.has(x)))).join(" ");
    if (!t || COMMON.has(t)) continue;
    const startsSentence = m.index === 0 || /[.!?\n]\s*$/.test(letter.slice(0, m.index));
    if (startsSentence && !t.includes(" ") && !/\d/.test(t)) continue; // a capital that's only there because a sentence starts
    if (!hay.includes(norm(t))) found.add(t);
  }
  return [...found];
}
