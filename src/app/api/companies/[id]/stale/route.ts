import { z } from "zod";
import { db } from "@/lib/db";
import { parseBody, ok } from "@/lib/http/json";
// Stale board token actions: re-probe (unlock and guess again) or dismiss (the company really has no openings).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await parseBody(req, z.object({ action: z.enum(["REPROBE", "DISMISS"]) }));
  if (!body.ok) return body.res;
  const id = (await params).id;
  if (body.data.action === "REPROBE") await db.company.update({ where: { id }, data: { boardStatus: "UNKNOWN", boardLocked: false, boardProvider: null, boardCode: null, lastProbedAt: null, emptyOrMissingDays: 0 } });
  else await db.company.update({ where: { id }, data: { staleDismissedAt: new Date(), emptyOrMissingDays: 0 } });
  return ok();
}
