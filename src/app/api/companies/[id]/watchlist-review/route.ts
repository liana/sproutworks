import { reviewWatchlistCompany, undoWatchlistReview } from "@/services/watchlist";
import { ok } from "@/lib/http/json";
type Ctx = { params: Promise<{ id: string }> };
export async function POST(_: Request, { params }: Ctx) { await reviewWatchlistCompany((await params).id); return ok(); }
export async function DELETE(_: Request, { params }: Ctx) { await undoWatchlistReview((await params).id); return ok(); }
