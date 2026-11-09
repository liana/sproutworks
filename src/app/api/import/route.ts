import { importArchive } from "@/services/importArchive";
import { ArchiveError } from "@/services/linkedin/parse";
import { runRefresh } from "@/services/refresh";
import { backup } from "@/services/backup";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("archive");
  if (!(file instanceof File)) return Response.json({ error: "Choose the ZIP LinkedIn emailed you." }, { status: 400 });
  try {
    await backup("import");
    const summary = await importArchive(await file.arrayBuffer(), file.name);
    void runRefresh(); // new and changed companies need their job boards checked
    return Response.json(summary);
  } catch (e) {
    if (e instanceof ArchiveError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
