"use client";
import { useState } from "react";
import { api } from "@/hooks/api";

type Fit = { fit: string; matches: { requirement: string; quote: string }[]; gaps: string[]; staleProfile?: boolean };
type Resp = ({ ok: true; dropped: number; cached: boolean } & Fit) | { ok: false; error: string; message: string };
const LABEL: Record<string, string> = { STRONG: "Strong fit", PARTIAL: "Partial fit", WEAK: "Weak fit" };

export function FitButton({ postingId, initial, onResult }: { postingId: string; initial: Fit | null; onResult: (f: Fit | { error: string }) => void }) {
  const [busy, setBusy] = useState(false);
  const label = busy ? "Checking…" : initial ? (initial.staleProfile ? "Re-check fit" : "Fit checked") : "Check fit";
  async function run() {
    setBusy(true);
    try {
      const r = await api.post<Resp>(`/api/postings/${postingId}/fit`);
      onResult(r.ok ? r : { error: r.message });
    } catch (e) { onResult({ error: (e as Error).message }); }
    finally { setBusy(false); }
  }
  return <button className="btn" disabled={busy || (!!initial && !initial.staleProfile)} onClick={run}>{label}</button>;
}

export function FitResult({ result }: { result: Fit | { error: string } }) {
  if ("error" in result) return <div className="fit"><span className="error-text" style={{ margin: 0 }}>{result.error}</span></div>;
  return (
    <div className="fit">
      <span className="grade">{LABEL[result.fit] ?? result.fit}</span>
      {result.staleProfile && <span className="k"> · checked against your old profile</span>}
      {result.matches.length > 0 && <ul>{result.matches.map((m) => <li key={m.quote}>{m.requirement}: <q>{m.quote}</q></li>)}</ul>}
      {result.gaps.length > 0 && <div className="k" style={{ marginTop: ".4rem" }}>Gaps: {result.gaps.join(" · ")}</div>}
    </div>
  );
}
