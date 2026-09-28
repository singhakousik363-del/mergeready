import { readFileSync } from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { runChecks } from "./runChecks";
import { extractRules } from "../rules/extractRules";
import { toRecentCommit, type CommitData } from "../github/fetchRecentCommits";
import type { IssueData } from "../github/fetchIssue";
import type { PullRequestData } from "../github/fetchPullRequest";

// Real data only: stdlib's real guideline files and commits give the rules,
// real fetchPullRequest/fetchIssue output gives the PR and issues
const RULES_DIR = path.join(import.meta.dirname, "..", "rules", "__fixtures__");
const CHECKS_DIR = path.join(import.meta.dirname, "__fixtures__");
const read = (dir: string, name: string) => readFileSync(path.join(dir, name), "utf8");

const STDLIB = "https://github.com/stdlib-js/stdlib";
const { rules: STDLIB_RULES } = extractRules(
    {
        contributing: read(RULES_DIR, "stdlib-contributing.md"),
        prTemplate: read(RULES_DIR, "stdlib-pr-template.md"),
        sources: {
            contributing: `${STDLIB}/blob/develop/CONTRIBUTING.md`,
            prTemplate: `${STDLIB}/blob/develop/.github/PULL_REQUEST_TEMPLATE.md`,
        },
        extraDocs: [],
        warnings: [],
    },
    { files: [], warnings: [] },
    { commits: (JSON.parse(read(RULES_DIR, "stdlib-commits.json")) as CommitData[]).map(toRecentCommit), warnings: [] },
    STDLIB
);

const PR: PullRequestData = JSON.parse(read(CHECKS_DIR, "stdlib-pr-15585.json"));
const LINKED_ISSUE: IssueData = JSON.parse(read(CHECKS_DIR, "stdlib-issue-15456.json"));
const ISSUE: IssueData = JSON.parse(read(CHECKS_DIR, "stdlib-issue-12959.json"));

describe("runChecks: real stdlib PR #15585", () => {
    const result = runChecks({ mode: "pr", rules: STDLIB_RULES, pr: PR, linkedIssue: LINKED_ISSUE });

    it("runs every PR check", () => {
        expect(result.checks.map((c) => [c.id, c.status])).toEqual([
            // stdlib has no "get assigned" rule
            ["issue-assigned", "skip"],
            ["tests-changed", "pass"],
            // stdlib's history rule is about the PR title, so no commit-message check
            ["commit-format:pr-title", "pass"],
            // stdlib has no DCO rule (none of the 3 commits is signed off, and that's fine)
            ["dco-signoff", "skip"],
            ["template-section:Description", "pass"],
            ["template-section:Related Issues", "pass"],
            ["template-section:Questions", "pass"],
            ["template-section:Other", "pass"],
            ["template-section:Disclosure", "pass"],
            ["template-checkboxes:1", "pass"],
            ["template-checkboxes:2", "manual"],
            ["template-checkboxes:3", "pass"],
            ["linked-issue", "pass"],
            ["merge-state", "pending"],
        ]);
    });

    it("builds the journey map", () => {
        expect(result.journey).toEqual([
            { stage: "issue", status: "skip", summary: "Nothing to check here." },
            { stage: "work", status: "pass", summary: "All good" },
            { stage: "commit", status: "skip", summary: "Nothing to check here." },
            { stage: "pr", status: "manual", summary: "1 to check yourself" },
            { stage: "merge", status: "pending", summary: "Waiting for a maintainer to review." },
        ]);
        expect(result.warnings).toEqual([]);
    });

    it("the merge stage asks to fix red items first when there are any", () => {
        // stdlib's own rules are all advice (no "must"), so make the issue rule strict to get a red item
        const strictRules = STDLIB_RULES.map((r) => (r.type === "linked-issue" ? { ...r, strict: true } : r));
        const broken = runChecks({ mode: "pr", rules: strictRules, pr: { ...PR, linkedIssues: [] }, linkedIssue: null });
        expect(broken.checks.find((c) => c.id === "merge-state")?.message).toBe(
            "Fix the red items first, then wait for a maintainer to review."
        );
        expect(broken.journey.find((s) => s.stage === "pr")?.status).toBe("fail");
    });

    it("draft, merged and closed PRs", () => {
        const state = (pr: PullRequestData) =>
            runChecks({ mode: "pr", rules: STDLIB_RULES, pr, linkedIssue: null }).checks.find((c) => c.id === "merge-state")?.status;
        expect(state({ ...PR, draft: true })).toBe("warn");
        expect(state({ ...PR, state: "merged" })).toBe("pass");
        expect(state({ ...PR, state: "closed" })).toBe("fail");
    });

    it("passes on warnings from the fetched data", () => {
        const many = { ...PR, warnings: ["This PR has 400 commits; only the first 250 were checked."] };
        expect(runChecks({ mode: "pr", rules: STDLIB_RULES, pr: many, linkedIssue: null }).warnings).toEqual(many.warnings);
    });
});

describe("runChecks: real stdlib issue #12959", () => {
    it("runs the pre-start checks; later stages wait for a PR", () => {
        const result = runChecks({ mode: "issue", rules: STDLIB_RULES, issue: ISSUE, username: null, now: new Date("2026-09-28T00:00:00Z") });

        expect(result.checks.every((c) => c.stage === "issue")).toBe(true);
        expect(result.journey).toEqual([
            { stage: "issue", status: "warn", summary: "2 to look at" },
            { stage: "work", status: "skip", summary: "Open a PR to check this." },
            { stage: "commit", status: "skip", summary: "Open a PR to check this." },
            { stage: "pr", status: "skip", summary: "Open a PR to check this." },
            { stage: "merge", status: "skip", summary: "Open a PR to check this." },
        ]);
    });
});
