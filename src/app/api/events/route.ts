import { AppEventRequest } from "@/contracts/requests";
import { recordEvent } from "@/services/actions";
import { parseBody, ok } from "@/lib/http/json";
export async function POST(req: Request) {
  const body = await parseBody(req, AppEventRequest);
  if (!body.ok) return body.res;
  await recordEvent(body.data.type, body.data.postingId);
  return ok();
}
