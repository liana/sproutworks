"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/hooks/api";
import { useToast } from "@/components/Toast";

type Src = { id: string; list: "NEWS" | "LEADS"; name: string; url: string; status: string; detail: string };
type Preview = Awaited<ReturnType<typeof api.previewSource>>;

const PILL: Record<string, string> = { Fetched: "ok", Horoscope: "ok", "Stale feed?": "warn", "Still useful?": "warn", "Unused for 30 days": "warn" };

export function SourcesPanel({ list, title, sources }: { list: "NEWS" | "LEADS"; title: string; sources: Src[] }) {
  const router = useRouter();
  const toast = useToast();
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mine = sources.filter((s) => s.list === list);

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
    <section className="panel">
      <h2>{title}</h2>
      <ul className="list">
        {mine.map((s) => (
          <li key={s.id}>
            <div>
              {s.status === "Link only" || s.status === "Still useful?" || s.status === "Unused for 30 days"
                ? <a href={s.url} target="_blank" rel="noopener noreferrer" onClick={() => api.visitSource(s.id).then(() => router.refresh())}>{s.name} ↗</a>
                : s.name}
              <span className="k">{s.detail}</span>
            </div>
            <div style={{ display: "flex", gap: ".4rem", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <span className={`pill ${PILL[s.status] ?? ""}`}>{s.status}</span>
              {s.status === "Still useful?" && <button className="btn quiet" onClick={() => run(() => api.keepSource(s.id), `${s.name} kept for another 30 days.`)}>Keep</button>}
              <button className="btn quiet" onClick={() => run(() => api.removeSource(s.id), `${s.name} removed.`)}>Remove</button>
            </div>
          </li>
        ))}
      </ul>
      <form className="addurl" onSubmit={check}>
        <input aria-label={`Add a ${list === "NEWS" ? "news" : "lead gen"} source URL`} placeholder="Paste a site or feed URL" value={url} onChange={(e) => setUrl(e.target.value)} required type="url" />
        <button className="btn" disabled={busy}>{busy && !preview ? "Checking…" : "Check"}</button>
      </form>
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
    </section>
  );
}
