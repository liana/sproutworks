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
  event: (type: string, postingId?: string) => call("POST", "/api/events", { type, postingId }).catch(() => {}),
  async importArchive(file: File): Promise<{ connections: number; companies: number; changes: number; excludedEmployer: string | null }> {
    const form = new FormData(); form.append("archive", file);
    const res = await fetch("/api/import", { method: "POST", body: form });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "Import failed. Nothing was changed.");
    return json;
  },
  async progress(): Promise<{ checked: number; total: number; state: string } | null> {
    const res = await fetch("/api/refresh"); return (await res.json()).progress;
  },
};
