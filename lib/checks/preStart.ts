import type { IssueComment, IssueData } from "../github/fetchIssue";
import type { Rule } from "../rules/types";
import { evidenceOf, failStatus, rulesOfType, steps, type Check, type CheckStatus, type FixStep } from "./types";

// No push for this long = the repo may not be maintained any more
export const INACTIVE_DAYS = 180;
// A claim this old with no PR from that person may be abandoned
export const STALE_CLAIM_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

// Comments where someone says they will work on the issue:
// "I'd like to ... work on a fix", "Can I be assigned?", "/assign".
// Up to 60 characters may sit between "I'd" and "work on": the real claim
// "I'd like to investigate this lint failure and work on a fix" needs 43.
const CLAIM_PATTERNS = [
    /\b(?:i['’]?d|i would|i['’]?m|i am|i['’]?ll|i will|i want|let me|can i|could i|may i)\b[^.?!\n]{0,60}\b(?:work(?:ing)? on|take|tackle|fix|handle|attempt|pick (?:this|it) up)\b/i,
    /\b(?:assign (?:this|it) to me|assign me|be assigned|get assigned)\b/i,
    /\binterested in (?:working on|taking|fixing)\b/i,
    // Slash command used by some repos' bots
    /^\/assign\b/im,
];

export type PreStartInput = {
    issue: IssueData;
    rules: Rule[];
    // The user's GitHub name, if they gave it: their own claims and PRs don't count against them
    username: string | null;
    // Passed in (not read from the clock) so tests always give the same result
    now: Date;
};

// Checks to run BEFORE starting work on an issue
export function checkPreStart({ issue, rules, username, now }: PreStartInput): Check[] {
    const isMe = (login: string) => username !== null && login.toLowerCase() === username.toLowerCase();
    return [
        checkArchived(issue),
        checkIssueOpen(issue),
        checkActivity(issue, now),
        checkAssignment(issue, rules, isMe),
        ...checkClaims(issue, isMe, now),
        checkOpenPullRequests(issue, isMe),
    ];
}

function checkArchived(issue: IssueData): Check {
    const archived = issue.repoActivity.archived;
    return {
        id: "repo-archived",
        ruleType: null,
        stage: "issue",
        status: archived ? "fail" : "pass",
        message: archived
            ? "This repo is archived (read-only). New pull requests can't be merged."
            : "The repo is not archived.",
        howToFix: archived ? steps("Pick an issue in a repo that is still active.") : [],
        evidence: { rules: [], observed: [archived ? "GitHub marks this repo as archived." : "Not archived."] },
    };
}

function checkIssueOpen(issue: IssueData): Check {
    const closed = issue.state === "closed";
    return {
        id: "issue-open",
        ruleType: null,
        stage: "issue",
        status: closed ? "fail" : "pass",
        message: closed ? "This issue is already closed, so there's nothing left to fix." : "The issue is open.",
        howToFix: closed ? steps("Pick an open issue instead.") : [],
        evidence: { rules: [], observed: [`Issue state: ${issue.state}`] },
    };
}

function checkActivity(issue: IssueData, now: Date): Check {
    const pushedAt = issue.repoActivity.pushedAt;
    if (pushedAt === null) {
        return skipped("repo-activity", "The repo has no code yet, so its activity can't be checked.");
    }
    const days = daysBetween(pushedAt, now);
    const inactive = days > INACTIVE_DAYS;
    return {
        id: "repo-activity",
        ruleType: null,
        stage: "issue",
        status: inactive ? "warn" : "pass",
        message: inactive
            ? `Nothing was pushed to this repo for ${days} days. Maintainers may not review new pull requests.`
            : "The repo is active.",
        howToFix: inactive ? steps("Check recent issues and PRs to see if maintainers still reply before you start.") : [],
        // Honest: bots' pushes count too, so an "active" repo may only have bot activity
        evidence: { rules: [], observed: [`Last push: ${pushedAt.slice(0, 10)} (bots' pushes count too)`] },
    };
}

function checkAssignment(issue: IssueData, rules: Rule[], isMe: (login: string) => boolean): Check {
    const assignRules = rulesOfType(rules, "issue-assigned");
    const strongest = assignRules[0];
    const observed = [`Assignees: ${issue.assignees.join(", ") || "none"}`];

    function result(status: CheckStatus, message: string, howToFix: FixStep[]): Check {
        return {
            id: "issue-assignment",
            ruleType: strongest ? "issue-assigned" : null,
            stage: "issue",
            status,
            message,
            howToFix,
            evidence: { rules: evidenceOf(assignRules), observed },
        };
    }

    if (issue.assignees.some(isMe)) {
        return result("pass", "This issue is assigned to you.", []);
    }
    if (issue.assignees.length > 0) {
        const names = issue.assignees.map((a) => `@${a}`).join(", ");
        return result(
            "fail",
            `This issue is assigned to ${names}. Someone else is already working on it.`,
            steps("Pick a different issue, or", `ask in the issue whether ${names} is still working on it before you start.`)
        );
    }
    // Nobody is assigned: only a problem when the repo asks you to get assigned first
    if (strongest) {
        return result(
            failStatus(strongest.confidence),
            "This repo asks you to be assigned before you start, and nobody is assigned yet.",
            steps(
                'Comment on the issue, e.g. "Hi! I\'d like to work on this. Could you assign it to me?"',
                "Wait until a maintainer assigns you, then start."
            )
        );
    }
    return result("pass", "Nobody is assigned to this issue yet.", []);
}

type Claim = { comment: IssueComment; days: number; hasOpenPr: boolean };

// Up to two checks: recent claims (or claims with a PR), and old claims with no PR
function checkClaims(issue: IssueData, isMe: (login: string) => boolean, now: Date): Check[] {
    // One claim per person: their first claiming comment
    const claims = new Map<string, Claim>();
    for (const comment of issue.comments) {
        if (comment.isBot || isMe(comment.author) || claims.has(comment.author.toLowerCase())) continue;
        if (!CLAIM_PATTERNS.some((pattern) => pattern.test(comment.body))) continue;
        claims.set(comment.author.toLowerCase(), {
            comment,
            days: daysBetween(comment.createdAt, now),
            hasOpenPr: issue.openPullRequests.some((pr) => pr.author.toLowerCase() === comment.author.toLowerCase()),
        });
    }

    const all = [...claims.values()];
    if (all.length === 0) {
        return [
            {
                id: "claimed-in-comments",
                ruleType: null,
                stage: "issue",
                status: "pass",
                message: "Nobody else has said in the comments that they are working on this.",
                howToFix: [],
                evidence: { rules: [], observed: [`${issue.comments.length} comments read`] },
            },
        ];
    }

    const stale = all.filter((c) => c.days > STALE_CLAIM_DAYS && !c.hasOpenPr);
    const active = all.filter((c) => !stale.includes(c));
    const checks: Check[] = [];

    if (active.length > 0) {
        checks.push({
            id: "claimed-in-comments",
            ruleType: null,
            stage: "issue",
            status: "warn",
            message:
                active.length === 1
                    ? "Someone else said in the comments that they want to work on this."
                    : `${active.length} people said in the comments that they want to work on this.`,
            howToFix: steps(
                "Read their comments and any pull requests they opened.",
                "If they are active, pick another issue or offer to help instead."
            ),
            evidence: { rules: [], observed: active.map(describeClaim) },
        });
    }
    if (stale.length > 0) {
        const oldest = Math.max(...stale.map((c) => c.days));
        checks.push({
            id: "stale-claim",
            ruleType: null,
            stage: "issue",
            status: "warn",
            message: `Claimed ${oldest} days ago with no PR yet. Ask a maintainer if the issue is still taken.`,
            howToFix: steps(
                "Comment on the issue and ask politely whether it is still being worked on.",
                "Start only after someone confirms it is free."
            ),
            evidence: { rules: [], observed: stale.map(describeClaim) },
        });
    }
    return checks;
}

function describeClaim({ comment, days, hasOpenPr }: Claim): string {
    const firstLine = comment.body.split("\n").find((line) => line.trim() !== "")?.trim() ?? "";
    const quote = firstLine.length > 100 ? `${firstLine.slice(0, 100)}…` : firstLine;
    const pr = hasOpenPr ? "has an open PR" : "no open PR";
    return `@${comment.author}, ${days} days ago (${pr}): "${quote}"`;
}

function checkOpenPullRequests(issue: IssueData, isMe: (login: string) => boolean): Check {
    const others = issue.openPullRequests.filter((pr) => !isMe(pr.author));
    return {
        id: "open-pull-requests",
        ruleType: null,
        stage: "issue",
        // Yellow, not red: a PR that only mentions the issue is listed too
        status: others.length > 0 ? "warn" : "pass",
        message:
            others.length === 0
                ? "No one else has an open pull request for this issue."
                : `There ${others.length === 1 ? "is already 1 open pull request" : `are already ${others.length} open pull requests`} that mention this issue.`,
        howToFix:
            others.length === 0
                ? []
                : steps(
                      "Open those pull requests and check whether they really fix this issue.",
                      "If one does and it is active, pick another issue or help review it."
                  ),
        evidence: {
            rules: [],
            observed: others.map((pr) => `#${pr.number} by @${pr.author}${pr.draft ? " (draft)" : ""}: ${pr.title} — ${pr.url}`),
        },
    };
}

function skipped(id: string, message: string): Check {
    return { id, ruleType: null, stage: "issue", status: "skip", message, howToFix: [], evidence: { rules: [], observed: [] } };
}

// Whole days from an ISO date to now (never negative)
function daysBetween(iso: string, now: Date): number {
    return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS));
}
