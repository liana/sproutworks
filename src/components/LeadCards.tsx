"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/hooks/api";
import { useToast } from "@/components/Toast";
import type { LeadCard } from "@/contracts/views";

export function LeadCards({ initial }: { initial: LeadCard[] }) {
  const router = useRouter();
  const toast = useToast();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());
  const visible = initial.filter((c) => !hidden.has(c.companyId) && c.jobs.some((j) => !appliedJobs.has(j.id)));

  const hide = (id: string, on: boolean) => setHidden((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });

  async function act(card: LeadCard, kind: "review" | "exclude") {
    hide(card.companyId, true);
    try {
      await (kind === "review" ? api.review(card.companyId) : api.exclude(card.companyId));
      router.refresh();
      toast(
        kind === "review" ? `${card.companyName} reviewed. It comes back when a new role opens.` : `${card.companyName} excluded. Include it again from Admin.`,
        async () => { await (kind === "review" ? api.undoReview(card.companyId) : api.include(card.companyId)); hide(card.companyId, false); router.refresh(); },
      );
    } catch (e) { hide(card.companyId, false); toast((e as Error).message); }
  }

  async function applied(card: LeadCard, jobId: string, title: string) {
    setAppliedJobs((s) => new Set(s).add(jobId));
    try { await api.applied(jobId); toast(`${title} moved to Pipeline.`); router.refresh(); }
    catch (e) { setAppliedJobs((s) => { const n = new Set(s); n.delete(jobId); return n; }); toast((e as Error).message); }
  }

  if (!visible.length) return <p className="sub">No new openings at companies you know.</p>;

  return (
    <>
      {visible.map((card) => (
        <article className="card" key={card.companyId}>
          <div className="card-head"><h3>{card.companyName}</h3></div>
          {card.jobs.filter((j) => !appliedJobs.has(j.id)).map((job) => {
            const isNew = card.newSinceReview.includes(job.id);
            const meta = [job.location ?? (job.isRemote ? "Remote" : null), job.roleType === "FULL_TIME" ? "Full-time" : null, job.compensation, job.postedLabel].filter(Boolean).join(" · ");
            return (
              <div className={`job${isNew ? " new" : ""}`} key={job.id}>
                <div className="job-title">
                  {job.title}
                  {isNew && <span className="flag">New since you reviewed</span>}
                  {job.roleType === "FRACTIONAL" && !isNew && <span className="flag" style={{ background: "#DCE8DE" }}>Fractional</span>}
                </div>
                <div className="meta">{meta}</div>
                <div className="actions">
                  {job.url && <a className="btn solid" href={job.url} target="_blank" rel="noopener noreferrer" onClick={() => api.event("APPLY_CLICKED", job.id)}>Apply ↗</a>}
                  <button className="btn quiet" onClick={() => applied(card, job.id, job.title)}>Applied</button>
                </div>
              </div>
            );
          })}
          <ul className="people" aria-label={`People you know at ${card.companyName}`}>
            {card.people.map((p) => (
              <li key={p.personId}>
                <span className={`tier t${p.tier}`}><span className="dot" />{p.tierLabel}</span>
                <span className="who">{p.name}</span>
                <span className="ctx">{[p.title, p.connectedLabel].filter(Boolean).join(" · ")}</span>
                {p.note && <span className="flag" style={{ background: "#DCE8DE" }}>{p.note}</span>}
              </li>
            ))}
          </ul>
          <div className="card-foot">
            <button className="btn quiet" onClick={() => act(card, "exclude")}>Exclude company</button>
            <button className="btn" onClick={() => act(card, "review")}>Reviewed</button>
          </div>
        </article>
      ))}
    </>
  );
}
