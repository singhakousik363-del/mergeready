import type { Rule } from "./types";
import { lineUrl, parseMarkdownBlocks, splitSentences, type Block } from "./sentences";

// A guideline file to search: CONTRIBUTING or a doc it links to
export type ProseDoc = { text: string; fileUrl: string };

type ProseRuleType = "conventional-commits" | "linked-issue" | "dco-signoff" | "issue-assigned" | "tests-changed";

// What each rule type is about. A sentence must match one of these AND say
// it's an obligation (see below) to become a rule.
const TOPICS: { type: ProseRuleType; pattern: RegExp }[] = [
    {
        type: "dco-signoff",
        // Plain "sign off" is NOT enough: nodejs/node says "All pull requests
        // require "sign off" in order to land", which means reviewer approval.
        pattern:
            /\bSigned-off-by\b|\bgit commit (?:-s|--signoff)\b|\bsign[- ]off (?:on )?(?:your |each |all |every )?commits?\b|\bDCO\b|\bDeveloper(?:'s|’s)? Certificate of Origin\b/i,
    },
    {
        type: "conventional-commits",
        // Bare "commitlint" is left out: commitlint's own docs say it in every paragraph
        pattern:
            /\bconventional[- ]commits?\b|conventionalcommits\.org|\bsemantic commit messages?\b|\$type\(\$scope\):|<type>(?:\(<scope>\))?:/i,
    },
    {
        type: "linked-issue",
        pattern:
            /\b(?:fix(?:es)?|close[sd]?|resolves?)\s*:?\s*#|\b(?:link|reference)\s+(?:it\s+)?(?:to\s+)?(?:(?:the|an|a|any)\s+)?(?:related\s+|relevant\s+|open\s+|corresponding\s+)?issues?\b|\bissue (?:number|URL|link)\b/i,
    },
    {
        type: "issue-assigned",
        pattern:
            /\bassign(?:ed)?\s+(?:it\s+|the issue\s+)?(?:to\s+)?yourself\b|\b(?:ask|request)(?:ing)?\s+(?:to\s+)?(?:be|get)\s+assigned\b|\bclaim(?:ing)?\s+(?:the|an|this)\s+issue\b|\b(?:is|been|be)\s+assigned to you\b|\bget(?:ting)? assigned\b|\balready (?:been )?assigned\b/i,
    },
    {
        type: "tests-changed",
        // About ADDING tests. "Make sure all tests pass" is about running them, so it doesn't count.
        pattern:
            /\b(?:add|adding|include|including|write|writing|come with|accompanied by|covered by)\b.{0,40}?\btests?\b|\btests?\b.{0,20}?\baccompany\b|\btests? (?:are|is) required\b/i,
    },
];

// Words that make a sentence an obligation
// ("required?" also covers "we require" and "is required"; "need to" covers "you'll need to")
const OBLIGATION =
    /\b(?:must|should|shall|required?|requires|need(?:s)? to|have to|has to|make sure|be sure to|remember to|(?:don['’]t|do not) forget to|ensure|please|always|expected to|enforced|mandatory)\b/i;
// Instructions often start with a verb: "Add tests for...", "Use the Fixes: prefix"
const IMPERATIVE =
    /^(?:add|include|write|use|sign|link|reference|follow|make|ensure|comment|ask|assign|get|keep|provide|update|mention|wait)\b/i;
// "not required", "if applicable", "Bot generated commits are exempt from this requirement"
// (docs often use a curly apostrophe: don’t)
const NEGATION =
    /\b(?:not (?:required|necessary|mandatory|needed)|no need|(?:don['’]t|do not|doesn['’]t|does not) need|optional|if applicable|exempt)\b/i;

const PR_TITLE = /\b(?:PR|pull request) titles?\b/i;

// Finds rule sentences in guideline docs. Each matching sentence becomes one
// rule, and the sentence itself is the sourceQuote.
export function extractProseRules(docs: ProseDoc[]): Rule[] {
    const rules: Rule[] = [];
    const seen = new Set<string>();

    for (const doc of docs) {
        for (const { block, leadInObliges } of readableBlocks(parseMarkdownBlocks(doc.text))) {
            for (const sentence of splitSentences(block.parts)) {
                const text = sentence.text;
                if (NEGATION.test(text)) continue;

                const obliges =
                    OBLIGATION.test(text) || IMPERATIVE.test(text) || (block.kind === "list-item" && leadInObliges);
                if (!obliges) continue;

                for (const topic of TOPICS) {
                    if (!topic.pattern.test(text)) continue;
                    const sourceUrl = lineUrl(doc.fileUrl, sentence.line);
                    // The same sentence can't give the same rule twice
                    const key = `${topic.type}|${sourceUrl}|${sentence.raw}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    const base = { confidence: "prose" as const, sourceQuote: sentence.raw, sourceUrl };
                    if (topic.type === "conventional-commits") {
                        // "PR titles must follow Conventional Commits" is about the title only
                        const appliesTo = PR_TITLE.test(text) ? "pr-title" : "commits";
                        rules.push({ ...base, type: topic.type, details: { appliesTo, allowedTypes: null } });
                    } else {
                        rules.push({ ...base, type: topic.type, details: null });
                    }
                }
            }
        }
    }
    return rules;
}

// Headings, paragraphs and list items (comments are skipped). Headings count
// because some repos put the rule there, e.g. p5.js: "Get Assigned Before
// Working on an Issue".
// leadInObliges: for list items, whether the text right above the list says
// it's an obligation, e.g. commitlint's "the following commit rules are
// enforced." above "- message format of `$type($scope): $message`".
function readableBlocks(blocks: Block[]): { block: Block; leadInObliges: boolean }[] {
    const result: { block: Block; leadInObliges: boolean }[] = [];
    // Paragraphs since the last heading or the last list
    let leadIn: string[] = [];
    let inList = false;

    for (const block of blocks) {
        if (block.kind === "heading") {
            leadIn = [];
            inList = false;
            result.push({ block, leadInObliges: false });
        } else if (block.kind === "paragraph") {
            if (inList) leadIn = [];
            inList = false;
            leadIn.push(splitSentences(block.parts).map((s) => s.text).join(" "));
            result.push({ block, leadInObliges: false });
        } else if (block.kind === "list-item") {
            inList = true;
            result.push({ block, leadInObliges: leadIn.some((text) => OBLIGATION.test(text)) });
        }
    }
    return result;
}
