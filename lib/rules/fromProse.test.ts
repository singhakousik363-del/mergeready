import { readFileSync } from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { extractProseRules } from "./fromProse";
import type { Rule } from "./types";

// Real docs, see __fixtures__/SOURCES.md
function fixture(name: string): string {
    return readFileSync(path.join(import.meta.dirname, "__fixtures__", name), "utf8");
}

const FILE_URL = "https://github.com/acme/app/blob/main/CONTRIBUTING.md";

function rulesFor(text: string): Rule[] {
    return extractProseRules([{ text, fileUrl: FILE_URL }]);
}

// [type, line] pairs, easy to compare with the real file
function summary(rules: Rule[]): [string, string][] {
    return rules.map((r) => [r.type, new URL(r.sourceUrl).hash]);
}

describe("extractProseRules: nodejs/node", () => {
    it("finds sign-off, issue link and tests in doc/contributing/pull-requests.md", () => {
        const rules = rulesFor(fixture("node-pull-requests.md"));

        expect(summary(rules)).toEqual([
            ["linked-issue", "#L184"],
            ["dco-signoff", "#L201"],
            ["dco-signoff", "#L203"],
            ["tests-changed", "#L247"],
        ]);
        expect(rules[1]).toEqual({
            type: "dco-signoff",
            details: null,
            confidence: "prose",
            sourceQuote:
                "Your commit must contain the `Signed-off-by` line with your name and email " +
                "address as an acknowledgement that you agree to the [Developer Certificate of Origin][].",
            sourceUrl: `${FILE_URL}?plain=1#L201`,
        });
    });

    it("does not treat reviewer 'sign off' as DCO", () => {
        // Line 347: All pull requests require "sign off" in order to land.
        const rules = rulesFor(fixture("node-pull-requests.md"));
        expect(rules.some((r) => r.sourceQuote.includes('require "sign off"'))).toBe(false);
    });

    it("does not see Conventional Commits in Node's 'subsystem: message' format", () => {
        const rules = rulesFor(fixture("node-pull-requests.md"));
        expect(rules.some((r) => r.type === "conventional-commits")).toBe(false);
    });

    it("finds nothing in CONTRIBUTING.md (the DCO text there is in a code block)", () => {
        expect(rulesFor(fixture("node-contributing.md"))).toEqual([]);
    });
});

describe("extractProseRules: stdlib-js/stdlib", () => {
    it("finds the tests rule but no DCO rule from the certificate text", () => {
        const rules = rulesFor(fixture("stdlib-contributing.md"));

        expect(summary(rules)).toEqual([
            ["tests-changed", "#L241"],
            // A how-to step under "Writing Tests": weak, but really about adding tests
            ["tests-changed", "#L350"],
        ]);
        expect(rules[0].sourceQuote).toBe("Tests should accompany **all** bug fixes and features.");
    });

    it("misses the commit rules, which live in a linked folder (known limitation)", () => {
        // "When writing commit messages, follow the Git [style guide][...]." names no format
        const rules = rulesFor(fixture("stdlib-contributing.md"));
        expect(rules.some((r) => r.type === "conventional-commits")).toBe(false);
    });
});

describe("extractProseRules: conventional-changelog/commitlint", () => {
    it("reads a list item as a rule because the text above it says 'enforced'", () => {
        const rules = rulesFor(fixture("commitlint-contributing.md"));

        expect(summary(rules)).toEqual([
            ["conventional-commits", "#L66"],
            ["tests-changed", "#L109"],
        ]);
        expect(rules[0].sourceQuote).toBe("message format of `$type($scope): $message`");
    });
});

describe("extractProseRules: processing/p5.js", () => {
    it("finds 'get assigned' rules, including one written as a heading", () => {
        const rules = rulesFor(fixture("p5-contributing.md"));

        expect(summary(rules)).toEqual([
            ["issue-assigned", "#L15"],
            ["issue-assigned", "#L17"],
            ["tests-changed", "#L27"],
            ["tests-changed", "#L29"],
        ]);
        expect(rules[0].sourceQuote).toBe("Get Assigned Before Working on an Issue");
    });

    it("skips 'including unit tests if applicable'", () => {
        const rules = rulesFor(fixture("p5-contributing.md"));
        expect(rules.some((r) => r.sourceQuote.includes("if applicable"))).toBe(false);
    });
});

describe("extractProseRules: small cases", () => {
    it("needs an obligation, not just the topic", () => {
        expect(rulesFor("We use Conventional Commits.")).toEqual([]);
        expect(rulesFor("You must use Conventional Commits.")).toHaveLength(1);
    });

    it("knows when Conventional Commits is about the PR title only", () => {
        const [commits] = rulesFor("Commit messages must follow Conventional Commits.");
        const [title] = rulesFor("PR titles must follow Conventional Commits.");
        expect(commits.details).toEqual({ appliesTo: "commits", allowedTypes: null });
        expect(title.details).toEqual({ appliesTo: "pr-title", allowedTypes: null });
    });

    it("skips negated sentences", () => {
        expect(rulesFor("A DCO sign-off is not required.")).toEqual([]);
    });

    it("does not count 'make sure tests pass' as adding tests", () => {
        expect(rulesFor("Please make sure all tests pass.")).toEqual([]);
    });

    it("a sentence can match two rule types", () => {
        const rules = rulesFor("Please add tests and reference the related issue.");
        expect(rules.map((r) => r.type)).toEqual(["linked-issue", "tests-changed"]);
    });

    it("reads several docs and links each rule to its own file", () => {
        const other = "https://github.com/acme/app/blob/main/docs/pr.md";
        const rules = extractProseRules([
            { text: "# Hi", fileUrl: FILE_URL },
            { text: "\n\nPlease add tests.", fileUrl: other },
        ]);
        expect(rules.map((r) => r.sourceUrl)).toEqual([`${other}?plain=1#L3`]);
    });

    it("returns nothing for no docs or empty docs", () => {
        expect(extractProseRules([])).toEqual([]);
        expect(rulesFor("")).toEqual([]);
    });
});
