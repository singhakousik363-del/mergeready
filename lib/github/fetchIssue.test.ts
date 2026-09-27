import { afterEach, describe, it, expect, vi } from "vitest";
import type { Octokit } from "@octokit/rest";
import { fetchIssue } from "./fetchIssue";
import { GitHubTimeoutError, MissingTokenError, RateLimitError, RepoNotFoundError } from "./errors";

// Real data (trimmed) from https://github.com/stdlib-js/stdlib/issues/12959:
// an unassigned good first issue where two newcomers both opened a PR.
const ISSUE = {
    number: 12959,
    title: "Fix JavaScript lint errors",
    state: "open",
    html_url: "https://github.com/stdlib-js/stdlib/issues/12959",
    labels: [{ name: "Good First Issue" }],
    assignees: [],
};

const REPO = { full_name: "stdlib-js/stdlib", archived: false, pushed_at: "2026-09-26T10:00:00Z" };
const REPO_API_URL = "https://api.github.com/repos/stdlib-js/stdlib";

function comment(user: string | null, body: string, createdAt: string) {
    return { event: "commented", user: user === null ? null : { login: user }, body, created_at: createdAt };
}

function crossReference(
    number: number,
    // user: null = a deleted account
    extra: { state?: string; pr?: boolean; repositoryUrl?: string; user?: string | null; draft?: boolean } = {}
) {
    const repositoryUrl = extra.repositoryUrl ?? REPO_API_URL;
    const repoPath = repositoryUrl.replace("https://api.github.com/repos/", "");
    return {
        event: "cross-referenced",
        source: {
            type: "issue",
            issue: {
                number,
                title: `chore: fix JavaScript lint errors (#${number})`,
                state: extra.state ?? "open",
                draft: extra.draft ?? false,
                user: extra.user === null ? null : { login: extra.user ?? "MannXo" },
                html_url: `https://github.com/${repoPath}/pull/${number}`,
                repository_url: repositoryUrl,
                ...(extra.pr === false ? {} : { pull_request: { url: `${repositoryUrl}/pulls/${number}` } }),
            },
        },
    };
}

const TIMELINE = [
    { event: "labeled", label: { name: "Good First Issue" } },
    comment("stdlib-bot", "This issue has been labeled as a **good first issue**", "2026-06-19T00:43:22Z"),
    comment("prakashiitp", "I'd like to investigate this lint failure and work on a fix.", "2026-06-19T06:06:04Z"),
    comment("MannXo", "Interested in working on this. Can I be assigned?", "2026-06-19T07:05:00Z"),
    crossReference(12965, { user: "MannXo" }),
    crossReference(12966, { user: "prakashiitp" }),
];

type Fake = {
    repo?: object;
    issue?: object;
    // timeline pages: page number -> events. Page 1 = TIMELINE by default.
    timelinePages?: Record<number, object[]>;
    // How many timeline pages GitHub says there are (Link header)
    lastPage?: number;
    repoError?: Error;
    issueError?: Error;
    timelineError?: Error;
};

// Error shaped like Octokit's RequestError
function httpError(status: number, message: string, headers: Record<string, string> = {}): Error {
    return Object.assign(new Error(message), { status, response: { headers } });
}

function linkHeader(last: number): string {
    return `<${REPO_API_URL}/issues/12959/timeline?page=2>; rel="next", <${REPO_API_URL}/issues/12959/timeline?page=${last}>; rel="last"`;
}

// A fake Octokit with only the 3 methods fetchIssue uses
function createFakeOctokit(fake: Fake = {}) {
    const get = vi.fn(async () => {
        if (fake.repoError) throw fake.repoError;
        return { data: fake.repo ?? REPO };
    });
    const getIssue = vi.fn(async () => {
        if (fake.issueError) throw fake.issueError;
        return { data: fake.issue ?? ISSUE };
    });
    const listEventsForTimeline = vi.fn(async ({ page }: { page: number }) => {
        if (fake.timelineError) throw fake.timelineError;
        const pages = fake.timelinePages ?? { 1: TIMELINE };
        const last = fake.lastPage ?? 1;
        return { data: pages[page] ?? [], headers: last > 1 && page < last ? { link: linkHeader(last) } : {} };
    });

    const octokit = { rest: { repos: { get }, issues: { get: getIssue, listEventsForTimeline } } };
    return { octokit: octokit as unknown as Octokit, get, getIssue, listEventsForTimeline };
}

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("fetchIssue", () => {
    it("returns the issue, its comments, open PRs and repo activity", async () => {
        const { octokit } = createFakeOctokit();

        const result = await fetchIssue("stdlib-js", "stdlib", 12959, { octokit });

        expect(result).toEqual({
            number: 12959,
            title: "Fix JavaScript lint errors",
            url: "https://github.com/stdlib-js/stdlib/issues/12959",
            state: "open",
            labels: ["Good First Issue"],
            assignees: [],
            comments: [
                {
                    author: "stdlib-bot",
                    body: "This issue has been labeled as a **good first issue**",
                    createdAt: "2026-06-19T00:43:22Z",
                },
                {
                    author: "prakashiitp",
                    body: "I'd like to investigate this lint failure and work on a fix.",
                    createdAt: "2026-06-19T06:06:04Z",
                },
                {
                    author: "MannXo",
                    body: "Interested in working on this. Can I be assigned?",
                    createdAt: "2026-06-19T07:05:00Z",
                },
            ],
            openPullRequests: [
                {
                    number: 12965,
                    title: "chore: fix JavaScript lint errors (#12965)",
                    author: "MannXo",
                    url: "https://github.com/stdlib-js/stdlib/pull/12965",
                    draft: false,
                },
                {
                    number: 12966,
                    title: "chore: fix JavaScript lint errors (#12966)",
                    author: "prakashiitp",
                    url: "https://github.com/stdlib-js/stdlib/pull/12966",
                    draft: false,
                },
            ],
            repoActivity: { archived: false, pushedAt: "2026-09-26T10:00:00Z" },
            warnings: [],
        });
    });

    it("reads assignees, string labels and archived repos", async () => {
        const { octokit } = createFakeOctokit({
            issue: { ...ISSUE, labels: ["bug", { name: "help wanted" }, { name: null }], assignees: [{ login: "MannXo" }] },
            repo: { ...REPO, archived: true, pushed_at: null },
        });

        const result = await fetchIssue("stdlib-js", "stdlib", 12959, { octokit });

        expect(result.labels).toEqual(["bug", "help wanted"]);
        expect(result.assignees).toEqual(["MannXo"]);
        expect(result.repoActivity).toEqual({ archived: true, pushedAt: null });
    });

    it("handles missing data: no assignees list, deleted users, empty comment body", async () => {
        const { octokit } = createFakeOctokit({
            issue: { ...ISSUE, assignees: null },
            timelinePages: { 1: [comment(null, "", "2026-06-20T00:00:00Z"), crossReference(1, { user: null })] },
        });

        const result = await fetchIssue("stdlib-js", "stdlib", 12959, { octokit });

        expect(result.assignees).toEqual([]);
        expect(result.comments).toEqual([{ author: "ghost", body: "", createdAt: "2026-06-20T00:00:00Z" }]);
        expect(result.openPullRequests[0].author).toBe("ghost");
    });

    it("returns empty lists for an issue with no timeline events", async () => {
        const { octokit } = createFakeOctokit({ timelinePages: { 1: [] } });

        const result = await fetchIssue("stdlib-js", "stdlib", 12959, { octokit });

        expect(result.comments).toEqual([]);
        expect(result.openPullRequests).toEqual([]);
        expect(result.warnings).toEqual([]);
    });

    it("keeps only open PRs from the same repo, each once", async () => {
        const { octokit } = createFakeOctokit({
            timelinePages: {
                1: [
                    crossReference(10), // open PR: keep
                    crossReference(10), // same PR again: keep once
                    crossReference(11, { state: "closed" }), // closed or merged: skip
                    crossReference(12, { pr: false }), // an issue, not a PR: skip
                    crossReference(13, { repositoryUrl: "https://api.github.com/repos/MannXo/stdlib" }), // fork: skip
                    crossReference(14, { repositoryUrl: "https://api.github.com/repos/STDLIB-JS/StdLib", draft: true }),
                ],
            },
        });

        const result = await fetchIssue("stdlib-js", "stdlib", 12959, { octokit });

        expect(result.openPullRequests.map((pr) => [pr.number, pr.draft])).toEqual([
            [10, false],
            [14, true],
        ]);
    });

    it("uses the repo's current name, so PRs are found after a rename", async () => {
        const { octokit } = createFakeOctokit({ repo: { ...REPO, full_name: "stdlib-js/stdlib" } });

        // The user typed an old name; GitHub redirects it to stdlib-js/stdlib
        const result = await fetchIssue("stdlib-js", "old-stdlib", 12959, { octokit });

        expect(result.openPullRequests).toHaveLength(2);
    });

    it("reads page 1 plus the LAST 2 timeline pages when there are more than 3", async () => {
        const { octokit, listEventsForTimeline } = createFakeOctokit({
            lastPage: 8,
            timelinePages: {
                1: [comment("stdlib-bot", "good first issue", "2026-01-01T00:00:00Z")],
                4: [comment("middle", "skipped", "2026-03-01T00:00:00Z")],
                7: [comment("newcomer", "Can I work on this?", "2026-09-01T00:00:00Z")],
                8: [crossReference(99, { user: "newcomer" })],
            },
        });

        const result = await fetchIssue("stdlib-js", "stdlib", 12959, { octokit });

        const pagesRead = listEventsForTimeline.mock.calls.map(([args]) => args.page);
        expect(pagesRead).toEqual([1, 7, 8]);
        expect(result.comments.map((c) => c.author)).toEqual(["stdlib-bot", "newcomer"]);
        expect(result.openPullRequests.map((pr) => pr.number)).toEqual([99]);
        expect(result.warnings).toEqual([
            "This issue has a very long history. About 500 events in the middle were skipped; " +
                "the oldest and newest events were checked.",
        ]);
    });

    it("says so when the number is a pull request", async () => {
        const { octokit } = createFakeOctokit({
            issue: { ...ISSUE, pull_request: { url: `${REPO_API_URL}/pulls/12959` } },
        });

        await expect(fetchIssue("stdlib-js", "stdlib", 12959, { octokit })).rejects.toMatchObject({
            code: "ISSUE_NOT_FOUND",
            message: "#12959 is a pull request, not an issue. Paste the pull request link instead.",
        });
    });
});

describe("fetchIssue: errors", () => {
    it("throws RepoNotFoundError when the repo is missing", async () => {
        const { octokit, getIssue } = createFakeOctokit({ repoError: httpError(404, "Not Found") });

        await expect(fetchIssue("acme", "missing", 1, { octokit })).rejects.toBeInstanceOf(RepoNotFoundError);
        expect(getIssue).not.toHaveBeenCalled();
    });

    it.each([404, 410])("throws ISSUE_NOT_FOUND when the issue gives %i", async (status) => {
        const { octokit } = createFakeOctokit({
            issueError: httpError(status, "Gone"),
            timelineError: httpError(status, "Gone"),
        });

        await expect(fetchIssue("stdlib-js", "stdlib", 999999, { octokit })).rejects.toMatchObject({
            code: "ISSUE_NOT_FOUND",
            message:
                "Issue #999999 was not found. It may have been deleted, or issues may be turned off for this repo.",
        });
    });

    it("throws RateLimitError when the timeline hits the rate limit", async () => {
        const { octokit } = createFakeOctokit({
            timelineError: httpError(403, "API rate limit exceeded", { "x-ratelimit-remaining": "0" }),
        });

        await expect(fetchIssue("stdlib-js", "stdlib", 12959, { octokit })).rejects.toBeInstanceOf(RateLimitError);
    });

    it("throws GitHubTimeoutError when GitHub is too slow", async () => {
        const timeout = Object.assign(new Error("Request failed"), {
            cause: Object.assign(new Error("The operation timed out"), { name: "TimeoutError" }),
        });
        const { octokit } = createFakeOctokit({ issueError: timeout });

        await expect(fetchIssue("stdlib-js", "stdlib", 12959, { octokit })).rejects.toBeInstanceOf(GitHubTimeoutError);
    });

    it("rejects bad input before calling GitHub", async () => {
        const { octokit, get } = createFakeOctokit();

        await expect(fetchIssue("../etc", "stdlib", 1, { octokit })).rejects.toMatchObject({ code: "INVALID_REPO" });
        await expect(fetchIssue("stdlib-js", "stdlib", 0, { octokit })).rejects.toMatchObject({
            code: "INVALID_NUMBER",
        });
        expect(get).not.toHaveBeenCalled();
    });

    it("throws MissingTokenError when GITHUB_TOKEN is not set", async () => {
        vi.stubEnv("GITHUB_TOKEN", "");

        await expect(fetchIssue("stdlib-js", "stdlib", 1)).rejects.toBeInstanceOf(MissingTokenError);
    });
});
