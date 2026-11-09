import { visitSource } from "@/services/sources";
import { ok } from "@/lib/http/json";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) { await visitSource((await params).id); return ok(); }
