"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/hooks/api";
import { useToast } from "@/components/Toast";
import type { buildAdmin } from "@/services/admin";
import { SourcesPanel } from "@/components/SourcesPanel";

type Admin = Awaited<ReturnType<typeof buildAdmin>>;
const LINKEDIN_EXPORT_URL = "https://www.linkedin.com/mypreferences/d/download-my-data";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function AdminPanels({ data }: { data: Admin }) {
  const router = useRouter();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setting, setSetting] = useState<string | null>(null);

  async function onImport(f: File) {
    setBusy(true); setError(null);
    try {
      const r = await api.importArchive(f);
      const what = r.connections ? `${r.connections} connections at ${r.companies} companies` : "your profile";
      const next = r.waitingFor === "connections" ? " Upload the second LinkedIn ZIP (with Connections) when it arrives." : r.waitingFor === "profile" ? " Upload the first LinkedIn ZIP (your profile) too, so Check fit and cover letters can use it." : "";
      toast(`Imported ${what}${r.changes ? ` · ${r.changes} job changes` : ""}${r.excludedEmployer ? ` · excluded ${r.excludedEmployer} (your current employer)` : ""}.${next}`);
      router.refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); if (file.current) file.current.value = ""; }
  }
  async function board(id: string, body: object, msg: string) {
    try { await api.board(id, body); toast(msg); router.refresh(); } catch (e) { toast((e as Error).message); }
  }

  const li = data.linkedin;
  return (
    <div className="panels">
      <section className="panel">
        <h2>LinkedIn data</h2>
        <p className="sub">{li.lastImportedAt ? `Last imported ${day(li.lastImportedAt)} · ${li.connections} connections` : "Nothing imported yet"}</p>
        <div className="addurl">
          <a className="btn" href={LINKEDIN_EXPORT_URL} target="_blank" rel="noopener noreferrer" onClick={() => api.exportRequested().then(() => router.refresh())}>Request new export ↗</a>
          <button className="btn solid" disabled={busy} onClick={() => file.current?.click()}>{busy ? "Importing…" : "Import archive"}</button>
          <input ref={file} type="file" accept=".zip" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
        </div>
        <p className="sub" style={{ marginTop: "0.75rem" }}>Upload the .zip file LinkedIn sent, not an unzipped folder.</p>
        {li.exportRequestedAt && <p className="sub" style={{ marginTop: "0.75rem" }}>Requested {day(li.exportRequestedAt)}. Upload the ZIP when LinkedIn&apos;s email arrives.</p>}
        {error && <p className="error-text">{error}</p>}
      </section>

      <section className="panel">
        <h2>Board links to confirm</h2>
        <p className="sub">Confirm once and it&apos;s locked</p>
        {data.pending.length === 0 ? <p className="sub">Nothing waiting.</p> : (
          <ul className="list">
            {data.pending.map((c) => (
              <li key={c.id}>
                <div>{c.name} → {c.provider?.toLowerCase()} <code>{c.code}</code><span className="k">{c.jobCount} open jobs{c.sample ? ` · e.g. ${c.sample}` : ""}</span>
                  {setting === c.id && (
                    <form style={{ display: "flex", gap: ".4rem", marginTop: ".4rem" }} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); board(c.id, { action: "SET", provider: f.get("provider"), code: f.get("code") }, `${c.name} set and locked.`); setSetting(null); }}>
                      <select name="provider" aria-label="Provider" defaultValue="GREENHOUSE"><option>GREENHOUSE</option><option>LEVER</option><option>ASHBY</option></select>
                      <input name="code" aria-label="Board code" placeholder="board code" required />
                      <button className="btn">Save</button>
                    </form>
                  )}
                </div>
                <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button className="btn solid" onClick={() => board(c.id, { action: "CONFIRM" }, `${c.name} confirmed and locked.`)}>Confirm</button>
                  <button className="btn quiet" onClick={() => setSetting(setting === c.id ? null : c.id)}>Set code</button>
                  <button className="btn quiet" onClick={() => board(c.id, { action: "MARK_CANT_CHECK" }, `${c.name} marked wrong. It moves to the companies the app can't check.`)}>Wrong</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {data.unreadableCount > 0 && <p className="sub" style={{ marginTop: ".75rem" }}>{data.unreadableCount} {data.unreadableCount === 1 ? "company has" : "companies have"} no board the app can read. {data.unreadableCount === 1 ? "It" : "They"}&apos;ll appear on the Watchlist (later slice).</p>}
      </section>

      <section className="panel">
        <h2>Stale board token?</h2>
        <p className="sub">Empty or missing for {3} days in a row. It&apos;s still checked daily.</p>
        {data.stale.length === 0 ? <p className="sub">None.</p> : (
          <ul className="list">
            {data.stale.map((c) => (
              <li key={c.id}>
                <div>{c.name} · {c.provider?.toLowerCase()} <code>{c.code}</code><span className="k">empty or missing {c.days} days</span></div>
                <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button className="btn" onClick={async () => { await api.post(`/api/companies/${c.id}/stale`, { action: "REPROBE" }); toast(`${c.name} will be re-probed on the next check.`); router.refresh(); }}>Re-probe</button>
                  <button className="btn quiet" onClick={() => setSetting(setting === c.id ? null : c.id)}>Set code</button>
                  <button className="btn quiet" onClick={() => board(c.id, { action: "MARK_CANT_CHECK" }, `${c.name} moved to your Watchlist.`)}>Can&apos;t check</button>
                  <button className="btn quiet" onClick={async () => { await api.post(`/api/companies/${c.id}/stale`, { action: "DISMISS" }); toast(`${c.name} dismissed. Counting starts over.`); router.refresh(); }}>Dismiss</button>
                </div>
                {setting === c.id && (
                  <form style={{ display: "flex", gap: ".4rem", marginTop: ".4rem", width: "100%" }} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); board(c.id, { action: "SET", provider: f.get("provider"), code: f.get("code") }, `${c.name} set and locked.`); setSetting(null); }}>
                    <select name="provider" aria-label="Provider" defaultValue={c.provider ?? "GREENHOUSE"}><option>GREENHOUSE</option><option>LEVER</option><option>ASHBY</option></select>
                    <input name="code" aria-label="Board code" placeholder="board code" required />
                    <button className="btn">Save</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <SourcesPanel list="LEADS" title="Lead gen sources" sources={data.sources} />
      <SourcesPanel list="NEWS" title="Industry news sources" sources={data.sources} />

      <section className="panel">
        <h2>Excluded companies</h2>
        {data.excluded.length === 0 ? <p className="sub">None.</p> : (
          <ul className="list">
            {data.excluded.map((c) => (
              <li key={c.id}><div>{c.name}<span className="k">excluded {day(c.excludedAt)}</span></div>
                <button className="btn quiet" onClick={async () => { await api.include(c.id); toast(`${c.name} included again.`); router.refresh(); }}>Include again</button></li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Morning checks</h2>
        {data.runs.length === 0 ? <p className="sub">No checks yet. The first one runs when you open Today after importing.</p> : (
          <ul className="list">
            {data.runs.map((r) => (
              <li key={r.id}>
                <div>{new Date(r.startedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  <span className="k">{r.requests} requests{r.minutes !== null ? ` · ${r.minutes} min` : " · running"}{r.skipped ? ` · ${r.skipped} skipped` : ""}{r.failures.length ? ` · ${r.failures.length} failed (${r.failures.slice(0, 3).map((f) => f.company).join(", ")})` : ""}</span></div>
                <span className={`pill ${r.failures.length ? "warn" : "ok"}`}>{r.status === "running" ? "Running" : r.failures.length ? `${r.failures.length} failed` : "Done"}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="addurl"><button className="btn" onClick={async () => { await api.refresh(); toast("Checking what's due or failed. Today shows progress."); }}>Run check now</button></div>
      </section>

      <section className="panel">
        <h2>Backups</h2>
        <p className="sub">Saved before each check, import, and schema update · last {data.backups.keep} kept in {data.backups.dir}</p>
        {data.backups.files.length === 0 ? <p className="sub">None yet. The first one is made before the next check.</p> : (
          <ul className="list">
            {data.backups.files.slice(0, 5).map((b) => <li key={b.file}><div><code style={{ fontSize: ".78rem" }}>{b.file}</code><span className="k">{b.sizeMb} MB</span></div></li>)}
          </ul>
        )}
        <p className="sub" style={{ marginTop: ".75rem" }}>To restore: stop the app, then run <code>npm run restore -- &lt;file&gt;</code>. Your current data is kept as a copy first.</p>
      </section>
    </div>
  );
}
