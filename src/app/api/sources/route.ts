import { AddSourceRequest } from "@/contracts/requests";
import { addSource } from "@/services/sources";
import { parseBody } from "@/lib/http/json";
export async function POST(req: Request) {
  const body = await parseBody(req, AddSourceRequest);
  if (!body.ok) return body.res;
  try { const s = await addSource(body.data); return Response.json({ id: s.id, type: s.type }); }
  catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
}
