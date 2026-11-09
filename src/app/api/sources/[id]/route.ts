import { removeSource } from "@/services/sources";
import { ok } from "@/lib/http/json";
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) { await removeSource((await params).id); return ok(); }
