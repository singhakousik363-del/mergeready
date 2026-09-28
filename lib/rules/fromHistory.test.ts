import { readFileSync } from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { MIN_COMMITS, extractHistoryRules } from "./fromHistory";
import { toRecentCommit, type CommitData, type RecentCommit } from "../github/fetchRecentCommits";

// Real "last 50 commits" answers from GitHub (trimmed), see __fixtures__/SOURCES.md
function commitsOf(name: string): RecentCommit[] {
    const data: CommitData[] = JSON.parse(
        readFileSync(path.join(import.meta.dirname, "__fixtures__", `${name}-commits.json`), "utf8")
    );
    return data.map(toRecentCommit);
}

const REPO = "https://github.com/acme/app";

// n human commits with this message
function made(n: number, message: string, extra: Partial<RecentCommit> = {}): RecentCommit[] {
    return Array.from({ length: n }, (_, i) => ({ sha: `s${i}`, message, isMerge: false, isBot: false, ...extra }));
}

const SIGNED = "\n\nSigned-off-by: Jane Doe <jane@example.com>";

describe("extractHistoryRules: real repos", () => {
    it("stdlib-js/stdlib: Conventional Commits; 'PR-URL:' trailers mean the PR title matters (9 stdlib-bot commits skipped)", () => {
        const { rules, warnings } = extractHistoryRules(commitsOf("stdlib"), "https://github.com/stdlib-js/stdlib");

        expect(warnings).toEqual([]);
        expect(rules).toEqual([
            {
                type: "conventional-commits",
                details: { format: "conventional", appliesTo: "pr-title", allowedTypes: null },
                confidence: "history",
                strict: false,
                sourceQuote:
                    "41 of the last 41 commits (not counting merges and bots) follow Conventional Commits; " +
                    "most were written when the PR was merged, so the PR title matters most",
                sourceUrl: "https://github.com/stdlib-js/stdlib/commits/0695f035b77cb48eb223ed45f430e1e94cfe2554",
            },
        ]);
    });

    it("nodejs/node: 'subsystem: message' is a prefix habit (not Conventional Commits), about commits; every commit is signed off", () => {
        const { rules } = extractHistoryRules(commitsOf("node"), "https://github.com/nodejs/node");

        expect(rules).toEqual([
            {
                type: "conventional-commits",
                // 6 of the 50 PR-URLs appear on more than one commit: node keeps a PR's own commits
                details: { format: "prefix", appliesTo: "commits", allowedTypes: null },
                confidence: "history",
                strict: false,
                sourceQuote: '49 of the last 49 commits (not counting merges and bots) start with a lowercase "prefix: " (like "fs: fix leak")',
                sourceUrl: "https://github.com/nodejs/node/commits/a2a064c76afe42fedf061d976de8dff69ef2feaf",
            },
            {
                type: "dco-signoff",
                details: null,
                confidence: "history",
                strict: false,
                sourceQuote: "49 of the last 49 commits (not counting merges and bots) have a Signed-off-by line",
                sourceUrl: "https://github.com/nodejs/node/commits/a2a064c76afe42fedf061d976de8dff69ef2feaf",
            },
        ]);
    });

    it("prometheus/prometheus: finds the DCO app's sign-offs after skipping 16 merges and 15 bot commits", () => {
        const { rules } = extractHistoryRules(commitsOf("prometheus"), "https://github.com/prometheus/prometheus");

        expect(rules.map((r) => [r.type, r.sourceQuote])).toEqual([
            ["dco-signoff", "19 of the last 19 commits (not counting merges and bots) have a Signed-off-by line"],
        ]);
    });

    it("vitejs/vite: '(#123)' titles mean squash merges, so the rule is about the PR title", () => {
        const { rules } = extractHistoryRules(commitsOf("vite"), "https://github.com/vitejs/vite");

        expect(rules).toHaveLength(1);
        expect(rules[0].details).toEqual({ format: "conventional", appliesTo: "pr-title", allowedTypes: null });
    });
});

describe("extractHistoryRules: counting", () => {
    it("needs 90%: 18 of 20 is enough, 17 of 20 is not", () => {
        const enough = [...made(18, "feat: x"), ...made(2, "Update README")];
        const notEnough = [...made(17, "feat: x"), ...made(3, "Update README")];

        expect(extractHistoryRules(enough, REPO).rules).toHaveLength(1);
        expect(extractHistoryRules(notEnough, REPO).rules).toEqual([]);
    });

    it(`needs at least ${MIN_COMMITS} human commits, and says so when there are fewer`, () => {
        const commits = [...made(5, "feat: x"), ...made(45, "chore(deps): bump", { isBot: true })];
        expect(extractHistoryRules(commits, REPO)).toEqual({
            rules: [],
            warnings: [
                "Only 5 of the last 50 commits were made by people (not merges or bots), which is too few to learn the repo's commit habits.",
            ],
        });
    });

    it("does not count merge commits", () => {
        const commits = [...made(20, "fix: x"), ...made(10, "Merge pull request #1 from a/b", { isMerge: true })];
        expect(extractHistoryRules(commits, REPO).rules[0].sourceQuote).toMatch(/^20 of the last 20 commits/);
    });

    it("uses 'commits' when most messages were not written at merge time", () => {
        const [rule] = extractHistoryRules(made(20, "fix(parser): handle tabs"), REPO).rules;
        expect(rule.details).toEqual({ format: "conventional", appliesTo: "commits", allowedTypes: null });
        expect(rule.sourceQuote).toBe("20 of the last 20 commits (not counting merges and bots) follow Conventional Commits");
    });

    it("gives both rules when commits follow both habits", () => {
        const rules = extractHistoryRules(made(20, `feat!: drop node 18${SIGNED}`), REPO).rules;
        expect(rules.map((r) => r.type)).toEqual(["conventional-commits", "dco-signoff"]);
    });

    it("needs a real sign-off line with an email", () => {
        expect(extractHistoryRules(made(20, "docs: x\n\nSigned-off-by: someone"), REPO).rules.map((r) => r.type)).toEqual([
            "conventional-commits",
        ]);
    });

    it("learns a 'prefix: message' habit at 90%, and Conventional Commits wins when both fit", () => {
        const prefix = [...made(18, "fs, stream: fix leak"), ...made(2, "Update README")];
        expect(extractHistoryRules(prefix, REPO).rules.map((r) => r.details)).toEqual([
            { format: "prefix", appliesTo: "commits", allowedTypes: null },
        ]);
        // "fix: x" fits both patterns
        expect(extractHistoryRules(made(20, "fix: x"), REPO).rules.map((r) => r.details)).toEqual([
            { format: "conventional", appliesTo: "commits", allowedTypes: null },
        ]);
        // Capitalised prefixes are not the lowercase "subsystem" style
        expect(extractHistoryRules(made(20, "Docs: x"), REPO).rules).toEqual([]);
    });

    it("PR-URL trailers mean 'PR title', unless two commits share one PR-URL (the PR's commits were kept)", () => {
        const squashed = Array.from({ length: 20 }, (_, i) => made(1, `fix: x\n\nPR-URL: https://github.com/a/b/pull/${i}`)[0]);
        const kept = [...squashed.slice(0, 18), ...made(2, "fix: y\n\nPR-URL: https://github.com/a/b/pull/99")];
        expect(extractHistoryRules(squashed, REPO).rules[0].details).toMatchObject({ appliesTo: "pr-title" });
        expect(extractHistoryRules(kept, REPO).rules[0].details).toMatchObject({ appliesTo: "commits" });
    });

    it("history rules are never strict", () => {
        const rules = extractHistoryRules(made(20, `feat: x${SIGNED}`), REPO).rules;
        expect(rules.map((r) => r.strict)).toEqual([false, false]);
    });

    it("returns nothing for an empty repo", () => {
        expect(extractHistoryRules([], REPO)).toEqual({ rules: [], warnings: [] });
    });
});
