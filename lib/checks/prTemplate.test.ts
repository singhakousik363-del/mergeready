import { readFileSync } from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { checkPrTemplate } from "./prTemplate";
import { extractTemplateRules } from "../rules/fromTemplate";
import type { PullRequestData } from "../github/fetchPullRequest";
import type { Check } from "./types";

const REAL_PR: PullRequestData = JSON.parse(
    readFileSync(path.join(import.meta.dirname, "__fixtures__", "stdlib-pr-15585.json"), "utf8")
);

// Real templates from the rules fixtures
function template(name: string): string {
    return readFileSync(path.join(import.meta.dirname, "..", "rules", "__fixtures__", name), "utf8");
}

const STDLIB_TEMPLATE = template("stdlib-pr-template.md");
const STDLIB_RULES = extractTemplateRules(STDLIB_TEMPLATE, "https://github.com/stdlib-js/stdlib/blob/develop/.github/PULL_REQUEST_TEMPLATE.md");
const COMMITLINT_TEMPLATE = template("commitlint-pr-template.md");
const COMMITLINT_RULES = extractTemplateRules(COMMITLINT_TEMPLATE, "https://github.com/conventional-changelog/commitlint/blob/master/.github/PULL_REQUEST_TEMPLATE.md");

function statuses(checks: Check[]): [string, string][] {
    return checks.map((c) => [c.id, c.status]);
}

function withBody(body: string): PullRequestData {
    return { ...REAL_PR, body };
}

describe("checkPrTemplate: real stdlib PR #15585 against stdlib's real template", () => {
    const checks = checkPrTemplate(STDLIB_RULES, REAL_PR);

    it("every section is filled; required box ticked; Yes/No is manual; optional group passes", () => {
        expect(statuses(checks)).toEqual([
            ["template-section:Description", "pass"],
            ["template-section:Related Issues", "pass"],
            ["template-section:Questions", "pass"],
            ["template-section:Other", "pass"],
            ["template-section:Disclosure", "pass"],
            ["template-checkboxes:1", "pass"],
            ["template-checkboxes:2", "manual"],
            ["template-checkboxes:3", "pass"],
        ]);
        expect(checks.every((c) => c.stage === "pr")).toBe(true);
    });

    it("matches the ticked box although the PR changed the link and dropped the final '.'", () => {
        const checklist = checks.find((c) => c.id === "template-checkboxes:1");
        expect(checklist?.message).toBe('"Checklist" checkboxes: all required boxes are ticked.');
        expect(checklist?.evidence.observed).toEqual(["[x] Read, understood, and followed the contributing guidelines."]);
    });

    it("shows what was ticked in the unknown Yes/No group", () => {
        const ai = checks.find((c) => c.id === "template-checkboxes:2");
        expect(ai?.message).toBe(
            '"AI Assistance" checkboxes: the template doesn\'t say which boxes you must tick. Check them yourself.'
        );
        expect(ai?.evidence.observed).toEqual(["[x] Yes", "[ ] No"]);
    });
});

describe("checkPrTemplate: stdlib's template pasted in without changes", () => {
    const checks = checkPrTemplate(STDLIB_RULES, withBody(STDLIB_TEMPLATE));

    it("red for {{TODO}} placeholders, manual when the text is just the template's, yellow for an optional placeholder", () => {
        expect(statuses(checks)).toEqual([
            ["template-section:Description", "fail"],
            ["template-section:Related Issues", "fail"],
            // The template already answers "No.", which may be the right answer
            ["template-section:Questions", "manual"],
            ["template-section:Other", "manual"],
            ["template-section:Disclosure", "warn"],
            ["template-checkboxes:1", "fail"],
            ["template-checkboxes:2", "manual"],
            ["template-checkboxes:3", "pass"],
        ]);
    });

    it("names the placeholder to replace", () => {
        const description = checks.find((c) => c.id === "template-section:Description");
        expect(description?.howToFix).toEqual([
            "Replace {{TODO: add description describing what this pull request does}} with your own words.",
        ]);
    });

    it("never tells the user to just tick a box: do what it says first", () => {
        const checklist = checks.find((c) => c.id === "template-checkboxes:1");
        expect(checklist?.howToFix[0]).toBe(
            "Do what each box says first. Only then edit the PR description and change [ ] to [x]."
        );
    });
});

describe("checkPrTemplate: commitlint's template (comment-only sections, pick-one group)", () => {
    it("empty sections are red, and nothing ticked in 'Types of changes' is red", () => {
        const checks = checkPrTemplate(COMMITLINT_RULES, withBody(COMMITLINT_TEMPLATE));
        expect(statuses(checks)).toEqual([
            ["template-section:Description", "fail"],
            ["template-section:Motivation and Context", "fail"],
            // Its code example is plain text, not a comment, and it's unchanged
            ["template-section:Usage examples", "manual"],
            ["template-section:How Has This Been Tested?", "fail"],
            ["template-checkboxes:1", "fail"],
            ["template-checkboxes:2", "pass"],
        ]);
    });

    it("one ticked type is enough", () => {
        const body = COMMITLINT_TEMPLATE.replace("- [ ] Bug fix", "- [x] Bug fix");
        const types = checkPrTemplate(COMMITLINT_RULES, withBody(body)).find((c) => c.id === "template-checkboxes:1");
        expect(types?.status).toBe("pass");
    });
});

describe("checkPrTemplate: edge cases", () => {
    it("a deleted section is 'missing', a deleted box is shown as missing", () => {
        const checks = checkPrTemplate(STDLIB_RULES, withBody("## Description\n\nFixes a bug."));
        expect(checks.find((c) => c.id === "template-section:Other")?.message).toBe(
            'The "Other" section from the template is missing.'
        );
        expect(checks.find((c) => c.id === "template-section:Disclosure")?.status).toBe("pass");
        expect(checks.find((c) => c.id === "template-checkboxes:1")?.evidence.observed).toEqual([
            "(missing) Read, understood, and followed the contributing guidelines.",
        ]);
    });

    it("skips when the repo has no template", () => {
        expect(checkPrTemplate([], REAL_PR)).toEqual([
            {
                id: "pr-template",
                ruleType: "pr-template",
                stage: "pr",
                status: "skip",
                message: "This repo has no PR template.",
                howToFix: [],
                evidence: { rules: [], observed: [] },
            },
        ]);
    });
});
