import { NextRequest, NextResponse } from 'next/server';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 10_000;

function pruneExpired(now: number): void {
  if (buckets.size < MAX_TRACKED_KEYS) return;
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) buckets.delete(key);
  });
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-nf-client-connection-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

export type RateLimitOptions = {
  /** Requests allowed per window. */
  limit: number;
  windowMs: number;
  /** Identifies the route/action being limited, e.g. 'auth:account-status'. */
  key: string;
};

/**
 * In-memory fixed-window limiter keyed by client IP + route key.
 * Counters live per warm server instance and reset on cold start / across
 * regions, so this deters casual abuse rather than guaranteeing a hard cap.
 */
export function rateLimit(req: NextRequest, options: RateLimitOptions): NextResponse | null {
  const now = Date.now();
  pruneExpired(now);

  const ip = getClientIp(req);
  const bucketKey = `${options.key}:${ip}`;
  const bucket = buckets.get(bucketKey);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  if (bucket.count >= options.limit) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    );
  }

  bucket.count += 1;
  return null;
}
