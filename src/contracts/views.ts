// Shapes the API returns and the pages render. Routes validate against these.
import { z } from "zod";

export const Tier = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const RefreshStatus = z.object({
  state: z.enum(["IDLE", "RUNNING", "DONE", "STOPPED_AT_CAP"]),
  checked: z.number().int(),
  total: z.number().int(),
  finishedAt: z.string().datetime().nullable(),
  newLeadCount: z.number().int(),
});

export const FitResult = z.object({
  fit: z.enum(["STRONG", "PARTIAL", "WEAK"]),
  matches: z.array(z.object({ requirement: z.string(), quote: z.string() })), // verified only
  gaps: z.array(z.string()),
  checkedAt: z.string().datetime(),
});

export const AiFailure = z.object({
  error: z.enum(["BUDGET", "AUTH", "UNAVAILABLE", "LENGTH"]),
  message: z.string(),
});

export const WarmIntro = z.object({
  personId: z.string(),
  name: z.string(),
  title: z.string().nullable(),
  tier: Tier,
  tierLabel: z.string(), // "Tier 1 · Direct influence"
  connectedLabel: z.string(), // "Connected 6 years ago"
  note: z.string().nullable().optional(), // "Just joined from Brightline", "Promoted from Senior PM"
});

export const LeadJob = z.object({
  id: z.string(),
  title: z.string(),
  location: z.string().nullable(),
  isRemote: z.boolean(),
  roleType: z.enum(["FULL_TIME", "FRACTIONAL"]),
  compensation: z.string().nullable(),
  url: z.string().url().nullable(),
  postedLabel: z.string(), // "Posted 4 days ago"
  source: z.enum(["GREENHOUSE", "LEVER", "ASHBY", "VENTUREFIZZ", "MANUAL"]),
  addedByUser: z.boolean(),
  fit: FitResult.extend({ staleProfile: z.boolean() }).nullable(),
  hasCoverLetter: z.boolean(),
  filterWarnings: z.array(z.string()), // manual entries only: filters warn, never block
});

export const PulseItem = z.object({
  headline: z.string(), // verbatim
  url: z.string().url(),
  source: z.string(),
  type: z.enum(["FUNDING", "LAUNCH", "LEADERSHIP_HIRE", "EXPANSION"]).nullable(),
  amount: z.string().nullable(),
  round: z.string().nullable(),
  knownPeople: z.number().int(),
});

export const LeadCard = z.object({
  companyId: z.string(),
  companyName: z.string(),
  pulse: PulseItem.nullable(),
  jobs: z.array(LeadJob), // newest first
  people: z.array(WarmIntro), // tier, then most recently connected
  newSinceReview: z.array(z.string()), // posting IDs to highlight
});

export const TodayView = z.object({
  refresh: RefreshStatus,
  staleImportDays: z.number().int().nullable(),
  firstRun: z.boolean(),
  horoscopes: z.array(z.object({ source: z.string(), text: z.string(), url: z.string().url() })),
  recentlySwitched: z
    .array(
      z.object({
        personId: z.string(),
        name: z.string(),
        fromCompany: z.string().nullable(),
        toCompany: z.string().nullable(),
        betweenLabel: z.string(), // "changed between your Oct 9 and Nov 8 imports"
      }),
    )
    .max(5),
  leads: z.array(LeadCard),
  worthALook: z.array(PulseItem).max(3),
});

export const WatchlistRow = z.object({
  companyId: z.string(),
  companyName: z.string(),
  peopleCount: z.number().int(),
  bestIntro: WarmIntro.nullable(),
  careersUrl: z.string().url().nullable(),
  lastReviewedAt: z.string().datetime().nullable(),
  backBecause: z.string().nullable(), // "raised a $12M seed", "30 days since you reviewed it"
});

export const CoverLetterDraft = z.object({
  id: z.string(),
  postingId: z.string(),
  openingType: z.enum(["STANDARD", "MISSION_DRIVEN"]),
  body: z.string(),
  paragraphWordCounts: z.array(z.number().int()),
  flags: z.array(z.object({ text: z.string(), reason: z.string() })),
  regenerationsLeft: z.number().int(),
});

export const ImportResult = z.object({
  connections: z.number().int(),
  companies: z.number().int(),
  changes: z.number().int(),
  profileVersion: z.number().int(),
});

export const SourcePreview = z.object({
  url: z.string().url(),
  detectedType: z.enum(["ATS_BOARD", "NEWS_RSS", "JOB_AGGREGATOR_RSS", "NONE"]),
  feedUrl: z.string().url().nullable(),
  itemCount: z.number().int().nullable(),
  robotsAllowed: z.boolean(),
  fetchable: z.boolean(), // false → saves as link-out
  newestLabel: z.string().nullable(), // "Nov 8"
  stale: z.boolean(), // newest item older than 30 days: refused
  error: z.string().nullable(),
});
export type SourcePreview = z.infer<typeof SourcePreview>;

export const PipelineCard = z.object({
  applicationId: z.string(),
  companyName: z.string(),
  title: z.string(),
  stage: z.enum(["APPLIED", "INTERVIEWING", "CLOSED", "WON"]),
  appliedLabel: z.string(), // "Applied Nov 2"
  stageSinceLabel: z.string().nullable(), // null when still in the stage it started in
  bestIntro: WarmIntro.nullable(),
  collapsed: z.boolean(), // CLOSED for more than 30 days
});
export const PipelineView = z.object({ cards: z.array(PipelineCard) });
export type PipelineView = z.infer<typeof PipelineView>;

export type TodayView = z.infer<typeof TodayView>;
export type LeadCard = z.infer<typeof LeadCard>;
export type LeadJob = z.infer<typeof LeadJob>;
export type WarmIntro = z.infer<typeof WarmIntro>;
export type WatchlistRow = z.infer<typeof WatchlistRow>;
export type CoverLetterDraft = z.infer<typeof CoverLetterDraft>;
export type FitResult = z.infer<typeof FitResult>;
export type AiFailure = z.infer<typeof AiFailure>;
