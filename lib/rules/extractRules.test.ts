import { readFileSync } from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { extractRules } from "./extractRules";
import type { Guidelines } from "../github/fetchGuidelines";
import type { ConfigFiles } from "../github/fetchConfigFiles";
import type { RecentCommits } from "../github/fetchRecentCommits";

// Real files, see __fixtures__/SOURCES.md
function fixture(name: string): string {
    return readFileSync(path.join(import.meta.dirname, "__fixtures__", name), "utf8");
}

function guidelines(parts: Partial<Guidelines>): Guidelines {
    return {
        contributing: null,
        prTemplate: null,
        sources: { contributing: null, prTemplate: null },
        extraDocs: [],
        warnings: [],
        ...parts,
    };
}

const NO_CONFIG: ConfigFiles = { files: [], warnings: [] };
const NO_HISTORY: RecentCommits = { commits: [], warnings: [] };

// Most tests don't need commit history
function run(g: Guidelines, config: ConfigFiles, history: RecentCommits = NO_HISTORY) {
    return extractRules(g, config, history, "https://github.com/acme/app");
}

describe("extractRules: conventional-changelog/commitlint (all three sources)", () => {
    const repo = "https://github.com/conventional-changelog/commitlint/blob/master";
    const result = run(
        guidelines({
            contributing: fixture("commitlint-contributing.md"),
            prTemplate: fixture("commitlint-pr-template.md"),
            sources: {
                contributing: `${repo}/.github/CONTRIBUTING.md`,
                prTemplate: `${repo}/.github/PULL_REQUEST_TEMPLATE.md`,
            },
        }),
        {
            files: [
                { path: "package.json", text: fixture("commitlint-package.json"), url: `${repo}/package.json` },
                {
                    path: ".github/workflows/commitlint.yml",
                    text: fixture("commitlint-workflow.yml"),
                    url: `${repo}/.github/workflows/commitlint.yml`,
                },
            ],
            warnings: [],
        }
    );

    it("puts config rules first, then template, then prose", () => {
        const order = result.rules.map((r) => r.confidence);
        expect(order).toEqual([
            "config",
            "config",
            ...Array<string>(13).fill("template"),
            "prose",
            "prose",
        ]);
    });

    it("finds Conventional Commits from all three kinds of source", () => {
        const conventional = result.rules.filter((r) => r.type === "conventional-commits");
        expect(conventional.map((r) => r.sourceUrl)).toEqual([
            `${repo}/package.json?plain=1#L81`,
            `${repo}/.github/workflows/commitlint.yml?plain=1#L48`,
            `${repo}/.github/CONTRIBUTING.md?plain=1#L66`,
        ]);
    });

    it("gives every rule an exact quote and a link", () => {
        for (const rule of result.rules) {
            expect(rule.sourceQuote.length).toBeGreaterThan(0);
            expect(rule.sourceUrl).toMatch(/^https:\/\/github\.com\/.+\?plain=1#L\d+$/);
        }
    });

    it("lists sections to read and has no warnings", () => {
        expect(result.sections.map((s) => s.heading)).toEqual([
            "Found an Issue?",
            "Commit Rules",
            "Testing",
            "Test-driven development",
        ]);
        expect(result.warnings).toEqual([]);
    });
});

describe("extractRules: nodejs/node (rules live in a linked doc)", () => {
    const repo = "https://github.com/nodejs/node/blob/main";
    const result = run(
        guidelines({
            contributing: fixture("node-contributing.md"),
            prTemplate: fixture("node-pr-template.md"),
            sources: { contributing: `${repo}/CONTRIBUTING.md`, prTemplate: `${repo}/.github/PULL_REQUEST_TEMPLATE.md` },
            extraDocs: [
                {
                    path: "doc/contributing/pull-requests.md",
                    text: fixture("node-pull-requests.md"),
                    source: `${repo}/doc/contributing/pull-requests.md`,
                    linkText: "Pull Requests",
                },
            ],
        }),
        NO_CONFIG
    );

    it("reads the rules from doc/contributing/pull-requests.md", () => {
        expect(result.rules.map((r) => [r.type, r.sourceUrl.replace(repo, "")])).toEqual([
            ["linked-issue", "/doc/contributing/pull-requests.md?plain=1#L184"],
            ["dco-signoff", "/doc/contributing/pull-requests.md?plain=1#L201"],
            ["dco-signoff", "/doc/contributing/pull-requests.md?plain=1#L203"],
            ["tests-changed", "/doc/contributing/pull-requests.md?plain=1#L247"],
        ]);
    });

    it("shows CONTRIBUTING sections before the linked doc's", () => {
        const headings = result.sections.map((s) => s.heading);
        expect(headings.slice(0, 2)).toEqual(["Pull Requests", "Developer's Certificate of Origin 1.1"]);
        expect(headings).toContain("Step 4: Commit");
    });
});

describe("extractRules: warnings", () => {
    it("passes on config warnings", () => {
        const result = run(guidelines({}), {
            files: [{ path: "package.json", text: "{ broken", url: "https://github.com/a/b/blob/main/package.json" }],
            warnings: ["Couldn't read config files (commitlint, DCO, workflows): GitHub took too long to respond."],
        });
        expect(result.warnings).toEqual([
            "Couldn't read config files (commitlint, DCO, workflows): GitHub took too long to respond.",
            "package.json is not valid JSON, so its commitlint settings were skipped.",
            "No rules were found automatically. Please read the guideline sections below yourself.",
        ]);
    });

    it("says so when the repo has no guideline files at all", () => {
        expect(run(guidelines({}), NO_CONFIG)).toEqual({
            rules: [],
            sections: [],
            warnings: [
                "This repo has no CONTRIBUTING file, PR template or tool configs, so there are no repo rules to check.",
            ],
        });
    });

    it("asks the user to read the docs when files exist but no rules were found", () => {
        const result = run(
            guidelines({
                contributing: "# Contributing\n\nThanks for helping!",
                sources: { contributing: "https://github.com/a/b/blob/main/CONTRIBUTING.md", prTemplate: null },
            }),
            NO_CONFIG
        );
        expect(result.warnings).toEqual([
            "No rules were found automatically. Please read the guideline sections below yourself.",
        ]);
    });
});

describe("extractRules: commit history", () => {
    // 20 human commits that follow Conventional Commits and are signed off
    const habits: RecentCommits = {
        commits: Array.from({ length: 20 }, (_, i) => ({
            sha: `sha${i}`,
            message: `fix: bug ${i}\n\nSigned-off-by: Jane Doe <jane@example.com>`,
            isMerge: false,
            isBot: false,
        })),
        warnings: [],
    };

    it("puts history rules after template rules and before prose rules", () => {
        const result = run(
            guidelines({
                contributing: "Please add tests.",
                prTemplate: "## Checklist\n\n- [ ] I have added tests",
                sources: {
                    contributing: "https://github.com/acme/app/blob/main/CONTRIBUTING.md",
                    prTemplate: "https://github.com/acme/app/blob/main/.github/PULL_REQUEST_TEMPLATE.md",
                },
            }),
            NO_CONFIG,
            habits
        );
        expect(result.rules.map((r) => [r.confidence, r.type])).toEqual([
            ["template", "pr-template"],
            ["history", "conventional-commits"],
            ["history", "dco-signoff"],
            ["prose", "tests-changed"],
        ]);
        expect(result.rules[1].sourceUrl).toBe("https://github.com/acme/app/commits/sha0");
    });

    it("passes on history warnings", () => {
        const result = run(guidelines({}), NO_CONFIG, {
            commits: [],
            warnings: ["Couldn't read recent commits: GitHub took too long to respond. Please try again."],
        });
        expect(result.warnings[0]).toBe("Couldn't read recent commits: GitHub took too long to respond. Please try again.");
    });
});
