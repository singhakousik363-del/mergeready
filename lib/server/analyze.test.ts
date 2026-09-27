import { readFileSync } from "fs";
import path from "path";
import { describe, it, expect, vi } from "vitest";
import type { Octokit } from "@octokit/rest";
import { analyze, createCaches, type AnalyzeDeps, type Fetchers } from "./analyze";
import { BudgetExceededError } from "./httpErrors";
import { RepoNotFoundError } from "../github/errors";
import { toRecentCommit, type CommitData } from "../github/fetchRecentCommits";
import type { IssueData } from "../github/fetchIssue";
import type { PullRequestData } from "../github/fetchPullRequest";
import type { AnalyzeInput } from "./validateInput";

// Mocked fetchers that return REAL data (fixtures), so no network is used
const RULES_DIR = path.join(import.meta.dirname, "..", "rules", "__fixtures__");
const CHECKS_DIR = path.join(import.meta.dirname, "..", "checks", "__fixtures__");
const read = (dir: string, name: string) => readFileSync(path.join(dir, name), "utf8");
const STDLIB = "https://github.com/stdlib-js/stdlib/blob/develop";

const ISSUES: Record<number, IssueData> = {
    12959: JSON.parse(read(CHECKS_DIR, "stdlib-issue-12959.json")),
    15456: JSON.parse(read(CHECKS_DIR, "stdlib-issue-15456.json")),
};
const PR: PullRequestData = JSON.parse(read(CHECKS_DIR, "stdlib-pr-15585.json"));

function fakeFetchers(overrides: Partial<Fetchers> = {}) {
    const fetchers = {
        fetchGuidelines: vi.fn(async () => ({
            contributing: read(RULES_DIR, "stdlib-contributing.md"),
            prTemplate: read(RULES_DIR, "stdlib-pr-template.md"),
            sources: { contributing: `${STDLIB}/CONTRIBUTING.md`, prTemplate: `${STDLIB}/.github/PULL_REQUEST_TEMPLATE.md` },
            extraDocs: [],
            warnings: [],
        })),
        fetchConfigFiles: vi.fn(async () => ({
            files: [],
            warnings: [".commitlintrc.js exists, but its settings are built with code."],
        })),
        fetchRecentCommits: vi.fn(async () => ({
            commits: (JSON.parse(read(RULES_DIR, "stdlib-commits.json")) as CommitData[]).map(toRecentCommit),
            warnings: [],
        })),
        fetchIssue: vi.fn(async (_o: string, _r: string, number: number) => ISSUES[number]),
        fetchPullRequest: vi.fn(async () => PR),
        ...overrides,
    };
    return fetchers;
}

function deps(fetchers: Fetchers, budgetMs = 25_000): AnalyzeDeps & { signals: AbortSignal[] } {
    const signals: AbortSignal[] = [];
    return {
        fetchers,
        createClient: (signal) => {
            signals.push(signal);
            return {} as Octokit;
        },
        caches: createCaches(),
        now: () => new Date("2026-09-28T00:00:00Z"),
        budgetMs,
        signals,
    };
}

const ISSUE_INPUT: AnalyzeInput = { owner: "stdlib-js", repo: "stdlib", kind: "issue", number: 12959, username: null };
const PR_INPUT: AnalyzeInput = { owner: "stdlib-js", repo: "stdlib", kind: "pr", number: 15585, username: null };

describe("analyze: issue #12959", () => {
    it("returns everything the UI needs", async () => {
        const result = await analyze(ISSUE_INPUT, deps(fakeFetchers()));

        expect(result.ok).toBe(true);
        expect(result.kind).toBe("issue");
        expect(result.repo).toEqual({ owner: "stdlib-js", repo: "stdlib", url: "https://github.com/stdlib-js/stdlib" });
        expect(result.target).toEqual({
            number: 12959,
            title: ISSUES[12959].title,
            url: "https://github.com/stdlib-js/stdlib/issues/12959",
            state: "open",
            author: null,
        });
        expect(result.journey.map((s) => [s.stage, s.status])).toEqual([
            ["issue", "warn"],
            ["work", "skip"],
            ["commit", "skip"],
            ["pr", "skip"],
            ["merge", "skip"],
        ]);
        expect(result.rules).toHaveLength(16);
        expect(result.sections).toHaveLength(6);
        expect(result.prDescription.label).toBe("PR description");
        expect(result.prDescription.text.split("\n")[0]).toBe("Resolves #12959.");
        expect(result.warnings).toEqual([".commitlintrc.js exists, but its settings are built with code."]);
        expect(result.meta.cached).toEqual({ rules: false, target: false });
    });

    it("groups checks by stage, worst first", async () => {
        const result = await analyze(ISSUE_INPUT, deps(fakeFetchers()));
        const issueStage = result.stages[0];

        expect(result.stages.map((s) => s.stage)).toEqual(["issue", "work", "commit", "pr", "merge"]);
        expect(issueStage.status).toBe("warn");
        expect(issueStage.checks.map((c) => c.status)).toEqual(["warn", "warn", "pass", "pass", "pass", "pass"]);
        expect(result.stages[1].checks).toEqual([]);
    });

    it("the second run is served from cache (no GitHub calls), even with different letter case", async () => {
        const fetchers = fakeFetchers();
        const d = deps(fetchers);
        await analyze(ISSUE_INPUT, d);
        const second = await analyze({ ...ISSUE_INPUT, owner: "STDLIB-JS", repo: "Stdlib" }, d);

        expect(second.meta.cached).toEqual({ rules: true, target: true });
        expect(fetchers.fetchGuidelines).toHaveBeenCalledTimes(1);
        expect(fetchers.fetchIssue).toHaveBeenCalledTimes(1);
    });
});

describe("analyze: PR #15585", () => {
    it("checks the PR, loads its linked issue, and labels the description as a suggestion", async () => {
        const fetchers = fakeFetchers();
        const result = await analyze(PR_INPUT, deps(fetchers));

        expect(result.kind).toBe("pr");
        expect(result.target).toMatchObject({ number: 15585, state: "open", author: "AdeshDeshmukh" });
        expect(fetchers.fetchIssue).toHaveBeenCalledWith("stdlib-js", "stdlib", 15456, expect.anything());
        expect(result.journey.map((s) => s.status)).toEqual(["skip", "pass", "skip", "manual", "pending"]);
        expect(result.prDescription.label).toBe("Suggested description");
        expect(result.prDescription.text.split("\n")[0]).toBe("Resolves #15456.");
    });

    it("the target counts as cached only when the PR AND its linked issue were cached", async () => {
        const d = deps(fakeFetchers());
        await analyze(ISSUE_INPUT, d); // caches the rules only
        const first = await analyze(PR_INPUT, d);
        const second = await analyze(PR_INPUT, d);

        expect(first.meta.cached).toEqual({ rules: true, target: false });
        expect(second.meta.cached).toEqual({ rules: true, target: true });
    });

    it("still works when the linked issue can't be loaded", async () => {
        const fetchers = fakeFetchers({
            fetchIssue: vi.fn(async () => {
                throw new Error("boom");
            }),
        });
        const result = await analyze(PR_INPUT, deps(fetchers));
        expect(result.warnings).toContain("Couldn't load issue #15456, so its assignee wasn't checked.");
    });
});

describe("analyze: failures", () => {
    it("passes on GitHub errors (the route turns them into HTTP answers)", async () => {
        const fetchers = fakeFetchers({
            fetchGuidelines: vi.fn(async () => {
                throw new RepoNotFoundError();
            }),
        });
        await expect(analyze(ISSUE_INPUT, deps(fetchers))).rejects.toBeInstanceOf(RepoNotFoundError);
    });

    it("stops after the time budget and cancels the GitHub requests", async () => {
        const fetchers = fakeFetchers({
            // Never answers
            fetchPullRequest: vi.fn(() => new Promise<PullRequestData>(() => {})),
        });
        const d = deps(fetchers, 30);

        await expect(analyze(PR_INPUT, d)).rejects.toBeInstanceOf(BudgetExceededError);
        expect(d.signals[0].aborted).toBe(true);
    });

    it("a finished analysis doesn't leave the budget timer running", async () => {
        const d = deps(fakeFetchers());
        await analyze(ISSUE_INPUT, d);
        expect(d.signals[0].aborted).toBe(false);
    });
});
