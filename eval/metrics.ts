// Step 6: compare MergeReady's flags with the locked labels. Pure functions.
import type { RuleType } from "../lib/rules/types";
import type { Category } from "./suggestLabels";
import type { Flag } from "./runTool";

// Which rule type answers which label category
export const CATEGORY_RULE: Record<Exclude<Category, "not-checkable">, RuleType> = {
    template: "pr-template",
    "commit-format": "conventional-commits",
    dco: "dco-signoff",
    "linked-issue": "linked-issue",
    tests: "tests-changed",
    assignment: "issue-assigned",
};

// One (PR, rule type) pair
export type Pair = { pr: string; repo: string; ruleType: RuleType; objection: boolean; flag: Flag };

export type Rate = { k: number; n: number; value: number | null; low: number | null; high: number | null };

export type Scores = {
    objections: number;
    flags: number;
    // Objections MergeReady flagged (red or yellow) / all objections
    recall: Rate;
    // Flags that match an objection / all flags
    precision: Rate;
    precisionRed: Rate;
    precisionYellow: Rate;
};

// 95% Wilson score interval: honest for small samples (never below 0 or above 1)
export function wilson(k: number, n: number, z = 1.96): Rate {
    if (n === 0) return { k, n, value: null, low: null, high: null };
    const p = k / n;
    const denominator = 1 + (z * z) / n;
    const centre = (p + (z * z) / (2 * n)) / denominator;
    const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denominator;
    return { k, n, value: p, low: Math.max(0, centre - margin), high: Math.min(1, centre + margin) };
}

export function score(pairs: Pair[]): Scores {
    const objections = pairs.filter((p) => p.objection);
    const flagged = pairs.filter((p) => p.flag !== null);
    const red = pairs.filter((p) => p.flag === "red");
    const yellow = pairs.filter((p) => p.flag === "yellow");
    return {
        objections: objections.length,
        flags: flagged.length,
        recall: wilson(objections.filter((p) => p.flag !== null).length, objections.length),
        precision: wilson(flagged.filter((p) => p.objection).length, flagged.length),
        precisionRed: wilson(red.filter((p) => p.objection).length, red.length),
        precisionYellow: wilson(yellow.filter((p) => p.objection).length, yellow.length),
    };
}

// The categories a person settled on for one PR: confirmed or changed suggestions, plus added ones
export function finalCategories(pr: { suggestions: { category: Category; decision: string }[]; added: { category: Category }[] }): Set<Category> {
    const categories = new Set<Category>();
    for (const s of pr.suggestions) {
        if (s.decision === "confirm") categories.add(s.category);
        else if (s.decision.startsWith("change:")) categories.add(s.decision.slice("change:".length) as Category);
    }
    for (const a of pr.added) categories.add(a.category);
    return categories;
}
