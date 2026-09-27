import { describe, it, expect, vi } from "vitest";
import { TtlCache } from "./cache";

function clock(start = 0) {
    let time = start;
    return { now: () => time, advance: (ms: number) => (time += ms) };
}

describe("TtlCache", () => {
    it("loads once, then serves hits until the TTL runs out", async () => {
        const c = clock();
        const cache = new TtlCache<string>(1000, 200, c.now);
        const load = vi.fn(async () => "rules");

        expect(cache.getOrLoad("rules:a/b", load).hit).toBe(false);
        const second = cache.getOrLoad("rules:a/b", load);
        expect(second.hit).toBe(true);
        expect(await second.value).toBe("rules");
        expect(load).toHaveBeenCalledTimes(1);

        c.advance(1000);
        expect(cache.getOrLoad("rules:a/b", load).hit).toBe(false);
        expect(load).toHaveBeenCalledTimes(2);
    });

    it("two requests at the same time share one load", async () => {
        const cache = new TtlCache<number>(1000);
        let resolve: (n: number) => void = () => {};
        const load = vi.fn(() => new Promise<number>((r) => (resolve = r)));

        const first = cache.getOrLoad("k", load);
        const second = cache.getOrLoad("k", load);
        resolve(7);

        expect(await first.value).toBe(7);
        expect(await second.value).toBe(7);
        expect(second.hit).toBe(true);
        expect(load).toHaveBeenCalledTimes(1);
    });

    it("never keeps a failed load", async () => {
        const cache = new TtlCache<string>(1000);
        const failing = cache.getOrLoad("k", async () => {
            throw new Error("GitHub down");
        });
        await expect(failing.value).rejects.toThrow("GitHub down");

        const retry = cache.getOrLoad("k", async () => "ok");
        expect(retry.hit).toBe(false);
        expect(await retry.value).toBe("ok");
    });

    it("drops the oldest entry when full", () => {
        const cache = new TtlCache<string>(1000, 2);
        cache.getOrLoad("a", async () => "a");
        cache.getOrLoad("b", async () => "b");
        cache.getOrLoad("c", async () => "c");

        expect(cache.size).toBe(2);
        expect(cache.getOrLoad("a", async () => "a2").hit).toBe(false);
        expect(cache.getOrLoad("c", async () => "c2").hit).toBe(true);
    });
});
