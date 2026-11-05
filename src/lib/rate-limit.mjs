// Tiny in-memory sliding-window limiter for public endpoints (signup). It is per server instance, which is
// enough to stop casual abuse; put a shared limiter (e.g. Upstash Redis) in front when running many instances.

const hits = new Map(); // key -> timestamps (ms) inside the window

/** Returns true if the call is allowed and records it; false once `max` calls happened within `windowMs`. */
export function allow(key, { max, windowMs }, now = Date.now()) {
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= max) { hits.set(key, recent); return false; }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k); // keep memory bounded
  return true;
}

export const resetRateLimits = () => hits.clear();
