// VentureFizz sitemap.rss: the 50 newest postings, with the company only in the URL slug. Pure.
import type { FeedItem } from "../feeds/parse.ts";
import { normalizeCompanyName } from "../companies/normalize.ts";

export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");

// "/job/zus-health-future-zusers-2/" + "Future Zusers" → "zus-health"
export function companySlugFrom(url: string, title: string): string | null {
  const slug = url.match(/\/job\/([^/]+)\/?/)?.[1]?.replace(/-\d+$/, "");
  const t = slugify(title);
  if (!slug || !t || !slug.endsWith(`-${t}`)) return null;
  return slug.slice(0, -(t.length + 1)) || null;
}

export function matchCompany(companySlug: string, companies: { id: string; name: string }[]): string | null {
  const hit = companies.find((c) => slugify(c.name) === companySlug || slugify(normalizeCompanyName(c.name)) === companySlug);
  return hit?.id ?? null;
}

export function ventureFizzPostings(items: FeedItem[], companies: { id: string; name: string }[]) {
  const out: { externalId: string; companyId: string; title: string; url: string; postedAt: Date | null }[] = [];
  for (const i of items) {
    if (!/\/job\//.test(i.url)) continue;
    const cs = companySlugFrom(i.url, i.title);
    const companyId = cs ? matchCompany(cs, companies) : null;
    if (!companyId) continue;
    out.push({ externalId: i.url.match(/\/job\/([^/]+)/)![1], companyId, title: i.title, url: i.url, postedAt: i.publishedAt });
  }
  return out;
}
