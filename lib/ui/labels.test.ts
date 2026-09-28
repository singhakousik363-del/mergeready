import { describe, it, expect } from "vitest";
import { RULE_TYPE_LABEL, SOURCE_GROUPS, STAGE_LABEL, STATUS_LABEL, ruleDetail, sourceLabel } from "./labels";

describe("labels", () => {
    it("every status has a word (never colour alone)", () => {
        expect(STATUS_LABEL).toEqual({
            pass: "Good",
            fail: "Fix this",
            warn: "Look at this",
            manual: "Check yourself",
            pending: "Waiting",
            skip: "Not checked",
        });
    });

    it("names the five stages and six rule types", () => {
        expect(Object.values(STAGE_LABEL)).toEqual(["Issue", "Work", "Commit", "PR", "Merge"]);
        expect(Object.keys(RULE_TYPE_LABEL)).toHaveLength(6);
    });

    it("groups rules by source, strongest first", () => {
        expect(SOURCE_GROUPS.map((g) => g.confidence)).toEqual(["config", "template", "history", "prose"]);
    });
});

describe("sourceLabel (real rules from try-rules)", () => {
    it("config and template", () => {
        expect(
            sourceLabel({ confidence: "config", sourceQuote: '"@commitlint/config-conventional",', sourceUrl: "https://github.com/conventional-changelog/commitlint/blob/master/package.json?plain=1#L81" })
        ).toBe("Repo config");
        expect(
            sourceLabel({ confidence: "template", sourceQuote: "Resolves #{{TODO: add issue number}}.", sourceUrl: "https://github.com/stdlib-js/stdlib/blob/develop/.github/PULL_REQUEST_TEMPLATE.md?plain=1#L1" })
        ).toBe("PR template");
    });

    it("history shows the count from the quote", () => {
        expect(
            sourceLabel({
                confidence: "history",
                sourceQuote: "41 of the last 41 commits (not counting merges and bots) follow Conventional Commits; most were written when the PR was merged, so the PR title matters most",
                sourceUrl: "https://github.com/stdlib-js/stdlib/commits/0695f035b77cb48eb223ed45f430e1e94cfe2554",
            })
        ).toBe("Commit history: 41 of 41 commits");
        expect(sourceLabel({ confidence: "history", sourceQuote: "odd", sourceUrl: "x" })).toBe("Commit history");
    });

    it("prose says CONTRIBUTING or names the linked doc", () => {
        expect(
            sourceLabel({ confidence: "prose", sourceQuote: "Tests should accompany **all** bug fixes and features.", sourceUrl: "https://github.com/stdlib-js/stdlib/blob/develop/CONTRIBUTING.md?plain=1#L241" })
        ).toBe("CONTRIBUTING text");
        expect(
            sourceLabel({ confidence: "prose", sourceQuote: "Your commit must contain the `Signed-off-by` line", sourceUrl: "https://github.com/nodejs/node/blob/main/doc/contributing/pull-requests.md?plain=1#L201" })
        ).toBe("Docs: pull-requests.md");
        expect(sourceLabel({ confidence: "prose", sourceQuote: "x", sourceUrl: "not a url" })).toBe("CONTRIBUTING text");
    });
});

describe("ruleDetail", () => {
    const base = { confidence: "template" as const, sourceQuote: "x", sourceUrl: "y", strict: false };

    it("describes commit format rules", () => {
        expect(ruleDetail({ ...base, type: "conventional-commits", details: { format: "conventional", appliesTo: "pr-title", allowedTypes: null } })).toBe(
            "Applies to the PR title"
        );
        expect(ruleDetail({ ...base, type: "conventional-commits", details: { format: "conventional", appliesTo: "commits", allowedTypes: ["feat", "fix"] } })).toBe(
            "Applies to every commit message; types: feat, fix"
        );
    });

    it("describes template sections and checkboxes", () => {
        expect(ruleDetail({ ...base, type: "pr-template", details: { kind: "section", heading: "Disclosure", templateText: "", requirement: "optional" } })).toBe(
            'Section "Disclosure" (optional)'
        );
        expect(
            ruleDetail({
                ...base,
                type: "pr-template",
                details: { kind: "checkbox", text: "Yes", heading: "AI Assistance", groupId: 2, requirement: "unknown" },
            })
        ).toBe('Checkbox "Yes": the template doesn\'t say');
    });

    it("uses the rule type name for the rest", () => {
        expect(ruleDetail({ ...base, type: "dco-signoff", details: null })).toBe("DCO sign-off");
    });
});
