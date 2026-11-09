import { keepSource } from "@/services/sources";
import { ok } from "@/lib/http/json";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) { await keepSource((await params).id); return ok(); }
