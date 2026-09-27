import { readFileSync } from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { checkDcoSignoff } from "./dcoSignoff";
import type { PullRequestData } from "../github/fetchPullRequest";
import type { Rule } from "../rules/types";

// Real fetchPullRequest() output, see __fixtures__/SOURCES.md
const REAL_PR: PullRequestData = JSON.parse(
    readFileSync(path.join(import.meta.dirname, "__fixtures__", "stdlib-pr-15585.json"), "utf8")
);

// Real rules found by try-rules
const NODE_PROSE_RULE: Rule = {
    type: "dco-signoff",
    details: null,
    confidence: "prose",
    sourceQuote:
        "Your commit must contain the `Signed-off-by` line with your name and email address as an acknowledgement that you agree to the [Developer Certificate of Origin][].",
    sourceUrl: "https://github.com/nodejs/node/blob/main/doc/contributing/pull-requests.md?plain=1#L201",
};
const FLYTE_CONFIG_RULE: Rule = {
    type: "dco-signoff",
    details: null,
    confidence: "config",
    sourceQuote: "require:",
    sourceUrl: "https://github.com/flyteorg/flyte/blob/main/.github/dco.yml?plain=1#L1",
};

describe("checkDcoSignoff", () => {
    it("skips stdlib PR #15585: stdlib has no DCO rule, even though no commit is signed off", () => {
        expect(checkDcoSignoff([], REAL_PR)).toMatchObject({ id: "dco-signoff", stage: "commit", status: "skip" });
    });

    it("with a config rule, the same real commits are red, each listed by SHA", () => {
        const check = checkDcoSignoff([FLYTE_CONFIG_RULE], REAL_PR);

        expect(check.status).toBe("fail");
        expect(check.message).toBe('3 of 3 commits have no "Signed-off-by" line. This repo needs one on every commit.');
        expect(check.evidence.observed).toEqual([
            'Commit 7700073 "fix: resolve incorrect Rayleigh MGF values via erfcx formulation" has no Signed-off-by line',
            'Commit 1eec69e "fix: resolve lint errors in Rayleigh MGF files" has no Signed-off-by line',
            'Commit 2077076 "fix: resolve remaining lint errors in Rayleigh MGF files" has no Signed-off-by line',
        ]);
        expect(check.howToFix).toEqual([
            "Check your name and email: git config user.name && git config user.email",
            "Add the sign-off to all 3 commits: git rebase --signoff HEAD~3",
            "Update the PR: git push --force-with-lease",
            "Next time, use git commit -s to sign off as you commit.",
        ]);
    });

    it("is yellow for a prose rule and suggests --amend for one commit", () => {
        const one = { ...REAL_PR, commits: REAL_PR.commits.slice(0, 1) };
        const check = checkDcoSignoff([NODE_PROSE_RULE], one);
        expect(check.status).toBe("warn");
        expect(check.howToFix[1]).toBe("Add the sign-off to your commit: git commit --amend -s --no-edit");
    });

    it("passes when every commit is signed off, ignoring merge commits", () => {
        const commits = [
            { ...REAL_PR.commits[0], hasSignOff: true },
            { ...REAL_PR.commits[1], message: "Merge branch 'develop' into fix", hasSignOff: false },
        ];
        const check = checkDcoSignoff([FLYTE_CONFIG_RULE], { ...REAL_PR, commits });
        expect(check).toMatchObject({ status: "pass", message: "The commit is signed off." });
    });

    it("shows the strongest rule first in the evidence", () => {
        const check = checkDcoSignoff([NODE_PROSE_RULE, FLYTE_CONFIG_RULE], REAL_PR);
        expect(check.evidence.rules.map((r) => r.confidence)).toEqual(["config", "prose"]);
        expect(check.status).toBe("fail");
    });
});
