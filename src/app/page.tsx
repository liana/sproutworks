import Link from "next/link";
import { buildToday } from "@/services/today";
import { startRefreshIfDue } from "@/services/refresh";
import { MorningStrip } from "@/components/MorningStrip";
import { LeadCards } from "@/components/LeadCards";
import { CaughtUp } from "@/components/CaughtUp";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  await startRefreshIfDue();
  const view = await buildToday();

  if (view.firstRun) {
    return (
      <>
        <MorningStrip state="IDLE" checked={0} total={0} finishedAt={null} />
        <section>
          <h2>Get started</h2>
          <div className="empty">
            Sproutworks needs your LinkedIn data export to find leads.
            <ol>
              <li>On <Link href="/admin">Admin</Link>, use <strong>Request new export</strong> and click Request on LinkedIn.</li>
              <li>When LinkedIn emails you the ZIP, upload it with <strong>Import archive</strong>.</li>
            </ol>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      {view.staleImportDays && <div className="nudge">Your LinkedIn data is {view.staleImportDays} days old. <Link href="/admin">Refresh it</Link> so job changes show up.</div>}
      <MorningStrip state={view.refresh.state} checked={view.refresh.checked} total={view.refresh.total} finishedAt={view.refresh.finishedAt} />
      {view.recentlySwitched.length > 0 && (
        <section aria-labelledby="sw">
          <h2 id="sw">Recently switched</h2>
          <p className="sub">{view.recentlySwitched[0].betweenLabel}</p>
          <div className="switched">
            {view.recentlySwitched.map((s) => <div className="chip" key={s.personId}><strong>{s.name}</strong>: {s.fromCompany ?? "?"} → {s.toCompany ?? "?"}</div>)}
          </div>
        </section>
      )}
      <section aria-labelledby="leads">
        <h2 id="leads">{view.leads.length ? `${view.leads.length} new lead${view.leads.length === 1 ? "" : "s"}` : "No new leads"}</h2>
        <p className="sub">{view.leads.length ? "newest job first" : ""}</p>
        <LeadCards initial={view.leads} />
      </section>
      <CaughtUp />
    </>
  );
}
