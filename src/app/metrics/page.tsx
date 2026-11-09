import Link from "next/link";
import { buildMetrics } from "@/services/metrics";
import { KPI } from "@/config/kpis";
import { Tip, Sparkline } from "@/components/MetricBits";

export const dynamic = "force-dynamic";

const state = (v: number | null | undefined, target: number, lowerIsBetter = true) =>
  v === null || v === undefined ? "No data yet this week" : (lowerIsBetter ? v <= target : v >= target) ? "✓ On target" : "▲ Over target";

function Name({ k }: { k: keyof typeof KPI }) {
  return <div className="name">{KPI[k].label}<Tip id={`tip-${k}`} label={KPI[k].label} text={KPI[k].tip} /></div>;
}

export default async function MetricsPage() {
  const m = await buildMetrics();
  return (
    <>
      <h1 className="page-title">Metrics</h1>
      <p className="page-sub">What your search is producing, then how the app is doing. Trend lines cover 8 weeks, and the dashed line is the target.</p>

      <section className="outcomes" aria-label="Outcomes">
        <Link className="outcome" href="/pipeline">
          <span className="o-name">{KPI.applications.label}<Tip id="tip-o-apps" label="Applications" text={KPI.applications.tip} /></span>
          <span className="o-val">{m.outcomes.applications}</span><span className="o-sub">{m.outcomes.active} active · open Pipeline →</span>
        </Link>
        <div className="outcome">
          <span className="o-name">{KPI.interviewRate.label}<Tip id="tip-o-rate" label="Interview rate" text={KPI.interviewRate.tip} /></span>
          <span className="o-val">{m.outcomes.interviewRate}%</span><span className="o-sub">{m.outcomes.reached} of {m.outcomes.applications} applications reached Interviewing</span>
        </div>
        <div className="outcome won">
          <span className="o-name">{KPI.jobsWon.label}<Tip id="tip-o-won" label="Jobs won" text={KPI.jobsWon.tip} /></span>
          <span className="o-val">{m.outcomes.won}</span><span className="o-sub">all time</span>
        </div>
      </section>

      <h2 style={{ marginTop: "2rem" }}>How the sweep is going</h2>
      <div className="kpis">
        <div className="kpi"><Name k="sweep" /><div className="val">{m.sweep.value ?? "–"}<small> {KPI.sweep.unit}</small></div><div className="tgt">Target ≤ {KPI.sweep.target} min</div><div className="state">{state(m.sweep.value, KPI.sweep.target)}</div><Sparkline values={m.sweep.trend} target={KPI.sweep.target} unit="min" /></div>
        <div className="kpi"><Name k="toReview" /><div className="val">{m.toReview.value ?? "–"}<small> {KPI.toReview.unit}</small></div><div className="tgt">Target ≤ {KPI.toReview.target} days</div><div className="state">{state(m.toReview.value, KPI.toReview.target)}</div><Sparkline values={m.toReview.trend} target={KPI.toReview.target} unit="days" /></div>
        <div className="kpi"><Name k="warmLeads" /><div className="val">{m.warmLeads.value}<small> {KPI.warmLeads.unit}</small></div><div className="tgt">Baseline · week {m.warmLeads.baselineWeek} of 4</div><div className="state">Target set after 4 weeks</div></div>
        <div className="kpi"><Name k="outreach" /><div className="val">{m.outreach.value}<small> {KPI.outreach.unit}</small></div><div className="tgt">Baseline · week {m.outreach.baselineWeek} of 4</div><div className="state">Target set after 4 weeks</div></div>
      </div>

      <h2 style={{ marginTop: "2rem" }}>Can you trust it</h2>
      <div className="kpis">
        <div className="kpi"><Name k="check" /><div className="val">{m.check.value ?? "–"}<small> {KPI.check.unit}</small></div><div className="tgt">Target ≤ {KPI.check.target} min</div><div className="state">{state(m.check.value, KPI.check.target)}</div><Sparkline values={m.check.trend} target={KPI.check.target} unit="min" /></div>
        <div className="kpi"><Name k="failures" /><div className="val">{m.failures.value ?? "–"}<small> {KPI.failures.unit}</small></div><div className="tgt">Target &lt; {KPI.failures.target}%</div><div className="state">{state(m.failures.value, KPI.failures.target)}</div><Sparkline values={m.failures.trend} target={KPI.failures.target} unit="%" /></div>
        <div className="kpi"><Name k="spend" /><div className="val">${m.spend.usd.toFixed(2)}<small> of ${m.spend.budget.toFixed(2)}</small></div><div className="tgt">Rolling 7 days</div><div className="state">{Math.round((m.spend.usd / m.spend.budget) * 100)}% of weekly budget</div><div className="budget" role="img" aria-label={`${Math.round((m.spend.usd / m.spend.budget) * 100)}% of budget used`}><span style={{ width: `${Math.min(100, (m.spend.usd / m.spend.budget) * 100)}%` }} /></div></div>
        <div className="kpi"><Name k="accuracy" /><div className="val">{m.accuracy.falseResurfaces}<small> false new leads</small></div><div className="tgt">Cover letters saved within length: {m.accuracy.letters} of {m.accuracy.letters}</div><div className="state">{m.accuracy.falseResurfaces === 0 ? "✓ On target" : "▲ Check Admin"}</div></div>
        <div className="kpi"><Name k="coverage" /><div className="val">{m.coverage.readable}<small> of {m.coverage.total} companies</small></div><div className="tgt">The rest are on your Watchlist</div><div className="state">Coverage, no target</div></div>
      </div>
    </>
  );
}
