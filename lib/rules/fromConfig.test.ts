import { readFileSync } from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { CONVENTIONAL_TYPES, extractConfigRules } from "./fromConfig";
import type { ConfigFile } from "../github/fetchConfigFiles";

// Real config files, see __fixtures__/SOURCES.md
function file(fixtureName: string, repoPath: string): ConfigFile {
    return {
        path: repoPath,
        text: readFileSync(path.join(import.meta.dirname, "__fixtures__", fixtureName), "utf8"),
        url: `https://github.com/acme/app/blob/main/${repoPath}`,
    };
}

function inline(repoPath: string, text: string): ConfigFile {
    return { path: repoPath, text, url: `https://github.com/acme/app/blob/main/${repoPath}` };
}

describe("extractConfigRules: commitlint configs", () => {
    it("reads package.json 'commitlint' and quotes that block, not devDependencies (commitlint)", () => {
        const { rules, warnings } = extractConfigRules([file("commitlint-package.json", "package.json")]);

        expect(warnings).toEqual([]);
        expect(rules).toEqual([
            {
                type: "conventional-commits",
                details: { appliesTo: "commits", allowedTypes: CONVENTIONAL_TYPES },
                confidence: "config",
                // Line 50 has the same text inside devDependencies
                sourceQuote: '"@commitlint/config-conventional",',
                sourceUrl: "https://github.com/acme/app/blob/main/package.json?plain=1#L81",
            },
        ]);
    });

    it("reads type-enum from a YAML config, including a custom type (oh-my-posh)", () => {
        const { rules } = extractConfigRules([file("oh-my-posh-commitlintrc.yml", ".commitlintrc.yml")]);

        expect(rules).toHaveLength(1);
        expect(rules[0].details).toEqual({
            appliesTo: "commits",
            allowedTypes: ["chore", "ci", "docs", "feat", "fix", "perf", "refactor", "revert", "style", "test", "theme"],
        });
        expect(rules[0].sourceQuote).toBe("- '@commitlint/config-conventional'");
    });

    it("reads a JS config as text, including a type-enum over several lines (qiankun)", () => {
        const { rules, warnings } = extractConfigRules([
            file("qiankun-commitlint.config.js.txt", "commitlint.config.js"),
        ]);

        expect(warnings).toEqual([]);
        expect(rules[0].details).toEqual({
            appliesTo: "commits",
            allowedTypes: ["feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert"],
        });
        expect(rules[0].sourceQuote).toBe("extends: ['@commitlint/config-conventional'],");
        expect(rules[0].sourceUrl).toMatch(/#L2$/);
    });

    it("warns when a JS config builds its type list with code", () => {
        const config = "const types = require('./types');\nmodule.exports = { extends: ['@commitlint/config-conventional'], rules: { 'type-enum': [2, 'always', types] } };";
        const { rules, warnings } = extractConfigRules([inline("commitlint.config.js", config)]);

        expect(rules[0].details).toEqual({ appliesTo: "commits", allowedTypes: null });
        expect(warnings).toEqual(["commitlint.config.js could only be partly read (JS configs are read as text, never run)."]);
    });

    it("skips a JS config built from other files, with a warning (like stdlib's .commitlintrc.js)", () => {
        // Real lines from https://github.com/stdlib-js/stdlib/blob/develop/.commitlintrc.js
        const config = "var config = require( './etc/commitlint/.commitlintrc.js' );\n\nmodule.exports = config;";
        const { rules, warnings } = extractConfigRules([inline(".commitlintrc.js", config)]);
        expect(rules).toEqual([]);
        expect(warnings).toEqual([
            ".commitlintrc.js exists, but its settings are built with code (e.g. require()), so its commit rules couldn't be read. JS configs are read as text, never run.",
        ]);
    });

    it("uses the angular type list for config-angular (JSON config)", () => {
        const { rules } = extractConfigRules([
            inline(".commitlintrc.json", '{\n  "extends": ["@commitlint/config-angular"]\n}'),
        ]);
        expect(rules[0].details).toEqual({
            appliesTo: "commits",
            allowedTypes: ["build", "ci", "docs", "feat", "fix", "perf", "refactor", "revert", "style", "test"],
        });
    });

    it("allows any type when type-enum is turned off (level 0)", () => {
        const { rules } = extractConfigRules([
            inline(".commitlintrc.yml", "extends: ['@commitlint/config-conventional']\nrules:\n  type-enum: [0]"),
        ]);
        expect(rules[0].details).toEqual({ appliesTo: "commits", allowedTypes: null });
    });

    it("makes no rule for a commitlint config that isn't about Conventional Commits", () => {
        const { rules } = extractConfigRules([inline(".commitlintrc.json", '{ "rules": { "body-max-line-length": [2, "always", 100] } }')]);
        expect(rules).toEqual([]);
    });

    it("ignores package.json without a commitlint block", () => {
        const { rules, warnings } = extractConfigRules([inline("package.json", '{ "name": "app" }')]);
        expect(rules).toEqual([]);
        expect(warnings).toEqual([]);
    });

    it("warns about broken JSON and YAML instead of crashing", () => {
        const { rules, warnings } = extractConfigRules([
            inline("package.json", "{ not json"),
            inline(".commitlintrc.yml", "extends: [unclosed"),
        ]);
        expect(rules).toEqual([]);
        expect(warnings).toEqual([
            "package.json is not valid JSON, so its commitlint settings were skipped.",
            ".commitlintrc.yml could not be parsed, so it was skipped.",
        ]);
    });
});

describe("extractConfigRules: workflows", () => {
    it("sees commitlint run as a command (conventional-changelog/commitlint)", () => {
        const { rules } = extractConfigRules([file("commitlint-workflow.yml", ".github/workflows/commitlint.yml")]);

        expect(rules).toEqual([
            expect.objectContaining({
                type: "conventional-commits",
                details: { appliesTo: "commits", allowedTypes: null },
                // Not the "Print versions" step, which runs "commitlint --version"
                sourceQuote: "run: node @commitlint/cli/cli.js --last --verbose",
            }),
        ]);
    });

    it("sees the semantic PR action as a PR-title rule with the default types (vitejs/vite)", () => {
        const { rules } = extractConfigRules([
            file("vite-semantic-pull-request.yml", ".github/workflows/semantic-pull-request.yml"),
        ]);

        expect(rules).toHaveLength(1);
        expect(rules[0].details).toEqual({ appliesTo: "pr-title", allowedTypes: CONVENTIONAL_TYPES });
        expect(rules[0].sourceQuote).toBe(
            "uses: amannn/action-semantic-pull-request@48f256284bd46cdaab1048c3721360e808335d50 # v6.1.1"
        );
    });

    it("reads the semantic PR action's own 'types' list", () => {
        const workflow = `jobs:
  title:
    runs-on: ubuntu-latest
    steps:
      - uses: amannn/action-semantic-pull-request@v5
        with:
          types: |
            fix
            feat
`;
        const { rules } = extractConfigRules([inline(".github/workflows/pr.yml", workflow)]);
        expect(rules[0].details).toEqual({ appliesTo: "pr-title", allowedTypes: ["fix", "feat"] });
    });

    it("sees a script that checks 'Signed-off-by' as a DCO rule (moby/moby)", () => {
        const { rules } = extractConfigRules([file("moby-dco-workflow.yml", ".github/workflows/.dco.yml")]);

        expect(rules).toHaveLength(1);
        expect(rules[0].type).toBe("dco-signoff");
        expect(rules[0].sourceQuote).toContain("Signed-off-by:");
        expect(rules[0].sourceUrl).toMatch(/#L43$/);
    });

    it("does NOT treat a comment-signature 'DCO Assistant' as commit sign-off (carbon)", () => {
        // carbon asks for a PR comment ("I hereby sign the DCO"), not a Signed-off-by line
        const { rules } = extractConfigRules([file("carbon-dco-workflow.yml", ".github/workflows/dco.yml")]);
        expect(rules).toEqual([]);
    });

    it("sees DCO and commitlint actions by name, and reusable workflows", () => {
        const workflow = `jobs:
  dco:
    runs-on: ubuntu-latest
    steps:
      - uses: tim-actions/dco@master
  lint:
    uses: acme/.github/.github/workflows/commitlint.yml@main
`;
        const { rules } = extractConfigRules([inline(".github/workflows/checks.yml", workflow)]);
        expect(rules.map((r) => [r.type, r.sourceQuote])).toEqual([
            ["dco-signoff", "- uses: tim-actions/dco@master"],
            ["conventional-commits", "uses: acme/.github/.github/workflows/commitlint.yml@main"],
        ]);
    });

    it("ignores 'npm install commitlint' and odd workflow shapes", () => {
        const workflow = "jobs:\n  a:\n    steps:\n      - run: npm install commitlint\n      - 42\n  b: nope\n";
        expect(extractConfigRules([inline(".github/workflows/x.yml", workflow)]).rules).toEqual([]);
        expect(extractConfigRules([inline(".github/workflows/y.yml", "just text")]).rules).toEqual([]);
    });
});

describe("extractConfigRules: DCO app", () => {
    it("treats .github/dco.yml as a DCO rule (flyteorg/flyte)", () => {
        const { rules } = extractConfigRules([file("flyte-dco.yml", ".github/dco.yml")]);
        expect(rules).toEqual([
            {
                type: "dco-signoff",
                details: null,
                confidence: "config",
                sourceQuote: "require:",
                sourceUrl: "https://github.com/acme/app/blob/main/.github/dco.yml?plain=1#L1",
            },
        ]);
    });

    it("quotes the path for an empty dco.yml (the file itself is the evidence)", () => {
        const { rules } = extractConfigRules([inline(".github/dco.yml", "")]);
        expect(rules[0].sourceQuote).toBe(".github/dco.yml");
    });
});

describe("extractConfigRules: nothing to read", () => {
    it("returns no rules and no warnings for no files", () => {
        expect(extractConfigRules([])).toEqual({ rules: [], warnings: [] });
    });
});
