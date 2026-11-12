interface RateLimitRecord {
  timestamps: number[];
}

const store = new Map<string, RateLimitRecord>();
const MAX_KEYS = 5000;

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { success: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const record = store.get(key) || { timestamps: [] };

  const validTimestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (validTimestamps.length >= limit) {
    const oldest = validTimestamps[0];
    const resetMs = Math.max(0, windowMs - (now - oldest));
    store.set(key, { timestamps: validTimestamps });
    return { success: false, remaining: 0, resetMs };
  }

  // Bound the table so an attacker rotating keys cannot grow it without limit.
  if (!store.has(key) && store.size >= MAX_KEYS) {
    prune(now, windowMs >= 60_000 ? windowMs : 60_000);
    if (store.size >= MAX_KEYS) {
      return { success: false, remaining: 0, resetMs: windowMs };
    }
  }

  validTimestamps.push(now);
  store.set(key, { timestamps: validTimestamps });

  return {
    success: true,
    remaining: limit - validTimestamps.length,
    resetMs: windowMs,
  };
}

function prune(now: number, windowMs: number) {
  for (const [k, v] of store.entries()) {
    if (v.timestamps.length === 0 || now - v.timestamps[v.timestamps.length - 1] >= windowMs) {
      store.delete(k);
    }
  }
}

export function getClientIp(request: Request): string {
  // Vercel writes the real client IP to x-vercel-forwarded-for and x-real-ip.
  // The leftmost x-forwarded-for hop is caller-controlled on other platforms,
  // so prefer the platform headers and fall back to the *last* hop (the one a
  // trusted proxy appended) rather than the first.
  const vercelIp = request.headers.get("x-vercel-forwarded-for")?.trim();
  if (vercelIp) return vercelIp.split(",")[0].trim();

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const hops = xForwardedFor
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1]!;
  }

  return "127.0.0.1";
}
