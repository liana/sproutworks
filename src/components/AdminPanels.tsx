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
  async function wrongMatch(id: string, name: string) {
    try { await api.wrongMatch(id); toast(`Removed that match for ${name}. Its jobs are gone and it won't be tried again.`); router.refresh(); } catch (e) { toast((e as Error).message); }
  }
  async function board(id: string, body: object, msg: string) {
    try { await api.board(id, body); toast(msg); router.refresh(); } catch (e) { toast((e as Error).message); }
  }

  const li = data.linkedin;
  const cov = data.coverage;
  const pct = (n: number) => `${cov.total ? (n / cov.total) * 100 : 0}%`;
  const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const [last, ...earlier] = data.runs;
  const runLine = (r: Admin["runs"][number]) => `${r.requests.toLocaleString()} requests${r.minutes !== null ? ` · ${r.minutes} min` : " · running"}${r.skipped ? ` · ${r.skipped} skipped` : ""}${r.failures.length ? ` · ${r.failures.length} didn't open` : ""}`;
  const sections = [
    { id: "coverage", label: "Coverage" },
    { id: "linkedin", label: "LinkedIn" },
    { id: "sources", label: "Sources" },
    ...(data.stale.length ? [{ id: "stale", label: "Needs a look" }] : []),
    ...(data.excluded.length ? [{ id: "excluded", label: "Excluded" }] : []),
    { id: "checks", label: "Morning checks" },
    { id: "backups", label: "Backups" },
  ];

  return (
    <div className="adm">
      <nav className="adm-index" aria-label="Admin sections">
        {sections.map((s) => <a key={s.id} href={`#${s.id}`}>{s.label}</a>)}
      </nav>
      <div className="adm-sheet">
        <section className="adm-sec" id="coverage">
          <h2>Coverage</h2>
          <div>
            <p className="adm-big">{cov.total.toLocaleString()}<small>companies where you know people</small></p>
            <div className="meter" role="img" aria-label={`${cov.boards} read through a job board, ${cov.careersPages} through a careers page, ${cov.watchlist} on the Watchlist, ${cov.notChecked} not checked yet`}>
              <span className="m-board" style={{ width: pct(cov.boards) }} />
              <span className="m-page" style={{ width: pct(cov.careersPages) }} />
              <span className="m-watch" style={{ width: pct(cov.watchlist) }} />
            </div>
            <ul className="legend">
              <li><span className="sw m-board" /><span><b>{cov.boards}</b> job {cov.boards === 1 ? "board" : "boards"}</span></li>
              <li><span className="sw m-page" /><span><b>{cov.careersPages}</b> careers {cov.careersPages === 1 ? "page" : "pages"}</span></li>
              <li><span className="sw m-watch" /><span><b>{cov.watchlist}</b> on your Watchlist{cov.unreadable ? <span className="k"> · {cov.unreadable} with a page the app can&apos;t read</span> : null}</span></li>
              {cov.notChecked > 0 && <li><span className="sw todo" /><span><b>{cov.notChecked}</b> not checked yet <span className="k">· about {cov.morningsLeft} more {cov.morningsLeft === 1 ? "morning" : "mornings"}</span></span></li>}
            </ul>
            {data.autoMatched.length > 0 && (
              <details>
                <summary>Found automatically in the last two weeks ({data.autoMatched.length})</summary>
                <ul className="adm-list">
                  {data.autoMatched.map((c) => (
                    <li key={c.id}>
                      <span><span className="who">{c.name}</span> <a className="k" href={c.url} target="_blank" rel="noopener noreferrer">{c.what} ↗</a></span>
                      <button className="linkish" onClick={() => wrongMatch(c.id, c.name)}>Wrong company</button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </section>

        <section className="adm-sec" id="linkedin">
          <h2>LinkedIn</h2>
          <div>
            <p className="adm-lead">{li.lastImportedAt ? `Last imported ${day(li.lastImportedAt)}` : "Nothing imported yet"}</p>
            {li.lastImportedAt && <span className="k">{li.connections.toLocaleString()} connections</span>}
            <div className="adm-acts">
              <button className="btn solid" disabled={busy} onClick={() => file.current?.click()}>{busy ? "Importing…" : "Import archive"}</button>
              <a className="btn quiet" href={LINKEDIN_EXPORT_URL} target="_blank" rel="noopener noreferrer" onClick={() => api.exportRequested().then(() => router.refresh())}>Request new export ↗</a>
              <input ref={file} type="file" accept=".zip" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
            </div>
            <p className="k adm-note">{li.exportRequestedAt ? `Export requested ${day(li.exportRequestedAt)}. Upload the .zip when LinkedIn's email arrives.` : "Upload the .zip LinkedIn sends, not an unzipped folder."}</p>
            {error && <p className="error-text">{error}</p>}
          </div>
        </section>

        <section className="adm-sec" id="sources">
          <h2>Sources</h2>
          <SourcesPanel sources={data.sources} />
        </section>

        {data.stale.length > 0 && (
          <section className="adm-sec" id="stale">
            <h2>Needs a look</h2>
            <div>
              <p className="adm-lead">{data.stale.length} job {data.stale.length === 1 ? "board has" : "boards have"} been empty or missing for {data.staleDays}+ days</p>
              <span className="k">They&apos;re still checked daily. Usually the company moved to a new board.</span>
              <ul className="adm-list">
                {data.stale.map((c) => (
                  <li key={c.id} className="wrap">
                    <span><span className="who">{c.name}</span> <span className="k">{c.provider?.toLowerCase()} {c.code} · {c.days} days</span></span>
                    <span className="adm-row-acts">
                      <button className="btn quiet" onClick={async () => { await api.post(`/api/companies/${c.id}/stale`, { action: "REPROBE" }); toast(`${c.name} will be looked up again on the next check.`); router.refresh(); }}>Look again</button>
                      <button className="btn quiet" onClick={() => setSetting(setting === c.id ? null : c.id)}>Set board</button>
                      <button className="linkish" onClick={async () => { await api.post(`/api/companies/${c.id}/stale`, { action: "DISMISS" }); toast(`${c.name} dismissed. Counting starts over.`); router.refresh(); }}>Dismiss</button>
                    </span>
                    {setting === c.id && (
                      <form className="adm-set" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); board(c.id, { action: "SET", provider: f.get("provider"), code: f.get("code") }, `${c.name} set and locked.`); setSetting(null); }}>
                        <select name="provider" aria-label="Provider" defaultValue={c.provider ?? "GREENHOUSE"}><option>GREENHOUSE</option><option>LEVER</option><option>ASHBY</option></select>
                        <input name="code" aria-label="Board code" placeholder="board code" required />
                        <button className="btn">Save</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {data.excluded.length > 0 && (
          <section className="adm-sec" id="excluded">
            <h2>Excluded</h2>
            <ul className="adm-list">
              {data.excluded.map((c) => (
                <li key={c.id}>
                  <span><span className="who">{c.name}</span> <span className="k">excluded {day(c.excludedAt)}</span></span>
                  <button className="btn quiet" onClick={async () => { await api.include(c.id); toast(`${c.name} included again.`); router.refresh(); }}>Include again</button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="adm-sec" id="checks">
          <h2>Morning checks</h2>
          <div>
            {last ? <>
              <p className="adm-lead">{when(last.startedAt)} · {last.status === "running" ? "running" : last.status === "stopped-at-cap" ? "stopped at the request limit" : "done"}</p>
              <span className="k">{runLine(last)}</span>
              {last.failures.length > 0 && <details><summary>What didn&apos;t open ({last.failures.length})</summary><p className="k adm-note">{last.failures.map((f) => f.company).join(" · ")}</p></details>}
            </> : <p className="adm-lead">No checks yet</p>}
            <div className="adm-acts"><button className="btn" onClick={async () => { await api.refresh(); toast("Checking what's due. Today shows progress."); }}>Run check now</button></div>
            {earlier.length > 0 && (
              <details><summary>Earlier checks</summary>
                <ul className="adm-list">{earlier.map((r) => <li key={r.id}><span>{when(r.startedAt)}</span><span className="k">{runLine(r)}</span></li>)}</ul>
              </details>
            )}
          </div>
        </section>

        <section className="adm-sec" id="backups">
          <h2>Backups</h2>
          <div>
            <p className="adm-lead">{data.backups.files.length ? `${data.backups.files.length} kept · newest ${when(data.backups.files[0].savedAt)}` : "None yet"}</p>
            <span className="k">Saved before every check, import, and update in {data.backups.dir}. The last {data.backups.keep} are kept.</span>
            <details><summary>How to restore</summary>
              <p className="adm-note">Stop the app, then run <code>npm run restore -- &lt;file&gt;</code>. Your current data is kept as a copy first.</p>
              <ul className="adm-list">{data.backups.files.slice(0, 5).map((b) => <li key={b.file}><code>{b.file}</code><span className="k">{b.sizeMb} MB</span></li>)}</ul>
            </details>
          </div>
        </section>
      </div>
    </div>
  );
}
