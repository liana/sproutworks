"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/hooks/api";
import { useToast } from "@/components/Toast";

type Draft = { ok: true; id: string; body: string; counts: number[]; limits: number[]; flags: { text: string; reason: string }[]; regenerationsLeft: number };
type Resp = Draft | { ok: false; error: string; message: string };

export function CoverLetterDialog({ postingId, role, people, onClose }: { postingId: string; role: string; people: { id: string; name: string }[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const toast = useToast();
  const [openingType, setOpeningType] = useState<"STANDARD" | "MISSION_DRIVEN">("STANDARD");
  const [referrer, setReferrer] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [text, setText] = useState("");
  useEffect(() => { ref.current?.showModal(); }, []);

  async function generate() {
    setBusy(true); setError(null);
    try {
      const r = await api.post<Resp>(`/api/postings/${postingId}/cover-letter`, { openingType, referrerPersonId: referrer || undefined, note: note || undefined });
      if (r.ok) { setDraft(r); setText(r.body); } else setError(r.message);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function copy() {
    await navigator.clipboard.writeText(text);
    if (draft && text !== draft.body) await api.saveLetter(draft.id, text).catch(() => {});
    toast("Cover letter copied.");
  }
  const close = () => { ref.current?.close(); onClose(); };

  return (
    <dialog ref={ref} onClose={onClose} aria-label={`Cover letter for ${role}`}>
      <div className="dlg">
        <h2>{draft ? "Draft" : "Cover letter"} · {role}</h2>
        {!draft ? (
          <>
            <label>Opening</label>
            <div className="choice">
              <label><input type="radio" name="op" checked={openingType === "STANDARD"} onChange={() => setOpeningType("STANDARD")} /> Standard</label>
              <label><input type="radio" name="op" checked={openingType === "MISSION_DRIVEN"} onChange={() => setOpeningType("MISSION_DRIVEN")} /> Mission-driven</label>
            </div>
            {openingType === "STANDARD" && (
              <>
                <label htmlFor="cl-ref">Referrer (optional)</label>
                <select id="cl-ref" value={referrer} onChange={(e) => setReferrer(e.target.value)}>
                  <option value="">No referrer</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </>
            )}
            <label htmlFor="cl-note">Why this company (optional)</label>
            <input id="cl-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the job description won't say" maxLength={500} />
            {error && <p className="error-text">{error}</p>}
            <div className="foot"><button className="btn quiet" onClick={close}>Cancel</button><button className="btn solid" disabled={busy} onClick={generate}>{busy ? "Drafting…" : "Draft letter"}</button></div>
          </>
        ) : (
          <>
            <textarea className="letter" aria-label="Editable cover letter" value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 360 }} />
            <div className="counts">Words per paragraph: {draft.counts.join(" / ")} · limits {draft.limits.join(" / ")}</div>
            {draft.flags.length > 0 && (
              <div className="preview" style={{ marginTop: ".6rem" }}>
                <strong>Check before sending:</strong>
                <ul style={{ margin: ".3rem 0 0", paddingLeft: "1.1rem" }}>{draft.flags.map((f) => <li key={f.text}><span className="flagged">{f.text}</span>: {f.reason}</li>)}</ul>
              </div>
            )}
            {error && <p className="error-text">{error}</p>}
            <div className="foot">
              <button className="btn quiet" onClick={close}>Close</button>
              <button className="btn" disabled={busy || draft.regenerationsLeft <= 0} onClick={generate}>{busy ? "Drafting…" : `Regenerate (${draft.regenerationsLeft} left)`}</button>
              <button className="btn solid" onClick={copy}>Copy</button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
