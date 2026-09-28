// Words the UI shows. Kept in one place (and tested) so every screen says
// the same thing, and so the UI never shows a status by colour alone.
import type { CheckStatus, EvidenceRule, Stage } from "../checks/types";
import type { CheckboxRequirement, Confidence, Rule, RuleType } from "../rules/types";

export const STAGE_LABEL: Record<Stage, string> = {
    issue: "Issue",
    work: "Work",
    commit: "Commit",
    pr: "PR",
    merge: "Merge",
};

// Short word next to each status icon
export const STATUS_LABEL: Record<CheckStatus, string> = {
    pass: "Good",
    fail: "Fix this",
    warn: "Look at this",
    manual: "Check yourself",
    pending: "Waiting",
    skip: "Not checked",
};

export const RULE_TYPE_LABEL: Record<RuleType, string> = {
    "conventional-commits": "Commit message format",
    "pr-template": "PR template",
    "linked-issue": "Linked issue",
    "dco-signoff": "DCO sign-off",
    "issue-assigned": "Issue assigned to you",
    "tests-changed": "Tests with code changes",
};

// The "Rules we found" panel: one group per source, strongest first
export const SOURCE_GROUPS: { confidence: Confidence; title: string; explain: string }[] = [
    { confidence: "config", title: "Repo config", explain: "Tools the repo runs on every PR. These are enforced." },
    { confidence: "template", title: "PR template", explain: "What the repo's pull request template asks for." },
    { confidence: "history", title: "Commit history", explain: "Habits seen in the repo's recent commits. Recommended, not enforced." },
    { confidence: "prose", title: "Written guidelines", explain: "Sentences from CONTRIBUTING and the docs it links to." },
];

// A history quote starts like "41 of the last 41 commits ..."
const HISTORY_COUNT = /^(\d+) of the last (\d+) commits/;

// Where a rule came from, in a few words, e.g. "Commit history: 41 of 41 commits"
export function sourceLabel(rule: Pick<EvidenceRule, "confidence" | "sourceQuote" | "sourceUrl">): string {
    switch (rule.confidence) {
        case "config":
            return "Repo config";
        case "template":
            return "PR template";
        case "history": {
            const count = HISTORY_COUNT.exec(rule.sourceQuote);
            return count ? `Commit history: ${count[1]} of ${count[2]} commits` : "Commit history";
        }
        case "prose": {
            const file = fileName(rule.sourceUrl);
            if (file === null || /^contributing/i.test(file)) return "CONTRIBUTING text";
            return `Docs: ${file}`;
        }
    }
}

// "https://github.com/o/r/blob/main/doc/pull-requests.md?plain=1#L5" -> "pull-requests.md"
function fileName(url: string): string | null {
    try {
        const last = new URL(url).pathname.split("/").pop();
        return last ? decodeURIComponent(last) : null;
    } catch {
        return null;
    }
}

const REQUIREMENT_LABEL: Record<CheckboxRequirement, string> = {
    required: "must be ticked",
    "pick-at-least-one": "pick at least one in its group",
    optional: "optional",
    unknown: "the template doesn't say",
};

// One line about what a rule asks for, for the "Rules we found" panel
export function ruleDetail(rule: Rule): string {
    switch (rule.type) {
        case "conventional-commits": {
            const where = rule.details.appliesTo === "pr-title" ? "the PR title" : "every commit message";
            if (rule.details.format === "prefix") return `Applies to ${where}; format "prefix: message"`;
            const types = rule.details.allowedTypes ? `; types: ${rule.details.allowedTypes.join(", ")}` : "";
            return `Applies to ${where}${types}`;
        }
        case "pr-template":
            return rule.details.kind === "section"
                ? `Section "${rule.details.heading}"${rule.details.requirement === "unmarked" ? "" : ` (${rule.details.requirement})`}`
                : `Checkbox "${rule.details.text}": ${REQUIREMENT_LABEL[rule.details.requirement]}`;
        default:
            return RULE_TYPE_LABEL[rule.type];
    }
}
