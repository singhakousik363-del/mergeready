import { readFileSync } from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { buildPrDescription } from "./prDescription";

// Real templates from the rules fixtures
function template(name: string): string {
    return readFileSync(path.join(import.meta.dirname, "..", "rules", "__fixtures__", name), "utf8");
}

const STDLIB = template("stdlib-pr-template.md");
const HOME_ASSISTANT = template("home-assistant-pr-template.md");
const COMMITLINT = template("commitlint-pr-template.md");
const PROMETHEUS_STYLE = "#### Which issue(s) does the PR fix:\n<!--\nUsage: `Fixes #<issue number>`\n-->\n";

describe("buildPrDescription", () => {
    it("stdlib: fills 'Resolves #{{TODO...}}' and changes nothing else", () => {
        const result = buildPrDescription({ template: STDLIB, issueNumber: 15456 });

        expect(result.split("\n")[0]).toBe("Resolves #15456.");
        expect(result.replace("Resolves #15456.", "Resolves #{{TODO: add issue number}}.")).toBe(STDLIB);
        // "Related Issues" has no closing word, so its placeholder stays for the author
        expect(result).toContain("-   #{{TODO: add related issue number}}");
    });

    it("home-assistant: fills the empty 'fixes #' field in a list", () => {
        const result = buildPrDescription({ template: HOME_ASSISTANT, issueNumber: 42 });
        expect(result).toContain("- This PR fixes or closes issue: fixes #42\n");
        expect(result).not.toContain("\nFixes #42");
    });

    it("commitlint: no issue field outside comments, so 'Fixes #N' is added at the end", () => {
        const result = buildPrDescription({ template: COMMITLINT, issueNumber: 7 });
        expect(result.endsWith("\n\nFixes #7\n")).toBe(true);
        // The instruction comment is untouched
        expect(result).toContain("<!--- If it fixes an open issue, please link to the issue here. -->");
    });

    it("never changes text inside comments ('Usage: `Fixes #<issue number>`' stays)", () => {
        const result = buildPrDescription({ template: PROMETHEUS_STYLE, issueNumber: 9 });
        expect(result).toContain("Usage: `Fixes #<issue number>`");
        expect(result.endsWith("Fixes #9\n")).toBe(true);
    });

    it("NEVER ticks a box, and unticks boxes a template pre-ticks", () => {
        const pretick = "## Checklist\n\n- [x] I agree\n* [X] Tests pass\n1. [x] Docs\n- [ ] Changelog\n";
        const result = buildPrDescription({ template: pretick, issueNumber: null });
        expect(result).toBe("## Checklist\n\n- [ ] I agree\n* [ ] Tests pass\n1. [ ] Docs\n- [ ] Changelog\n");

        for (const real of [STDLIB, HOME_ASSISTANT, COMMITLINT]) {
            expect(buildPrDescription({ template: real, issueNumber: 1 })).not.toMatch(/\[[xX]\]/);
        }
    });

    it("leaves the template alone when the issue number is unknown", () => {
        expect(buildPrDescription({ template: STDLIB, issueNumber: null })).toBe(STDLIB);
    });

    it("gives a marked starter when the repo has no template", () => {
        const result = buildPrDescription({ template: null, issueNumber: 12 });
        expect(result.split("\n")[0]).toBe("<!-- Starter from MergeReady: this repo has no PR template. -->");
        expect(result).toContain("\nFixes #12\n");
        expect(buildPrDescription({ template: null, issueNumber: null })).toContain(
            "<!-- If this fixes an issue, write: Fixes #123 -->"
        );
    });
});
