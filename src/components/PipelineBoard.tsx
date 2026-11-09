"use client";
import { useRouter } from "next/navigation";
import { api } from "@/hooks/api";
import { useToast } from "@/components/Toast";
import type { PipelineView } from "@/contracts/views";

const STAGES = [["APPLIED", "Applied"], ["INTERVIEWING", "Interviewing"], ["CLOSED", "Closed"], ["WON", "Won"]] as const;

export function PipelineBoard({ cards }: PipelineView) {
  const router = useRouter();
  const toast = useToast();
  async function move(id: string, company: string, stage: string, label: string) {
    try { await api.move(id, stage); toast(`${company} moved to ${label}.`); router.refresh(); }
    catch (e) { toast((e as Error).message); }
  }
  const Card = (c: PipelineView["cards"][number]) => (
    <div className="app" key={c.applicationId}>
      <h3>{c.companyName}</h3>
      <div className="role">{c.title}</div>
      <span className="k">{c.appliedLabel}{c.stageSinceLabel ? ` · ${c.stageSinceLabel}` : ""}</span>
      {c.bestIntro && <span className="k">You know: {c.bestIntro.name} · {c.bestIntro.tierLabel.split(" · ")[0]}</span>}
      <select aria-label={`Move ${c.companyName} to`} defaultValue="" onChange={(e) => { const v = e.target.value; const label = STAGES.find(([k]) => k === v)?.[1] ?? v; if (v) move(c.applicationId, c.companyName, v, label); }}>
        <option value="">Move to…</option>
        {STAGES.filter(([k]) => k !== c.stage).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    </div>
  );
  return (
    <div className="board">
      {STAGES.map(([key, label]) => {
        const all = cards.filter((c) => c.stage === key);
        const recent = all.filter((c) => !c.collapsed);
        const older = all.filter((c) => c.collapsed);
        return (
          <section className={`col ${label.toLowerCase()}`} key={key}>
            <h2>{label} <span>{all.length}</span></h2>
            {recent.map(Card)}
            {older.length > 0 && <details className="older"><summary>{older.length} closed more than 30 days ago</summary>{older.map(Card)}</details>}
          </section>
        );
      })}
    </div>
  );
}
