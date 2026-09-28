import { parse as parseYaml } from "yaml";
import { COMMITLINT_FILES, type ConfigFile } from "../github/fetchConfigFiles";
import type { ConventionalCommitsDetails, Rule } from "./types";
import { lineUrl } from "./sentences";

// Types allowed by @commitlint/config-conventional. The semantic PR action's
// default list is the same. (Copied from those projects: if they add a type
// later, this list must be updated by hand.)
export const CONVENTIONAL_TYPES = ["build", "chore", "ci", "docs", "feat", "fix", "perf", "refactor", "revert", "style", "test"];
// @commitlint/config-angular: the same list without "chore"
const ANGULAR_TYPES = CONVENTIONAL_TYPES.filter((type) => type !== "chore");

const JS_CONFIG = /\.[cm]?[jt]s$/;
// For JS configs, which are read as text and NEVER run
const JS_PRESET = /['"`]@commitlint\/config-(conventional|angular)['"`]/;
const JS_TYPE_ENUM_KEY = /['"]?type-enum['"]?\s*:/;
// 'type-enum': [2, 'always', ['feat', 'fix']]   (may span several lines)
const JS_TYPE_ENUM = /['"]?type-enum['"]?\s*:\s*\[\s*([0-2])\s*,\s*['"](always|never)['"]\s*,\s*\[([^\]]*)\]/;

// Workflow steps
const COMMITLINT_ACTION = /^[^@]*commitlint[^@]*@/i; // e.g. wagoid/commitlint-github-action@v6
const SEMANTIC_PR_ACTION = /^amannn\/action-semantic-pull-request@/i;
const DCO_ACTION = /^[^@]*dco[^@]*@/i; // e.g. tim-actions/dco@master
const COMMITLINT_COMMAND = /\bcommitlint\b/;
// "commitlint --version" or "npm install commitlint" don't check anything
const NOT_A_CHECK = /--version|\b(?:npm|pnpm|yarn|bun)\s+(?:i|install|add)\b/;

export type ConfigRules = { rules: Rule[]; warnings: string[] };

// Turns tool configs into rules. These are the most trustworthy rules,
// because the repo's own tools enforce them.
export function extractConfigRules(files: ConfigFile[]): ConfigRules {
    const rules: Rule[] = [];
    const warnings: string[] = [];

    for (const file of files) {
        if (COMMITLINT_FILES.includes(file.path)) {
            const rule = JS_CONFIG.test(file.path) ? readJsCommitlint(file, warnings) : readDataCommitlint(file, warnings);
            if (rule) rules.push(rule);
        } else if (file.path === "package.json") {
            const rule = readPackageJson(file, warnings);
            if (rule) rules.push(rule);
        } else if (file.path === ".github/dco.yml") {
            rules.push(readDcoApp(file));
        } else if (file.path.startsWith(".github/workflows/")) {
            rules.push(...readWorkflow(file, warnings));
        }
    }
    return { rules, warnings };
}

// ---------- commitlint ----------

type CommitlintSettings = {
    // The line to quote: the preset (e.g. "@commitlint/config-conventional") or "type-enum"
    quoteNeedle: string;
    allowedTypes: string[] | null;
};

// Reads a parsed commitlint config: { extends: [...], rules: { "type-enum": [2, "always", [...]] } }.
// Returns null when it doesn't ask for Conventional Commits.
function readCommitlintObject(config: unknown): CommitlintSettings | null {
    if (!isRecord(config)) return null;

    const presets = typeof config.extends === "string" ? [config.extends] : Array.isArray(config.extends) ? config.extends : [];
    const preset = presets.find(
        (p): p is string => typeof p === "string" && /config-(?:conventional|angular)$/.test(p)
    );

    const typeEnum = isRecord(config.rules) ? config.rules["type-enum"] : undefined;
    // [level, "always", list]. Level 0 = rule turned off.
    let typeList: string[] | null = null;
    let typeEnumOff = false;
    if (Array.isArray(typeEnum)) {
        const [level, when, list] = typeEnum;
        if (level === 0) typeEnumOff = true;
        else if (when === "always" && Array.isArray(list)) typeList = list.filter((t) => typeof t === "string");
    }

    if (!preset && !typeList) return null;
    return {
        quoteNeedle: preset ?? "type-enum",
        allowedTypes: typeList ?? (typeEnumOff || !preset ? null : presetTypes(preset)),
    };
}

function presetTypes(preset: string): string[] {
    return preset.endsWith("config-angular") ? ANGULAR_TYPES : CONVENTIONAL_TYPES;
}

// .commitlintrc, .commitlintrc.json, .commitlintrc.yml: all readable as YAML
// (JSON is valid YAML, so one parser handles both)
function readDataCommitlint(file: ConfigFile, warnings: string[]): Rule | null {
    const config = safeParseYaml(file, warnings);
    const settings = readCommitlintObject(config);
    return settings && commitlintRule(file, settings, 1);
}

// "commitlint": { ... } inside package.json
function readPackageJson(file: ConfigFile, warnings: string[]): Rule | null {
    let pkg: unknown;
    try {
        pkg = JSON.parse(file.text);
    } catch {
        warnings.push(`${file.path} is not valid JSON, so its commitlint settings were skipped.`);
        return null;
    }
    if (!isRecord(pkg) || !isRecord(pkg.commitlint)) return null;
    const settings = readCommitlintObject(pkg.commitlint);
    if (!settings) return null;
    // Quote from the "commitlint" block, not from e.g. devDependencies above it
    const blockStart = findLine(file.text, (line) => /^\s*"commitlint"\s*:\s*\{/.test(line));
    return commitlintRule(file, settings, blockStart?.line ?? 1);
}

// commitlint.config.js and friends. Running repo code would be a security
// hole, so these are only searched with regex. Configs that build their
// settings with code (variables, imports) can't be read this way.
function readJsCommitlint(file: ConfigFile, warnings: string[]): Rule | null {
    const preset = JS_PRESET.exec(file.text);
    const typeEnum = JS_TYPE_ENUM.exec(file.text);
    const couldNotRead = `${file.path} could only be partly read (JS configs are read as text, never run).`;

    let allowedTypes: string[] | null = null;
    let partlyRead = false;
    if (typeEnum) {
        // Level 0 = turned off: any type is allowed
        if (typeEnum[1] !== "0" && typeEnum[2] === "always") {
            allowedTypes = [...typeEnum[3].matchAll(/['"`]([\w-]+)['"`]/g)].map((m) => m[1]);
        }
    } else if (JS_TYPE_ENUM_KEY.test(file.text)) {
        // There is a type list, but it's built with code, e.g. [2, 'always', types]
        partlyRead = true;
    } else if (preset) {
        allowedTypes = presetTypes(preset[1]);
    }

    if (!preset && !allowedTypes) {
        warnings.push(
            `${file.path} exists, but its settings are built with code (e.g. require()), so its commit rules couldn't be read. JS configs are read as text, never run.`
        );
        return null;
    }
    if (partlyRead) warnings.push(couldNotRead);
    const quoteNeedle = preset ? `@commitlint/config-${preset[1]}` : "type-enum";
    return commitlintRule(file, { quoteNeedle, allowedTypes }, 1);
}

function commitlintRule(file: ConfigFile, settings: CommitlintSettings, fromLine: number): Rule {
    const found = findLine(file.text, (line) => line.includes(settings.quoteNeedle), fromLine);
    return conventionalRule(file, found ?? firstLine(file), { appliesTo: "commits", allowedTypes: settings.allowedTypes });
}

// ---------- DCO app ----------

// The file's existence is the evidence. (It doesn't prove the app is
// really installed: GitHub doesn't show that to other users.)
function readDcoApp(file: ConfigFile): Rule {
    const { line, raw } = firstLine(file);
    return { type: "dco-signoff", details: null, confidence: "config", sourceQuote: raw, sourceUrl: lineUrl(file.url, line), strict: true };
}

// ---------- workflows ----------

function readWorkflow(file: ConfigFile, warnings: string[]): Rule[] {
    const workflow = safeParseYaml(file, warnings);
    if (!isRecord(workflow) || !isRecord(workflow.jobs)) return [];

    const rules: Rule[] = [];
    // One rule per type per workflow is enough
    const has = (type: Rule["type"]) => rules.some((r) => r.type === type);

    for (const job of Object.values(workflow.jobs)) {
        if (!isRecord(job)) continue;
        // A job can call a reusable workflow: "uses: org/repo/.github/workflows/commitlint.yml@main"
        const steps: unknown[] = [{ uses: job.uses }, ...(Array.isArray(job.steps) ? job.steps : [])];

        for (const step of steps) {
            if (!isRecord(step)) continue;
            const uses = typeof step.uses === "string" ? step.uses : "";
            const run = typeof step.run === "string" ? step.run : "";

            if (!has("conventional-commits")) {
                if (SEMANTIC_PR_ACTION.test(uses)) {
                    const types = isRecord(step.with) && typeof step.with.types === "string" ? step.with.types : "";
                    const allowedTypes = types.trim() ? types.split(/\s+/).filter(Boolean) : CONVENTIONAL_TYPES;
                    rules.push(conventionalRule(file, lineWith(file, uses), { appliesTo: "pr-title", allowedTypes }));
                } else if (COMMITLINT_ACTION.test(uses)) {
                    // The type list lives in the repo's commitlint config, read separately
                    rules.push(conventionalRule(file, lineWith(file, uses), { appliesTo: "commits", allowedTypes: null }));
                } else {
                    const command = run.split("\n").find((l) => COMMITLINT_COMMAND.test(l) && !NOT_A_CHECK.test(l));
                    if (command) {
                        rules.push(
                            conventionalRule(file, lineWith(file, command.trim()), { appliesTo: "commits", allowedTypes: null })
                        );
                    }
                }
            }

            if (!has("dco-signoff")) {
                // A DCO action, or a script that looks for the "Signed-off-by" line
                const snippet = DCO_ACTION.test(uses) ? uses : run.split("\n").find((l) => l.includes("Signed-off-by"));
                if (snippet) {
                    const { line, raw } = lineWith(file, snippet.trim());
                    rules.push({ type: "dco-signoff", details: null, confidence: "config", sourceQuote: raw, sourceUrl: lineUrl(file.url, line), strict: true });
                }
            }
        }
    }
    return rules;
}

// ---------- helpers ----------

type FoundLine = { line: number; raw: string };

// Config rules are always strict: the repo's own tools enforce them
function conventionalRule(file: ConfigFile, found: FoundLine, details: Omit<ConventionalCommitsDetails, "format">): Rule {
    return {
        type: "conventional-commits",
        details: { format: "conventional", ...details },
        confidence: "config",
        sourceQuote: found.raw,
        sourceUrl: lineUrl(file.url, found.line),
        strict: true,
    };
}

// The first line (from `fromLine` on) that matches, trimmed
function findLine(text: string, matches: (line: string) => boolean, fromLine = 1): FoundLine | null {
    const lines = text.split(/\r?\n/);
    for (let i = fromLine - 1; i < lines.length; i++) {
        if (matches(lines[i])) return { line: i + 1, raw: lines[i].trim() };
    }
    return null;
}

function lineWith(file: ConfigFile, snippet: string): FoundLine {
    return findLine(file.text, (line) => line.includes(snippet)) ?? firstLine(file);
}

// Fallback quote: the first non-empty line, or the file path for an empty file
function firstLine(file: ConfigFile): FoundLine {
    return findLine(file.text, (line) => line.trim() !== "") ?? { line: 1, raw: file.path };
}

// The yaml package refuses to expand huge alias chains ("billion laughs"),
// so a hostile file can't blow up memory.
function safeParseYaml(file: ConfigFile, warnings: string[]): unknown {
    try {
        return parseYaml(file.text);
    } catch {
        warnings.push(`${file.path} could not be parsed, so it was skipped.`);
        return null;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
