import { buildPipeline } from "@/services/pipeline";
import { PipelineBoard } from "@/components/PipelineBoard";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const view = await buildPipeline();
  return (
    <>
      <h1 className="page-title">Pipeline</h1>
      <p className="page-sub">Every job you marked Applied, by stage. Closed applications collapse after 30 days.</p>
      {view.cards.length ? <PipelineBoard cards={view.cards} /> : <div className="empty">Nothing here yet. Mark a job <strong>Applied</strong> on Today and it moves here.</div>}
    </>
  );
}
