import { afterEach, describe, it, expect, vi } from "vitest";
import { assertValidNumber, assertValidRepo, createOctokit, fetchPages, parseLastPage } from "./client";
import { GitHubTimeoutError, MissingTokenError, toGitHubError } from "./errors";

// A fetch that never answers; it only fails when the request is cancelled
const hangingFetch: typeof fetch = (_input, init) =>
    new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    });

// A fetch that answers with `status` after `delayMs`
function slowFetch(status: number, delayMs: number): typeof fetch {
    return async () => {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return new Response(JSON.stringify(status === 404 ? { message: "Not Found" } : { name: "app" }), {
            status,
            headers: { "content-type": "application/json" },
        });
    };
}

afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe("createOctokit", () => {
    it("turns a request that takes too long into GitHubTimeoutError", async () => {
        vi.stubEnv("GITHUB_TOKEN", "test-token");
        const octokit = createOctokit({ fetch: hangingFetch, timeoutMs: 20 });

        const error = await octokit.rest.repos.get({ owner: "acme", repo: "app" }).catch((e: unknown) => e);

        expect(toGitHubError(error)).toBeInstanceOf(GitHubTimeoutError);
    });

    it("gives every request its own timer", async () => {
        vi.stubEnv("GITHUB_TOKEN", "test-token");
        // Each request takes 30ms (under the 50ms limit), but together they take 60ms
        const octokit = createOctokit({ fetch: slowFetch(200, 30), timeoutMs: 50 });

        await octokit.rest.repos.get({ owner: "acme", repo: "app" });
        const second = await octokit.rest.repos.get({ owner: "acme", repo: "app" });

        expect(second.status).toBe(200);
    });

    it("does not print 404s to the console", async () => {
        vi.stubEnv("GITHUB_TOKEN", "test-token");
        const spies = (["log", "info", "warn", "error"] as const).map((method) =>
            vi.spyOn(console, method).mockImplementation(() => {})
        );
        const octokit = createOctokit({ fetch: slowFetch(404, 0) });

        const error = await octokit.rest.repos.get({ owner: "acme", repo: "missing" }).catch((e: unknown) => e);

        expect(error).toMatchObject({ status: 404 });
        for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    });

    it("throws MissingTokenError when GITHUB_TOKEN is not set", () => {
        vi.stubEnv("GITHUB_TOKEN", "");

        expect(() => createOctokit()).toThrow(MissingTokenError);
    });
});

// Link header like GitHub sends when there are `last` pages in total
function linkHeader(last: number): string {
    const url = (page: number) => `https://api.github.com/repositories/1/issues/2/timeline?per_page=100&page=${page}`;
    return `<${url(2)}>; rel="next", <${url(last)}>; rel="last"`;
}

// A fake list endpoint with `last` pages; each page's data is just [page number]
function fakePages(last: number) {
    return vi.fn(async (page: number) => ({
        data: [page],
        // GitHub leaves out rel="last" when there is only one page
        headers: last > 1 && page < last ? { link: linkHeader(last) } : {},
    }));
}

describe("fetchPages", () => {
    it("reads a single page when there is no Link header", async () => {
        const fetchPage = fakePages(1);

        expect(await fetchPages(fetchPage, 3, "first")).toEqual({ items: [1], skippedPages: 0 });
        expect(fetchPage).toHaveBeenCalledTimes(1);
    });

    it("reads every page when they fit in the limit", async () => {
        expect(await fetchPages(fakePages(3), 3, "newest")).toEqual({ items: [1, 2, 3], skippedPages: 0 });
    });

    it('"first": reads the first pages and reports how many were skipped', async () => {
        expect(await fetchPages(fakePages(10), 3, "first")).toEqual({ items: [1, 2, 3], skippedPages: 7 });
    });

    it('"newest": reads page 1 plus the LAST pages, in order', async () => {
        const fetchPage = fakePages(10);

        expect(await fetchPages(fetchPage, 3, "newest")).toEqual({ items: [1, 9, 10], skippedPages: 7 });
        expect(fetchPage.mock.calls.map(([page]) => page)).toEqual([1, 9, 10]);
    });

    it("fails if any page fails", async () => {
        const fetchPage = vi.fn(async (page: number) => {
            if (page === 2) throw new Error("boom");
            return { data: [page], headers: { link: linkHeader(2) } };
        });

        await expect(fetchPages(fetchPage, 3, "first")).rejects.toThrow("boom");
    });
});

describe("parseLastPage", () => {
    it("reads the page number of the last link", () => {
        expect(parseLastPage(linkHeader(42))).toBe(42);
    });

    it("returns null for a missing or broken header", () => {
        expect(parseLastPage(undefined)).toBeNull();
        expect(parseLastPage('<https://api.github.com/x?page=2>; rel="next"')).toBeNull();
        expect(parseLastPage('<not a url>; rel="last"')).toBeNull();
        expect(parseLastPage('<https://api.github.com/x?page=-1>; rel="last"')).toBeNull();
    });
});

describe("input checks", () => {
    it("accepts real owner/repo names and rejects unsafe ones", () => {
        expect(() => assertValidRepo("stdlib-js", "stdlib")).not.toThrow();
        expect(() => assertValidRepo("acme", "..")).toThrow(expect.objectContaining({ code: "INVALID_REPO" }));
        expect(() => assertValidRepo("../etc", "app")).toThrow(expect.objectContaining({ code: "INVALID_REPO" }));
    });

    it("only accepts positive whole numbers", () => {
        expect(() => assertValidNumber(15585)).not.toThrow();
        for (const bad of [0, -1, 1.5, Number.NaN, 2 ** 60]) {
            expect(() => assertValidNumber(bad)).toThrow(expect.objectContaining({ code: "INVALID_NUMBER" }));
        }
    });
});
