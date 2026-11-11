"use client";
// Watchlist: companies on the left, the selected one's details on the right. On narrow screens the
// details replace the list, with a way back.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/hooks/api";
import { useToast } from "@/components/Toast";
import type { WatchlistRow as Row } from "@/contracts/views";

const SELECTED_KEY = "sproutworks:watchlist:selected";
const subscribeStorage = (onChange: () => void) => { window.addEventListener("storage", onChange); return () => window.removeEventListener("storage", onChange); };
const PROVIDER_NAMES = { GREENHOUSE: "Greenhouse", LEVER: "Lever", ASHBY: "Ashby" } as const;

export function WatchlistRows({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const toast = useToast();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const stored = useSyncExternalStore(subscribeStorage, () => localStorage.getItem(SELECTED_KEY), () => null);
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked ?? stored;
  const [showDetail, setShowDetail] = useState(false); // narrow screens only
  const visible = rows.filter((r) => !hidden.has(r.companyId));
  const current = visible.find((r) => r.companyId === selected) ?? visible[0] ?? null;

  const select = (id: string) => { setPicked(id); setShowDetail(true); localStorage.setItem(SELECTED_KEY, id); };
  const hide = (id: string, on: boolean) => setHidden((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });

  async function review(r: Row) {
    hide(r.companyId, true); setShowDetail(false);
    try {
      await api.post(`/api/companies/${r.companyId}/watchlist-review`);
      toast(`${r.companyName} reviewed. It comes back with news, a change in who you know there, or in 30 days.`, async () => {
        await api.undoWatchlistReview(r.companyId); hide(r.companyId, false); router.refresh();
      });
    } catch (e) { hide(r.companyId, false); toast((e as Error).message); }
  }
  async function exclude(r: Row) {
    hide(r.companyId, true); setShowDetail(false);
    try { await api.exclude(r.companyId); toast(`${r.companyName} excluded.`, async () => { await api.include(r.companyId); hide(r.companyId, false); }); }
    catch (e) { hide(r.companyId, false); toast((e as Error).message); }
  }

  if (!visible.length || !current) return <div className="empty">Nothing to check right now. Reviewed companies come back with news, a change in who you know there, or after 30 days.</div>;
  return (
    <div className={`wl${showDetail ? " show-detail" : ""}`}>
      <ul className="wl-list" aria-label="Companies">
        {visible.map((r) => (
          <li key={r.companyId} className={r.companyId === current.companyId ? "on" : undefined}>
            <button className="wl-pick" onClick={() => select(r.companyId)} aria-current={r.companyId === current.companyId ? "true" : undefined}>
              <span className={`tier t${r.bestIntro?.tier ?? 3}`} aria-hidden="true"><span className="dot" /></span>
              <span className="wl-name">{r.companyName}</span>
              {(r.industry ?? r.blurb) && <span className="wl-line">{r.industry ?? r.blurb}</span>}
              <span className="wl-meta">{r.peopleCount} {r.peopleCount === 1 ? "person" : "people"}{r.backBecause ? <> · <b>Back:</b> {r.backBecause}</> : null}</span>
            </button>
            <button className="wl-check" onClick={() => review(r)} aria-label={`Mark ${r.companyName} reviewed`} title="Reviewed">✓</button>
          </li>
        ))}
      </ul>
      <Detail key={current.companyId} r={current} onBack={() => setShowDetail(false)} onReview={() => review(current)} onExclude={() => exclude(current)} />
    </div>
  );
}

function Detail({ r, onBack, onReview, onExclude }: { r: Row; onBack: () => void; onReview: () => void; onExclude: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [looking, setLooking] = useState(!r.infoLooked);
  const asked = useRef(false);

  // First time a company is opened, look up what it does. One try; the morning check refreshes later.
  useEffect(() => {
    if (r.infoLooked || asked.current) return;
    asked.current = true;
    api.post(`/api/companies/${r.companyId}/info`).then(() => router.refresh()).catch(() => undefined).finally(() => setLooking(false));
  }, [r.companyId, r.infoLooked, router]);

  const [best, ...others] = r.people;
  return (
    <article className="wl-detail" aria-label={r.companyName}>
      <button className="btn quiet wl-back" onClick={onBack}>← All companies</button>
      <header className="wl-head">
        <h2>{r.companyName}</h2>
        {r.website && <a href={r.website} target="_blank" rel="noopener noreferrer">{new URL(r.website).hostname} ↗</a>}
      </header>
      {r.industry && <p className="wl-industry">{r.industry}</p>}
      {looking ? <p className="wl-blurb muted">Looking up what {r.companyName} does…</p>
        : r.blurb ? <p className="wl-blurb">{r.blurb} <span className="src">from {r.blurbSource === "WIKIPEDIA" ? "Wikipedia" : "their website"}</span></p>
        : <p className="wl-blurb muted">No public description found.{r.careersUrl ? "" : " Saving their careers page below can help."}</p>}
      {r.backBecause && <p className="wl-back-because"><b>Back because:</b> {r.backBecause}{r.lastReviewedLabel ? ` · ${r.lastReviewedLabel}` : ""}</p>}

      {best && (
        <section className="wayin" aria-labelledby={`wayin-${r.companyId}`}>
          <h3 id={`wayin-${r.companyId}`}>Your way in</h3>
          <Person p={best} />
          {others.length > 0 && (
            <details>
              <summary>{others.length} more {others.length === 1 ? "person" : "people"} you know here</summary>
              <ul>{others.map((p) => <li key={p.id}><Person p={p} /></li>)}</ul>
            </details>
          )}
        </section>
      )}

      <Careers r={r} onSaved={(msg) => { toast(msg); router.refresh(); }} />

      {r.news.length > 0 && (
        <section className="wl-sec">
          <h3>Recent news</h3>
          <ul className="wl-news">{r.news.map((n) => <li key={n.id}><a href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a> <span className="k">{n.dateLabel}</span></li>)}</ul>
        </section>
      )}

      <div className="wl-acts">
        <button className="btn solid" onClick={onReview}>Reviewed</button>
        <button className="btn quiet" onClick={onExclude}>Exclude</button>
      </div>
    </article>
  );
}

function Person({ p }: { p: Row["people"][number] }) {
  return (
    <div className="person">
      <span className={`avatar t${p.tier}`} aria-hidden="true">{p.initials}</span>
      <span>
        <span className="who">{p.name}</span>{p.title ? <span className="ctx">, {p.title}</span> : null}
        <span className="k">{p.tierLabel} · {p.connectedLabel}</span>
      </span>
    </div>
  );
}

type Check = { readAs: "BOARD" | "WORKDAY" | "LISTINGS" | "TEXT" | "UNREADABLE" | "LINKEDIN" | "FAILED"; jobCount: number; provider?: keyof typeof PROVIDER_NAMES };

// What the user is told after saving a careers page: what the app could read, and what happens next.
function checkMessage(name: string, c: Check): string {
  const roles = `${c.jobCount} senior product ${c.jobCount === 1 ? "role" : "roles"}`;
  switch (c.readAs) {
    case "BOARD": return `Found ${name}'s ${c.provider ? PROVIDER_NAMES[c.provider] : "job"} board with ${c.jobCount} open ${c.jobCount === 1 ? "job" : "jobs"}. Its jobs show on Today after the next morning check.`;
    case "WORKDAY": case "LISTINGS": case "TEXT": {
      const where = c.readAs === "WORKDAY" ? "Workday site" : "careers page";
      return c.jobCount ? `Read ${name}'s ${where}: ${roles}, now on Today. It's checked every morning.` : `Read ${name}'s ${where}. No senior product roles open today. It's checked every morning.`;
    }
    case "LINKEDIN": return `Saved. ${name} lists its jobs on LinkedIn, which the app never reads. Open it yourself; ${name} stays on your Watchlist.`;
    case "UNREADABLE": return `Saved. ${name}'s page loads its jobs after it opens, so the app can't read it. It stays on your Watchlist.`;
    default: return `Saved, but the page didn't open. The app tries again on the next morning check.`;
  }
}

function Careers({ r, onSaved }: { r: Row; onSaved: (message: string) => void }) {
  const [editing, setEditing] = useState(!r.careersUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(url: string) {
    setBusy(true); setError(null);
    try {
      const res = await api.post<Check>(`/api/companies/${r.companyId}/careers`, { url });
      onSaved(checkMessage(r.companyName, res));
      setEditing(false);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  const host = r.careersUrl ? new URL(r.careersUrl).hostname.replace(/^www\./, "") : "";
  return (
    <section className="wl-sec">
      <h3>Careers page</h3>
      {!editing && r.careersUrl ? (
        <>
          <p className="wl-careers"><a className="btn solid" href={r.careersUrl} target="_blank" rel="noopener noreferrer">Visit {host} ↗</a> <button className="btn quiet" onClick={() => setEditing(true)}>{r.careersFound ? "Wrong page? Change it" : "Change link"}</button></p>
          {r.careersOnLinkedIn && <p className="wl-note">Their jobs are listed on LinkedIn. The app never reads LinkedIn, so open it yourself.</p>}
          {r.careersUnreadable && <p className="wl-note">This page loads its jobs after it opens, so the app can&apos;t read it. Check it yourself.</p>}
        </>
      ) : (
        <>
          <form className="addurl" onSubmit={(e) => { e.preventDefault(); const url = String(new FormData(e.currentTarget).get("url") ?? "").trim(); if (url) void save(url); }}>
            <input name="url" type="url" required placeholder="Paste their careers page link" aria-label={`${r.companyName} careers page link`} defaultValue={r.careersUrl ?? ""} disabled={busy} />
            <button className="btn" disabled={busy}>{busy ? "Checking…" : "Save and check"}</button>
          </form>
          <p className="wl-hint"><a href={r.searchUrl} target="_blank" rel="noopener noreferrer">Find their careers page ↗</a></p>
        </>
      )}
      {error && <p className="wl-error" role="alert">{error}</p>}
    </section>
  );
}
