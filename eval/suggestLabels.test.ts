import { describe, it, expect } from "vitest";
import { findBoilerplate, suggestLabels } from "./suggestLabels";
import type { Comment, Snapshot } from "./types";

function snapshot(activity: Partial<Snapshot["activity"]> = {}, parts: Partial<Snapshot> = {}): Snapshot {
    return {
        repo: { owner: "acme", repo: "app" },
        number: 7,
        url: "https://github.com/acme/app/pull/7",
        author: "newbie",
        createdAt: "2026-09-01T10:00:00Z",
        endedAt: "2026-09-10T00:00:00Z",
        finalState: "MERGED",
        original: {} as Snapshot["original"],
        linkedIssueAtCreation: null,
        reconstruction: { body: "never-edited", title: "never-renamed", commits: "pr-commits", laterCommitsLeftOut: 0, warnings: [] },
        activity: { comments: [], titleRenames: [], bodyEdits: [], forcePushes: [], laterCommits: [], failedChecks: [], ...activity },
        ...parts,
    };
}

function comment(parts: Partial<Comment>): Comment {
    return {
        kind: "comment",
        author: "maintainer",
        association: "MEMBER",
        isBot: false,
        body: "",
        at: "2026-09-02T00:00:00Z",
        url: "https://github.com/acme/app/pull/7#c1",
        ...parts,
    };
}

const categories = (s: Snapshot, boilerplate = new Set<string>()) => suggestLabels(s, boilerplate).map((x) => x.category).sort();

describe("suggestLabels: maintainer and bot comments", () => {
    it("matches categories and quotes the exact line", () => {
        const [suggestion] = suggestLabels(snapshot({ comments: [comment({ body: "Thanks!\nCould you add a test for the NaN case?" })] }), new Set());
        expect(suggestion.category).toBe("tests");
        expect(suggestion.evidence[0]).toMatchObject({
            kind: "comment",
            who: "maintainer (MEMBER)",
            text: "Could you add a test for the NaN case?",
        });
    });

    it("recognises each checkable category from real-style comments", () => {
        const bodies: [string, string][] = [
            ["Please sign off your commits (DCO).", "dco"],
            ["The PR title should follow Conventional Commits.", "commit-format"],
            ["Please use the subsystem prefix in the commit message.", "commit-format"],
            ["Can you link the issue this fixes?", "linked-issue"],
            ["Please fill out the PR template.", "template"],
            ["This issue is already assigned to someone else.", "assignment"],
        ];
        for (const [body, expected] of bodies) {
            expect(categories(snapshot({ comments: [comment({ body })] }))).toContain(expected);
        }
    });

    it("anything else a maintainer asks for is not-checkable; LGTM is nothing", () => {
        expect(categories(snapshot({ comments: [comment({ body: "All of these whitespace changes need to be reverted." })] }))).toEqual(["not-checkable"]);
        expect(categories(snapshot({ comments: [comment({ kind: "review", reviewState: "CHANGES_REQUESTED", body: "Left initial comments." })] }))).toEqual([
            "not-checkable",
        ]);
        expect(categories(snapshot({ comments: [comment({ kind: "review", reviewState: "APPROVED", body: "LGTM" })] }))).toEqual([]);
        // Real review comments from the dataset (node, prometheus, vite)
        for (const body of [
            "This doesn't match the symbol naming around it",
            "can we get rid of the duration-specific test?",
            "Sorry I noticed this PR after I made the fix (#23567)",
        ]) {
            expect(categories(snapshot({ comments: [comment({ body })] }))).toEqual(["not-checkable"]);
        }
        expect(categories(snapshot({ comments: [comment({ body: "cc @nodejs/single-executable" })] }))).toEqual([]);
    });

    it("ignores the author's own comments, non-maintainers, and anything after merge/close", () => {
        expect(categories(snapshot({ comments: [comment({ author: "newbie", body: "I will add tests" })] }))).toEqual([]);
        expect(categories(snapshot({ comments: [comment({ association: "CONTRIBUTOR", body: "please add tests" })] }))).toEqual([]);
        expect(categories(snapshot({ comments: [comment({ at: "2026-09-11T00:00:00Z", body: "please add tests" })] }))).toEqual([]);
    });

    it("ignores quoted lines and code", () => {
        const body = "> Please sign off your commits\n```\ngit commit -s\n```\nLooks fine.";
        expect(categories(snapshot({ comments: [comment({ body })] }))).toEqual([]);
    });
});

describe("boilerplate bot comments", () => {
    it("a bot note posted on 3+ PRs is ignored, a one-off bot note counts", () => {
        const welcome = (n: number) =>
            snapshot(
                { comments: [comment({ author: "github-actions", isBot: true, association: "NONE", body: `Welcome! Read the commit message guidelines. (#${n})` })] },
                { number: n }
            );
        const prs = [welcome(1), welcome(2), welcome(3)];
        const boilerplate = findBoilerplate(prs);
        expect(categories(prs[0], boilerplate)).toEqual([]);

        const oneOff = snapshot({ comments: [comment({ author: "dco-bot", isBot: true, association: "NONE", body: "Commit abc is missing a Signed-off-by line." })] });
        expect(categories(oneOff, boilerplate)).toEqual(["dco"]);
    });
});

describe("silent fixes need clear evidence (SELECTION.md)", () => {
    it("a maintainer editing the title or adding 'Fixes #' to the body counts", () => {
        const s = snapshot({
            titleRenames: [{ at: "2026-09-03T00:00:00Z", actor: "maintainer", from: "Fix bug", to: "fix: handle NaN" }],
            bodyEdits: [{ at: "2026-09-03T00:00:00Z", editor: "maintainer", before: "Some text", after: "Some text\n\nFixes #12" }],
        });
        const result = suggestLabels(s, new Set());
        expect(result.map((x) => [x.category, x.evidence[0].kind])).toEqual([
            ["commit-format", "maintainer-title-edit"],
            ["linked-issue", "maintainer-body-edit"],
        ]);
        expect(result[0].evidence[0].text).toBe('Title changed: "Fix bug" → "fix: handle NaN"');
    });

    it("a pre-registered bot check failing on the first commit counts; other failing checks don't", () => {
        const s = snapshot({
            failedChecks: [
                { name: "DCO", app: "DCO", at: "2026-09-01T10:01:00Z", url: "https://x/dco" },
                { name: "lint-commit-message", app: "GitHub Actions", at: "2026-09-01T10:02:00Z", url: "https://x/lint" },
                { name: "Go tests", app: "GitHub Actions", at: "2026-09-01T10:05:00Z", url: "https://x/go" },
                { name: "Check Contributing Guidelines Acceptance", app: "GitHub Actions", at: "2026-09-01T10:05:00Z", url: "https://x/cg" },
            ],
        });
        expect(categories(s)).toEqual(["commit-format", "dco"]);
    });

    it("the author changing things right after a trigger adds evidence", () => {
        const s = snapshot({
            failedChecks: [{ name: "DCO", app: "DCO", at: "2026-09-01T10:01:00Z", url: "https://x/dco" }],
            forcePushes: [{ at: "2026-09-01T12:00:00Z", actor: "newbie" }],
        });
        const [dco] = suggestLabels(s, new Set());
        expect(dco.evidence.map((e) => e.kind)).toEqual(["failed-check", "author-fix"]);
    });

    it("the author editing their own PR with no trigger is NOT an objection", () => {
        const s = snapshot({
            titleRenames: [{ at: "2026-09-02T00:00:00Z", actor: "newbie", from: "wip", to: "fix: x" }],
            bodyEdits: [{ at: "2026-09-02T00:00:00Z", editor: "newbie", before: "a", after: "b" }],
            forcePushes: [{ at: "2026-09-02T00:00:00Z", actor: "newbie" }],
        });
        expect(suggestLabels(s, new Set())).toEqual([]);
    });

    it("an author change after an approval ('LGTM') or more than 48h later doesn't count", () => {
        const approved = snapshot({
            comments: [comment({ kind: "review", reviewState: "APPROVED", body: "LGTM" })],
            titleRenames: [{ at: "2026-09-02T01:00:00Z", actor: "newbie", from: "a", to: "b" }],
        });
        expect(suggestLabels(approved, new Set())).toEqual([]);

        const late = snapshot({
            comments: [comment({ body: "Please update the PR title." })],
            titleRenames: [{ at: "2026-09-05T00:00:00Z", actor: "newbie", from: "a", to: "fix: b" }],
        });
        const [titleSuggestion] = suggestLabels(late, new Set());
        expect(titleSuggestion.evidence.map((e) => e.kind)).toEqual(["comment"]);
    });
});
