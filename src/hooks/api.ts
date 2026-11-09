"use client";
// Client-side calls to the app's own API routes. Components use these, never fetch directly.

async function call(method: string, url: string, body?: unknown): Promise<void> {
  const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Something went wrong. Try again.");
}

export const api = {
  review: (id: string) => call("POST", `/api/companies/${id}/review`),
  undoReview: (id: string) => call("DELETE", `/api/companies/${id}/review`),
  exclude: (id: string) => call("POST", `/api/companies/${id}/exclude`),
  include: (id: string) => call("DELETE", `/api/companies/${id}/exclude`),
  applied: (postingId: string) => call("POST", `/api/postings/${postingId}/applied`),
  move: (applicationId: string, stage: string) => call("PATCH", `/api/applications/${applicationId}`, { stage }),
  board: (id: string, body: unknown) => call("POST", `/api/companies/${id}/board`, body),
  exportRequested: () => call("POST", "/api/export-request"),
  refresh: () => call("POST", "/api/refresh"),
  removeSource: (id: string) => call("DELETE", `/api/sources/${id}`),
  visitSource: (id: string) => call("POST", `/api/sources/${id}/visit`),
  keepSource: (id: string) => call("POST", `/api/sources/${id}/keep`),
  async previewSource(url: string) {
    const res = await fetch("/api/sources/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "That URL couldn't be checked.");
    return json as { detectedType: string; feedUrl: string | null; itemCount: number | null; robotsAllowed: boolean; fetchable: boolean; newestLabel: string | null; stale: boolean; error: string | null };
  },
  async addSource(body: { list: "NEWS" | "LEADS"; url: string; termsConfirmed: boolean }) {
    const res = await fetch("/api/sources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "That source couldn't be saved.");
    return json as { id: string; type: string };
  },
  event: (type: string, postingId?: string) => call("POST", "/api/events", { type, postingId }).catch(() => {}),
  async importArchive(file: File): Promise<{ connections: number; companies: number; changes: number; excludedEmployer: string | null; waitingFor: "connections" | "profile" | null }> {
    const form = new FormData(); form.append("archive", file);
    const res = await fetch("/api/import", { method: "POST", body: form });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "Import failed. Nothing was changed.");
    return json;
  },
  async post<T>(url: string, body?: unknown): Promise<T> {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => ({}));
    if (!res.ok && !("ok" in json)) throw new Error(json.error ?? "Something went wrong. Try again.");
    return json as T;
  },
  undoWatchlistReview: (id: string) => call("DELETE", `/api/companies/${id}/watchlist-review`),
  saveLetter: (id: string, body: string) => call("PATCH", `/api/cover-letters/${id}`, { body }),
  async companyNames(): Promise<string[]> { const r = await fetch("/api/companies/names"); return (await r.json()).names ?? []; },
  async progress(): Promise<{ checked: number; total: number; state: string } | null> {
    const res = await fetch("/api/refresh"); return (await res.json()).progress;
  },
};
