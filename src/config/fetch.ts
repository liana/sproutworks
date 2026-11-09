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

import { APP_NAME } from "./app.ts";

export function userAgent(): string {
  const contact = process.env.SPROUT_CONTACT_EMAIL ?? "contact-not-set";
  return `${APP_NAME}/0.1 (personal job tracker; ${contact})`;
}
