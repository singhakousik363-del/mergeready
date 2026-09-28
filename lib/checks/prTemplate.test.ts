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

    it("yellow for {{TODO}} placeholders (no section is marked required), manual when the text is just the template's", () => {
        expect(statuses(checks)).toEqual([
            ["template-section:Description", "warn"],
            ["template-section:Related Issues", "warn"],
            // The template already answers "No.", which may be the right answer
            ["template-section:Questions", "manual"],
            ["template-section:Other", "manual"],
            ["template-section:Disclosure", "warn"],
            // Required box, but "Please ensure..." is advice, not "must": yellow
            ["template-checkboxes:1", "warn"],
            ["template-checkboxes:2", "manual"],
            ["template-checkboxes:3", "pass"],
        ]);
    });

    it("names the placeholder to replace", () => {
        const description = checks.find((c) => c.id === "template-section:Description");
        expect(description?.howToFix).toEqual([
            { text: "Replace {{TODO: add description describing what this pull request does}} with your own words, or delete the section." },
        ]);
    });

    it("never tells the user to just tick a box: do what it says first", () => {
        const checklist = checks.find((c) => c.id === "template-checkboxes:1");
        expect(checklist?.howToFix[0]).toEqual({
            text: "Do what each box says first. Only then edit the PR description and change [ ] to [x].",
        });
        // Nothing here is a command to copy
        expect(checklist?.howToFix.every((step) => step.command === undefined)).toBe(true);
    });
});

describe("checkPrTemplate: commitlint's template (comment-only sections, pick-one group)", () => {
    it("empty unmarked sections are skipped; nothing ticked in 'Types of changes' is yellow (no 'must')", () => {
        const checks = checkPrTemplate(COMMITLINT_RULES, withBody(COMMITLINT_TEMPLATE));
        expect(statuses(checks)).toEqual([
            ["template-section:Description", "skip"],
            ["template-section:Motivation and Context", "skip"],
            // Its code example is plain text, not a comment, and it's unchanged
            ["template-section:Usage examples", "manual"],
            ["template-section:How Has This Been Tested?", "skip"],
            ["template-checkboxes:1", "warn"],
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
    it("a deleted unmarked section is fine, a deleted box is shown as missing", () => {
        const checks = checkPrTemplate(STDLIB_RULES, withBody("## Description\n\nFixes a bug."));
        expect(checks.find((c) => c.id === "template-section:Other")).toMatchObject({
            status: "skip",
            message: 'The template doesn\'t say the "Other" section is required.',
        });
        expect(checks.find((c) => c.id === "template-section:Disclosure")?.status).toBe("pass");
        expect(checks.find((c) => c.id === "template-checkboxes:1")?.evidence.observed).toEqual([
            "(missing) Read, understood, and followed the contributing guidelines.",
        ]);
    });

    it("a section marked '(required)' is red when missing or empty, and for a leftover placeholder", () => {
        const rules = extractTemplateRules("## Description (required)\n\n{{TODO: describe}}", "https://github.com/acme/app/blob/main/.github/PULL_REQUEST_TEMPLATE.md");
        const status = (body: string) => checkPrTemplate(rules, withBody(body))[0];
        expect(status("Fixes a bug.")).toMatchObject({ status: "fail", message: 'The "Description (required)" section from the template is missing.' });
        expect(status("## Description (required)\n\n").status).toBe("fail");
        expect(status("## Description (required)\n\n{{TODO: describe}}").status).toBe("fail");
        expect(status("## Description (required)\n\nFixes a bug.").status).toBe("pass");
    });

    it("a required group is red only when a strict box is still unticked", () => {
        const rules = extractTemplateRules(
            "## Checklist\n\n- [ ] Local tests pass. Your PR cannot be merged unless tests pass\n- [ ] Docs updated",
            "https://github.com/acme/app/blob/main/.github/PULL_REQUEST_TEMPLATE.md"
        );
        const group = (body: string) => checkPrTemplate(rules, withBody(body))[0].status;
        expect(group("- [ ] Local tests pass. Your PR cannot be merged unless tests pass\n- [x] Docs updated")).toBe("fail");
        expect(group("- [x] Local tests pass. Your PR cannot be merged unless tests pass\n- [ ] Docs updated")).toBe("warn");
    });

    it("skips when there are no template rules", () => {
        expect(checkPrTemplate([], REAL_PR)).toEqual([
            {
                id: "pr-template",
                ruleType: "pr-template",
                stage: "pr",
                status: "skip",
                message: "We found no PR template rules to check.",
                howToFix: [],
                evidence: { rules: [], observed: [] },
            },
        ]);
    });
});
