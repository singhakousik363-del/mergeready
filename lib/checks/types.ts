import { CONFIDENCE_RANK, type Confidence, type Rule, type RuleType } from "../rules/types";

// The journey map: Issue -> Work -> Commit -> PR -> Merge
export type Stage = "issue" | "work" | "commit" | "pr" | "merge";

// - "pass":    done right
// - "fail":    red, breaks a strict rule (a config the repo runs, or "must"/"required" wording)
// - "warn":    yellow, breaks a habit or advice (history, or "should"-style wording)
// - "manual":  we can't tell: the user has to look (e.g. an "unknown" checkbox group)
// - "pending": waiting for maintainers (e.g. PR is open and ready for review)
// - "skip":    nothing to check (no rule for it, or no PR yet)
export type CheckStatus = "pass" | "fail" | "warn" | "manual" | "pending" | "skip";

export type EvidenceRule = { sourceQuote: string; sourceUrl: string; confidence: Confidence };

// One "how to fix" step. command is only set by hand in each check, never
// guessed from the text: a wrong copied git command can hurt a beginner.
export type FixStep = { text: string; command?: string };

// Steps that are only text: steps("Do this.", "Then this.")
export function steps(...texts: string[]): FixStep[] {
    return texts.map((text) => ({ text }));
}

export type Check = {
    // Stable name, e.g. "dco-signoff" or "template-section:Description"
    id: string;
    // null for checks that don't come from a repo rule (e.g. "repo is archived")
    ruleType: RuleType | null;
    stage: Stage;
    status: CheckStatus;
    // Plain English a beginner understands
    message: string;
    // Concrete steps. A step's command is an exact shell command the UI shows
    // with a copy button, e.g. { text: "Sign off:", command: "git commit --amend -s --no-edit" }
    howToFix: FixStep[];
    evidence: {
        // The rules behind this check, strongest first
        rules: EvidenceRule[];
        // What we saw, e.g. "Commit 3f2a1bc has no Signed-off-by line"
        observed: string[];
    };
};

// How bad breaking these rules is (see CLAUDE.md): red when any of them is
// strict (a config the repo runs, or words like "must"), otherwise yellow.
export function failStatus(rules: Pick<Rule, "strict">[]): "fail" | "warn" {
    return rules.some((rule) => rule.strict) ? "fail" : "warn";
}

// All rules of one type, strongest first.
// (Rule & { type: T }, not Extract: one Rule member covers four types at once,
// and Extract would drop it.)
export function rulesOfType<T extends RuleType>(rules: Rule[], type: T): (Rule & { type: T })[] {
    return rules
        .filter((rule): rule is Rule & { type: T } => rule.type === type)
        .sort((a, b) => CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence]);
}

export function evidenceOf(rules: Rule[]): EvidenceRule[] {
    return rules.map(({ sourceQuote, sourceUrl, confidence }) => ({ sourceQuote, sourceUrl, confidence }));
}

// plural(1, "commit") -> "1 commit", plural(3, "commit") -> "3 commits"
export function plural(count: number, word: string): string {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
}

// First 7 characters, like GitHub shows: 3f2a1bc
export function shortSha(sha: string): string {
    return sha.slice(0, 7);
}
