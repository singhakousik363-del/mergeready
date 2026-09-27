// A per-IP limit so nobody can use up our GitHub token.
// Like the cache, it lives in one server instance's memory, so on Vercel it
// slows abuse down but is not a hard guarantee (see CLAUDE.md).

export type RateWindow = { limit: number; windowMs: number };

// 10 per minute and 60 per hour: classmates on one college Wi-Fi share an IP
export const DEFAULT_WINDOWS: RateWindow[] = [
    { limit: 10, windowMs: 60_000 },
    { limit: 60, windowMs: 60 * 60_000 },
];

export type RateCheck = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export class RateLimiter {
    // IP -> times (ms) of its counted requests, oldest first
    private readonly hits = new Map<string, number[]>();
    private readonly longestWindowMs: number;

    constructor(
        private readonly windows: RateWindow[] = DEFAULT_WINDOWS,
        private readonly now: () => number = Date.now,
        // Keeps memory bounded if many different IPs show up
        private readonly maxKeys = 10_000
    ) {
        this.longestWindowMs = Math.max(...windows.map((w) => w.windowMs));
    }

    // May this IP start a new analysis? Doesn't count anything by itself:
    // call record() once the request really cost GitHub calls.
    check(key: string): RateCheck {
        const now = this.now();
        const times = this.recentHits(key, now);
        let waitMs = 0;

        for (const { limit, windowMs } of this.windows) {
            const inWindow = times.filter((t) => t > now - windowMs);
            if (inWindow.length >= limit) {
                // A slot frees up when the hit that pushed us over the limit gets old enough
                const freesAt = inWindow[inWindow.length - limit] + windowMs;
                waitMs = Math.max(waitMs, freesAt - now);
            }
        }
        return waitMs > 0 ? { allowed: false, retryAfterSeconds: Math.ceil(waitMs / 1000) } : { allowed: true };
    }

    // Count one request for this IP
    record(key: string): void {
        const now = this.now();
        const times = this.recentHits(key, now);
        times.push(now);
        // Re-insert so this IP becomes the newest key
        this.hits.delete(key);
        this.hits.set(key, times);

        if (this.hits.size > this.maxKeys) {
            const oldest = this.hits.keys().next().value;
            if (oldest !== undefined) this.hits.delete(oldest);
        }
    }

    // This IP's hits inside the longest window (older ones are forgotten)
    private recentHits(key: string, now: number): number[] {
        const times = (this.hits.get(key) ?? []).filter((t) => t > now - this.longestWindowMs);
        if (times.length === 0) this.hits.delete(key);
        return times;
    }
}
