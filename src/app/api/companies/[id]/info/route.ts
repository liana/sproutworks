import { lookUpCompanyInfo } from "@/services/companyInfo";
import { ok } from "@/lib/http/json";
type Ctx = { params: Promise<{ id: string }> };
export async function POST(_: Request, { params }: Ctx) { return ok(await lookUpCompanyInfo((await params).id)); }
