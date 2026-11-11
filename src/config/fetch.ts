// Politeness limits for every outbound request the app makes.
export const FETCH = {
  maxConcurrent: 4,
  perHostConcurrent: 1,
  perHostDelayMs: 1000,
  requestTimeoutMs: 10_000,
  maxRetries: 1,
  minHoursBetweenFetches: 20,
  resolverRetryDays: 7,
  maxRequestsPerRefresh: 1000,
  staleBoardDays: 3,
  closureMinFraction: 0.5,
} as const;

// Hard rule: the app never requests anything from LinkedIn, however a link or redirect leads there.
// Enforced in the polite fetcher, the only way the app makes outbound requests.
export const NEVER_FETCH_HOSTS = /(^|\.)(linkedin\.com|lnkd\.in|licdn\.com)$/i;
export const isNeverFetch = (url: string): boolean => { try { return NEVER_FETCH_HOSTS.test(new URL(url).hostname); } catch { return false; } };

// Company descriptions for the Watchlist: a few per morning check, on their own budget, refreshed quarterly.
export const COMPANY_INFO = {
  perRefresh: 25,
  maxRequestsPerCompany: 6,
  refreshDays: 90,
} as const;

// Companies' own careers pages and Workday sites: checked every morning on their own budget,
// so board matching can never crowd them out. Discovery follows a few homepages' Careers links per run.
export const CAREERS = {
  maxRequestsPerRefresh: 600,
  discoverPerRefresh: 25,
  workdayMaxPages: 3, // 20 product-search results a page
} as const;

import { APP_NAME } from "./app.ts";

export function userAgent(): string {
  const contact = process.env.SPROUT_CONTACT_EMAIL ?? "contact-not-set";
  return `${APP_NAME}/0.1 (personal job tracker; ${contact})`;
}
