import { SaveCareersUrlRequest } from "@/contracts/requests";
import { saveCareersUrl } from "@/services/companyInfo";
import { parseBody, ok } from "@/lib/http/json";
type Ctx = { params: Promise<{ id: string }> };
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await parseBody(req, SaveCareersUrlRequest);
  if (!body.ok) return body.res;
  return ok(await saveCareersUrl(id, body.data.url));
}
