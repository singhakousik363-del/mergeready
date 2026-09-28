import type { IssueData } from "../lib/github/fetchIssue";
import type { PullRequestData } from "../lib/github/fetchPullRequest";
import type { RepoRef } from "./config";

// Something a human or bot did on the PR, in time order. Suggestions are
// built ONLY from these, never from MergeReady's output.
export type Comment = {
    kind: "comment" | "review" | "review-comment";
    author: string;
    association: string;
    isBot: boolean;
    body: string;
    at: string;
    url: string;
    // Only for reviews, e.g. "CHANGES_REQUESTED"
    reviewState?: string;
};

export type Activity = {
    comments: Comment[];
    titleRenames: { at: string; actor: string; from: string; to: string }[];
    bodyEdits: { at: string; editor: string; before: string; after: string }[];
    forcePushes: { at: string; actor: string }[];
    // Commits dated after the first push (added later by the author)
    laterCommits: { at: string; sha: string; message: string }[];
    // Checks that failed on the FIRST head commit
    failedChecks: { name: string; app: string; at: string; url: string }[];
};

export type Snapshot = {
    repo: RepoRef;
    number: number;
    url: string;
    author: string;
    createdAt: string;
    // When the PR was merged or closed (null if still open): later activity doesn't count
    endedAt: string | null;
    finalState: "OPEN" | "CLOSED" | "MERGED";
    // The PR as first submitted, in the shape analyze() expects
    original: PullRequestData;
    // The first linked issue, with its assignees as they were when the PR was opened
    linkedIssueAtCreation: IssueData | null;
    reconstruction: {
        body: "edit-history" | "never-edited";
        title: "renamed" | "never-renamed";
        commits: "before-first-force-push" | "pr-commits";
        // Commits left out because they were dated after the first push
        laterCommitsLeftOut: number;
        warnings: string[];
    };
    activity: Activity;
};

export type Exclusion = { repo: RepoRef; number: number; url: string; reason: string };

export type Snapshots = { snapshots: Snapshot[]; excluded: Exclusion[] };
