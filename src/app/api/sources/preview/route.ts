import { z } from "zod";
import { previewSource } from "@/services/sources";
import { parseBody } from "@/lib/http/json";
export async function POST(req: Request) {
  const body = await parseBody(req, z.object({ url: z.string().url() }));
  if (!body.ok) return body.res;
  return Response.json(await previewSource(body.data.url));
}
