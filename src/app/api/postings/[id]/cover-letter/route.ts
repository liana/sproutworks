import { CoverLetterRequest } from "@/contracts/requests";
import { draftLetter } from "@/services/applying/coverLetter";
import { parseBody } from "@/lib/http/json";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await parseBody(req, CoverLetterRequest);
  if (!body.ok) return body.res;
  const r = await draftLetter((await params).id, body.data);
  return Response.json(r, { status: r.ok ? 200 : r.error === "BUDGET" ? 429 : 422 });
}
