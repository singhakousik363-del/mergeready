import { afterEach, describe, it, expect, vi } from "vitest";
import { createOctokit } from "./client";
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
