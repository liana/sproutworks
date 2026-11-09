// User actions on leads, boards, and applications.
import { db } from "@/lib/db";
import type { ApplicationStage } from "@/generated/prisma/client";

export async function reviewCompany(companyId: string) {
  const open = await db.posting.findMany({ where: { companyId, closedAt: null }, select: { id: true } });
  await db.review.create({ data: { companyId, postingIds: open.map((p) => p.id) } });
}

export async function undoReview(companyId: string) {
  const last = await db.review.findFirst({ where: { companyId }, orderBy: { reviewedAt: "desc" } });
  if (last) await db.review.delete({ where: { id: last.id } });
}

export const excludeCompany = (id: string) => db.company.update({ where: { id }, data: { excludedAt: new Date() } });
export const includeCompany = (id: string) => db.company.update({ where: { id }, data: { excludedAt: null } });

export async function markApplied(postingId: string) {
  await db.$transaction(async (tx) => {
    const app = await tx.application.upsert({ where: { postingId }, update: {}, create: { postingId } });
    const changes = await tx.applicationStageChange.count({ where: { applicationId: app.id } });
    if (!changes) await tx.applicationStageChange.create({ data: { applicationId: app.id, fromStage: null, toStage: "APPLIED" } });
  });
}

export async function moveApplication(id: string, stage: ApplicationStage) {
  await db.$transaction(async (tx) => {
    const app = await tx.application.findUniqueOrThrow({ where: { id } });
    if (app.stage === stage) return;
    await tx.application.update({
      where: { id },
      data: { stage, stageChangedAt: new Date(), reachedInterview: app.reachedInterview || stage === "INTERVIEWING" || stage === "WON" },
    });
    await tx.applicationStageChange.create({ data: { applicationId: id, fromStage: app.stage, toStage: stage } });
  });
}

export const confirmBoard = (id: string) => db.company.update({ where: { id }, data: { boardStatus: "CONFIRMED", boardLocked: true, lastFetchedAt: null } });

export const rejectBoard = (id: string) =>
  db.company.update({ where: { id }, data: { boardStatus: "NONE", boardProvider: null, boardCode: null, probeJobCount: null, probeSampleTitle: null } });

export const setBoard = (id: string, provider: "GREENHOUSE" | "LEVER" | "ASHBY", code: string) =>
  db.company.update({ where: { id }, data: { boardStatus: "CONFIRMED", boardLocked: true, boardProvider: provider, boardCode: code.trim(), lastFetchedAt: null, emptyOrMissingDays: 0 } });

export const recordExportRequest = () => db.exportRequest.create({ data: {} });

export const recordEvent = (type: "TODAY_OPENED" | "ALL_CAUGHT_UP" | "APPLY_CLICKED", postingId?: string) =>
  db.appEvent.create({ data: { type, postingId } });
