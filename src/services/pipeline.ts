import { db } from "@/lib/db";
import { tierFor } from "@/services/leads/rules";
import { TIER_LABELS } from "@/config/tiers";
import type { PipelineView } from "@/contracts/views";

const COLLAPSE_DAYS = 30;
const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

export async function buildPipeline(): Promise<PipelineView> {
  const apps = await db.application.findMany({
    orderBy: { stageChangedAt: "desc" },
    include: { posting: { include: { company: { include: { people: true } } } } },
  });
  return {
    cards: apps.map((a) => {
      const people = (a.posting.company?.people ?? []).map((p) => ({ p, tier: tierFor(p.title) })).sort((x, y) => x.tier - y.tier);
      const best = people[0];
      const sameDay = fmt(a.appliedAt) === fmt(a.stageChangedAt);
      return {
        applicationId: a.id,
        companyName: a.posting.company?.name ?? a.posting.manualCompanyName ?? "Unknown company",
        title: a.posting.title,
        stage: a.stage,
        appliedLabel: `Applied ${fmt(a.appliedAt)}`,
        stageSinceLabel: sameDay ? null : `in this stage since ${fmt(a.stageChangedAt)}`,
        bestIntro: best
          ? { personId: best.p.id, name: `${best.p.firstName} ${best.p.lastName}`, title: best.p.title, tier: best.tier, tierLabel: TIER_LABELS[best.tier], connectedLabel: "" }
          : null,
        collapsed: a.stage === "CLOSED" && Date.now() - a.stageChangedAt.getTime() > COLLAPSE_DAYS * 864e5,
      };
    }),
  };
}
