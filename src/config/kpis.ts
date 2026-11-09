// KPI definitions from PRD Module B: label, target, and the plain-language explanation shown in each tooltip.
export const KPI = {
  applications: { label: "Applications", tip: "Jobs you marked Applied, all time. Active means still at Applied or Interviewing." },
  interviewRate: { label: "Interview rate", tip: "Of all your applications, the share that reached Interviewing. It still counts if the application later closed or was won." },
  jobsWon: { label: "Jobs won", tip: "Applications you moved to Won." },
  sweep: { label: "Daily sweep time", target: 10, unit: "min avg", tip: "How long your morning takes, from opening Today to reaching \"All caught up.\" Averaged across the week." },
  toReview: { label: "Posting to review", target: 2, unit: "days avg", tip: "How long new jobs wait for you, from the day the app first saw the job to the day you reviewed its company or applied." },
  warmLeads: { label: "Warm leads", unit: "this week", baselineWeeks: 4, tip: "Companies that showed up on Today this week with an open role and someone you know there." },
  outreach: { label: "Outreach actions", unit: "this week", baselineWeeks: 4, tip: "Fit checks, cover letters, and jobs marked Applied this week." },
  check: { label: "Morning check", target: 2, unit: "min avg", tip: "How long the once-a-day job board check takes to finish." },
  failures: { label: "Board failures", target: 5, unit: "% of requests", tip: "The share of job board and feed requests that failed during the morning check. Each failure is listed on Admin." },
  spend: { label: "AI spend", tip: "Estimated cost of fit checks and cover letters over the last 7 days. The app refuses AI calls that would go past $3.00." },
  accuracy: { label: "Accuracy", tip: "Two checks that should stay perfect: reviewed companies that came back for a job that already existed when you reviewed (should be 0), and cover letters that stayed within your length caps." },
  coverage: { label: "Readable boards", unit: "companies", tip: "Companies whose job boards the app can read automatically. The rest are on your Watchlist." },
} as const;
