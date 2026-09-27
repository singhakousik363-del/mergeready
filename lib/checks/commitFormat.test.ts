import { readFileSync } from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { checkCommitFormat } from "./commitFormat";
import type { PullRequestData } from "../github/fetchPullRequest";
import type { Rule } from "../rules/types";

// Real fetchPullRequest() output, see __fixtures__/SOURCES.md
const REAL_PR: PullRequestData = JSON.parse(
    readFileSync(path.join(import.meta.dirname, "__fixtures__", "stdlib-pr-15585.json"), "utf8")
);

// The real rule try-rules found for stdlib (from its commit history)
const STDLIB_HISTORY_RULE: Rule = {
    type: "conventional-commits",
    details: { appliesTo: "pr-title", allowedTypes: null },
    confidence: "history",
    sourceQuote:
        "41 of the last 41 commits (not counting merges and bots) follow Conventional Commits; " +
        "most were written when the PR was merged, so the PR title matters most",
    sourceUrl: "https://github.com/stdlib-js/stdlib/commits/0695f035b77cb48eb223ed45f430e1e94cfe2554",
};

// A commitlint config rule (checks every commit, red when broken)
const COMMITLINT_RULE: Rule = {
    type: "conventional-commits",
    details: { appliesTo: "commits", allowedTypes: ["feat", "fix", "docs"] },
    confidence: "config",
    sourceQuote: '"@commitlint/config-conventional",',
    sourceUrl: "https://github.com/acme/app/blob/main/package.json?plain=1#L81",
};

function pr(parts: Partial<PullRequestData>): PullRequestData {
    return { ...REAL_PR, ...parts };
}

function commit(sha: string, message: string) {
    return { sha, message, authorName: "Jane", authorLogin: "jane", hasSignOff: false };
}

describe("checkCommitFormat: real stdlib PR #15585", () => {
    it("checks the PR title (stdlib's rule is about the title) and it passes", () => {
        expect(checkCommitFormat([STDLIB_HISTORY_RULE], REAL_PR)).toEqual([
            {
                id: "commit-format:pr-title",
                ruleType: "conventional-commits",
                stage: "pr",
                status: "pass",
                message: "The PR title follows Conventional Commits.",
                howToFix: [],
                evidence: {
                    rules: [
                        {
                            sourceQuote: STDLIB_HISTORY_RULE.sourceQuote,
                            sourceUrl: STDLIB_HISTORY_RULE.sourceUrl,
                            confidence: "history",
                        },
                    ],
                    observed: ['PR title "fix: resolve incorrect Rayleigh MGF values via erfcx formulation"'],
                },
            },
        ]);
    });

    it("its 3 real commits would also pass a commitlint rule", () => {
        const [check] = checkCommitFormat([COMMITLINT_RULE], REAL_PR);
        expect(check).toMatchObject({ id: "commit-format:commits", stage: "commit", status: "pass" });
        expect(check.message).toBe("All 3 commit messages follow Conventional Commits.");
    });
});

describe("checkCommitFormat: failures", () => {
    it("red for a config rule, naming each bad commit and why", () => {
        const [check] = checkCommitFormat(
            [COMMITLINT_RULE],
            pr({
                commits: [
                    commit("a1b2c3d4e5", "fix: typo"),
                    commit("b2c3d4e5f6", "Update README"),
                    commit("c3d4e5f6a7", "feature: add login"),
                    commit("d4e5f6a7b8", "Merge branch 'main' into fix-typo"),
                ],
            })
        );
        expect(check.status).toBe("fail");
        expect(check.message).toBe('2 of 3 commit messages don\'t follow Conventional Commits ("type: description").');
        expect(check.evidence.observed).toEqual([
            'Commit b2c3d4e "Update README": it should start with a lowercase type, a colon and a space, like "fix: ..."',
            'Commit c3d4e5f "feature: add login": type "feature" is not allowed here',
        ]);
        expect(check.howToFix).toEqual([
            "Open your commits for editing: git rebase -i HEAD~3",
            'Change "pick" to "reword" for the commits listed below, save, and write new messages.',
            "Allowed types: feat, fix, docs",
            "Update the PR: git push --force-with-lease",
        ]);
    });

    it("suggests --amend for a single commit", () => {
        const [check] = checkCommitFormat([COMMITLINT_RULE], pr({ commits: [commit("a1b2c3d", "Fixed it")] }));
        expect(check.howToFix[0]).toBe('Rewrite the message: git commit --amend -m "fix: short description"');
    });

    it("yellow for a history rule on the PR title", () => {
        const [check] = checkCommitFormat([STDLIB_HISTORY_RULE], pr({ title: "Rayleigh MGF fix" }));
        expect(check.status).toBe("warn");
        expect(check.howToFix[0]).toBe('On the PR page, click "Edit" next to the title.');
    });

    it("makes two checks when rules cover both commits and the title", () => {
        const checks = checkCommitFormat([COMMITLINT_RULE, STDLIB_HISTORY_RULE], REAL_PR);
        expect(checks.map((c) => c.id)).toEqual(["commit-format:commits", "commit-format:pr-title"]);
    });

    it("uses the type list from the strongest rule that has one", () => {
        const noList: Rule = { ...COMMITLINT_RULE, details: { appliesTo: "commits", allowedTypes: null } };
        const [check] = checkCommitFormat([noList], pr({ commits: [commit("a1b2c3d", "feature: x")] }));
        // No list anywhere: any lowercase type is fine
        expect(check.status).toBe("pass");
    });

    it("skips when there is no format rule", () => {
        const [check] = checkCommitFormat([], REAL_PR);
        expect(check).toMatchObject({ id: "commit-format", status: "skip" });
    });
});
