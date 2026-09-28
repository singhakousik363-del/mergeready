// Step 2: rebuild each PR as it was when FIRST submitted (see SELECTION.md).
// Contributors often fix things after a maintainer asks; judging today's
// version would hide exactly the problems we want to measure.
import { looksLikeBot } from "../lib/github/client";
import type { IssueData } from "../lib/github/fetchIssue";
import { SIGN_OFF_LINE, type PullRequestCommit, type PullRequestData } from "../lib/github/fetchPullRequest";
import { parseLinkedIssues } from "../lib/github/linkedIssues";
import { FIRST_PUSH_GRACE_MS, repoKey, type RepoRef } from "./config";
import type { CachedGitHub } from "./github";
import type { Activity, Comment, Exclusion, Snapshot } from "./types";

// ---------- pure helpers (tested) ----------

type Edit = { createdAt: string; editedAt: string; diff: string | null; editor: { login: string } | null };

// GitHub keeps every version of the body. The oldest one is what was first
// submitted. Returns null when the history exists but the oldest text is gone.
export function bodyHistory(currentBody: string, edits: Edit[]): { original: string; versions: { at: string; editor: string; text: string }[] } | null {
    if (edits.length === 0) return { original: currentBody, versions: [] };
    const sorted = [...edits].sort((a, b) => a.editedAt.localeCompare(b.editedAt) || a.createdAt.localeCompare(b.createdAt));
    if (sorted[0].diff === null) return null;
    return {
        original: sorted[0].diff,
        versions: sorted.map((e) => ({ at: e.editedAt, editor: e.editor?.login ?? "ghost", text: e.diff ?? "" })),
    };
}

// The title before the first rename (or today's title if never renamed)
export function originalTitle(currentTitle: string, renames: { at: string; from: string }[]): string {
    const sorted = [...renames].sort((a, b) => a.at.localeCompare(b.at));
    return sorted[0]?.from ?? currentTitle;
}

// Commits dated up to FIRST_PUSH_GRACE_MS after the PR was opened
export function firstPushCommits<T extends { date: string }>(commits: T[], createdAt: string): { first: T[]; later: T[] } {
    const limit = new Date(createdAt).getTime() + FIRST_PUSH_GRACE_MS;
    return {
        first: commits.filter((c) => new Date(c.date).getTime() <= limit),
        later: commits.filter((c) => new Date(c.date).getTime() > limit),
    };
}

// Replays assign/unassign events up to `at`
export function assigneesAt(events: { type: "assigned" | "unassigned"; at: string; login: string }[], at: string): string[] {
    const current = new Set<string>();
    for (const event of [...events].sort((a, b) => a.at.localeCompare(b.at))) {
        if (event.at > at) break;
        if (event.type === "assigned") current.add(event.login);
        else current.delete(event.login);
    }
    return [...current];
}

// ---------- GitHub queries ----------

const PR_QUERY = `query ($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    defaultBranchRef { name }
    pullRequest(number: $number) {
      number title body url createdAt closedAt mergedAt state baseRefName
      author { login }
      userContentEdits(first: 100) { totalCount nodes { createdAt editedAt diff editor { login } } }
      commits(first: 100) { totalCount nodes { commit { oid message committedDate author { name user { login } } } } }
      timelineItems(first: 100, itemTypes: [HEAD_REF_FORCE_PUSHED_EVENT, RENAMED_TITLE_EVENT, ISSUE_COMMENT, PULL_REQUEST_REVIEW]) {
        pageInfo { hasNextPage }
        nodes {
          __typename
          ... on HeadRefForcePushedEvent { createdAt actor { login } beforeCommit { oid } }
          ... on RenamedTitleEvent { createdAt actor { login } previousTitle currentTitle }
          ... on IssueComment { createdAt url body authorAssociation author { __typename login } }
          ... on PullRequestReview {
            createdAt url body state authorAssociation author { __typename login }
            comments(first: 50) { nodes { createdAt url body } }
          }
        }
      }
    }
  }
}`;

type Author = { __typename?: string; login: string } | null;
type TimelineNode =
    | { __typename: "HeadRefForcePushedEvent"; createdAt: string; actor: Author; beforeCommit: { oid: string } | null }
    | { __typename: "RenamedTitleEvent"; createdAt: string; actor: Author; previousTitle: string; currentTitle: string }
    | { __typename: "IssueComment"; createdAt: string; url: string; body: string; authorAssociation: string; author: Author }
    | {
          __typename: "PullRequestReview";
          createdAt: string;
          url: string;
          body: string;
          state: string;
          authorAssociation: string;
          author: Author;
          comments: { nodes: { createdAt: string; url: string; body: string }[] };
      };

type PrQueryResult = {
    repository: {
        defaultBranchRef: { name: string } | null;
        pullRequest: {
            number: number;
            title: string;
            body: string;
            url: string;
            createdAt: string;
            closedAt: string | null;
            mergedAt: string | null;
            state: "OPEN" | "CLOSED" | "MERGED";
            baseRefName: string;
            author: Author;
            userContentEdits: { totalCount: number; nodes: Edit[] };
            commits: {
                totalCount: number;
                nodes: { commit: { oid: string; message: string; committedDate: string; author: { name: string | null; user: { login: string } | null } | null } }[];
            };
            // (totalCount would ignore itemTypes and count every event, so hasNextPage is used)
            timelineItems: { pageInfo: { hasNextPage: boolean }; nodes: TimelineNode[] };
        } | null;
    };
};

type CompareResult = {
    commits: { sha: string; commit: { message: string; committer: { date: string } | null; author: { name: string } | null }; author: { login: string } | null }[];
    files?: { filename: string; status: string }[];
};

const CHECKS_QUERY = `query ($owner: String!, $name: String!, $oid: GitObjectID!) {
  repository(owner: $owner, name: $name) {
    object(oid: $oid) {
      ... on Commit {
        checkSuites(first: 30) { nodes { app { name } checkRuns(first: 30) { nodes { name conclusion completedAt url } } } }
        status { contexts { context state createdAt targetUrl } }
      }
    }
  }
}`;

type ChecksResult = {
    repository: {
        object: {
            checkSuites?: { nodes: { app: { name: string } | null; checkRuns: { nodes: { name: string; conclusion: string | null; completedAt: string | null; url: string }[] } }[] };
            status?: { contexts: { context: string; state: string; createdAt: string; targetUrl: string | null }[] } | null;
        } | null;
    };
};

const ISSUE_QUERY = `query ($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      number title url state
      timelineItems(first: 100, itemTypes: [ASSIGNED_EVENT, UNASSIGNED_EVENT]) {
        nodes {
          __typename
          ... on AssignedEvent { createdAt assignee { __typename ... on User { login } } }
          ... on UnassignedEvent { createdAt assignee { __typename ... on User { login } } }
        }
      }
    }
  }
}`;

type IssueResult = {
    repository: {
        issue: {
            number: number;
            title: string;
            url: string;
            state: "OPEN" | "CLOSED";
            timelineItems: { nodes: { __typename: string; createdAt: string; assignee: { login?: string } | null }[] };
        } | null;
    };
};

// ---------- rebuilding one PR ----------

type SimpleCommit = { sha: string; message: string; date: string; authorName: string | null; authorLogin: string | null };

export async function reconstructPr(gh: CachedGitHub, repo: RepoRef, number: number): Promise<Snapshot | Exclusion> {
    const vars = { owner: repo.owner, name: repo.repo };
    const exclude = (reason: string): Exclusion => ({ repo, number, url: `https://github.com/${repoKey(repo)}/pull/${number}`, reason });

    const result = await gh.graphql<PrQueryResult>(PR_QUERY, { ...vars, number });
    const pr = result.repository.pullRequest;
    if (!pr) return exclude("PR not found");
    const author = pr.author?.login ?? "ghost";
    const warnings: string[] = [];
    if (pr.timelineItems.pageInfo.hasNextPage) warnings.push("More than 100 comments/reviews/renames; later ones were not read.");

    // Body
    const body = bodyHistory(pr.body, pr.userContentEdits.nodes);
    if (!body) return exclude("The original PR body is missing from GitHub's edit history.");

    // Title
    const renames = pr.timelineItems.nodes.flatMap((n) =>
        n.__typename === "RenamedTitleEvent" ? [{ at: n.createdAt, actor: n.actor?.login ?? "ghost", from: n.previousTitle, to: n.currentTitle }] : []
    );

    // Commits: before the first force-push if there was one, else today's commits
    const forcePushes = pr.timelineItems.nodes
        .flatMap((n) => (n.__typename === "HeadRefForcePushedEvent" ? [n] : []))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    let candidates: SimpleCommit[];
    let commitSource: Snapshot["reconstruction"]["commits"];
    if (forcePushes.length > 0) {
        const before = forcePushes[0].beforeCommit?.oid;
        if (!before) return exclude("The commit from before the first force-push is gone.");
        const compare = await safeCompare(gh, repo, pr.baseRefName, before);
        if (!compare) return exclude("Couldn't read the commits from before the first force-push.");
        candidates = compare.commits.map((c) => ({
            sha: c.sha,
            message: c.commit.message,
            date: c.commit.committer?.date ?? pr.createdAt,
            authorName: c.commit.author?.name ?? null,
            authorLogin: c.author?.login ?? null,
        }));
        commitSource = "before-first-force-push";
    } else {
        if (pr.commits.totalCount > pr.commits.nodes.length) warnings.push("More than 100 commits; only the first 100 were read.");
        candidates = pr.commits.nodes.map(({ commit }) => ({
            sha: commit.oid,
            message: commit.message,
            date: commit.committedDate,
            authorName: commit.author?.name ?? null,
            authorLogin: commit.author?.user?.login ?? null,
        }));
        commitSource = "pr-commits";
    }
    const { first, later } = firstPushCommits(candidates, pr.createdAt);
    if (first.length === 0) return exclude("No commit is dated at or before the PR's creation (probably rebased later).");
    const originalHead = first[first.length - 1].sha;

    // Files changed by the first push
    const filesCompare = await safeCompare(gh, repo, pr.baseRefName, originalHead);
    if (!filesCompare?.files) return exclude("Couldn't read the files changed by the first push.");

    const originalBody = body.original;
    const linkedIssues = parseLinkedIssues(originalBody, repo);
    const original: PullRequestData = {
        number: pr.number,
        title: originalTitle(pr.title, renames),
        url: pr.url,
        body: originalBody,
        author,
        // Unknown for the past; not used by any check
        authorAssociation: "NONE",
        mergedPrCountInRepo: 0,
        isNewContributor: true,
        draft: false,
        state: "open",
        baseBranch: pr.baseRefName,
        targetsDefaultBranch: pr.baseRefName === result.repository.defaultBranchRef?.name,
        linkedIssues,
        commits: first.map(
            (c): PullRequestCommit => ({
                sha: c.sha,
                message: c.message,
                authorName: c.authorName,
                authorLogin: c.authorLogin,
                hasSignOff: SIGN_OFF_LINE.test(c.message),
            })
        ),
        files: filesCompare.files.map((f) => ({ filename: f.filename, status: f.status })),
        warnings: [],
    };

    const linkedIssueAtCreation = linkedIssues[0] !== undefined ? await issueAtCreation(gh, repo, linkedIssues[0], pr.createdAt) : null;

    const activity: Activity = {
        comments: collectComments(pr.timelineItems.nodes),
        titleRenames: renames,
        bodyEdits: body.versions.slice(1).map((v, i) => ({ at: v.at, editor: v.editor, before: body.versions[i].text, after: v.text })),
        forcePushes: forcePushes.map((f) => ({ at: f.createdAt, actor: f.actor?.login ?? "ghost" })),
        laterCommits: later.map((c) => ({ at: c.date, sha: c.sha, message: c.message })),
        failedChecks: await failedChecks(gh, repo, originalHead).catch(() => {
            warnings.push("The first commit's checks couldn't be read; failed checks can't be used as evidence for this PR.");
            return [];
        }),
    };

    return {
        repo,
        number: pr.number,
        url: pr.url,
        author,
        createdAt: pr.createdAt,
        endedAt: pr.mergedAt ?? pr.closedAt,
        finalState: pr.state,
        original,
        linkedIssueAtCreation,
        reconstruction: {
            body: body.versions.length > 0 ? "edit-history" : "never-edited",
            title: renames.length > 0 ? "renamed" : "never-renamed",
            commits: commitSource,
            laterCommitsLeftOut: later.length,
            warnings,
        },
        activity,
    };
}

async function safeCompare(gh: CachedGitHub, repo: RepoRef, base: string, head: string): Promise<CompareResult | null> {
    try {
        return await gh.rest<CompareResult>("GET /repos/{owner}/{repo}/compare/{basehead}", {
            owner: repo.owner,
            repo: repo.repo,
            basehead: `${base}...${head}`,
            per_page: 100,
        });
    } catch {
        return null;
    }
}

function collectComments(nodes: TimelineNode[]): Comment[] {
    const comments: Comment[] = [];
    const isBot = (a: Author) => a?.__typename === "Bot" || looksLikeBot(a?.login ?? "");
    for (const n of nodes) {
        if (n.__typename === "IssueComment") {
            comments.push({ kind: "comment", author: n.author?.login ?? "ghost", association: n.authorAssociation, isBot: isBot(n.author), body: n.body, at: n.createdAt, url: n.url });
        } else if (n.__typename === "PullRequestReview") {
            const base = { author: n.author?.login ?? "ghost", association: n.authorAssociation, isBot: isBot(n.author) };
            if (n.body.trim() !== "" || n.state === "CHANGES_REQUESTED") {
                comments.push({ ...base, kind: "review", body: n.body, at: n.createdAt, url: n.url, reviewState: n.state });
            }
            for (const c of n.comments.nodes) comments.push({ ...base, kind: "review-comment", body: c.body, at: c.createdAt, url: c.url });
        }
    }
    return comments.sort((a, b) => a.at.localeCompare(b.at));
}

async function failedChecks(gh: CachedGitHub, repo: RepoRef, oid: string): Promise<Activity["failedChecks"]> {
    const result = await gh.graphql<ChecksResult>(CHECKS_QUERY, { owner: repo.owner, name: repo.repo, oid });
    const commit = result.repository.object;
    if (!commit) return [];
    const failed: Activity["failedChecks"] = [];
    for (const suite of commit.checkSuites?.nodes ?? []) {
        for (const run of suite.checkRuns.nodes) {
            if (run.conclusion === "FAILURE" || run.conclusion === "ACTION_REQUIRED") {
                failed.push({ name: run.name, app: suite.app?.name ?? "unknown", at: run.completedAt ?? "", url: run.url });
            }
        }
    }
    for (const context of commit.status?.contexts ?? []) {
        if (context.state === "FAILURE" || context.state === "ERROR") {
            failed.push({ name: context.context, app: "status", at: context.createdAt, url: context.targetUrl ?? "" });
        }
    }
    return failed;
}

async function issueAtCreation(gh: CachedGitHub, repo: RepoRef, number: number, at: string): Promise<IssueData | null> {
    let result: IssueResult;
    try {
        result = await gh.graphql<IssueResult>(ISSUE_QUERY, { owner: repo.owner, name: repo.repo, number });
    } catch {
        // e.g. the number belongs to a PR, not an issue
        return null;
    }
    const issue = result.repository.issue;
    if (!issue) return null;
    const events = issue.timelineItems.nodes.flatMap((n) =>
        n.assignee?.login
            ? [{ type: n.__typename === "AssignedEvent" ? ("assigned" as const) : ("unassigned" as const), at: n.createdAt, login: n.assignee.login }]
            : []
    );
    return {
        number: issue.number,
        title: issue.title,
        url: issue.url,
        state: issue.state === "CLOSED" ? "closed" : "open",
        labels: [],
        assignees: assigneesAt(events, at),
        comments: [],
        openPullRequests: [],
        repoActivity: { archived: false, pushedAt: null },
        warnings: [],
    };
}
