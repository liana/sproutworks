import { buildIndustry, type Section } from "@/services/industry";
import { IndustryFeed } from "@/components/IndustryFeed";

export const dynamic = "force-dynamic";
const SECTIONS: Section[] = ["all", "ai", "digital-health", "pulse"];

export default async function IndustryPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const raw = (await searchParams).section;
  const section: Section = SECTIONS.includes(raw as Section) ? (raw as Section) : "all";
  const view = await buildIndustry(section);
  return (
    <>
      <h1 className="page-title">Industry</h1>
      <IndustryFeed section={section} {...view} />
    </>
  );
}
