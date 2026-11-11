import { markWrongMatch } from "@/services/careersPages";
import { ok } from "@/lib/http/json";
type Ctx = { params: Promise<{ id: string }> };
export async function POST(_: Request, { params }: Ctx) { await markWrongMatch((await params).id); return ok(); }
