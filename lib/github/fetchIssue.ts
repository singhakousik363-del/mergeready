import type { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import { assertValidNumber, assertValidRepo, createOctokit, fetchPages, looksLikeBot, PER_PAGE } from "./client";
import { IssueNotFoundError, getHttpStatus, toGitHubError } from "./errors";

// Timeline: read at most this many pages of 100 events.
// With more, we read page 1 + the last 2 pages (the newest events).
export const MAX_TIMELINE_PAGES = 3;

export type IssueComment = {
    author: string;
    // Bot comments ("good first issue" notices...) are never claims
    isBot: boolean;
    body: string;
    createdAt: string;
};

// An open PR in the same repo that mentions this issue
export type LinkedPullRequest = {
    number: number;
    title: string;
    author: string;
    url: string;
    draft: boolean;
};

export type IssueData = {
    number: number;
    title: string;
    url: string;
    state: "open" | "closed";
    labels: string[];
    assignees: string[];
    // From the timeline, oldest first
    comments: IssueComment[];
    openPullRequests: LinkedPullRequest[];
    repoActivity: {
        archived: boolean;
        // Last push to any branch (null for an empty repo)
        pushedAt: string | null;
    };
    // Problems the user should know about, e.g. "some events were skipped"
    warnings: string[];
};

type FetchOptions = {
    // Tests pass a fake Octokit here, so the real API is never called
    octokit?: Octokit;
};

type TimelineEvent = RestEndpointMethodTypes["issues"]["listEventsForTimeline"]["response"]["data"][number];

export async function fetchIssue(
    owner: string,
    repo: string,
    number: number,
    options: FetchOptions = {}
): Promise<IssueData> {
    // 1. Validate user input before sending it anywhere
    assertValidRepo(owner, repo);
    assertValidNumber(number);

    const octokit = options.octokit ?? createOctokit();

    // 2. Repo first: a 404 here means the REPO is missing, not the issue
    let repoData;
    try {
        ({ data: repoData } = await octokit.rest.repos.get({ owner, repo }));
    } catch (err) {
        throw toGitHubError(err);
    }

    // 3. The issue and its timeline don't depend on each other
    const [issue, timeline] = await Promise.all([
        getIssue(octokit, owner, repo, number),
        fetchPages(
            (page) =>
                octokit.rest.issues
                    .listEventsForTimeline({ owner, repo, issue_number: number, per_page: PER_PAGE, page })
                    .catch((err: unknown) => {
                        throw toIssueError(err, number);
                    }),
            MAX_TIMELINE_PAGES,
            "newest"
        ),
    ]);

    // GitHub treats every PR as an issue too, so /issues/5 can be a PR
    if (issue.pull_request) {
        throw new IssueNotFoundError(`#${number} is a pull request, not an issue. Paste the pull request link instead.`);
    }

    const warnings: string[] = [];
    if (timeline.skippedPages > 0) {
        const skipped = timeline.skippedPages * PER_PAGE;
        warnings.push(
            `This issue has a very long history. About ${skipped} events in the middle were skipped; ` +
                "the oldest and newest events were checked."
        );
    }

    return {
        number,
        title: issue.title,
        url: issue.html_url,
        state: issue.state === "closed" ? "closed" : "open",
        // Labels can be plain strings or objects, depending on the API
        labels: issue.labels
            .map((label) => (typeof label === "string" ? label : (label.name ?? "")))
            .filter((name) => name !== ""),
        assignees: (issue.assignees ?? []).map((user) => user.login),
        comments: timeline.items.flatMap(toComment),
        // repoData.full_name is the current name, even if the user typed an old one
        openPullRequests: findOpenPullRequests(timeline.items, repoData.full_name),
        repoActivity: { archived: repoData.archived, pushedAt: repoData.pushed_at || null },
        warnings,
    };
}

async function getIssue(octokit: Octokit, owner: string, repo: string, number: number) {
    try {
        const { data } = await octokit.rest.issues.get({ owner, repo, issue_number: number });
        return data;
    } catch (err) {
        throw toIssueError(err, number);
    }
}

// 404 = no such issue, 410 = deleted or issues are turned off for the repo.
// The repo itself exists (step 2 checked), so a 404 is about the issue.
function toIssueError(err: unknown, number: number) {
    const status = getHttpStatus(err);
    if (status === 404 || status === 410) {
        return new IssueNotFoundError(
            `Issue #${number} was not found. It may have been deleted, or issues may be turned off for this repo.`
        );
    }
    return toGitHubError(err);
}

// Returns [] or [comment], so flatMap can skip events that aren't comments
function toComment(event: TimelineEvent): IssueComment[] {
    // The timeline mixes many event shapes; `in` checks tell TypeScript which one this is
    if (event.event !== "commented" || !("body" in event) || !("user" in event) || !("created_at" in event)) {
        return [];
    }
    // A deleted account has no user; GitHub shows it as "ghost"
    const author = event.user?.login ?? "ghost";
    return [
        {
            author,
            isBot: event.user?.type === "Bot" || looksLikeBot(author),
            body: event.body ?? "",
            createdAt: event.created_at,
        },
    ];
}

// Open PRs in the same repo that mention this issue ("cross-referenced").
// Note: a mention doesn't always mean the PR fixes the issue.
function findOpenPullRequests(events: TimelineEvent[], repoFullName: string): LinkedPullRequest[] {
    const found = new Map<number, LinkedPullRequest>();
    const repoApiUrl = `/repos/${repoFullName}`.toLowerCase();

    for (const event of events) {
        if (event.event !== "cross-referenced" || !("source" in event)) continue;
        const source = event.source.issue;
        // Only PRs (not issues), still open, and not from a fork or another repo
        if (!source?.pull_request || source.state !== "open") continue;
        if (!source.repository_url.toLowerCase().endsWith(repoApiUrl)) continue;

        // The same PR can mention the issue many times: keep it once
        found.set(source.number, {
            number: source.number,
            title: source.title,
            author: source.user?.login ?? "ghost",
            url: source.html_url,
            draft: source.draft ?? false,
        });
    }
    return [...found.values()];
}
