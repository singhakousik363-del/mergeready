import { readFileSync } from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { checkPreStart } from "./preStart";
import type { IssueData } from "../github/fetchIssue";
import type { Rule } from "../rules/types";
import type { Check } from "./types";

// Real fetchIssue() output, see __fixtures__/SOURCES.md
const REAL_ISSUE: IssueData = JSON.parse(
    readFileSync(path.join(import.meta.dirname, "__fixtures__", "stdlib-issue-12959.json"), "utf8")
);

// The day after the fixture was captured
const NOW = new Date("2026-09-28T00:00:00Z");

function byId(checks: Check[], id: string): Check | undefined {
    return checks.find((c) => c.id === id);
}

function issue(parts: Partial<IssueData>): IssueData {
    return { ...REAL_ISSUE, comments: [], openPullRequests: [], assignees: [], ...parts };
}

function comment(author: string, body: string, createdAt: string, isBot = false) {
    return { author, isBot, body, createdAt };
}

// p5.js-style rule: "Get Assigned Before Working on an Issue"
const ASSIGN_RULE: Rule = {
    type: "issue-assigned",
    details: null,
    confidence: "prose",
    sourceQuote: "Get Assigned Before Working on an Issue",
    sourceUrl: "https://github.com/processing/p5.js/blob/main/CONTRIBUTING.md?plain=1#L15",
};

describe("checkPreStart: real stdlib issue #12959 (good first issue, two competing PRs)", () => {
    const checks = checkPreStart({ issue: REAL_ISSUE, rules: [], username: null, now: NOW });

    it("gives one status per pre-start question, all in the 'issue' stage", () => {
        expect(checks.map((c) => [c.id, c.status])).toEqual([
            ["repo-archived", "pass"],
            ["issue-open", "pass"],
            ["repo-activity", "pass"],
            ["issue-assignment", "pass"],
            ["claimed-in-comments", "warn"],
            ["open-pull-requests", "warn"],
        ]);
        expect(checks.every((c) => c.stage === "issue")).toBe(true);
    });

    it("finds the two real claims, skips the bot notice and the 'change your PR title' reply", () => {
        const claims = byId(checks, "claimed-in-comments");
        expect(claims?.message).toBe("2 people said in the comments that they want to work on this.");
        expect(claims?.evidence.observed).toEqual([
            '@prakashiitp, 100 days ago (has an open PR): "I\'d like to investigate this lint failure and work on a fix."',
            '@MannXo, 100 days ago (has an open PR): "Interested in working on this. Can I be assigned?"',
        ]);
        // Both claimants have PRs, so the claims are old but NOT stale
        expect(byId(checks, "stale-claim")).toBeUndefined();
    });

    it("lists both open PRs", () => {
        const prs = byId(checks, "open-pull-requests");
        expect(prs?.message).toBe("There are already 2 open pull requests that mention this issue.");
        expect(prs?.evidence.observed.map((o) => o.split(":")[0])).toEqual(["#12965 by @MannXo", "#12966 by @prakashiitp"]);
    });

    it("with username, the user's own claim and PR don't count", () => {
        const mine = checkPreStart({ issue: REAL_ISSUE, rules: [], username: "mannxo", now: NOW });
        expect(byId(mine, "claimed-in-comments")?.message).toBe(
            "Someone else said in the comments that they want to work on this."
        );
        expect(byId(mine, "open-pull-requests")?.evidence.observed).toHaveLength(1);
    });
});

describe("checkPreStart: assignment", () => {
    it("red when assigned to someone else", () => {
        const check = byId(checkPreStart({ issue: issue({ assignees: ["alice"] }), rules: [], username: null, now: NOW }), "issue-assignment");
        expect(check?.status).toBe("fail");
        expect(check?.message).toBe("This issue is assigned to @alice. Someone else is already working on it.");
    });

    it("pass when assigned to the user", () => {
        const check = byId(checkPreStart({ issue: issue({ assignees: ["Alice"] }), rules: [], username: "alice", now: NOW }), "issue-assignment");
        expect(check?.status).toBe("pass");
        expect(check?.message).toBe("This issue is assigned to you.");
    });

    it("unassigned is fine without a rule, but yellow when a prose rule asks to get assigned", () => {
        const noRule = byId(checkPreStart({ issue: issue({}), rules: [], username: null, now: NOW }), "issue-assignment");
        const withRule = byId(checkPreStart({ issue: issue({}), rules: [ASSIGN_RULE], username: null, now: NOW }), "issue-assignment");

        expect(noRule?.status).toBe("pass");
        expect(withRule?.status).toBe("warn");
        expect(withRule?.ruleType).toBe("issue-assigned");
        expect(withRule?.evidence.rules).toEqual([
            { sourceQuote: ASSIGN_RULE.sourceQuote, sourceUrl: ASSIGN_RULE.sourceUrl, confidence: "prose" },
        ]);
    });
});

describe("checkPreStart: claims", () => {
    it("an old claim with no PR gets the 'ask a maintainer' message", () => {
        const checks = checkPreStart({
            issue: issue({ comments: [comment("bob", "Can I work on this?", "2026-08-01T00:00:00Z")] }),
            rules: [],
            username: null,
            now: NOW,
        });
        expect(byId(checks, "claimed-in-comments")).toBeUndefined();
        expect(byId(checks, "stale-claim")).toMatchObject({
            status: "warn",
            message: "Claimed 58 days ago with no PR yet. Ask a maintainer if the issue is still taken.",
        });
    });

    it("a recent claim with no PR is a normal claim", () => {
        const checks = checkPreStart({
            issue: issue({ comments: [comment("bob", "I'll take this one!", "2026-09-20T00:00:00Z")] }),
            rules: [],
            username: null,
            now: NOW,
        });
        expect(byId(checks, "claimed-in-comments")?.status).toBe("warn");
        expect(byId(checks, "stale-claim")).toBeUndefined();
    });

    it("never counts bots, the user, or questions that aren't claims", () => {
        const checks = checkPreStart({
            issue: issue({
                comments: [
                    comment("helper-bot", "Can I be assigned? (template text)", "2026-09-20T00:00:00Z", true),
                    comment("me", "I'd like to work on this", "2026-09-20T00:00:00Z"),
                    comment("carol", "Is anyone working on this?", "2026-09-20T00:00:00Z"),
                    comment("dave", "I'd like to see this fixed soon.", "2026-09-20T00:00:00Z"),
                ],
            }),
            rules: [],
            username: "me",
            now: NOW,
        });
        expect(byId(checks, "claimed-in-comments")?.status).toBe("pass");
    });

    it("understands the /assign command", () => {
        const checks = checkPreStart({
            issue: issue({ comments: [comment("erin", "/assign", "2026-09-27T00:00:00Z")] }),
            rules: [],
            username: null,
            now: NOW,
        });
        expect(byId(checks, "claimed-in-comments")?.status).toBe("warn");
    });
});

describe("checkPreStart: repo and issue state", () => {
    it("red for an archived repo and a closed issue", () => {
        const checks = checkPreStart({
            issue: issue({ state: "closed", repoActivity: { archived: true, pushedAt: "2026-09-01T00:00:00Z" } }),
            rules: [],
            username: null,
            now: NOW,
        });
        expect(byId(checks, "repo-archived")?.status).toBe("fail");
        expect(byId(checks, "issue-open")?.status).toBe("fail");
    });

    it(`yellow when nothing was pushed for more than 180 days, skip for an empty repo`, () => {
        const old = checkPreStart({
            issue: issue({ repoActivity: { archived: false, pushedAt: "2026-01-01T00:00:00Z" } }),
            rules: [],
            username: null,
            now: NOW,
        });
        const empty = checkPreStart({
            issue: issue({ repoActivity: { archived: false, pushedAt: null } }),
            rules: [],
            username: null,
            now: NOW,
        });
        expect(byId(old, "repo-activity")).toMatchObject({
            status: "warn",
            message: "Nothing was pushed to this repo for 270 days. Maintainers may not review new pull requests.",
        });
        expect(byId(empty, "repo-activity")?.status).toBe("skip");
    });
});
