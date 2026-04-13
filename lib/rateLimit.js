import { NextResponse } from 'next/server';

/**
 * Rate limiting helper.
 *
 * Uses Upstash Ratelimit (Redis-backed, works across serverless instances) when
 * UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set. Falls back to a
 * per-instance in-memory counter otherwise — fine for dev, best-effort in prod
 * (limits reset when a new lambda spins up). A warning is logged on first use
 * in production so misconfiguration is visible.
 *
 * Usage:
 *   import { rateLimit, limits } from '@/lib/rateLimit'
 *   const limited = await rateLimit(request, limits.ai, user.id)
 *   if (limited) return limited
 */

let upstashClient = null;
let upstashInitialized = false;
let upstashWarningLogged = false;

async function getUpstash() {
  if (upstashInitialized) return upstashClient;
  upstashInitialized = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const [{ Ratelimit }, { Redis }] = await Promise.all([
      import('@upstash/ratelimit'),
      import('@upstash/redis'),
    ]);
    upstashClient = {
      Ratelimit,
      redis: new Redis({ url, token }),
    };
    return upstashClient;
  } catch (err) {
    console.error('[rateLimit] Failed to load @upstash packages:', err.message);
    return null;
  }
}

const memoryBuckets = new Map();

function memoryLimit(key, { limit, windowSeconds }) {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const bucket = memoryBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  if (bucket.count >= limit) {
    return { success: false, remaining: 0, resetAt: bucket.resetAt };
  }
  bucket.count += 1;
  return { success: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memoryBuckets) {
    if (v.resetAt <= now) memoryBuckets.delete(k);
  }
}, 60_000).unref?.();

const limiterCache = new Map();

async function getLimiter(config) {
  const cacheKey = `${config.name}:${config.limit}:${config.windowSeconds}`;
  if (limiterCache.has(cacheKey)) return limiterCache.get(cacheKey);

  const upstash = await getUpstash();
  if (!upstash) {
    if (!upstashWarningLogged && process.env.NODE_ENV === 'production') {
      console.warn(
        '[rateLimit] UPSTASH_REDIS_REST_URL/TOKEN not set — falling back to in-memory rate limiting. ' +
        'This is per-instance and will not protect against abuse across serverless lambdas. ' +
        'Set up Upstash Redis: https://upstash.com/docs/redis/overall/getstarted'
      );
      upstashWarningLogged = true;
    }
    limiterCache.set(cacheKey, null);
    return null;
  }

  const limiter = new upstash.Ratelimit({
    redis: upstash.redis,
    limiter: upstash.Ratelimit.slidingWindow(config.limit, `${config.windowSeconds} s`),
    analytics: true,
    prefix: `ratelimit:${config.name}`,
  });
  limiterCache.set(cacheKey, limiter);
  return limiter;
}

/**
 * Preset limiter configs. Pass one of these to rateLimit().
 * Tune limits per route group based on expected usage.
 */
export const limits = {
  ai: { name: 'ai', limit: 10, windowSeconds: 60 },
  aiBurst: { name: 'ai-burst', limit: 30, windowSeconds: 60 * 10 },
  write: { name: 'write', limit: 30, windowSeconds: 60 },
  livekitToken: { name: 'livekit', limit: 20, windowSeconds: 60 },
  notify: { name: 'notify', limit: 10, windowSeconds: 60 },
  feedback: { name: 'feedback', limit: 5, windowSeconds: 60 * 5 },
  geocode: { name: 'geocode', limit: 30, windowSeconds: 60 },
};

function getClientIp(request) {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

/**
 * Apply a rate limit to the request. Returns a NextResponse (429) if blocked,
 * or null if the request should proceed.
 *
 * @param {Request} request   Next.js request object.
 * @param {object}  config    A preset from `limits` (or a custom {name, limit, windowSeconds}).
 * @param {string}  [subject] Stable identifier (user id preferred; falls back to client IP).
 */
export async function rateLimit(request, config, subject) {
  const identifier = subject || getClientIp(request);
  const key = `${config.name}:${identifier}`;

  const limiter = await getLimiter(config);
  let result;
  if (limiter) {
    const r = await limiter.limit(key);
    result = {
      success: r.success,
      remaining: r.remaining,
      resetAt: r.reset,
    };
  } else {
    result = memoryLimit(key, config);
  }

  if (result.success) return null;

  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return NextResponse.json(
    {
      error: 'Too many requests. Please slow down and try again shortly.',
      retryAfter,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(config.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
      },
    }
  );
}
