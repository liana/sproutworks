// Warm-intro tiers: how close a connection likely is to a hiring decision.
export const TIER_1 = /\b(vp|vice president|director|head of|chief|ceo|coo|cto|cpo|cfo|founder|co-founder|president|general manager|gm)\b/i;
export const TIER_2 = /\b(senior product manager|principal product manager|group product manager|staff product manager|product manager|product designer|engineering manager|design manager)\b/i;

export const TIER_LABELS = { 1: "Tier 1 · Direct influence", 2: "Tier 2 · Peer", 3: "Tier 3 · Insider" } as const;
