interface RateLimitRecord {
  timestamps: number[];
}

const store = new Map<string, RateLimitRecord>();

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
    return { success: false, remaining: 0, resetMs };
  }

  validTimestamps.push(now);
  store.set(key, { timestamps: validTimestamps });

  if (store.size > 5000) {
    for (const [k, v] of store.entries()) {
      const active = v.timestamps.filter((ts) => now - ts < windowMs);
      if (active.length === 0) store.delete(k);
    }
  }

  return {
    success: true,
    remaining: limit - validTimestamps.length,
    resetMs: windowMs,
  };
}

export function getClientIp(request: Request): string {
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip")?.trim() || "127.0.0.1";
}

