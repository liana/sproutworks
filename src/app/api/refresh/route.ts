import { runRefresh, currentProgress } from "@/services/refresh";
import { ok } from "@/lib/http/json";

export async function GET() { return ok({ progress: currentProgress() }); }
export async function POST() { void runRefresh(); return ok({ started: true }); }
