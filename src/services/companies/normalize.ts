// Company names → one stable key, plus job-board code guesses. Pure.

const SUFFIXES = /\b(incorporated|inc|llc|l\.l\.c|ltd|limited|corp|corporation|co|company|plc|gmbh|pbc|holdings|group|technologies|technology|labs?)\b\.?/gi;

export function normalizeCompanyName(raw: string): string {
  return raw
    .replace(/\(.*?\)/g, " ") // "Acme Health (Acme)" → "Acme Health"
    .replace(/&/g, " and ")
    .replace(SUFFIXES, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// Guesses for Greenhouse/Lever/Ashby board codes, most likely first.
export function boardCodeCandidates(raw: string): string[] {
  const words = normalizeCompanyName(raw).split(" ").filter(Boolean);
  if (!words.length) return [];
  const joined = words.join("");
  const dashed = words.join("-");
  const first = words[0];
  return [...new Set([joined, dashed, first])].filter((c) => c.length >= 2);
}
