import { SaveCoverLetterRequest } from "@/contracts/requests";
import { saveLetterEdits } from "@/services/applying/coverLetter";
import { parseBody, ok } from "@/lib/http/json";
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await parseBody(req, SaveCoverLetterRequest);
  if (!body.ok) return body.res;
  await saveLetterEdits((await params).id, body.data.body);
  return ok();
}
