"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/hooks/api";
import { useToast } from "@/components/Toast";
import type { buildWatchlist } from "@/services/watchlist";

type Row = Awaited<ReturnType<typeof buildWatchlist>>[number];

export function WatchlistRows({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const toast = useToast();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = rows.filter((r) => !hidden.has(r.companyId));
  const hide = (id: string, on: boolean) => setHidden((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });

  async function review(r: Row) {
    hide(r.companyId, true);
    try {
      await api.post(`/api/companies/${r.companyId}/watchlist-review`);
      toast(`${r.companyName} reviewed. It comes back with news, a change in who you know there, or in 30 days.`, async () => {
        await api.undoWatchlistReview(r.companyId); hide(r.companyId, false); router.refresh();
      });
    } catch (e) { hide(r.companyId, false); toast((e as Error).message); }
  }
  async function exclude(r: Row) {
    hide(r.companyId, true);
    try { await api.exclude(r.companyId); toast(`${r.companyName} excluded.`, async () => { await api.include(r.companyId); hide(r.companyId, false); }); }
    catch (e) { hide(r.companyId, false); toast((e as Error).message); }
  }

  if (!visible.length) return <div className="empty">Nothing to check right now. Reviewed companies come back with news, a change in who you know there, or after 30 days.</div>;
  return (
    <div className="rows">
      {visible.map((r) => (
        <div className="row" key={r.companyId}>
          <h3>{r.companyName}</h3>
          <div>
            {r.bestIntro && <span className={`tier t${r.bestIntro.tier}`}><span className="dot" />{r.bestIntro.tierLabel}</span>}{" "}
            {r.peopleCount} {r.peopleCount === 1 ? "person" : "people"}{r.bestIntro ? ` · best intro: ${r.bestIntro.name}${r.bestIntro.title ? `, ${r.bestIntro.title}` : ""}` : ""}
          </div>
          <div className="when">{r.backBecause ? <>Back because: {r.backBecause}{r.lastReviewedLabel ? <><br />{r.lastReviewedLabel}</> : null}</> : "New to your Watchlist"}</div>
          <div className="acts">
            {r.careersUrl
              ? <a className="btn solid" href={r.careersUrl} target="_blank" rel="noopener noreferrer">Visit careers page ↗</a>
              : <a className="btn" href={r.searchUrl} target="_blank" rel="noopener noreferrer">Find careers page ↗</a>}
            <button className="btn" onClick={() => review(r)}>Reviewed</button>
            <button className="btn quiet" onClick={() => exclude(r)}>Exclude</button>
          </div>
        </div>
      ))}
    </div>
  );
}
