import { markApplied } from "@/services/actions";
import { ok } from "@/lib/http/json";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) { await markApplied((await params).id); return ok(); }
