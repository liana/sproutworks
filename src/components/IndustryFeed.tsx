import Link from "next/link";
import type { IndustryItem, Section } from "@/services/industry";

const TABS: { key: Section; label: string }[] = [
  { key: "all", label: "All" }, { key: "ai", label: "AI" }, { key: "digital-health", label: "Digital health" }, { key: "pulse", label: "Market Pulse" },
];

function Card({ item }: { item: IndustryItem }) {
  return (
    <a className={`news${item.imageUrl ? " with-img" : ""}`} href={item.url} target="_blank" rel="noopener noreferrer" style={{ "--src": item.color ?? "#3C6E47" } as React.CSSProperties}>
      <div>
        <span className="src">{item.tags.join(" · ")} · {item.publishedLabel}</span>
        <h4>{item.title}</h4>
        {item.summary && <p>{item.summary}</p>}
        {item.knownPeople > 0 && <span className="know">You know {item.knownPeople} {item.knownPeople === 1 ? "person" : "people"} here</span>}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {item.imageUrl && <img className="thumb" src={item.imageUrl} alt="" loading="lazy" style={{ objectFit: "cover" }} />}
    </a>
  );
}

export function IndustryFeed({ section, items, fetched, linkOnly }: { section: Section; items: IndustryItem[]; fetched: string[]; linkOnly: { id: string; name: string; url: string }[] }) {
  const hero = items.find((i) => i.imageUrl);
  const rest = items.filter((i) => i !== hero);
  return (
    <>
      <p className="page-sub">Headlines from your sources, as each source wrote them.</p>
      <details className="how" style={{ marginBottom: "1rem" }}>
        <summary>How I pick these</summary>
        <div className="pop">Feeds you keep on Admin: {fetched.join(", ") || "none yet"}. Funding, launch, leadership, and expansion news is tagged by headline rules, and news at companies where you know people is marked. Only the last 7 days are shown. No AI.</div>
      </details>
      <nav className="tabs" aria-label="Sections">
        {TABS.map((t) => <Link key={t.key} href={t.key === "all" ? "/industry" : `/industry?section=${t.key}`} aria-current={section === t.key ? "true" : undefined}>{t.label}</Link>)}
      </nav>
      {items.length === 0 ? <div className="empty">Nothing in this section from the last 7 days. The next morning check pulls fresh headlines.</div> : (
        <>
          {hero && (
            <a className="hero" href={hero.url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="img" src={hero.imageUrl!} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div className="shade" />
              <div className="txt"><span className="src">{hero.tags.join(" · ")}</span><h3>{hero.title}</h3>{hero.summary && <p>{hero.summary}</p>}</div>
            </a>
          )}
          <div className="mag">{rest.map((i) => <Card key={i.id} item={i} />)}</div>
        </>
      )}
      {linkOnly.length > 0 && (
        <p className="linkouts">Sources you read on their own sites: {linkOnly.map((s, n) => <span key={s.id}>{n ? " · " : ""}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.name} ↗</a></span>)}</p>
      )}
    </>
  );
}
