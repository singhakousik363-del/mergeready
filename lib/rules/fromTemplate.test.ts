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

function checkboxesStrict(rules: Rule[]): boolean[] {
    return rules.flatMap((r) => (r.type === "pr-template" && r.details.kind === "checkbox" ? [r.strict] : []));
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
        // Nothing visible says a section is required, so they are "unmarked"
        expect(sections(rules).map((s) => [s.heading, s.requirement])).toEqual([
            ["Description", "unmarked"],
            ["Related Issues", "unmarked"],
            ["Questions", "unmarked"],
            ["Other", "unmarked"],
            // First sentence: "If you answered "yes" to using AI assistance, ..."
            ["Disclosure", "optional"],
        ]);
        expect(sections(rules)[2].templateText).toBe("Any questions for reviewers of this pull request?\nNo.");
    });

    it("finds the 'Resolves #' field, not strict (no 'must' or 'required')", () => {
        expect(rules.filter((r) => r.type === "linked-issue")).toEqual([
            {
                type: "linked-issue",
                details: null,
                confidence: "template",
                sourceQuote: "Resolves #{{TODO: add issue number}}.",
                sourceUrl: `${URL}?plain=1#L1`,
                strict: false,
            },
        ]);
    });

    it("the Checklist box is not strict: 'Please ensure...' is advice, not 'must'", () => {
        const box = rules.find((r) => r.sourceQuote.startsWith("Read, understood"));
        expect(box?.strict).toBe(false);
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

    it("keeps the code example in templateText and skips the conditional issue request", () => {
        expect(sections(rules).map((s) => s.heading)).toEqual([
            "Description",
            "Motivation and Context",
            "Usage examples",
            "How Has This Been Tested?",
        ]);
        // Code is part of the template's text, so a PR that leaves it unchanged can be spotted
        expect(sections(rules)[2].templateText).toContain("module.exports = {};");
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

    it("only the box that says 'cannot be merged' is strict", () => {
        const strict = rules.filter((r) => r.strict).map((r) => r.sourceQuote);
        expect(strict).toEqual(["Local tests pass. **Your PR cannot be merged unless tests pass**"]);
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
        expect(sections(rules).map((s) => [s.heading, s.requirement])).toEqual([
            ["Breaking change", "optional"],
            ["Proposed change", "unmarked"],
            ["Additional information", "optional"],
        ]);
    });

    it("finds the 'fixes #' field inside a list", () => {
        const issue = rules.find((r) => r.type === "linked-issue");
        expect(issue?.sourceQuote).toBe("This PR fixes or closes issue: fixes #");
        expect(issue?.sourceUrl).toBe(`${URL}?plain=1#L46`);
    });
});

describe("extractTemplateRules: prometheus/prometheus", () => {
    const rules = extractTemplateRules(fixture("prometheus-pr-template.md"), URL);

    it("the 'Fixes #<issue number>' usage line is in a comment (and says 'If it applies'), so it is no rule", () => {
        expect(rules.some((r) => r.type === "linked-issue")).toBe(false);
    });

    it("'(ALL commits must be considered)' is about what to write, so the release notes section is not required", () => {
        expect(sections(rules).map((s) => [s.heading, s.requirement])).toEqual([
            // The comment says "If it applies": comments may make a section optional
            ["Which issue(s) does the PR fix:", "optional"],
            ["Release notes for end users (ALL commits must be considered).", "unmarked"],
        ]);
        expect(rules.every((r) => !r.strict)).toBe(true);
    });
});

describe("extractTemplateRules: vitejs/vite", () => {
    it("finds nothing: the whole template is a comment, and 'e.g. `fixes #123`' is an example", () => {
        expect(extractTemplateRules(fixture("vite-pr-template.md"), URL)).toEqual([]);
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

    it("comments and examples never make a rule; a real number is an example, not a field", () => {
        expect(extractTemplateRules("<!-- Fixes # -->", URL)).toEqual([]);
        expect(extractTemplateRules("Link the issue it solves, e.g. Fixes #", URL)).toEqual([]);
        expect(extractTemplateRules("Fixes #123", URL)).toEqual([]);
        expect(extractTemplateRules("Closes #<issue number>", URL)).toEqual([expect.objectContaining({ type: "linked-issue" })]);
    });

    it("an issue field is strict only with clear words, and never when it says 'if it applies'", () => {
        const strictOf = (template: string) => extractTemplateRules(template, URL).find((r) => r.type === "linked-issue")?.strict;
        expect(strictOf("Fixes #")).toBe(false);
        expect(strictOf("You must link an issue: Fixes #")).toBe(true);
        expect(strictOf("## Related issue (required)\n\nFixes #")).toBe(true);
        expect(strictOf("Fixes # (if it applies)")).toBeUndefined();
    });

    it("a section is required only when its visible text says so", () => {
        const requirementOfSection = (template: string) => sections(extractTemplateRules(template, URL))[0]?.requirement;
        expect(requirementOfSection("## Description (required)\n\nDescribe it.")).toBe("required");
        expect(requirementOfSection("## Description\n\nThis section must be filled in.")).toBe("required");
        expect(requirementOfSection("## Description\n\n<!-- required -->")).toBe("unmarked");
        expect(requirementOfSection("## Screenshots\n\n<!-- Remove if not relevant -->")).toBe("optional");
        expect(requirementOfSection("## Notes\n\nAll changes must be tested.")).toBe("unmarked");
    });

    it("a required checkbox group is strict only with clear words above it", () => {
        const strictOf = (template: string) => checkboxesStrict(extractTemplateRules(template, URL));
        expect(strictOf("## Checklist\n\n- [ ] Tests pass")).toEqual([false]);
        expect(strictOf("## Checklist\n\nAll boxes must be ticked.\n\n- [ ] Tests pass")).toEqual([true]);
        // Only visible text: "<!-- checklist -->" can't make boxes required
        expect(checkboxes(extractTemplateRules("<!-- Checklist -->\n- [ ] Tests pass", URL)).map((c) => c.requirement)).toEqual(["unknown"]);
    });

    it("a plain request to link the issue is a linked-issue rule", () => {
        const rules = extractTemplateRules("Please link to the related issue.", URL);
        expect(rules).toEqual([
            expect.objectContaining({ type: "linked-issue", sourceQuote: "Please link to the related issue." }),
        ]);
    });
});
