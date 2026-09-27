import { readFileSync } from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { extractTemplateRules } from "./fromTemplate";
import type { PrTemplateDetails, Rule } from "./types";

// Real templates, see __fixtures__/SOURCES.md
function fixture(name: string): string {
    return readFileSync(path.join(import.meta.dirname, "__fixtures__", name), "utf8");
}

const URL = "https://github.com/acme/app/blob/main/.github/PULL_REQUEST_TEMPLATE.md";

type Checkbox = Extract<PrTemplateDetails, { kind: "checkbox" }>;
type TemplateSection = Extract<PrTemplateDetails, { kind: "section" }>;

function checkboxes(rules: Rule[]): (Checkbox & { quote: string })[] {
    return rules.flatMap((r) =>
        r.type === "pr-template" && r.details.kind === "checkbox" ? [{ ...r.details, quote: r.sourceQuote }] : []
    );
}

function sections(rules: Rule[]): TemplateSection[] {
    return rules.flatMap((r) => (r.type === "pr-template" && r.details.kind === "section" ? [r.details] : []));
}

function requirementOf(rules: Rule[], textStart: string): string | undefined {
    return checkboxes(rules).find((c) => c.text.startsWith(textStart))?.requirement;
}

describe("extractTemplateRules: stdlib-js/stdlib", () => {
    const rules = extractTemplateRules(fixture("stdlib-pr-template.md"), URL);

    it("makes the Checklist box required ('before submitting')", () => {
        expect(requirementOf(rules, "Read, understood, and followed")).toBe("required");
        const box = rules.find((r) => r.sourceQuote.startsWith("Read, understood"));
        // Quote is exact (markdown kept), and the link points at the line
        expect(box?.sourceQuote).toBe("Read, understood, and followed the [contributing guidelines][contributing].");
        expect(box?.sourceUrl).toBe(`${URL}?plain=1#L35`);
    });

    it("does not let '## Checklist' make the '### AI Assistance' Yes/No boxes required", () => {
        expect(requirementOf(rules, "Yes")).toBe("unknown");
        expect(requirementOf(rules, "No")).toBe("unknown");
    });

    it("makes boxes under a visible 'If you answered yes...' line optional", () => {
        expect(requirementOf(rules, "Code generation")).toBe("optional");
        expect(requirementOf(rules, "Research and understanding")).toBe("optional");
    });

    it("puts boxes next to each other in the same group", () => {
        const groups = checkboxes(rules).map((c) => c.groupId);
        expect(groups).toEqual([1, 2, 2, 3, 3, 3, 3]);
    });

    it("lists sections without checkboxes, with their template text", () => {
        expect(sections(rules).map((s) => [s.heading, s.optional])).toEqual([
            ["Description", false],
            ["Related Issues", false],
            ["Questions", false],
            ["Other", false],
            // First sentence: "If you answered "yes" to using AI assistance, ..."
            ["Disclosure", true],
        ]);
        expect(sections(rules)[2].templateText).toBe("Any questions for reviewers of this pull request?\nNo.");
    });

    it("finds the 'Resolves #' field", () => {
        expect(rules.filter((r) => r.type === "linked-issue")).toEqual([
            {
                type: "linked-issue",
                details: null,
                confidence: "template",
                sourceQuote: "Resolves #{{TODO: add issue number}}.",
                sourceUrl: `${URL}?plain=1#L1`,
            },
        ]);
    });
});

describe("extractTemplateRules: conventional-changelog/commitlint", () => {
    const rules = extractTemplateRules(fixture("commitlint-pr-template.md"), URL);

    it("'Types of changes' is pick-one even though it says 'all the boxes that apply'", () => {
        expect(requirementOf(rules, "Bug fix")).toBe("pick-at-least-one");
        expect(requirementOf(rules, "Breaking change")).toBe("pick-at-least-one");
    });

    it("'Checklist:' is optional because it says 'all the boxes that apply' (optional beats required)", () => {
        const checklist = checkboxes(rules).filter((c) => c.groupId === 2);
        expect(checklist).toHaveLength(6);
        expect(checklist.every((c) => c.requirement === "optional")).toBe(true);
    });

    it("skips the code example and the conditional issue request", () => {
        expect(sections(rules).map((s) => s.heading)).toEqual([
            "Description",
            "Motivation and Context",
            "Usage examples",
            "How Has This Been Tested?",
        ]);
        expect(sections(rules)[2].templateText).not.toContain("module.exports");
        // Only "If it fixes an open issue, please link to the issue here." (in a comment)
        expect(rules.some((r) => r.type === "linked-issue")).toBe(false);
    });
});

describe("extractTemplateRules: home-assistant/core ('Type of change' template)", () => {
    const rules = extractTemplateRules(fixture("home-assistant-pr-template.md"), URL);

    it("'Type of change' + 'check only 1! box' is pick-one", () => {
        const types = checkboxes(rules).filter((c) => c.groupId === 1);
        expect(types).toHaveLength(7);
        expect(types.every((c) => c.requirement === "pick-at-least-one")).toBe(true);
    });

    it("'Checklist' boxes are required ('the boxes that apply' has no 'all')", () => {
        expect(requirementOf(rules, "I understand the code I am submitting")).toBe("required");
        expect(requirementOf(rules, "Tests have been added")).toBe("required");
    });

    it("boxes under 'If ...:' lines inside the Checklist are optional", () => {
        expect(requirementOf(rules, "Documentation added/updated")).toBe("optional");
        expect(requirementOf(rules, "The manifest file has all fields")).toBe("optional");
        expect(requirementOf(rules, "For the updated dependencies")).toBe("optional");
    });

    it("joins a checkbox's continuation line", () => {
        const manifest = checkboxes(rules).find((c) => c.text.startsWith("The manifest file"));
        expect(manifest?.quote).toBe(
            "The [manifest file][manifest-docs] has all fields filled out correctly. " +
                "Updated and included derived files by running: `python3 -m script.hassfest`."
        );
    });

    it("known quirk: 'try to choose one' in a comment makes the last single box pick-one", () => {
        // With one box, pick-at-least-one means the same as required
        expect(requirementOf(rules, "I have reviewed two other")).toBe("pick-at-least-one");
    });

    it("marks 'Remove this section if...' and 'if applicable' sections optional", () => {
        expect(sections(rules).map((s) => [s.heading, s.optional])).toEqual([
            ["Breaking change", true],
            ["Proposed change", false],
            ["Additional information", true],
        ]);
    });

    it("finds the 'fixes #' field inside a list", () => {
        const issue = rules.find((r) => r.type === "linked-issue");
        expect(issue?.sourceQuote).toBe("This PR fixes or closes issue: fixes #");
        expect(issue?.sourceUrl).toBe(`${URL}?plain=1#L46`);
    });
});

describe("extractTemplateRules: nodejs/node", () => {
    it("finds nothing in a template that is only a comment", () => {
        // Its "Include tests..." instructions are in a comment. Node's
        // pull-requests.md says the same, which the prose matcher reads.
        expect(extractTemplateRules(fixture("node-pr-template.md"), URL)).toEqual([]);
    });
});

describe("extractTemplateRules: small cases", () => {
    it("returns nothing for an empty template", () => {
        expect(extractTemplateRules("", URL)).toEqual([]);
    });

    it("marks a single box optional when its own text says so", () => {
        const rules = extractTemplateRules("## Checklist\n\n- [ ] Tests pass\n- [ ] Screenshots (if applicable)", URL);
        expect(checkboxes(rules).map((c) => c.requirement)).toEqual(["required", "optional"]);
    });

    it("uses 'unknown' when nothing says how to tick", () => {
        const rules = extractTemplateRules("## Platforms\n\n- [ ] Linux\n- [ ] macOS", URL);
        expect(checkboxes(rules).map((c) => c.requirement)).toEqual(["unknown", "unknown"]);
    });

    it("pick-one beats required: 'Checklist' + 'select one'", () => {
        const rules = extractTemplateRules("## Checklist\n\nSelect one:\n\n- [ ] A\n- [ ] B", URL);
        expect(checkboxes(rules).map((c) => c.requirement)).toEqual(["pick-at-least-one", "pick-at-least-one"]);
    });

    it("a plain request to link the issue is a linked-issue rule", () => {
        const rules = extractTemplateRules("Please link to the related issue.", URL);
        expect(rules).toEqual([
            expect.objectContaining({ type: "linked-issue", sourceQuote: "Please link to the related issue." }),
        ]);
    });
});
