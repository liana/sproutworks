// Assembles a cover letter from model parts, so structure and fixed sentences can't drift. Pure.
import { POSITIONING_STATEMENT, REFERRAL_SENTENCE, CAPS } from "../../config/cover-letter/examples.ts";

export type StandardParts = {
  openingType: "STANDARD";
  evidence: { employer: string; clause: string }[];
  earlier: { stem: "EARLIER_IN_MY_CAREER" | "PREVIOUSLY"; employers: string[]; clause: string };
  capabilities: string[];
  strengths: string;
  hook: { text: string; quote: string };
  closeStem: "WELCOME" | "LOOK_FORWARD";
};
export type MissionParts = { openingType: "MISSION_DRIVEN"; opening: string; middle: string; close: string; hookQuote: string };

const clean = (s: string) => s.trim().replace(/\s+/g, " ").replace(/[.\s]+$/, "");
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(", ")}, and ${xs.at(-1)}`);
export const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

export function assemble(parts: StandardParts | MissionParts, ctx: { company: string; fullName: string; referrer?: string | null }) {
  let paragraphs: string[];
  if (parts.openingType === "STANDARD") {
    const opening = [POSITIONING_STATEMENT, ctx.referrer ? REFERRAL_SENTENCE(ctx.referrer) : null].filter(Boolean).join(" ");
    const lowerFirst = (s: string) => s.replace(/^I\s+/, "").replace(/^./, (c) => c.toLowerCase());
    const middle = [
      ...parts.evidence.map((e) => `At ${clean(e.employer)}, I ${lowerFirst(clean(e.clause))}.`),
      `${parts.earlier.stem === "PREVIOUSLY" ? "Previously" : "Earlier in my career"}, I ${lowerFirst(clean(parts.earlier.clause))}.`,
    ].join(" ");
    const close = `I build with AI tools daily, and I bring deep experience in ${list(parts.capabilities.map(clean))}. ${
      parts.closeStem === "WELCOME" ? "I would welcome the chance to discuss" : "I look forward to discussing"
    } how my ${clean(parts.strengths)} can support ${clean(parts.hook.text)}.`;
    paragraphs = [opening, middle, close];
  } else {
    paragraphs = [parts.opening, parts.middle, parts.close].map((p) => p.trim().replace(/\s+/g, " "));
  }
  const salutation = parts.openingType === "STANDARD" ? `Dear ${ctx.company},` : `Dear ${ctx.company} team!`;
  const body = `${salutation}\n\n${paragraphs.join("\n\n")}\n\nBest,\n${ctx.fullName}`;
  const counts = paragraphs.map(words);
  const caps = CAPS[parts.openingType];
  const limits = [caps.opening, caps.middle, caps.close];
  const over = counts.map((c, i) => Math.max(0, c - limits[i]));
  const total = counts.reduce((a, b) => a + b, 0);
  return { body, paragraphs, counts, limits, over, total, withinCaps: over.every((o) => o === 0) && total <= caps.body };
}
