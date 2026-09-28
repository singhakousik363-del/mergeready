// Builds eval/LABELING.md (what to read) and the eval/data/labels.json template
// (where decisions go). Neither contains any MergeReady output: the labeling
// must stay blind to what our tool says.
import { MAINTAINER_ASSOCIATIONS } from "./config";
import { boilerplateKey, CHECKABLE, type Category, type Suggestion } from "./suggestLabels";
import type { Snapshot } from "./types";

export type LabelDecision = { id: string; category: Category; decision: string };
export type PrLabels = {
    pr: string;
    url: string;
    reviewed: boolean;
    suggestions: LabelDecision[];
    // Objections the script missed: { category, evidence } where evidence is a link or quote
    added: { category: Category; evidence: string }[];
    notes: string;
};
export type LabelsFile = { howTo: string[]; categories: Category[]; prs: PrLabels[] };

const HOW_TO = [
    "For each PR, read its block in eval/LABELING.md (links first, suggestions marked with ➤).",
    'For each suggestion, set "decision" to "confirm", "reject", or "change:<category>" (e.g. "change:tests").',
    'If the maintainers objected to something the script missed, add it to "added": { "category": "...", "evidence": "<link or quote>" }.',
    'Set "reviewed": true when done with a PR (a PR with no suggestions and nothing to add still needs "reviewed": true).',
    "Only count what maintainers or bots raised BEFORE the PR was merged or closed.",
];

const ALL_CATEGORIES: Category[] = [...CHECKABLE, "not-checkable"];
const PRE_REGISTERED_CHECK = /\bdco\b|sign-?off|commitlint|commit[- ]?(?:lint|message)|semantic|pr[- ]?title|lint[- ]?pr/i;

export function labelsTemplate(entries: { snapshot: Snapshot; suggestions: Suggestion[] }[]): LabelsFile {
    return {
        howTo: HOW_TO,
        categories: ALL_CATEGORIES,
        prs: entries.map(({ snapshot, suggestions }) => ({
            pr: prName(snapshot),
            url: snapshot.url,
            reviewed: false,
            suggestions: suggestions.map((s) => ({ id: s.id, category: s.category, decision: "" })),
            added: [],
            notes: "",
        })),
    };
}

export function labelingMarkdown(entries: { snapshot: Snapshot; suggestions: Suggestion[] }[], boilerplate: Set<string>): string {
    const total = entries.reduce((n, e) => n + e.suggestions.length, 0);
    const withNone = entries.filter((e) => e.suggestions.length === 0).length;
    const ignoredBoilerplate = entries.reduce(
        (n, e) => n + e.snapshot.activity.comments.filter((c) => c.isBot && boilerplate.has(boilerplateKey(c))).length,
        0
    );

    const lines: string[] = [
        "# Labeling: what did maintainers object to?",
        "",
        `${entries.length} PRs · ${total} suggestions · ${withNone} PRs with no suggestion · ${ignoredBoilerplate} boilerplate bot comments ignored (same text on 3+ PRs).`,
        "",
        "**How to review** (decisions go in `eval/data/labels.json`):",
        "",
        ...HOW_TO.map((h, i) => `${i + 1}. ${h}`),
        "",
        `Categories: ${ALL_CATEGORIES.map((c) => `\`${c}\``).join(", ")}. \`not-checkable\` = code quality, design, duplicate, other.`,
        "",
        "Suggestions come only from maintainer and bot activity on each PR, never from MergeReady's output. Rules: `eval/SELECTION.md`.",
        "",
    ];

    let currentRepo = "";
    for (const { snapshot: s, suggestions } of entries) {
        const repo = `${s.repo.owner}/${s.repo.repo}`;
        if (repo !== currentRepo) {
            currentRepo = repo;
            lines.push(`## ${repo}`, "");
        }
        lines.push(`### ${prName(s)} · ${s.finalState.toLowerCase()}`, "");
        lines.push(`<${s.url}> · by @${s.author}${failedChecksNote(s)}`, "");

        if (suggestions.length === 0) {
            lines.push("No suggestions. Skim the comments below for anything missed.", "");
        } else {
            for (const suggestion of suggestions) {
                const [first, ...rest] = suggestion.evidence;
                lines.push(`- ➤ **\`${suggestion.category}\`** ← ${describe(first)}`);
                for (const e of rest.slice(0, 2)) lines.push(`  - also: ${describe(e)}`);
                if (rest.length > 2) lines.push(`  - and ${rest.length - 2} more`);
            }
            lines.push("");
        }

        const shown = relevantComments(s, boilerplate);
        if (shown.length > 0) {
            lines.push(`<details><summary>Maintainer and bot comments (${shown.length})</summary>`, "");
            for (const c of shown) lines.push(`- ${c.author} (${c.isBot ? "bot" : c.association}), ${c.kind}: “${oneLine(c.body, 160)}” [↗](${c.url})`);
            lines.push("", "</details>", "");
        }
    }
    return lines.join("\n");
}

function prName(s: Snapshot): string {
    return `${s.repo.owner}/${s.repo.repo}#${s.number}`;
}

// Every check that failed on the first commit, marking which ones the rules use
function failedChecksNote(s: Snapshot): string {
    if (s.activity.failedChecks.length === 0) return "";
    const names = [...new Set(s.activity.failedChecks.map((c) => c.name))];
    const used = names.filter((name) => PRE_REGISTERED_CHECK.test(name)).map((name) => `**${name}** (used)`);
    const other = names.filter((name) => !PRE_REGISTERED_CHECK.test(name));
    const shownOther = other.slice(0, 3).join(", ") + (other.length > 3 ? ` +${other.length - 3} more` : "");
    return ` · first commit failed: ${[...used, shownOther].filter(Boolean).join(", ")}`;
}

function relevantComments(s: Snapshot, boilerplate: Set<string>) {
    const end = s.endedAt ?? "9999";
    return s.activity.comments.filter(
        (c) =>
            c.at <= end &&
            c.author !== s.author &&
            ((c.isBot && !boilerplate.has(boilerplateKey(c))) || (!c.isBot && MAINTAINER_ASSOCIATIONS.has(c.association)))
    );
}

function describe(e: Suggestion["evidence"][number]): string {
    const what = e.kind.replace(/-/g, " ");
    return `${what} by ${e.who}: “${oneLine(e.text, 200)}” [↗](${e.url})`;
}

// One line, no HTML (so a comment can't break the page)
function oneLine(text: string, max: number): string {
    const flat = text.replace(/\s+/g, " ").trim().replace(/</g, "&lt;");
    return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}
