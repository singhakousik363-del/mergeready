// GitHub access for the evaluation. Every answer is saved to eval/.cache, so:
// - re-runs cost no API calls, and
// - the dataset stays the same even if GitHub changes later.
import { createHash } from "crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import type { Octokit } from "@octokit/rest";
import { createOctokit } from "../lib/github/client";
import { GitHubTimeoutError, GitHubUnavailableError, RateLimitError, toGitHubError } from "../lib/github/errors";
import { CACHE_DIR } from "./config";

// GitHub's search API allows 30 requests per minute
const SEARCH_GAP_MS = 2200;

export type CachedGitHub = {
    graphql: <T>(query: string, variables: Record<string, unknown>) => Promise<T>;
    rest: <T>(route: string, params: Record<string, unknown>) => Promise<T>;
    // Any other async result (e.g. our own fetchGuidelines) saved under `key`
    custom: <T>(key: unknown, load: () => Promise<T>) => Promise<T>;
    stats: { cached: number; fetched: number };
};

export function createCachedGitHub(octokit: Octokit = createOctokit({ timeoutMs: 30_000 }), dir = CACHE_DIR): CachedGitHub {
    mkdirSync(dir, { recursive: true });
    const stats = { cached: 0, fetched: 0 };
    let lastSearch = 0;

    async function cached<T>(key: unknown, load: () => Promise<T>): Promise<T> {
        const file = path.join(dir, `${createHash("sha256").update(JSON.stringify(key)).digest("hex")}.json`);
        if (existsSync(file)) {
            stats.cached++;
            return JSON.parse(readFileSync(file, "utf8")) as T;
        }
        const value = await withRetry(load);
        // Only successful answers are saved
        writeFileSync(file, JSON.stringify(value));
        stats.fetched++;
        return value;
    }

    return {
        stats,
        custom: (key, load) => cached({ custom: key }, load),
        graphql: (query, variables) => cached({ query, variables }, () => octokit.graphql(query, variables)),
        rest: (route, params) =>
            cached({ route, params }, async () => {
                if (route.startsWith("GET /search/")) {
                    const wait = lastSearch + SEARCH_GAP_MS - Date.now();
                    if (wait > 0) await sleep(wait);
                    lastSearch = Date.now();
                }
                const response = await octokit.request(route, params);
                return response.data;
            }),
    };
}

// Waits out a rate limit, and retries short hiccups (timeouts, GitHub 5xx)
// twice, instead of losing the whole run
async function withRetry<T>(load: () => Promise<T>, attempt = 1): Promise<T> {
    try {
        return await load();
    } catch (err) {
        const error = toGitHubError(err);
        if (error instanceof RateLimitError && attempt <= 2) {
            const waitMs = error.resetAt ? Math.max(1000, error.resetAt.getTime() - Date.now() + 1000) : 60_000;
            console.log(`  rate limited, waiting ${Math.round(waitMs / 1000)}s…`);
            await sleep(waitMs);
            return withRetry(load, attempt + 1);
        }
        if ((error instanceof GitHubTimeoutError || error instanceof GitHubUnavailableError) && attempt <= 2) {
            console.log(`  ${error.code}, retrying (${attempt}/2)…`);
            await sleep(3000 * attempt);
            return withRetry(load, attempt + 1);
        }
        // Our friendly error only: the raw one carries request details
        throw error;
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
