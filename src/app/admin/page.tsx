import { buildAdmin } from "@/services/admin";
import { AdminPanels } from "@/components/AdminPanels";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const data = await buildAdmin();
  return (
    <>
      <h1 className="page-title">Admin</h1>
      <p className="page-sub">Everything that keeps Sproutworks running. You won&apos;t need this most mornings.</p>
      <AdminPanels data={data} />
    </>
  );
}
