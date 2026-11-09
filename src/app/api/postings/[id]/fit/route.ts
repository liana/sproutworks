import { checkFit } from "@/services/applying/fit";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await checkFit((await params).id);
  return Response.json(r, { status: r.ok ? 200 : r.error === "BUDGET" ? 429 : 422 });
}
