import { MoveApplicationRequest } from "@/contracts/requests";
import { moveApplication } from "@/services/actions";
import { parseBody, ok } from "@/lib/http/json";
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await parseBody(req, MoveApplicationRequest);
  if (!body.ok) return body.res;
  await moveApplication((await params).id, body.data.stage);
  return ok();
}
