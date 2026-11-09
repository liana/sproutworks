// Starter sources, seeded once. The user adds and removes sources on Admin; these rules ride along by URL.
export type SeedSource = {
  list: "NEWS" | "LEADS";
  type: "NEWS_RSS" | "JOB_AGGREGATOR_RSS" | "HOROSCOPE" | "LINK_OUT";
  name: string;
  url: string;
  feedUrl?: string;
  category?: "AI" | "DIGITAL_HEALTH" | "PULSE";
  color?: string;
  pathFilter?: string;
  showSummary?: boolean;
  termsConfirmed: boolean; // the user's decision, recorded Nov 8
};

export const SEED_SOURCES: SeedSource[] = [
  { list: "NEWS", type: "NEWS_RSS", name: "STAT", url: "https://www.statnews.com/category/health-tech/", feedUrl: "https://www.statnews.com/category/health-tech/feed/", category: "DIGITAL_HEALTH", color: "#5B7FA6", showSummary: false, termsConfirmed: true },
  { list: "NEWS", type: "NEWS_RSS", name: "TechCrunch", url: "https://techcrunch.com/category/biotech-health/", feedUrl: "https://techcrunch.com/category/biotech-health/feed/", category: "PULSE", color: "#3C6E47", termsConfirmed: true },
  { list: "NEWS", type: "NEWS_RSS", name: "Fierce Healthcare", url: "https://www.fiercehealthcare.com/", feedUrl: "https://www.fiercehealthcare.com/rss/xml", category: "DIGITAL_HEALTH", color: "#B8892A", pathFilter: "/health-tech/,/digital-health/", termsConfirmed: true },
  { list: "NEWS", type: "LINK_OUT", name: "MobiHealthNews", url: "https://www.mobihealthnews.com/", termsConfirmed: false },
  { list: "NEWS", type: "LINK_OUT", name: "Health Tech Nerds", url: "https://www.healthtechnerds.com/", termsConfirmed: false },
  { list: "NEWS", type: "HOROSCOPE", name: "Astrostyle", url: "https://astrostyle.com/horoscopes/daily/virgo/", feedUrl: "https://astrostyle.com/feed/", termsConfirmed: true },
  // AI newsletters the user chose (checked Nov 8). The AI Optimist is left out: no posts since May 2026.
  { list: "NEWS", type: "NEWS_RSS", name: "Import AI", url: "https://importai.substack.com/", feedUrl: "https://importai.substack.com/feed", category: "AI", color: "#7A5C99", termsConfirmed: true },
  { list: "NEWS", type: "NEWS_RSS", name: "Ben's Bites", url: "https://www.bensbites.com/", feedUrl: "https://www.bensbites.com/feed", category: "AI", color: "#C2603A", termsConfirmed: true },
  { list: "NEWS", type: "NEWS_RSS", name: "100 School", url: "https://100-school.beehiiv.com/", feedUrl: "https://rss.beehiiv.com/feeds/v8OJluUjhs.xml", category: "AI", color: "#2F7D7A", termsConfirmed: true },
  { list: "NEWS", type: "NEWS_RSS", name: "Zapier", url: "https://zapier.com/blog/", feedUrl: "https://zapier.com/blog/feeds/latest/", category: "AI", color: "#E0592A", termsConfirmed: true },
  { list: "NEWS", type: "LINK_OUT", name: "The Rundown AI", url: "https://www.therundown.ai/", termsConfirmed: false },
  { list: "NEWS", type: "LINK_OUT", name: "The Batch", url: "https://www.deeplearning.ai/the-batch/", termsConfirmed: false },
  { list: "NEWS", type: "LINK_OUT", name: "Superhuman AI", url: "https://www.superhuman.ai/", termsConfirmed: false },
  { list: "NEWS", type: "LINK_OUT", name: "The Neuron", url: "https://www.theneurondaily.com/", termsConfirmed: false },
  { list: "LEADS", type: "LINK_OUT", name: "Health Tech Nerds jobs", url: "https://jobs.healthtechnerds.com/", termsConfirmed: false },
  { list: "LEADS", type: "LINK_OUT", name: "Fierce Jobs", url: "https://jobs.fiercehealthcare.com/", termsConfirmed: false },
];

// A source's own promotions aren't news.
export const TITLE_EXCLUDES: Record<string, RegExp> = {
  TechCrunch: /\b(techcrunch|founder summit|disrupt|strictlyvc)\b/i,
};

// Whole-blog feeds where only AI stories belong on the Industry page.
export const AI_ONLY = new Set(["Zapier"]);

export const STALE_FEED_DAYS = 30;
export const LINK_CHECK_DAYS = 30;
export const NEWS_WINDOW_DAYS = 7;
