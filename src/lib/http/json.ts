import type { ZodType } from "zod";

// Parse a JSON body against its contract. Anything else is a 400 with a plain message.
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<{ ok: true; data: T } | { ok: false; res: Response }> {
  const raw = await req.json().catch(() => undefined);
  const r = schema.safeParse(raw);
  if (!r.success) return { ok: false, res: Response.json({ error: "That request didn't match what this endpoint accepts.", issues: r.error.issues }, { status: 400 }) };
  return { ok: true, data: r.data };
}

export const ok = (body: object = { ok: true }) => Response.json(body);
