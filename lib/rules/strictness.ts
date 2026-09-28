// Decides whether a rule's own words make it strict (a failed check is red)
// or only advice (yellow). See "Severity" in CLAUDE.md.

// Clear obligation. "should", "always", "make sure", "be sure to" are advice.
// (The apostrophe forms "can't"/"won't" mean the same as "cannot"/"will not".)
const STRICT_WORDS =
    /\b(?:must|required|mandatory)\b|\b(?:cannot|can['’]t|will not|won['’]t) be (?:merged|accepted)\b|\bwill be closed\b/i;

// Words that make a sentence apply only sometimes, or not at all
export const CONDITIONAL =
    /\bif it applies\b|\bif applicable\b|\bwhen applicable\b|\bif relevant\b|\bif any\b|\boptional\b|\b(?:remove|delete)\b(?: (?:this|it|the|this section|the section))? if\b/i;

// "If your PR fixes a bug, ..." as the start of a sentence
export const STARTS_WITH_IF = /^if\b/i;

export function isStrict(text: string): boolean {
    const trimmed = text.trim();
    return STRICT_WORDS.test(trimmed) && !CONDITIONAL.test(trimmed) && !STARTS_WITH_IF.test(trimmed);
}
