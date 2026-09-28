// Step 5: run MergeReady's real analyze() on each rebuilt PR (never the HTTP
// route, see CLAUDE.md). Only runs AFTER the labels were locked.
import type { Octokit } from "@octokit/rest";
import { createOctokit } from "../lib/github/client";
import { fetchConfigFiles, type ConfigFiles } from "../lib/github/fetchConfigFiles";
import { fetchGuidelines, type Guidelines } from "../lib/github/fetchGuidelines";
import { RECENT_COMMITS, toRecentCommit, type CommitData } from "../lib/github/fetchRecentCommits";
import { IssueNotFoundError } from "../lib/github/errors";
import type { CheckStatus } from "../lib/checks/types";
import type { RuleType } from "../lib/rules/types";
import { analyze, createCaches, type AnalyzeResponse } from "../lib/server/analyze";
import { repoKey, type RepoRef } from "./config";
import type { CachedGitHub } from "./github";
import type { Snapshot } from "./types";

export type Flag = "red" | "yellow" | null;

export type ToolResult = {
    pr: string;
    repo: string;
    // For each of the 6 rule types: red (fail), yellow (warn) or no flag
    flags: Record<RuleType, Flag>;
    // Every check with its status, so each number in the report can be traced
    checks: { id: string; ruleType: RuleType | null; status: CheckStatus }[];
    ruleCount: number;
    warnings: string[];
};

export const RULE_TYPES: RuleType[] = ["conventional-commits", "pr-template", "linked-issue", "dco-signoff", "issue-assigned", "tests-changed"];

// The repo's guideline files and configs, fetched once per repo and cached.
// (Limitation: today's files, not the ones from the PR's day; see REPORT.md.)
type RepoFiles = { guidelines: Guidelines; configFiles: ConfigFiles };

export function loadRepoFiles(gh: CachedGitHub, repo: RepoRef): Promise<RepoFiles> {
    // Saved in the eval cache, so re-runs use the same files and cost no API calls
    return gh.custom<RepoFiles>({ kind: "repo-files", repo: repoKey(repo) }, async () => {
        const octokit = createOctokit({ timeoutMs: 30_000 });
        return {
            guidelines: await fetchGuidelines(repo.owner, repo.repo, { octokit }),
            configFiles: await fetchConfigFiles(repo.owner, repo.repo, { octokit }),
        };
    });
}

export async function runTool(gh: CachedGitHub, snapshot: Snapshot, files: RepoFiles): Promise<ToolResult> {
    const { repo, number, createdAt } = snapshot;
    const pr = `${repoKey(repo)}#${number}`;

    // The repo's habits as they were when the PR was opened (no peeking at later commits)
    const history = await gh.rest<CommitData[]>("GET /repos/{owner}/{repo}/commits", {
        owner: repo.owner,
        repo: repo.repo,
        per_page: RECENT_COMMITS,
        until: createdAt,
    });

    const result: AnalyzeResponse = await analyze(
        { owner: repo.owner, repo: repo.repo, kind: "pr", number, username: null },
        {
            fetchers: {
                fetchGuidelines: async () => files.guidelines,
                fetchConfigFiles: async () => files.configFiles,
                fetchRecentCommits: async () => ({ commits: history.map(toRecentCommit), warnings: [] }),
                fetchPullRequest: async () => snapshot.original,
                fetchIssue: async (_owner, _repo, issueNumber) => {
                    if (snapshot.linkedIssueAtCreation?.number === issueNumber) return snapshot.linkedIssueAtCreation;
                    throw new IssueNotFoundError(`Issue #${issueNumber} was not rebuilt.`);
                },
            },
            // The fetchers above never use it
            createClient: () => ({}) as Octokit,
            // Fresh caches: every PR has its own history
            caches: createCaches(),
            now: () => new Date(createdAt),
            budgetMs: 60_000,
        }
    );

    const checks = result.stages.flatMap((s) => s.checks).map((c) => ({ id: c.id, ruleType: c.ruleType, status: c.status }));
    const flags = Object.fromEntries(RULE_TYPES.map((type) => [type, flagFor(checks.filter((c) => c.ruleType === type))])) as Record<RuleType, Flag>;
    return { pr, repo: repoKey(repo), flags, checks, ruleCount: result.rules.length, warnings: result.warnings };
}

// A rule type is flagged red if any of its checks failed, yellow if any warned
function flagFor(checks: { status: CheckStatus }[]): Flag {
    if (checks.some((c) => c.status === "fail")) return "red";
    if (checks.some((c) => c.status === "warn")) return "yellow";
    return null;
}
