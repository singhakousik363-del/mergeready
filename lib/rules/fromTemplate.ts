import type { CheckboxRequirement, Rule } from "./types";
import { lineUrl, parseMarkdownBlocks, splitSentences, toPlainText, type Block } from "./sentences";

// Signals for checkbox groups (see "Rule extraction decisions" in CLAUDE.md).
// When several match, the first one in this order wins: pick-one > optional > required.
const PICK_ONE = /\btypes? of (?:change|pr|pull request)s?\b|\b(?:select|check|choose|pick)\s+(?:only\s+)?(?:one|1)\b|\bchoose\b/i;
const OPTIONAL = /\boptional\b|\bif applicable\b|\ball (?:the )?(?:boxes |ones |items |options )?that apply\b/i;
const REQUIRED = /\bchecklist\b|\bbefore submitting\b|\bI have\b|\bI confirm\b|\bmake sure\b/i;
const REMOVE_SECTION = /\b(?:remove|delete) this section\b/i;
const STARTS_WITH_IF = /^if\b/i;

// "Fixes #", "Resolves #{{TODO}}", "closes: #123": a place to write the issue number
const ISSUE_FIELD = /\b(?:fix(?:e[sd])?|close[sd]?|resolve[sd]?)\b:?\s*#/i;
// "Please link to the issue", "reference the related issue"
const ISSUE_REQUEST = /\b(?:link\s+(?:it\s+)?to|reference)\s+(?:(?:the|an|a|any)\s+)?(?:related\s+|relevant\s+|open\s+)?issues?\b/i;

type HeadingBlock = Extract<Block, { kind: "heading" }>;
type ListItemBlock = Extract<Block, { kind: "list-item" }>;
// A heading and everything under it until the next heading of any level
type Section = { heading: HeadingBlock | null; body: Block[] };

// Reads a PR template and returns its rules: sections to fill in, checkboxes
// to tick, and a linked-issue rule when it has a "Fixes #" style field.
// fileUrl = the template's GitHub page, used to link each rule to its line.
export function extractTemplateRules(template: string, fileUrl: string): Rule[] {
    // Code is kept so templateText matches what a PR description really contains
    // (e.g. a usage example). Everything below that reads instructions skips it.
    const blocks = parseMarkdownBlocks(template, { keepCode: true });
    const rules: Rule[] = [];
    let groupId = 0;

    for (const section of splitIntoSections(blocks)) {
        const hasCheckboxes = section.body.some(isCheckbox);

        // A heading with checkboxes is covered by the checkbox rules below
        if (section.heading && !hasCheckboxes) {
            const { heading } = section;
            rules.push({
                type: "pr-template",
                details: {
                    kind: "section",
                    heading: heading.text,
                    templateText: section.body
                        .filter((b) => b.kind !== "comment")
                        .map(blockText)
                        .join("\n"),
                    optional: isOptionalSection(section.body),
                },
                confidence: "template",
                sourceQuote: heading.parts[0].raw,
                sourceUrl: lineUrl(fileUrl, heading.parts[0].line),
            });
        }

        for (const { intro, boxes } of findCheckboxGroups(section.body)) {
            groupId++;
            const groupRequirement = classifyGroup(section.heading?.text ?? "", intro);
            for (const box of boxes) {
                if (box.parts.length === 0) continue;
                const raw = box.parts.map((p) => p.raw).join(" ");
                const text = toPlainText(raw);
                rules.push({
                    type: "pr-template",
                    details: {
                        kind: "checkbox",
                        text,
                        heading: section.heading?.text ?? null,
                        groupId,
                        // "- [ ] Screenshots (if applicable)" is optional on its own
                        requirement: OPTIONAL.test(text) ? "optional" : groupRequirement,
                    },
                    confidence: "template",
                    sourceQuote: raw,
                    sourceUrl: lineUrl(fileUrl, box.parts[0].line),
                });
            }
        }
    }

    const issueRule = findIssueRule(blocks, fileUrl);
    if (issueRule) rules.push(issueRule);
    return rules;
}

function splitIntoSections(blocks: Block[]): Section[] {
    // Text before the first heading goes into a section without a heading
    const sections: Section[] = [{ heading: null, body: [] }];
    for (const block of blocks) {
        if (block.kind === "heading") {
            sections.push({ heading: block, body: [] });
        } else {
            sections[sections.length - 1].body.push(block);
        }
    }
    return sections;
}

function isCheckbox(block: Block): block is ListItemBlock {
    return block.kind === "list-item" && block.checkbox !== null;
}

// Checkboxes next to each other form a group. intro = the blocks between the
// previous group (or the heading) and this group, e.g. "Check only 1 box!".
function findCheckboxGroups(body: Block[]): { intro: Block[]; boxes: ListItemBlock[] }[] {
    const groups: { intro: Block[]; boxes: ListItemBlock[] }[] = [];
    let intro: Block[] = [];
    let boxes: ListItemBlock[] = [];

    for (const block of body) {
        if (isCheckbox(block)) {
            boxes.push(block);
            continue;
        }
        if (boxes.length > 0) {
            groups.push({ intro, boxes });
            intro = [];
            boxes = [];
        }
        intro.push(block);
    }
    if (boxes.length > 0) groups.push({ intro, boxes });
    return groups;
}

function classifyGroup(headingText: string, allIntro: Block[]): CheckboxRequirement {
    const intro = withoutCode(allIntro);
    const signals = [headingText, ...intro.map(blockText)].join(" ");

    if (PICK_ONE.test(signals)) return "pick-at-least-one";

    // A visible line right above the boxes like "If the code talks to devices:"
    // (comments don't count: "If you're unsure, ask" is common there)
    const lineAbove = intro[intro.length - 1];
    const conditional = lineAbove?.kind === "paragraph" && STARTS_WITH_IF.test(blockText(lineAbove));
    if (OPTIONAL.test(signals) || conditional) return "optional";

    if (REQUIRED.test(signals)) return "required";
    return "unknown";
}

function isOptionalSection(allBody: Block[]): boolean {
    const body = withoutCode(allBody);
    const text = body.map(blockText).join(" ");
    if (OPTIONAL.test(text) || REMOVE_SECTION.test(text)) return true;
    // "If your PR contains a breaking change, ..." as the first sentence
    const first = body[0] ? splitSentences(body[0].parts)[0] : undefined;
    return first !== undefined && STARTS_WITH_IF.test(first.text);
}

// The first "Fixes #" field wins; without one, the first plain request to
// link the issue. "If it fixes an issue, link it" is conditional, so it's skipped.
function findIssueRule(blocks: Block[], fileUrl: string): Rule | null {
    const sentences = withoutCode(blocks).flatMap((b) => splitSentences(b.parts));
    const match =
        sentences.find((s) => ISSUE_FIELD.test(s.text)) ??
        sentences.find((s) => ISSUE_REQUEST.test(s.text) && !STARTS_WITH_IF.test(s.text));
    if (!match) return null;
    return {
        type: "linked-issue",
        details: null,
        confidence: "template",
        sourceQuote: match.raw,
        sourceUrl: lineUrl(fileUrl, match.line),
    };
}

function withoutCode(blocks: Block[]): Block[] {
    return blocks.filter((b) => b.kind !== "code");
}

function blockText(block: Block): string {
    return toPlainText(block.parts.map((p) => p.raw).join(" "));
}
