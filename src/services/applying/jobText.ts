// The job description and the user's profile, as plain text for the AI tasks. Fetched once and stored.
import { db } from "@/lib/db";
import { createPoliteFetcher } from "@/lib/fetch/polite";
import { stripHtml } from "@/services/feeds/parse";
import { fixtureFetcher } from "@/services/refresh";

export async function jobDescription(postingId: string): Promise<string | null> {
  const p = await db.posting.findUniqueOrThrow({ where: { id: postingId }, include: { company: true } });
  if (p.description) return p.description;
  const code = p.company?.boardCode;
  if (!code || p.source === "MANUAL" || p.source === "VENTUREFIZZ") return null;
  const fetcher = process.env.SPROUT_FIXTURE_BOARDS === "1" ? fixtureFetcher() : createPoliteFetcher({ maxRequestsPerRefresh: 3 }).fetcher;
  let text: string | null = null; let postedAt: Date | null = null;
  if (p.source === "GREENHOUSE") {
    const r = await fetcher(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(code)}/jobs/${encodeURIComponent(p.externalId)}`);
    const b = r.body as { content?: string; first_published?: string } | null;
    if (r.status === 200 && b?.content) { text = stripHtml(b.content); postedAt = b.first_published ? new Date(b.first_published) : null; }
  } else if (p.source === "LEVER") {
    const r = await fetcher(`https://api.lever.co/v0/postings/${encodeURIComponent(code)}/${encodeURIComponent(p.externalId)}?mode=json`);
    const b = r.body as { descriptionPlain?: string; lists?: { text: string; content: string }[]; additionalPlain?: string } | null;
    if (r.status === 200 && b) text = [b.descriptionPlain, ...(b.lists ?? []).map((l) => `${l.text}: ${stripHtml(l.content)}`), b.additionalPlain].filter(Boolean).join("\n\n");
  } else if (p.source === "ASHBY") {
    const r = await fetcher(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(code)}?includeCompensation=true`);
    const job = (r.body as { jobs?: { id: string; descriptionPlain?: string }[] } | null)?.jobs?.find((j) => j.id === p.externalId);
    if (job?.descriptionPlain) text = job.descriptionPlain;
  }
  if (text) await db.posting.update({ where: { id: postingId }, data: { description: text, ...(postedAt && !p.postedAt ? { postedAt } : {}) } });
  return text;
}

type Position = { company: string; title: string; description: string | null; startedOn: string | null; finishedOn: string | null };

export async function latestProfile() {
  const prof = await db.profile.findFirst({ orderBy: { version: "desc" } });
  if (!prof) return null;
  const positions = prof.positions as Position[];
  const text = [
    `${prof.firstName} ${prof.lastName}`, prof.headline && `Headline: ${prof.headline}`, prof.summary && `About: ${prof.summary}`,
    "Experience:",
    ...positions.map((p) => `- ${p.title} at ${p.company} (${p.startedOn ?? "?"} to ${p.finishedOn ?? "present"})${p.description ? `: ${p.description}` : ""}`),
    `Skills: ${(prof.skills as string[]).join(", ")}`,
  ].filter(Boolean).join("\n");
  return { version: prof.version, fullName: `${prof.firstName} ${prof.lastName}`.trim(), positions, text };
}
