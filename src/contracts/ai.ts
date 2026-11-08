// What the model must return. Code verifies quotes and employers, then assembles any user-facing text.
import { z } from "zod";

export const FitModelOutput = z.object({
  fit: z.enum(["STRONG", "PARTIAL", "WEAK"]),
  matches: z
    .array(
      z.object({
        requirement: z.string().max(120),
        quote: z.string().max(300), // must appear verbatim in the job description
      }),
    )
    .min(2)
    .max(3),
  gaps: z.array(z.string().max(120)).max(3),
});
export type FitModelOutput = z.infer<typeof FitModelOutput>;

// Standard letters: code writes the salutation, positioning statement, referral sentence,
// sentence stems, and sign-off. The model fills only these parts.
const StandardLetterParts = z.object({
  openingType: z.literal("STANDARD"),
  evidence: z.array(z.object({ employer: z.string(), clause: z.string() })).length(2), // "At {employer}, I {clause}"
  earlier: z.object({
    stem: z.enum(["EARLIER_IN_MY_CAREER", "PREVIOUSLY"]),
    employers: z.array(z.string()).length(2),
    clause: z.string(),
  }),
  capabilities: z.array(z.string()).min(2).max(3), // "...deep experience in {capabilities}."
  strengths: z.string(), // "...how my {strengths} can support {hook.text}."
  hook: z.object({ text: z.string(), quote: z.string() }), // quote verified against the job description
  closeStem: z.enum(["WELCOME", "LOOK_FORWARD"]),
});

const MissionDrivenLetterParts = z.object({
  openingType: z.literal("MISSION_DRIVEN"),
  opening: z.string(),
  middle: z.string(),
  close: z.string(),
  hookQuote: z.string(), // verified against the job description
});

export const LetterModelOutput = z.discriminatedUnion("openingType", [
  StandardLetterParts,
  MissionDrivenLetterParts,
]);
export type LetterModelOutput = z.infer<typeof LetterModelOutput>;
