import { describe, it, expect } from "vitest";
import { DEFAULT_WINDOWS, RateLimiter } from "./rateLimit";

function clock(start = 1_000_000) {
    let time = start;
    return { now: () => time, advance: (ms: number) => (time += ms) };
}

function recordTimes(limiter: RateLimiter, key: string, times: number) {
    for (let i = 0; i < times; i++) limiter.record(key);
}

describe("RateLimiter (10 per minute, 60 per hour)", () => {
    it("uses the approved limits", () => {
        expect(DEFAULT_WINDOWS).toEqual([
            { limit: 10, windowMs: 60_000 },
            { limit: 60, windowMs: 3_600_000 },
        ]);
    });

    it("allows 10 in a minute, blocks the 11th, and says when to retry", () => {
        const c = clock();
        const limiter = new RateLimiter(DEFAULT_WINDOWS, c.now);
        recordTimes(limiter, "1.2.3.4", 9);
        expect(limiter.check("1.2.3.4")).toEqual({ allowed: true });

        limiter.record("1.2.3.4");
        c.advance(15_000);
        expect(limiter.check("1.2.3.4")).toEqual({ allowed: false, retryAfterSeconds: 45 });

        c.advance(45_000);
        expect(limiter.check("1.2.3.4")).toEqual({ allowed: true });
    });

    it("check() alone never counts (cached answers cost nothing)", () => {
        const limiter = new RateLimiter(DEFAULT_WINDOWS, clock().now);
        for (let i = 0; i < 50; i++) expect(limiter.check("1.2.3.4").allowed).toBe(true);
    });

    it("blocks after 60 in an hour, even when spread out", () => {
        const c = clock();
        const limiter = new RateLimiter(DEFAULT_WINDOWS, c.now);
        for (let i = 0; i < 60; i++) {
            limiter.record("1.2.3.4");
            c.advance(50_000); // 60 x 50s = 50 minutes, never 10 in one minute
        }
        const result = limiter.check("1.2.3.4");
        expect(result.allowed).toBe(false);
        // The first hit is 50 minutes old: it expires in 10 minutes
        expect(result).toEqual({ allowed: false, retryAfterSeconds: 600 });
    });

    it("keeps IPs apart", () => {
        const limiter = new RateLimiter(DEFAULT_WINDOWS, clock().now);
        recordTimes(limiter, "1.1.1.1", 10);
        expect(limiter.check("1.1.1.1").allowed).toBe(false);
        expect(limiter.check("2.2.2.2").allowed).toBe(true);
    });

    it("forgets the oldest IP when too many IPs are tracked", () => {
        const limiter = new RateLimiter([{ limit: 1, windowMs: 60_000 }], clock().now, 2);
        limiter.record("a");
        limiter.record("b");
        limiter.record("c");
        expect(limiter.check("a").allowed).toBe(true);
        expect(limiter.check("c").allowed).toBe(false);
    });
});
