// A small in-memory cache where each entry expires after ttlMs.
//
// On Vercel every server instance has its own memory, and a new instance
// starts empty. So this only speeds things up while an instance stays warm;
// results are correct either way (see CLAUDE.md, Known limitations).
export class TtlCache<T> {
    private readonly entries = new Map<string, { value: Promise<T>; expiresAt: number }>();

    constructor(
        private readonly ttlMs: number,
        // Keeps memory bounded: the oldest entry is dropped when full
        private readonly maxEntries = 200,
        // Tests pass a fake clock
        private readonly now: () => number = Date.now
    ) {}

    // Returns the cached value, or starts load() and caches its promise.
    // Caching the promise (not the result) means two requests for the same
    // repo at the same time share ONE GitHub fetch.
    // hit = true when load() was not called (no GitHub calls for this key).
    getOrLoad(key: string, load: () => Promise<T>): { value: Promise<T>; hit: boolean } {
        const entry = this.entries.get(key);
        if (entry && entry.expiresAt > this.now()) return { value: entry.value, hit: true };
        if (entry) this.entries.delete(key);

        const value = load();
        this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
        // Never keep a failure: the next request tries again
        value.catch(() => {
            if (this.entries.get(key)?.value === value) this.entries.delete(key);
        });

        if (this.entries.size > this.maxEntries) {
            // A Map remembers insertion order, so the first key is the oldest
            const oldest = this.entries.keys().next().value;
            if (oldest !== undefined) this.entries.delete(oldest);
        }
        return { value, hit: false };
    }

    get size(): number {
        return this.entries.size;
    }

    clear(): void {
        this.entries.clear();
    }
}
