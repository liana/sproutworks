import { recordExportRequest } from "@/services/actions";
import { ok } from "@/lib/http/json";
export async function POST() { await recordExportRequest(); return ok(); }
