import { z } from "zod";
import { db } from "@/lib/db";
import { runTask } from "@/lib/ai/gateway";
import { FIT_SYSTEM, fitUser, FIT_PROMPT_VERSION } from "@/lib/ai/prompts/fit";
import { FitModelOutput } from "@/contracts/ai";
import { quoteAppears } from "@/services/applying/verify";
import { jobDescription, latestProfile } from "@/services/applying/jobText";

// The schema the API enforces. Length rules are checked again by Zod after parsing.
const FitSchema = z.object({
  fit: z.enum(["STRONG", "PARTIAL", "WEAK"]),
  matches: z.array(z.object({ requirement: z.string(), quote: z.string() })).min(2).max(3),
  gaps: z.array(z.string()).max(3),
});

export type FitResponse =
  | { ok: true; fit: "STRONG" | "PARTIAL" | "WEAK"; matches: { requirement: string; quote: string }[]; gaps: string[]; dropped: number; cached: boolean }
  | { ok: false; error: string; message: string };

export async function checkFit(postingId: string): Promise<FitResponse> {
  const profile = await latestProfile();
  if (!profile) return { ok: false, error: "NO_PROFILE", message: "Import your LinkedIn archive first, so there's a profile to compare." };
  const cached = await db.fitCheck.findUnique({ where: { postingId_profileVersion: { postingId, profileVersion: profile.version } } });
  if (cached) return { ok: true, fit: cached.fit, matches: cached.matches as { requirement: string; quote: string }[], gaps: cached.gaps as string[], dropped: 0, cached: true };

  const jd = await jobDescription(postingId);
  if (!jd) return { ok: false, error: "NO_JD", message: "No job description is available for this posting. Add it with + Add a job to check fit." };

  const r = await runTask("FIT_CHECK", { system: FIT_SYSTEM, user: fitUser(jd, profile.text), promptVersion: FIT_PROMPT_VERSION }, FitSchema);
  if (!r.ok) return { ok: false, error: r.error, message: r.message };
  const strict = FitModelOutput.safeParse(r.data);
  const data = strict.success ? strict.data : r.data;
  const verified = data.matches.filter((m) => quoteAppears(m.quote, jd)); // a quote that isn't really in the job description is dropped
  await db.fitCheck.create({ data: { postingId, profileVersion: profile.version, fit: data.fit, matches: verified, gaps: data.gaps, aiCallId: r.aiCallId } });
  return { ok: true, fit: data.fit, matches: verified, gaps: data.gaps, dropped: data.matches.length - verified.length, cached: false };
}

export async function storedFits(postingIds: string[]) {
  const profile = await db.profile.findFirst({ orderBy: { version: "desc" }, select: { version: true } });
  const rows = await db.fitCheck.findMany({ where: { postingId: { in: postingIds } }, orderBy: { profileVersion: "desc" } });
  const out = new Map<string, { fit: string; matches: { requirement: string; quote: string }[]; gaps: string[]; checkedAt: string; staleProfile: boolean }>();
  for (const f of rows) if (!out.has(f.postingId)) out.set(f.postingId, { fit: f.fit, matches: f.matches as never, gaps: f.gaps as never, checkedAt: f.createdAt.toISOString(), staleProfile: !!profile && f.profileVersion < profile.version });
  return out;
}
