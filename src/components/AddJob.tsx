"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/hooks/api";
import { useToast } from "@/components/Toast";

const FOUND_VIA = ["VentureFizz", "Health Tech Nerds", "Other"];

export function AddJobButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn add-job" onClick={() => setOpen(true)}>+ Add a job</button>
      {open && <AddJobDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function AddJobDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const toast = useToast();
  const [names, setNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { ref.current?.showModal(); api.companyNames().then(setNames).catch(() => {}); }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(null);
    const f = new FormData(e.currentTarget);
    const body = { companyName: String(f.get("company")), title: String(f.get("title")), url: String(f.get("url") || "") || undefined, description: String(f.get("description") || "") || undefined, foundVia: String(f.get("via")) };
    try {
      const r = await api.post<{ id: string; warnings: string[]; error?: string }>("/api/postings", body);
      if (r.error) throw new Error(r.error);
      toast(`${body.title} at ${body.companyName} added to Today.${r.warnings.length ? ` Note: ${r.warnings.join(", ")}.` : ""}`);
      ref.current?.close(); router.refresh();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <dialog ref={ref} onClose={onClose} aria-label="Add a job">
      <form className="dlg" onSubmit={submit}>
        <h2>Add a job</h2>
        <label htmlFor="aj-co">Company</label>
        <input id="aj-co" name="company" list="aj-names" required placeholder="Start typing a company" />
        <datalist id="aj-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
        <label htmlFor="aj-title">Job title</label>
        <input id="aj-title" name="title" required placeholder="e.g. Fractional Head of Product" />
        <label htmlFor="aj-url">Link (optional)</label>
        <input id="aj-url" name="url" type="url" placeholder="Where the posting lives" />
        <label htmlFor="aj-via">Where I found it</label>
        <select id="aj-via" name="via">{FOUND_VIA.map((v) => <option key={v}>{v}</option>)}</select>
        <label htmlFor="aj-desc">Job description</label>
        <textarea id="aj-desc" name="description" placeholder="Paste the posting so Check fit and cover letters can use it" />
        {error && <p className="error-text">{error}</p>}
        <div className="foot"><button type="button" className="btn quiet" onClick={() => ref.current?.close()}>Cancel</button><button className="btn solid" disabled={busy}>{busy ? "Adding…" : "Add job"}</button></div>
      </form>
    </dialog>
  );
}
