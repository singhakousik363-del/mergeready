import { afterEach, describe, it, expect, vi } from "vitest";
import type { Octokit } from "@octokit/rest";
import { fetchPullRequest } from "./fetchPullRequest";
import { GitHubTimeoutError, MissingTokenError, RateLimitError, RepoNotFoundError } from "./errors";

// Real data (trimmed) from https://github.com/stdlib-js/stdlib/pull/15585:
// the author's first PR in stdlib, yet GitHub labels them "NONE".
const PR = {
    number: 15585,
    title: "fix: resolve incorrect Rayleigh MGF values via erfcx formula",
    html_url: "https://github.com/stdlib-js/stdlib/pull/15585",
    body: "Resolves #15456.\n\n## Description\n\nThis pull request:\n\n-   Fixes the Rayleigh MGF.\n",
    user: { login: "AdeshDeshmukh", type: "User" },
    author_association: "NONE",
    draft: false,
    state: "open",
    merged_at: null,
    base: { ref: "develop", repo: { full_name: "stdlib-js/stdlib", default_branch: "develop" } },
    commits: 3,
    changed_files: 2,
};

const COMMITS = [
    commit("fix: resolve incorrect Rayleigh MGF values via erfcx formula"),
    commit("fix: resolve lint errors in Rayleigh MGF files"),
    commit(
        "fix: resolve remaining lint errors in Rayleigh MGF files\n\n" +
            "Signed-off-by: Adesh Deshmukh <adesh@example.com>"
    ),
];

const FILES = [
    { filename: "lib/node_modules/@stdlib/stats/base/dists/rayleigh/mgf/lib/main.js", status: "modified" },
    { filename: "lib/node_modules/@stdlib/stats/base/dists/rayleigh/mgf/test/fixtures/python/large.json", status: "added" },
];

function commit(message: string, login: string | null = "AdeshDeshmukh") {
    return {
        commit: { message, author: { name: "Adesh Deshmukh" } },
        author: login === null ? null : { login },
    };
}

type Fake = {
    pr?: object;
    // Every page returns these (tests with many pages use per-page functions)
    commits?: object[];
    files?: object[];
    // Pages GitHub says exist, for commits and files
    commitPages?: number;
    filePages?: number;
    // Merged PRs the search API finds for the author
    mergedCount?: number;
    prError?: Error;
    repoError?: Error;
    commitsError?: Error;
    searchError?: Error;
};

// Error shaped like Octokit's RequestError
function httpError(status: number, message: string, headers: Record<string, string> = {}): Error {
    return Object.assign(new Error(message), { status, response: { headers } });
}

function pagedResponse(data: object[], page: number, last: number) {
    const link = `<https://api.github.com/x?page=${page + 1}>; rel="next", <https://api.github.com/x?page=${last}>; rel="last"`;
    return { data, headers: page < last ? { link } : {} };
}

// A fake Octokit with only the 5 methods fetchPullRequest uses
function createFakeOctokit(fake: Fake = {}) {
    const get = vi.fn(async () => {
        if (fake.prError) throw fake.prError;
        return { data: fake.pr ?? PR };
    });
    const listCommits = vi.fn(async ({ page }: { page: number }) => {
        if (fake.commitsError) throw fake.commitsError;
        return pagedResponse(fake.commits ?? COMMITS, page, fake.commitPages ?? 1);
    });
    const listFiles = vi.fn(async ({ page }: { page: number }) =>
        pagedResponse(fake.files ?? FILES, page, fake.filePages ?? 1)
    );
    const getRepo = vi.fn(async () => {
        if (fake.repoError) throw fake.repoError;
        return { data: {} };
    });
    const issuesAndPullRequests = vi.fn(async () => {
        if (fake.searchError) throw fake.searchError;
        return { data: { total_count: fake.mergedCount ?? 0, items: [] } };
    });

    const octokit = {
        rest: {
            pulls: { get, listCommits, listFiles },
            repos: { get: getRepo },
            search: { issuesAndPullRequests },
        },
    };
    return { octokit: octokit as unknown as Octokit, get, listCommits, listFiles, getRepo, issuesAndPullRequests };
}

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("fetchPullRequest", () => {
    it("returns everything about a real first-time PR", async () => {
        const { octokit, issuesAndPullRequests } = createFakeOctokit();

        const result = await fetchPullRequest("stdlib-js", "stdlib", 15585, { octokit });

        expect(result).toEqual({
            number: 15585,
            title: "fix: resolve incorrect Rayleigh MGF values via erfcx formula",
            url: "https://github.com/stdlib-js/stdlib/pull/15585",
            body: PR.body,
            author: "AdeshDeshmukh",
            authorAssociation: "NONE",
            mergedPrCountInRepo: 0,
            isNewContributor: true,
            draft: false,
            state: "open",
            baseBranch: "develop",
            targetsDefaultBranch: true,
            linkedIssues: [15456],
            commits: [
                {
                    message: "fix: resolve incorrect Rayleigh MGF values via erfcx formula",
                    authorName: "Adesh Deshmukh",
                    authorLogin: "AdeshDeshmukh",
                    hasSignOff: false,
                },
                {
                    message: "fix: resolve lint errors in Rayleigh MGF files",
                    authorName: "Adesh Deshmukh",
                    authorLogin: "AdeshDeshmukh",
                    hasSignOff: false,
                },
                {
                    message: COMMITS[2].commit.message,
                    authorName: "Adesh Deshmukh",
                    authorLogin: "AdeshDeshmukh",
                    hasSignOff: true,
                },
            ],
            files: FILES,
            warnings: [],
        });
        expect(issuesAndPullRequests).toHaveBeenCalledWith({
            q: "repo:stdlib-js/stdlib is:pr is:merged author:AdeshDeshmukh",
            per_page: 1,
        });
    });

    it("is not a new contributor when the author has merged PRs", async () => {
        const { octokit } = createFakeOctokit({ mergedCount: 4 });

        const result = await fetchPullRequest("stdlib-js", "stdlib", 15585, { octokit });

        expect(result.mergedPrCountInRepo).toBe(4);
        expect(result.isNewContributor).toBe(false);
    });

    it("doesn't count this PR itself when it is already merged", async () => {
        const { octokit } = createFakeOctokit({
            pr: { ...PR, state: "closed", merged_at: "2026-09-20T00:00:00Z" },
            mergedCount: 1,
        });

        const result = await fetchPullRequest("stdlib-js", "stdlib", 15585, { octokit });

        expect(result.state).toBe("merged");
        expect(result.mergedPrCountInRepo).toBe(0);
        expect(result.isNewContributor).toBe(true);
    });

    it("reads closed, draft, and non-default-branch PRs", async () => {
        const { octokit } = createFakeOctokit({
            pr: { ...PR, state: "closed", draft: true, base: { ...PR.base, ref: "main" } },
        });

        const result = await fetchPullRequest("stdlib-js", "stdlib", 15585, { octokit });

        expect(result.state).toBe("closed");
        expect(result.draft).toBe(true);
        expect(result.baseBranch).toBe("main");
        expect(result.targetsDefaultBranch).toBe(false);
    });

    it("handles missing data: no body, deleted author, commit email not linked to GitHub", async () => {
        const { octokit, issuesAndPullRequests } = createFakeOctokit({
            pr: { ...PR, body: null, user: null, author_association: "NONE" },
            commits: [{ commit: { message: "fix: x", author: null }, author: null }],
        });

        const result = await fetchPullRequest("stdlib-js", "stdlib", 15585, { octokit });

        expect(result.body).toBe("");
        expect(result.linkedIssues).toEqual([]);
        expect(result.author).toBe("ghost");
        // A deleted account can't be searched: fall back to the label, no warning
        expect(issuesAndPullRequests).not.toHaveBeenCalled();
        expect(result.mergedPrCountInRepo).toBeNull();
        expect(result.isNewContributor).toBe(true);
        expect(result.commits[0]).toEqual({ message: "fix: x", authorName: null, authorLogin: null, hasSignOff: false });
    });

    it.each(["OWNER", "MEMBER", "COLLABORATOR"])(
        "never treats a %s as a new contributor, even with 0 merged PRs",
        async (association) => {
            const { octokit, issuesAndPullRequests } = createFakeOctokit({
                pr: { ...PR, author_association: association },
                mergedCount: 0,
            });

            const result = await fetchPullRequest("stdlib-js", "stdlib", 15585, { octokit });

            expect(result.isNewContributor).toBe(false);
            expect(result.mergedPrCountInRepo).toBeNull();
            expect(result.authorAssociation).toBe(association);
            expect(issuesAndPullRequests).not.toHaveBeenCalled();
        }
    );

    it("never treats a bot as a new contributor", async () => {
        const { octokit, issuesAndPullRequests } = createFakeOctokit({
            pr: { ...PR, user: { login: "dependabot[bot]", type: "Bot" } },
        });

        const result = await fetchPullRequest("stdlib-js", "stdlib", 15585, { octokit });

        expect(issuesAndPullRequests).not.toHaveBeenCalled();
        expect(result.isNewContributor).toBe(false);
    });

    it("only counts a real Signed-off-by line with name and email", async () => {
        const { octokit } = createFakeOctokit({
            commits: [
                commit("fix: a\n\nsigned-off-by: Jane Doe <jane@example.com>"),
                commit("fix: b\n\nSigned-off-by: Jane Doe"),
                commit("fix: c mentions Signed-off-by: Jane <jane@example.com> in the middle"),
            ],
        });

        const result = await fetchPullRequest("stdlib-js", "stdlib", 15585, { octokit });

        expect(result.commits.map((c) => c.hasSignOff)).toEqual([true, false, false]);
    });

    it("stops at 3 pages and warns when a PR has more commits and files", async () => {
        const { octokit, listCommits, listFiles } = createFakeOctokit({
            pr: { ...PR, commits: 400, changed_files: 1200 },
            commits: Array.from({ length: 100 }, (_, i) => commit(`fix: ${i}`)),
            files: Array.from({ length: 100 }, (_, i) => ({ filename: `f${i}.js`, status: "added" })),
            commitPages: 4,
            filePages: 12,
        });

        const result = await fetchPullRequest("stdlib-js", "stdlib", 15585, { octokit });

        expect(listCommits.mock.calls.map(([args]) => args.page)).toEqual([1, 2, 3]);
        expect(listFiles.mock.calls.map(([args]) => args.page)).toEqual([1, 2, 3]);
        expect(result.commits).toHaveLength(300);
        expect(result.files).toHaveLength(300);
        expect(result.warnings).toEqual([
            "This PR has 400 commits; only the first 300 were checked.",
            "This PR changes 1200 files; only the first 300 were checked.",
        ]);
    });
});

describe("fetchPullRequest: search fallback", () => {
    it("falls back to author_association with a warning when search hits its rate limit", async () => {
        const { octokit } = createFakeOctokit({
            searchError: httpError(403, "You have exceeded a secondary rate limit"),
        });

        const result = await fetchPullRequest("stdlib-js", "stdlib", 15585, { octokit });

        expect(result.mergedPrCountInRepo).toBeNull();
        expect(result.isNewContributor).toBe(true);
        expect(result.warnings).toEqual([
            "GitHub's search limit was reached, so first-time contributor status is based only on " +
                'GitHub\'s "NONE" label, which is less reliable.',
        ]);
    });

    it("falls back when search fails for another reason", async () => {
        const { octokit } = createFakeOctokit({
            pr: { ...PR, author_association: "CONTRIBUTOR" },
            searchError: httpError(500, "Server Error"),
        });

        const result = await fetchPullRequest("stdlib-js", "stdlib", 15585, { octokit });

        expect(result.isNewContributor).toBe(false);
        expect(result.warnings[0]).toMatch(/^GitHub search didn't answer/);
    });
});

describe("fetchPullRequest: errors", () => {
    it("throws PR_NOT_FOUND when the repo exists but the PR doesn't", async () => {
        const { octokit, getRepo } = createFakeOctokit({ prError: httpError(404, "Not Found") });

        await expect(fetchPullRequest("stdlib-js", "stdlib", 12959, { octokit })).rejects.toMatchObject({
            code: "PR_NOT_FOUND",
            message: "Pull request #12959 was not found. If it is an issue, paste the issue link instead.",
        });
        expect(getRepo).toHaveBeenCalled();
    });

    it("throws RepoNotFoundError when the repo is missing", async () => {
        const { octokit } = createFakeOctokit({
            prError: httpError(404, "Not Found"),
            repoError: httpError(404, "Not Found"),
        });

        await expect(fetchPullRequest("acme", "missing", 1, { octokit })).rejects.toBeInstanceOf(RepoNotFoundError);
    });

    it("throws RateLimitError when the PR request hits the rate limit", async () => {
        const { octokit, getRepo } = createFakeOctokit({
            prError: httpError(403, "API rate limit exceeded", { "x-ratelimit-remaining": "0" }),
        });

        await expect(fetchPullRequest("stdlib-js", "stdlib", 1, { octokit })).rejects.toBeInstanceOf(RateLimitError);
        expect(getRepo).not.toHaveBeenCalled();
    });

    it("fails the whole analysis when commits can't be read", async () => {
        const timeout = Object.assign(new Error("Request failed"), {
            cause: Object.assign(new Error("The operation timed out"), { name: "TimeoutError" }),
        });
        const { octokit } = createFakeOctokit({ commitsError: timeout });

        await expect(fetchPullRequest("stdlib-js", "stdlib", 15585, { octokit })).rejects.toBeInstanceOf(
            GitHubTimeoutError
        );
    });

    it("rejects bad input before calling GitHub", async () => {
        const { octokit, get } = createFakeOctokit();

        await expect(fetchPullRequest("stdlib-js", "../x", 1, { octokit })).rejects.toMatchObject({
            code: "INVALID_REPO",
        });
        await expect(fetchPullRequest("stdlib-js", "stdlib", 1.5, { octokit })).rejects.toMatchObject({
            code: "INVALID_NUMBER",
        });
        expect(get).not.toHaveBeenCalled();
    });

    it("throws MissingTokenError when GITHUB_TOKEN is not set", async () => {
        vi.stubEnv("GITHUB_TOKEN", "");

        await expect(fetchPullRequest("stdlib-js", "stdlib", 1)).rejects.toBeInstanceOf(MissingTokenError);
    });
});
