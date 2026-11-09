import { reviewCompany, undoReview } from "@/services/actions";
import { ok } from "@/lib/http/json";
type Ctx = { params: Promise<{ id: string }> };
export async function POST(_: Request, { params }: Ctx) { await reviewCompany((await params).id); return ok(); }
export async function DELETE(_: Request, { params }: Ctx) { await undoReview((await params).id); return ok(); }
