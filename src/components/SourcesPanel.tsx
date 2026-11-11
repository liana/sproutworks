"use client";
// News and lead gen sources in one list with tabs, the add field on top, and a quiet remove on each row.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/hooks/api";
import { useToast } from "@/components/Toast";

type Src = { id: string; list: "NEWS" | "LEADS"; name: string; url: string; status: string; detail: string };
type Preview = Awaited<ReturnType<typeof api.previewSource>>;
type List = "NEWS" | "LEADS";

const PILL: Record<string, string> = { Fetched: "ok", Horoscope: "ok", "Stale feed?": "warn", "Still useful?": "warn", "Unused for 30 days": "warn" };
const TABS: { list: List; label: string }[] = [{ list: "NEWS", label: "News" }, { list: "LEADS", label: "Lead gen" }];
const FIRST = 7; // rows shown before "Show all"

export function SourcesPanel({ sources }: { sources: Src[] }) {
  const router = useRouter();
  const toast = useToast();
  const [list, setList] = useState<List>("NEWS");
  const [all, setAll] = useState(false);
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mine = sources.filter((s) => s.list === list);
  const shown = all ? mine : mine.slice(0, FIRST);

  async function check(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null); setPreview(null); setTerms(false);
    try { const p = await api.previewSource(url.trim()); if (p.error) setError(p.error); else setPreview(p); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function save() {
    setBusy(true);
    try {
      const r = await api.addSource({ list, url: url.trim(), termsConfirmed: terms });
      toast(r.type === "LINK_OUT" ? "Saved as link only." : "Saved. It's read on the next morning check.");
      setUrl(""); setPreview(null); router.refresh();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  const run = async (fn: () => Promise<void>, msg: string) => { try { await fn(); toast(msg); router.refresh(); } catch (e) { toast((e as Error).message); } };

  return (
    <div>
      <div className="src-head">
        <div className="tabs" role="tablist" aria-label="Source lists">
          {TABS.map((t) => (
            <button key={t.list} role="tab" aria-selected={list === t.list} onClick={() => { setList(t.list); setAll(false); setPreview(null); setError(null); }}>
              {t.label} {sources.filter((s) => s.list === t.list).length}
            </button>
          ))}
        </div>
        <form className="addurl" onSubmit={check}>
          <input aria-label={`Add a ${list === "NEWS" ? "news" : "lead gen"} source URL`} placeholder={`Add a ${list === "NEWS" ? "news" : "lead gen"} site or feed`} value={url} onChange={(e) => setUrl(e.target.value)} required type="url" />
          <button className="btn" disabled={busy}>{busy && !preview ? "Checking…" : "Check"}</button>
        </form>
      </div>
      {error && <p className="error-text">{error}</p>}
      {preview && (
        <div className="preview">
          {preview.detectedType === "NONE"
            ? "No feed found, so this saves as a link you open yourself."
            : preview.stale ? `This feed hasn't posted since ${preview.newestLabel}. Stale feeds aren't saved.`
            : `Feed found · ${preview.itemCount} items · newest ${preview.newestLabel} · robots.txt ${preview.robotsAllowed ? "allows" : "disallows"} it`}
          {preview.fetchable && <label><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /> I&apos;ve checked this site&apos;s terms allow automated reading</label>}
          {!preview.stale && <div style={{ display: "flex", justifyContent: "flex-end", marginTop: ".5rem" }}><button className="btn solid" type="button" disabled={busy} onClick={save}>{preview.fetchable && terms ? "Save source" : "Save as link only"}</button></div>}
        </div>
      )}
      {mine.length === 0 ? <p className="sub" style={{ marginTop: ".9rem" }}>No sources yet. Paste a site above.</p> : (
        <ul className="srcs" role="tabpanel">
          {shown.map((s) => {
            const linkOnly = s.status === "Link only" || s.status === "Still useful?" || s.status === "Unused for 30 days";
            return (
              <li key={s.id}>
                <span className="src-name">{linkOnly
                  ? <a href={s.url} target="_blank" rel="noopener noreferrer" onClick={() => api.visitSource(s.id).then(() => router.refresh())}>{s.name} ↗</a>
                  : s.name}</span>
                <span><span className={`pill ${PILL[s.status] ?? ""}`}>{s.status}</span></span>
                <span className="k src-when">{s.detail}</span>
                <span className="src-acts">
                  {s.status === "Still useful?" && <button className="btn quiet" onClick={() => run(() => api.keepSource(s.id), `${s.name} kept for another 30 days.`)}>Keep</button>}
                  <button className="x" aria-label={`Remove ${s.name}`} title="Remove" onClick={() => run(() => api.removeSource(s.id), `${s.name} removed.`)}>✕</button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {mine.length > FIRST && <p className="k" style={{ margin: ".6rem 0 0" }}>{all ? `All ${mine.length}` : `Showing ${FIRST} of ${mine.length}`} · <button className="linkish" onClick={() => setAll(!all)}>{all ? "Show fewer" : "Show all"}</button></p>}
    </div>
  );
}
