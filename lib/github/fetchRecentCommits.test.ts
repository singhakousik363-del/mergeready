import { describe, it, expect, vi } from "vitest";
import type { Octokit } from "@octokit/rest";
import { RECENT_COMMITS, fetchRecentCommits, toRecentCommit } from "./fetchRecentCommits";
import { InvalidRepoError, MissingTokenError, RateLimitError, RepoNotFoundError } from "./errors";

type FakeCommit = {
    sha: string;
    commit: { message: string; author: { name: string } | null };
    author: { login: string; type: string } | null;
    parents: { sha: string }[];
};

function commit(sha: string, message: string, extra: Partial<FakeCommit> = {}): FakeCommit {
    return {
        sha,
        commit: { message, author: { name: "Jane Doe" } },
        author: { login: "jane", type: "User" },
        parents: [{ sha: "p1" }],
        ...extra,
    };
}

function fakeOctokit(listCommits: () => Promise<{ data: FakeCommit[] }>) {
    const spy = vi.fn(listCommits);
    return { octokit: { rest: { repos: { listCommits: spy } } } as unknown as Octokit, listCommits: spy };
}

// Error shaped like Octokit's RequestError
function httpError(status: number, headers: Record<string, string> = {}): Error {
    return Object.assign(new Error("HTTP error"), { status, response: { headers } });
}

describe("fetchRecentCommits", () => {
    it(`reads the newest ${RECENT_COMMITS} commits of the default branch in one request`, async () => {
        const { octokit, listCommits } = fakeOctokit(async () => ({
            data: [commit("a1", "fix: typo"), commit("b2", "Merge branch 'x'", { parents: [{ sha: "p1" }, { sha: "p2" }] })],
        }));

        const result = await fetchRecentCommits("acme", "app", { octokit });

        expect(listCommits).toHaveBeenCalledTimes(1);
        expect(listCommits).toHaveBeenCalledWith({ owner: "acme", repo: "app", per_page: RECENT_COMMITS });
        expect(result).toEqual({
            commits: [
                { sha: "a1", message: "fix: typo", isMerge: false, isBot: false },
                { sha: "b2", message: "Merge branch 'x'", isMerge: true, isBot: false },
            ],
            warnings: [],
        });
    });

    it("returns nothing for an empty repo (GitHub answers 409)", async () => {
        const { octokit } = fakeOctokit(async () => {
            throw httpError(409);
        });
        expect(await fetchRecentCommits("acme", "empty", { octokit })).toEqual({ commits: [], warnings: [] });
    });

    it("rejects bad owner/repo names before calling GitHub", async () => {
        const { octokit, listCommits } = fakeOctokit(async () => ({ data: [] }));
        await expect(fetchRecentCommits("-bad", "app", { octokit })).rejects.toBeInstanceOf(InvalidRepoError);
        expect(listCommits).not.toHaveBeenCalled();
    });

    it("throws on rate limits, a bad token and a missing repo", async () => {
        const cases: [Error, unknown][] = [
            [httpError(403, { "x-ratelimit-remaining": "0" }), RateLimitError],
            [httpError(401), MissingTokenError],
            [httpError(404), RepoNotFoundError],
        ];
        for (const [error, type] of cases) {
            const { octokit } = fakeOctokit(async () => {
                throw error;
            });
            await expect(fetchRecentCommits("acme", "app", { octokit })).rejects.toBeInstanceOf(type);
        }
    });

    it("turns other failures into a warning", async () => {
        const { octokit } = fakeOctokit(async () => {
            throw httpError(500);
        });
        expect(await fetchRecentCommits("acme", "app", { octokit })).toEqual({
            commits: [],
            warnings: ["Couldn't read recent commits: Couldn't reach GitHub right now. Please try again."],
        });
    });
});

describe("toRecentCommit: bot detection", () => {
    it("knows GitHub App bots by type", () => {
        const renovate = commit("a", "chore(deps): update", { author: { login: "renovate[bot]", type: "Bot" } });
        expect(toRecentCommit(renovate).isBot).toBe(true);
    });

    it("knows bot accounts by name, even when GitHub says 'User' (stdlib-bot)", () => {
        const stdlibBot = commit("a", "docs: update", { author: { login: "stdlib-bot", type: "User" } });
        expect(toRecentCommit(stdlibBot).isBot).toBe(true);
    });

    it("uses the git author name when no GitHub account is linked", () => {
        const unlinked = commit("a", "chore: sync", {
            author: null,
            commit: { message: "chore: sync", author: { name: "github-actions[bot]" } },
        });
        expect(toRecentCommit(unlinked).isBot).toBe(true);
    });

    it("does not treat people as bots", () => {
        expect(toRecentCommit(commit("a", "fix: x", { author: { login: "abbott", type: "User" } })).isBot).toBe(false);
    });
});
