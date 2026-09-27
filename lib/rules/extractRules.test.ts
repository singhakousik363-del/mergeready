import { readFileSync } from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { extractRules } from "./extractRules";
import type { Guidelines } from "../github/fetchGuidelines";
import type { ConfigFiles } from "../github/fetchConfigFiles";

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

describe("extractRules: conventional-changelog/commitlint (all three sources)", () => {
    const repo = "https://github.com/conventional-changelog/commitlint/blob/master";
    const result = extractRules(
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
    const result = extractRules(
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
        const result = extractRules(guidelines({}), {
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
        expect(extractRules(guidelines({}), NO_CONFIG)).toEqual({
            rules: [],
            sections: [],
            warnings: [
                "This repo has no CONTRIBUTING file, PR template or tool configs, so there are no repo rules to check.",
            ],
        });
    });

    it("asks the user to read the docs when files exist but no rules were found", () => {
        const result = extractRules(
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
