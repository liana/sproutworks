import { SetBoardRequest } from "@/contracts/requests";
import { confirmBoard, rejectBoard, setBoard } from "@/services/actions";
import { parseBody, ok } from "@/lib/http/json";
type Ctx = { params: Promise<{ id: string }> };
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await parseBody(req, SetBoardRequest);
  if (!body.ok) return body.res;
  const b = body.data;
  if (b.action === "CONFIRM") await confirmBoard(id);
  else if (b.action === "SET") await setBoard(id, b.provider, b.code);
  else await rejectBoard(id);
  return ok();
}
