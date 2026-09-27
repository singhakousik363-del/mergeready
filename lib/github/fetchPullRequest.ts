import type { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import { assertValidNumber, assertValidRepo, createOctokit, fetchPages, PER_PAGE } from "./client";
import { PullRequestNotFoundError, RateLimitError, getHttpStatus, toGitHubError } from "./errors";
import { parseLinkedIssues } from "./linkedIssues";

// GitHub never lists more than 250 commits for a PR, which is 3 pages of 100
export const MAX_COMMIT_PAGES = 3;
// Files: first 300 (GitHub itself stops at 3000)
export const MAX_FILE_PAGES = 3;

// GitHub labels that mean "nothing merged in this repo yet". Only used when
// the search API fails: real first-timers often show up as plain "NONE".
const NEW_ASSOCIATIONS = new Set(["NONE", "FIRST_TIMER", "FIRST_TIME_CONTRIBUTOR"]);

// People who run the repo are never new, even with 0 merged PRs
// (maintainers often push directly instead of opening PRs)
const MAINTAINER_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

// A "Signed-off-by: Name <email>" line (Developer Certificate of Origin)
export const SIGN_OFF_LINE = /^\s*signed-off-by:\s*\S.*<[^<>\s]+@[^<>\s]+>\s*$/im;

export type PullRequestCommit = {
    sha: string;
    message: string;
    // Name written in the commit (from git config)
    authorName: string | null;
    // GitHub account linked to the commit email (null if none is linked)
    authorLogin: string | null;
    hasSignOff: boolean;
};

export type ChangedFile = {
    filename: string;
    // "added", "removed", "modified", "renamed", ...
    status: string;
};

export type PullRequestData = {
    number: number;
    title: string;
    url: string;
    // "" when the PR has no description
    body: string;
    author: string;
    // GitHub's own label, e.g. "NONE" or "CONTRIBUTOR" (kept for reference)
    authorAssociation: string;
    // Merged PRs by this author in this repo, not counting this PR.
    // null when we didn't or couldn't ask (maintainer, bot, deleted account, search failed).
    mergedPrCountInRepo: number | null;
    isNewContributor: boolean;
    draft: boolean;
    state: "open" | "closed" | "merged";
    baseBranch: string;
    // GitHub only honours "fixes #12" when the PR targets the default branch
    targetsDefaultBranch: boolean;
    linkedIssues: number[];
    commits: PullRequestCommit[];
    files: ChangedFile[];
    // Problems the user should know about, e.g. "only the first 300 files were checked"
    warnings: string[];
};

type FetchOptions = {
    // Tests pass a fake Octokit here, so the real API is never called
    octokit?: Octokit;
};

type PullRequest = RestEndpointMethodTypes["pulls"]["get"]["response"]["data"];
type Commit = RestEndpointMethodTypes["pulls"]["listCommits"]["response"]["data"][number];

export async function fetchPullRequest(
    owner: string,
    repo: string,
    number: number,
    options: FetchOptions = {}
): Promise<PullRequestData> {
    // 1. Validate user input before sending it anywhere
    assertValidRepo(owner, repo);
    assertValidNumber(number);

    const octokit = options.octokit ?? createOctokit();

    // 2. The PR itself
    const pr = await getPullRequest(octokit, owner, repo, number);

    // 3. These three don't depend on each other, so ask together
    const [commits, files, contributor] = await Promise.all([
        fetchPages(
            (page) =>
                octokit.rest.pulls
                    .listCommits({ owner, repo, pull_number: number, per_page: PER_PAGE, page })
                    .catch((err: unknown) => {
                        throw toGitHubError(err);
                    }),
            MAX_COMMIT_PAGES,
            "first"
        ),
        fetchPages(
            (page) =>
                octokit.rest.pulls
                    .listFiles({ owner, repo, pull_number: number, per_page: PER_PAGE, page })
                    .catch((err: unknown) => {
                        throw toGitHubError(err);
                    }),
            MAX_FILE_PAGES,
            "first"
        ),
        getContributorInfo(octokit, pr),
    ]);

    // 4. Warn when we didn't see everything (pulls.get gives the real totals)
    const warnings: string[] = [];
    if (contributor.warning) warnings.push(contributor.warning);
    if (pr.commits > commits.items.length) {
        warnings.push(
            `This PR has ${pr.commits} commits; only the first ${commits.items.length} were checked.`
        );
    }
    if (pr.changed_files > files.items.length) {
        warnings.push(
            `This PR changes ${pr.changed_files} files; only the first ${files.items.length} were checked.`
        );
    }

    const body = pr.body ?? "";
    return {
        number,
        title: pr.title,
        url: pr.html_url,
        body,
        author: pr.user?.login ?? "ghost",
        authorAssociation: pr.author_association,
        mergedPrCountInRepo: contributor.mergedPrCountInRepo,
        isNewContributor: contributor.isNewContributor,
        draft: pr.draft ?? false,
        state: pr.merged_at ? "merged" : pr.state === "closed" ? "closed" : "open",
        baseBranch: pr.base.ref,
        targetsDefaultBranch: pr.base.ref === pr.base.repo.default_branch,
        // Use the owner/repo the user typed: "owner/repo#12" in the body normally uses that too
        linkedIssues: parseLinkedIssues(body, { owner, repo }),
        commits: commits.items.map(toCommit),
        files: files.items.map((file) => ({ filename: file.filename, status: file.status })),
        warnings,
    };
}

async function getPullRequest(octokit: Octokit, owner: string, repo: string, number: number): Promise<PullRequest> {
    try {
        const { data } = await octokit.rest.pulls.get({ owner, repo, pull_number: number });
        return data;
    } catch (err) {
        if (getHttpStatus(err) !== 404) throw toGitHubError(err);
    }
    // A 404 means the repo OR the PR is missing. Ask for the repo to know which.
    try {
        await octokit.rest.repos.get({ owner, repo });
    } catch (err) {
        throw toGitHubError(err);
    }
    throw new PullRequestNotFoundError(number);
}

function toCommit(item: Commit): PullRequestCommit {
    return {
        sha: item.sha,
        message: item.commit.message,
        authorName: item.commit.author?.name ?? null,
        authorLogin: item.author?.login ?? null,
        hasSignOff: SIGN_OFF_LINE.test(item.commit.message),
    };
}

type ContributorInfo = {
    mergedPrCountInRepo: number | null;
    isNewContributor: boolean;
    warning: string | null;
};

// Is the author new to this repo? GitHub's author_association often says
// "NONE" even for a first PR, so we count their merged PRs with the search API.
async function getContributorInfo(octokit: Octokit, pr: PullRequest): Promise<ContributorInfo> {
    const fromAssociation = NEW_ASSOCIATIONS.has(pr.author_association);
    const login = pr.user?.login;

    // Maintainers and bots are never new: skip the search (it has a small rate limit)
    if (MAINTAINER_ASSOCIATIONS.has(pr.author_association) || pr.user?.type === "Bot") {
        return { mergedPrCountInRepo: null, isNewContributor: false, warning: null };
    }
    // A deleted account can't be searched
    if (!login) return { mergedPrCountInRepo: null, isNewContributor: fromAssociation, warning: null };

    try {
        // base.repo.full_name is the current repo name, even after a rename
        const q = `repo:${pr.base.repo.full_name} is:pr is:merged author:${login}`;
        const { data } = await octokit.rest.search.issuesAndPullRequests({ q, per_page: 1 });
        // If this PR is already merged, the search counts it too: don't count it
        const count = Math.max(0, data.total_count - (pr.merged_at ? 1 : 0));
        return { mergedPrCountInRepo: count, isNewContributor: count === 0, warning: null };
    } catch (err) {
        // Search is a bonus: never fail the whole analysis because of it
        const reason =
            toGitHubError(err) instanceof RateLimitError
                ? "GitHub's search limit was reached"
                : "GitHub search didn't answer";
        return {
            mergedPrCountInRepo: null,
            isNewContributor: fromAssociation,
            warning:
                `${reason}, so first-time contributor status is based only on GitHub's ` +
                `"${pr.author_association}" label, which is less reliable.`,
        };
    }
}
