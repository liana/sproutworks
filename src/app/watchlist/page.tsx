import { buildWatchlist } from "@/services/watchlist";
import { WatchlistRows } from "@/components/WatchlistRows";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const rows = await buildWatchlist();
  return (
    <>
      <h1 className="page-title">Watchlist</h1>
      <p className="page-sub">Companies where you know people but whose careers pages can&apos;t be read automatically. Review one and it stays away until there&apos;s news, a change in who you know there, or 30 days pass.</p>
      <WatchlistRows rows={rows} />
    </>
  );
}
