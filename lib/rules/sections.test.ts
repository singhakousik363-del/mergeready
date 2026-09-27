import { readFileSync } from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { findRelevantSections, MAX_SECTION_CHARS, MAX_SECTIONS } from "./sections";

// Real docs, see __fixtures__/SOURCES.md
function fixture(name: string): string {
    return readFileSync(path.join(import.meta.dirname, "__fixtures__", name), "utf8");
}

const FILE_URL = "https://github.com/acme/app/blob/main/CONTRIBUTING.md";

function headingsIn(text: string): string[] {
    return findRelevantSections([{ text, fileUrl: FILE_URL }]).map((s) => s.heading);
}

describe("findRelevantSections: real docs", () => {
    it("looks inside a doc whose '# Pull requests' title is too long to show (nodejs/node)", () => {
        const sections = findRelevantSections([{ text: fixture("node-pull-requests.md"), fileUrl: FILE_URL }]);

        // Commit rules first; the whole-file "# Pull requests" section is not used
        expect(sections.map((s) => s.heading)).toEqual([
            "Step 4: Commit",
            "Step 8: Opening the pull request",
            "Abandoned or stalled pull requests",
            "Commit squashing",
            "Getting approvals for your pull request",
            "Waiting until the pull request gets landed",
        ]);
        // Step 4 includes its "Commit message guidelines" sub-section
        expect(sections[0].text).toContain("#### Commit message guidelines");
        expect(sections[0].text).toContain("Your commit must contain the `Signed-off-by` line");
        expect(sections[0].sourceUrl).toBe(`${FILE_URL}?plain=1#L145`);
        expect(sections[0].truncated).toBe(false);
    });

    it("does not treat the title 'commitlint' as a commit section (conventional-changelog/commitlint)", () => {
        expect(headingsIn(fixture("commitlint-contributing.md"))).toEqual([
            "Found an Issue?",
            "Commit Rules",
            "Testing",
            "Test-driven development",
        ]);
    });

    it("keeps the text exactly as written, heading line included (stdlib-js/stdlib)", () => {
        const sections = findRelevantSections([{ text: fixture("stdlib-contributing.md"), fileUrl: FILE_URL }]);
        const commit = sections.find((s) => s.heading === "Step 5: Commit");

        expect(commit?.text.split("\n")[0]).toBe("#### Step 5: Commit");
        expect(commit?.text).toContain("When writing commit messages, follow the Git [style guide][stdlib-style-guides-git].");
        expect(sections.map((s) => s.heading)).toContain("Developer's Certificate of Origin 1.1");
    });

    it("brings along the link targets a section uses, from the end of the file (stdlib-js/stdlib)", () => {
        const sections = findRelevantSections([{ text: fixture("stdlib-contributing.md"), fileUrl: FILE_URL }]);
        const commit = sections.find((s) => s.heading === "Step 5: Commit");

        // The section says "follow the Git [style guide][stdlib-style-guides-git]";
        // the "[stdlib-style-guides-git]: https://..." line is ~200 lines further down
        expect(commit?.references).toContainEqual({
            label: "stdlib-style-guides-git",
            url: "https://github.com/stdlib-js/stdlib/blob/develop/docs/style-guides/git",
        });
    });

    it("finds the 'Get Assigned' section (processing/p5.js)", () => {
        expect(headingsIn(fixture("p5-contributing.md"))[0]).toBe("Get Assigned Before Working on an Issue");
    });
});

describe("findRelevantSections: rules", () => {
    it("does not list a sub-section again when its parent is listed", () => {
        const text = "## Pull requests\n\nOpen one.\n\n### Tests\n\nAdd tests.\n\n## Other\n\nx";
        expect(headingsIn(text)).toEqual(["Pull requests"]);
    });

    it("skips headings with nothing under them and the table of contents", () => {
        expect(headingsIn("## Contents\n\n* [Pull requests](#pull-requests)\n\n## Pull requests")).toEqual([]);
    });

    it("cuts a long section without sub-sections and says so", () => {
        const text = `## Pull requests\n\n${"word ".repeat(2000)}`;
        const [section] = findRelevantSections([{ text, fileUrl: FILE_URL }]);
        expect(section.text).toHaveLength(MAX_SECTION_CHARS);
        expect(section.truncated).toBe(true);
    });

    it(`keeps at most ${MAX_SECTIONS}, preferring commit rules, shown in reading order`, () => {
        const text = [
            "## Testing\n\nx",
            ...Array.from({ length: 6 }, (_, i) => `## Pull request tip ${i + 1}\n\nx`),
            "## Commit messages\n\nx",
        ].join("\n\n");
        expect(headingsIn(text)).toEqual([
            "Pull request tip 1",
            "Pull request tip 2",
            "Pull request tip 3",
            "Pull request tip 4",
            "Pull request tip 5",
            "Commit messages",
        ]);
    });

    it("reads several docs and links each section to its own file", () => {
        const other = "https://github.com/acme/app/blob/main/docs/pr.md";
        const sections = findRelevantSections([
            { text: "# Hello\n\nhi", fileUrl: FILE_URL },
            { text: "## Sign-off\n\nUse git commit -s.", fileUrl: other },
        ]);
        expect(sections).toEqual([
            { heading: "Sign-off", text: "## Sign-off\n\nUse git commit -s.", sourceUrl: `${other}?plain=1#L1`, truncated: false, references: [] },
        ]);
    });

    it("returns nothing for no docs", () => {
        expect(findRelevantSections([])).toEqual([]);
    });
});
