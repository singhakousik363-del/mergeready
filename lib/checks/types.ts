import { CONFIDENCE_RANK, type Confidence, type Rule, type RuleType } from "../rules/types";

// The journey map: Issue -> Work -> Commit -> PR -> Merge
export type Stage = "issue" | "work" | "commit" | "pr" | "merge";

// - "pass":    done right
// - "fail":    red, breaks a rule the repo enforces (config or template)
// - "warn":    yellow, breaks a habit or a written guideline (history or prose)
// - "manual":  we can't tell: the user has to look (e.g. an "unknown" checkbox group)
// - "pending": waiting for maintainers (e.g. PR is open and ready for review)
// - "skip":    nothing to check (no rule for it, or no PR yet)
export type CheckStatus = "pass" | "fail" | "warn" | "manual" | "pending" | "skip";

export type EvidenceRule = { sourceQuote: string; sourceUrl: string; confidence: Confidence };

export type Check = {
    // Stable name, e.g. "dco-signoff" or "template-section:Description"
    id: string;
    // null for checks that don't come from a repo rule (e.g. "repo is archived")
    ruleType: RuleType | null;
    stage: Stage;
    status: CheckStatus;
    // Plain English a beginner understands
    message: string;
    // Concrete steps, e.g. ["git commit --amend -s --no-edit", "git push --force-with-lease"]
    howToFix: string[];
    evidence: {
        // The rules behind this check, strongest first
        rules: EvidenceRule[];
        // What we saw, e.g. "Commit 3f2a1bc has no Signed-off-by line"
        observed: string[];
    };
};

// How bad breaking a rule is (see CLAUDE.md): the repo's tools and template
// enforce config/template rules, so those are red. History and prose rules
// are habits or advice, so those are yellow.
export function failStatus(confidence: Confidence): "fail" | "warn" {
    return confidence === "config" || confidence === "template" ? "fail" : "warn";
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
