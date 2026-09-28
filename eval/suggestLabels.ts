// Step 3: suggest what maintainers objected to, ONLY from what humans and bots
// did on the PR (comments, reviews, edits, failed checks). This file never
// imports or reads MergeReady's checks. A person reviews every suggestion.
import { parseLinkedIssues } from "../lib/github/linkedIssues";
import { FIX_WINDOW_MS, MAINTAINER_ASSOCIATIONS } from "./config";
import type { Comment, Snapshot } from "./types";

export type Category = "template" | "commit-format" | "dco" | "linked-issue" | "tests" | "assignment" | "not-checkable";

export const CHECKABLE: Category[] = ["template", "commit-format", "dco", "linked-issue", "tests", "assignment"];

export type Evidence = {
    kind: "comment" | "review" | "review-comment" | "maintainer-title-edit" | "maintainer-body-edit" | "failed-check" | "author-fix";
    who: string;
    at: string;
    url: string;
    // An exact quote, or a short description of the event
    text: string;
};

export type Suggestion = { id: string; category: Category; evidence: Evidence[] };

// Words that tie a comment to a category. Code blocks and quoted lines are
// removed first, so a maintainer quoting the PR doesn't count.
const PATTERNS: Record<Exclude<Category, "not-checkable">, RegExp> = {
    dco: /\bsign(?:ed)?[- ]?off\b|signed-off-by|\bDCO\b|git commit (?:-s|--signoff)|--signoff\b/i,
    "commit-format": /\bcommit messages?\b|\bcommit (?:title|subject|format)\b|\b(?:pr|pull request) title\b|\bthe title\b|\bconventional commits?\b|\bcommitlint\b|\bsubsystem\b/i,
    "linked-issue": /\b(?:link|reference|mention)\s+(?:(?:the|an|this|a|related)\s+)?issue\b|\b(?:fixes|closes|resolves)\s*:?\s*#|\bissue number\b|\bwhich issue\b/i,
    tests: /\b(?:add|adding|include|write|missing|need|needs|cover)\b[^.?!\n]{0,40}\btests?\b|\btests?\b[^.?!\n]{0,30}\b(?:missing|needed|required)\b|\b(?:regression|unit) tests?\b|\btest coverage\b/i,
    template: /\b(?:pr|pull request) template\b|\bthe template\b|\bchecklist\b|\bfill (?:in|out)\b|\b(?:pr|pull request) description\b/i,
    assignment: /\bassign(?:ed|ing)?\b|\bclaim(?:ed)?\b|\balready (?:working|being worked)\b/i,
};

// A maintainer asking for something we can't check (code, design, ...)
// (Widened once after reading the dataset's comments, before MergeReady was run on it)
const REQUEST =
    /\b(?:please|could you|can you|can we|would you|should|needs? to|must|instead|revert|remove|why|nit|not (?:needed|necessary)|unnecessary|duplicate)\b|\bdoesn't (?:work|match)|\bI don't (?:think|find)|\balready (?:fixed|made the fix)|\bmade the fix\b/i;
// GitHub's "suggested change" block (code blocks are removed before matching, so check the raw text)
const SUGGESTED_CHANGE = /```suggestion/;

// Pre-registered bot checks (SELECTION.md): DCO, commitlint, semantic PR title
const CHECK_CATEGORY: { category: Category; pattern: RegExp }[] = [
    { category: "dco", pattern: /\bdco\b|sign-?off/i },
    { category: "commit-format", pattern: /commitlint|commit[- ]?(?:lint|message)|semantic|pr[- ]?title|lint[- ]?pr/i },
];

// ---------- boilerplate bot comments ----------

// A bot posting (almost) the same text on 3+ PRs is a welcome note or a
// report, not an objection to THIS PR
export const BOILERPLATE_MIN_PRS = 3;

export function boilerplateKey(comment: Pick<Comment, "author" | "body">): string {
    const text = comment.body
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, "")
        .replace(/[0-9a-f]{7,}|\d+/g, "")
        .replace(/\s+/g, " ")
        .trim();
    return `${comment.author}|${text.slice(0, 120)}`;
}

export function findBoilerplate(snapshots: Snapshot[]): Set<string> {
    const prsByKey = new Map<string, Set<string>>();
    for (const s of snapshots) {
        for (const c of s.activity.comments) {
            if (!c.isBot) continue;
            const key = boilerplateKey(c);
            const prs = prsByKey.get(key) ?? new Set<string>();
            prs.add(`${s.repo.owner}/${s.repo.repo}#${s.number}`);
            prsByKey.set(key, prs);
        }
    }
    return new Set([...prsByKey].filter(([, prs]) => prs.size >= BOILERPLATE_MIN_PRS).map(([key]) => key));
}

// ---------- suggestions for one PR ----------

export function suggestLabels(s: Snapshot, boilerplate: Set<string>): Suggestion[] {
    const end = s.endedAt ?? "9999";
    const byCategory = new Map<Category, Evidence[]>();
    const add = (category: Category, evidence: Evidence) => byCategory.set(category, [...(byCategory.get(category) ?? []), evidence]);

    // Triggers an author fix can respond to: [time, categories]
    const triggers: { at: string; categories: Category[] }[] = [];

    // 1. Maintainer and bot comments
    for (const c of s.activity.comments) {
        if (c.at > end || c.author === s.author) continue;
        const maintainer = !c.isBot && MAINTAINER_ASSOCIATIONS.has(c.association);
        if (!maintainer && !(c.isBot && !boilerplate.has(boilerplateKey(c)))) continue;

        const text = withoutQuotesAndCode(c.body);
        const categories: Category[] = (Object.keys(PATTERNS) as (keyof typeof PATTERNS)[]).filter((cat) => PATTERNS[cat].test(text));
        for (const category of categories) add(category, commentEvidence(c, quoteFor(text, PATTERNS[category as keyof typeof PATTERNS])));

        // Something else a maintainer asked for (only people, not bots)
        const asksSomething = REQUEST.test(text) || SUGGESTED_CHANGE.test(c.body);
        if (categories.length === 0 && maintainer && (c.reviewState === "CHANGES_REQUESTED" || asksSomething)) {
            const summary = firstLine(text) || (SUGGESTED_CHANGE.test(c.body) ? "Suggested a code change" : `Review: ${c.reviewState ?? "comment"}`);
            add("not-checkable", commentEvidence(c, summary));
            categories.push("not-checkable");
        }
        // Only a comment that raised something can trigger an author fix ("LGTM" can't)
        if (categories.length > 0) triggers.push({ at: c.at, categories });
    }

    // 2. A maintainer (not the author) edited the title or the body
    for (const r of s.activity.titleRenames) {
        if (r.at > end || r.actor === s.author) continue;
        add("commit-format", { kind: "maintainer-title-edit", who: r.actor, at: r.at, url: s.url, text: `Title changed: "${r.from}" → "${r.to}"` });
    }
    for (const e of s.activity.bodyEdits) {
        if (e.at > end || e.editor === s.author) continue;
        const addedIssue = parseLinkedIssues(e.before, s.repo).length === 0 && parseLinkedIssues(e.after, s.repo).length > 0;
        add(addedIssue ? "linked-issue" : "template", {
            kind: "maintainer-body-edit",
            who: e.editor,
            at: e.at,
            url: s.url,
            text: addedIssue ? "Edited the description and added a closing keyword (Fixes #…)" : "Edited the PR description",
        });
    }

    // 3. Pre-registered bot checks that failed on the first commit
    for (const check of s.activity.failedChecks) {
        const match = CHECK_CATEGORY.find((c) => c.pattern.test(check.name));
        if (!match) continue;
        add(match.category, { kind: "failed-check", who: check.app, at: check.at, url: check.url, text: `Check "${check.name}" failed on the first commit` });
        triggers.push({ at: check.at || s.createdAt, categories: [match.category] });
    }

    // 4. The author changed something right after a trigger
    for (const change of authorChanges(s)) {
        const trigger = [...triggers]
            .filter((t) => t.at < change.at && new Date(change.at).getTime() - new Date(t.at).getTime() <= FIX_WINDOW_MS)
            .sort((a, b) => b.at.localeCompare(a.at))[0];
        if (!trigger || change.at > end) continue;
        // Same category as the trigger when it fits; otherwise the trigger's checkable
        // categories; otherwise what the change itself looks like
        const checkable = trigger.categories.filter((c) => c !== "not-checkable");
        const categories = trigger.categories.includes(change.guess) ? [change.guess] : checkable.length > 0 ? checkable : [change.guess];
        for (const category of categories) {
            add(category, { kind: "author-fix", who: s.author, at: change.at, url: s.url, text: change.text });
        }
    }

    const prefix = `${s.repo.owner}/${s.repo.repo}#${s.number}`;
    return [...byCategory].map(([category, evidence]) => ({
        id: `${prefix}:${category}`,
        category,
        evidence: evidence.sort((a, b) => a.at.localeCompare(b.at)),
    }));
}

type AuthorChange = { at: string; text: string; guess: Category };

// What the author changed after opening the PR, with the category it most likely fixes
function authorChanges(s: Snapshot): AuthorChange[] {
    const changes: AuthorChange[] = [];
    for (const r of s.activity.titleRenames) {
        if (r.actor === s.author) changes.push({ at: r.at, text: `Author changed the title to "${r.to}"`, guess: "commit-format" });
    }
    for (const e of s.activity.bodyEdits) {
        if (e.editor !== s.author) continue;
        const addedIssue = parseLinkedIssues(e.before, s.repo).length === 0 && parseLinkedIssues(e.after, s.repo).length > 0;
        changes.push({ at: e.at, text: addedIssue ? "Author added a closing keyword (Fixes #…)" : "Author edited the description", guess: addedIssue ? "linked-issue" : "template" });
    }
    for (const f of s.activity.forcePushes) {
        if (f.actor === s.author) changes.push({ at: f.at, text: "Author force-pushed new commits", guess: "not-checkable" });
    }
    for (const c of s.activity.laterCommits) {
        changes.push({ at: c.at, text: `Author added commit "${firstLine(c.message)}"`, guess: "not-checkable" });
    }
    return changes;
}

function withoutQuotesAndCode(body: string): string {
    return body
        .replace(/```[\s\S]*?```/g, " ")
        .split("\n")
        .filter((line) => !line.trimStart().startsWith(">"))
        .join("\n")
        .replace(/<!--[\s\S]*?-->/g, " ");
}

// The line that matched, as an exact quote (shortened if very long)
function quoteFor(text: string, pattern: RegExp): string {
    const line = text.split("\n").find((l) => pattern.test(l)) ?? text;
    return shorten(line.trim());
}

function firstLine(text: string): string {
    return shorten(text.split("\n").find((l) => l.trim() !== "")?.trim() ?? "");
}

function shorten(text: string, max = 240): string {
    return text.length > max ? `${text.slice(0, max)}…` : text;
}

function commentEvidence(c: Comment, text: string): Evidence {
    return { kind: c.kind, who: `${c.author} (${c.isBot ? "bot" : c.association})`, at: c.at, url: c.url, text };
}
