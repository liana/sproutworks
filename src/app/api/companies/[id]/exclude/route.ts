import { excludeCompany, includeCompany } from "@/services/actions";
import { ok } from "@/lib/http/json";
type Ctx = { params: Promise<{ id: string }> };
export async function POST(_: Request, { params }: Ctx) { await excludeCompany((await params).id); return ok(); }
export async function DELETE(_: Request, { params }: Ctx) { await includeCompany((await params).id); return ok(); }
