// Runs the fit check and cover letter on fixed cases against a running app with a real API key: npm run eval
// Spends real money (a few cents). Results print as a table; record model/effort decisions in DECISIONS.md.
import { readFile } from "node:fs/promises";

type Case = { company: string; title: string; description: string; expectFit: string[] };
const base = process.env.SPROUT_URL ?? "http://127.0.0.1:3000";
const cases: Case[] = JSON.parse(await readFile(new URL("../test/fixtures/evals/cases.json", import.meta.url), "utf8"));
const post = async (path: string, body?: unknown) => (await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })).json();

let pass = 0;
for (const c of cases) {
  const job = await post("/api/postings", { companyName: c.company, title: c.title, description: c.description, foundVia: "Other" });
  const fit = await post(`/api/postings/${job.id}/fit`);
  const fitOk = fit.ok && c.expectFit.includes(fit.fit) && fit.matches.length >= 2 && fit.dropped === 0;
  const letter = await post(`/api/postings/${job.id}/cover-letter`, { openingType: "STANDARD" });
  const letterOk = letter.ok === true;
  if (fitOk && letterOk) pass++;
  console.log([c.title.padEnd(42), `fit=${fit.fit ?? fit.message}`, `quotes=${fit.matches?.length ?? 0} dropped=${fit.dropped ?? "-"}`, `letter=${letter.ok ? `${letter.counts.join("/")} flags=${letter.flags.length}` : letter.message}`, fitOk && letterOk ? "PASS" : "FAIL"].join("  "));
}
console.log(`\n${pass}/${cases.length} passed. Delete the eval jobs from Today with Exclude company, or reset the database.`);
