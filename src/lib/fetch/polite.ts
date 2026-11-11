// The only way the app makes outbound requests: per-host limits, spacing, timeout, one retry, and a hard ceiling.
import { FETCH, userAgent } from "../../config/fetch.ts";

export type FetchResult = { status: number; body: unknown; etag: string | null; host: string; finalUrl?: string }; // finalUrl: after redirects
export type FetchOptions = { etag?: string | null; json?: unknown }; // json: send as a POST body
export type Fetcher = (url: string, opts?: FetchOptions) => Promise<FetchResult>;

export class RequestCapReached extends Error {}

type Options = { [K in keyof typeof FETCH]?: number } & { fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void> };

export function createPoliteFetcher(options: Options = {}) {
  const cfg = { ...FETCH, ...options };
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const hostQueues = new Map<string, Promise<unknown>>();
  const pausedHosts = new Set<string>();
  let active = 0;
  let made = 0;
  const waiters: (() => void)[] = [];

  const acquire = async () => {
    while (active >= cfg.maxConcurrent) await new Promise<void>((r) => waiters.push(r));
    active++;
  };
  const release = () => { active--; waiters.shift()?.(); };

  async function once(url: string, etag?: string | null, json?: unknown): Promise<Response> {
    if (made >= cfg.maxRequestsPerRefresh) throw new RequestCapReached(`Stopped at ${cfg.maxRequestsPerRefresh} requests.`);
    made++;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), cfg.requestTimeoutMs);
    try {
      return await fetchImpl(url, {
        method: json === undefined ? "GET" : "POST",
        headers: {
          "User-Agent": userAgent(), Accept: "application/json, application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, text/html;q=0.5",
          ...(etag ? { "If-None-Match": etag } : {}), ...(json === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: json === undefined ? undefined : JSON.stringify(json),
        signal: ctrl.signal,
      });
    } finally { clearTimeout(t); }
  }

  const fetcher: Fetcher = (url, opts = {}) => {
    const host = new URL(url).host;
    // One request at a time per host, spaced by perHostDelayMs.
    const prev = hostQueues.get(host) ?? Promise.resolve();
    const run = prev.then(async () => {
      if (pausedHosts.has(host)) return { status: 429, body: null, etag: null, host };
      await acquire();
      try {
        let res: Response | null = null;
        for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
          try {
            res = await once(url, opts.etag, opts.json);
          } catch (e) {
            if (e instanceof RequestCapReached) throw e;
            if (attempt === cfg.maxRetries) return { status: 0, body: null, etag: null, host };
            await sleep(cfg.perHostDelayMs);
            continue;
          }
          if (res.status === 429 || res.status >= 500) {
            if (attempt === cfg.maxRetries) { if (res.status === 429) pausedHosts.add(host); break; }
            const wait = Number(res.headers.get("retry-after")) * 1000 || cfg.perHostDelayMs;
            await sleep(Math.min(wait, 60_000));
            continue;
          }
          break;
        }
        const status = res?.status ?? 0;
        let body: unknown = null;
        if (status === 200) {
          const text = await res!.text();
          const isJson = /json/i.test(res!.headers.get("content-type") ?? "") || /^\s*[[{]/.test(text);
          body = isJson ? (() => { try { return JSON.parse(text); } catch { return text; } })() : text;
        }
        return { status, body, etag: res?.headers.get("etag") ?? null, host, finalUrl: res?.url || url };
      } finally {
        release();
        await sleep(cfg.perHostDelayMs);
      }
    });
    hostQueues.set(host, run.catch(() => undefined));
    return run as Promise<FetchResult>;
  };

  return { fetcher, requestsMade: () => made };
}
