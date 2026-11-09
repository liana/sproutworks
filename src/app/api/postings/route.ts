import { AddPostingRequest } from "@/contracts/requests";
import { addManualPosting } from "@/services/applying/manual";
import { parseBody } from "@/lib/http/json";
export async function POST(req: Request) {
  const body = await parseBody(req, AddPostingRequest);
  if (!body.ok) return body.res;
  if (body.data.url && /(^|\.)linkedin\.com/i.test(new URL(body.data.url).hostname) && !body.data.description)
    return Response.json({ error: "LinkedIn links are saved but never opened by the app. Paste the job text too." }, { status: 400 });
  return Response.json(await addManualPosting(body.data));
}
