import { z } from "zod";
import { db } from "@/lib/db";
import { runTask } from "@/lib/ai/gateway";
import { letterSystem, letterUser, LETTER_PROMPT_VERSION } from "@/lib/ai/prompts/letter";
import { POSITIONING_STATEMENT } from "@/config/cover-letter/examples";
import { LETTER_REGENERATIONS } from "@/config/models";
import { assemble, type StandardParts, type MissionParts } from "@/services/applying/letter";
import { quoteAppears, employerKnown, unverifiedTerms } from "@/services/applying/verify";
import { jobDescription, latestProfile } from "@/services/applying/jobText";

// One schema per opening type (the user picks the type, so the model never has to).
const Standard = z.object({
  evidence: z.array(z.object({ employer: z.string(), clause: z.string() })).length(2),
  earlier: z.object({ stem: z.enum(["EARLIER_IN_MY_CAREER", "PREVIOUSLY"]), employers: z.array(z.string()).length(2), clause: z.string() }),
  capabilities: z.array(z.string()).min(2).max(3),
  strengths: z.string(),
  hook: z.object({ text: z.string(), quote: z.string() }),
  closeStem: z.enum(["WELCOME", "LOOK_FORWARD"]),
});
const Mission = z.object({ opening: z.string(), middle: z.string(), close: z.string(), hookQuote: z.string() });

export type LetterResponse =
  | { ok: true; id: string; body: string; counts: number[]; limits: number[]; flags: { text: string; reason: string }[]; regenerationsLeft: number }
  | { ok: false; error: string; message: string };

export async function draftLetter(postingId: string, opts: { openingType: "STANDARD" | "MISSION_DRIVEN"; referrerPersonId?: string; note?: string }): Promise<LetterResponse> {
  const posting = await db.posting.findUniqueOrThrow({ where: { id: postingId }, include: { company: true } });
  if (posting.roleType !== "FULL_TIME") return { ok: false, error: "NOT_FULL_TIME", message: "Cover letters are for full-time roles." };
  const previous = await db.coverLetter.findFirst({ where: { postingId }, orderBy: { createdAt: "desc" } });
  const used = previous ? previous.regenCount + 1 : 0;
  if (used > LETTER_REGENERATIONS) return { ok: false, error: "LIMIT", message: `You've redrafted this letter ${LETTER_REGENERATIONS} times. Edit the last draft instead.` };

  const profile = await latestProfile();
  if (!profile) return { ok: false, error: "NO_PROFILE", message: "Import your LinkedIn archive first." };
  const jd = await jobDescription(postingId);
  if (!jd) return { ok: false, error: "NO_JD", message: "No job description is available for this posting. Add it with + Add a job." };
  const company = posting.company?.name ?? posting.manualCompanyName ?? "the team";
  const referrer = opts.referrerPersonId ? await db.person.findUnique({ where: { id: opts.referrerPersonId } }) : null;
  const referrerName = referrer ? `${referrer.firstName} ${referrer.lastName}`.trim() : null;

  let overBy: string | null = null;
  let aiCallId = "";
  let draft: ReturnType<typeof assemble> | null = null;
  const flags: { text: string; reason: string }[] = [];
  for (let attempt = 0; attempt < 2; attempt++) { // one automatic retry, only for length
    const system = letterSystem(opts.openingType);
    const user = letterUser({ company, title: posting.title, jobDescription: jd, profile: profile.text, note: opts.note, overBy });
    const r = opts.openingType === "STANDARD"
      ? await runTask("COVER_LETTER", { system, user, promptVersion: LETTER_PROMPT_VERSION }, Standard)
      : await runTask("COVER_LETTER", { system, user, promptVersion: LETTER_PROMPT_VERSION }, Mission);
    if (!r.ok) return { ok: false, error: r.error, message: r.message };
    aiCallId = r.aiCallId;
    const parts = (opts.openingType === "STANDARD" ? { openingType: "STANDARD", ...r.data } : { openingType: "MISSION_DRIVEN", ...r.data }) as StandardParts | MissionParts;
    draft = assemble(parts, { company, fullName: profile.fullName, referrer: referrerName });
    flags.length = 0;
    if (parts.openingType === "STANDARD") {
      for (const e of [...parts.evidence.map((x) => x.employer), ...parts.earlier.employers]) if (!employerKnown(e, profile.positions)) flags.push({ text: e, reason: "Not one of your LinkedIn positions" });
      if (!quoteAppears(parts.hook.quote, jd)) flags.push({ text: parts.hook.text, reason: "Couldn't find this in the job description" });
    } else if (!quoteAppears(parts.hookQuote, jd)) flags.push({ text: "the closing mission line", reason: "Couldn't find it in the job description" });
    if (draft.withinCaps) break;
    overBy = draft.over.map((o, i) => (o ? `paragraph ${i + 1} is ${o} words over` : null)).filter(Boolean).join(", ") || `the body is ${draft.total} words, over the limit`;
  }
  if (!draft || !draft.withinCaps) return { ok: false, error: "LENGTH", message: "Couldn't keep this within your length. Regenerate." };

  for (const t of unverifiedTerms(draft.paragraphs.join("\n\n"), [profile.text, jd, company, referrerName ?? "", POSITIONING_STATEMENT, posting.title, "Best"]))
    if (!flags.some((f) => f.text === t)) flags.push({ text: t, reason: "Not found in your profile or the job description" });

  const saved = await db.coverLetter.create({
    data: { postingId, openingType: opts.openingType, referrerId: referrer?.id ?? null, note: opts.note ?? null, body: draft.body, flags, regenCount: used, aiCallId },
  });
  return { ok: true, id: saved.id, body: draft.body, counts: draft.counts, limits: draft.limits, flags, regenerationsLeft: LETTER_REGENERATIONS - used };
}

export const saveLetterEdits = (id: string, body: string) => db.coverLetter.update({ where: { id }, data: { body } });
