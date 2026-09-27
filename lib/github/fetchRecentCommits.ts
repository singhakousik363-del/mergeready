import type { Octokit } from "@octokit/rest";
import { assertValidRepo, createOctokit } from "./client";
import { MissingTokenError, RateLimitError, RepoNotFoundError, getHttpStatus, toGitHubError } from "./errors";

// How many of the newest commits on the default branch to read (one request)
export const RECENT_COMMITS = 50;

export type RecentCommit = {
    sha: string;
    message: string;
    // More than one parent = a merge commit
    isMerge: boolean;
    // Bots (renovate, dependabot, stdlib-bot...) don't follow the human rules
    isBot: boolean;
};

export type RecentCommits = {
    commits: RecentCommit[];
    warnings: string[];
};

type FetchOptions = {
    // Tests pass a fake Octokit here, so the real API is never called
    octokit?: Octokit;
};

// Only the fields we read from GitHub's answer, so tests and fixtures can use trimmed data
export type CommitData = {
    sha: string;
    commit: { message: string; author: { name?: string } | null };
    // The GitHub account linked to the commit email (null if none is linked)
    author: { login?: string; type?: string } | null;
    parents: { sha: string }[];
};

// "renovate[bot]" (GitHub App) or "stdlib-bot" (a normal account used as a bot,
// which GitHub doesn't mark as type "Bot")
const BOT_NAME = /\[bot\]$|-bot$/i;

export async function fetchRecentCommits(
    owner: string,
    repo: string,
    options: FetchOptions = {}
): Promise<RecentCommits> {
    assertValidRepo(owner, repo);
    const octokit = options.octokit ?? createOctokit();

    try {
        // No branch given = the default branch, newest first
        const { data } = await octokit.rest.repos.listCommits({ owner, repo, per_page: RECENT_COMMITS });
        return { commits: data.map(toRecentCommit), warnings: [] };
    } catch (err) {
        // 409 = the repo has no commits yet
        if (getHttpStatus(err) === 409) return { commits: [], warnings: [] };

        const error = toGitHubError(err);
        // These break the whole analysis anyway, so stop now
        if (error instanceof RateLimitError || error instanceof MissingTokenError || error instanceof RepoNotFoundError) {
            throw error;
        }
        // History is a bonus: other rule sources still work without it
        return { commits: [], warnings: [`Couldn't read recent commits: ${error.message}`] };
    }
}

// Tests use this to turn real API data (fixtures) into RecentCommits
export function toRecentCommit(item: CommitData): RecentCommit {
    const login = item.author?.login ?? "";
    const name = item.commit.author?.name ?? "";
    return {
        sha: item.sha,
        message: item.commit.message,
        isMerge: item.parents.length > 1,
        isBot: item.author?.type === "Bot" || BOT_NAME.test(login) || BOT_NAME.test(name),
    };
}
