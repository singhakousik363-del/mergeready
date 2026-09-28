import type { PullRequestData } from "../github/fetchPullRequest";
import { parseMarkdownBlocks, toPlainText, type Block } from "../rules/sentences";
import type { PrTemplateDetails, Rule } from "../rules/types";
import { evidenceOf, failStatus, plural, rulesOfType, steps, type Check, type CheckStatus, type FixStep } from "./types";

type TemplateRule = Rule & { type: "pr-template" };
type SectionRule = TemplateRule & { details: Extract<PrTemplateDetails, { kind: "section" }> };
type CheckboxRule = TemplateRule & { details: Extract<PrTemplateDetails, { kind: "checkbox" }> };

// Text a template leaves for you to replace, e.g. "{{TODO: add description}}"
const PLACEHOLDER = /\{\{[^}]*\}\}/;

// One check per template section and one per checkbox group
export function checkPrTemplate(rules: Rule[], pr: PullRequestData): Check[] {
    const templateRules = rulesOfType(rules, "pr-template");
    if (templateRules.length === 0) {
        return [
            {
                id: "pr-template",
                ruleType: "pr-template",
                stage: "pr",
                status: "skip",
                // (A template made only of comments, like nodejs/node's, has no rules either)
                message: "We found no PR template rules to check.",
                howToFix: [],
                evidence: { rules: [], observed: [] },
            },
        ];
    }

    const body = readBody(pr.body);
    const sections = templateRules.filter((r): r is SectionRule => r.details.kind === "section");
    const boxes = templateRules.filter((r): r is CheckboxRule => r.details.kind === "checkbox");

    // Boxes of the same group belong together
    const groups = new Map<number, CheckboxRule[]>();
    for (const box of boxes) groups.set(box.details.groupId, [...(groups.get(box.details.groupId) ?? []), box]);

    return [
        ...sections.map((rule) => checkSection(rule, body)),
        ...[...groups.entries()].map(([groupId, groupRules]) => checkGroup(groupId, groupRules, body)),
    ];
}

type Body = {
    // Heading (normalized) -> the plain text under it, comments removed
    sections: Map<string, string>;
    // Checkbox text (normalized) -> ticked or not
    boxes: Map<string, boolean>;
};

function readBody(markdown: string): Body {
    const sections = new Map<string, string>();
    const boxes = new Map<string, boolean>();
    let heading: string | null = null;
    let lines: string[] = [];

    const finishSection = () => {
        if (heading !== null && !sections.has(heading)) sections.set(heading, lines.join("\n").trim());
    };

    // keepCode: a section may be only a code example, which is real content
    for (const block of parseMarkdownBlocks(markdown, { keepCode: true })) {
        if (block.kind === "heading") {
            finishSection();
            heading = normalize(block.text);
            lines = [];
            continue;
        }
        // HTML comments are the template's instructions, not the author's answer
        if (block.kind === "comment") continue;
        const text = blockText(block);
        lines.push(text);
        if (block.kind === "list-item" && block.checkbox !== null) boxes.set(normalize(text), block.checkbox === "checked");
    }
    finishSection();
    return { sections, boxes };
}

function checkSection(rule: SectionRule, body: Body): Check {
    const { heading, templateText, requirement } = rule.details;
    const content = body.sections.get(normalize(heading));
    const result = (status: CheckStatus, message: string, howToFix: FixStep[], observed: string): Check => ({
        id: `template-section:${heading}`,
        ruleType: "pr-template",
        stage: "pr",
        status,
        message,
        howToFix,
        evidence: { rules: evidenceOf([rule]), observed: [observed] },
    });

    if (content === undefined || content === "") {
        const missing = content === undefined;
        const observed = missing ? "Section not in the PR description" : "Section is empty";
        if (requirement === "optional") return result("pass", `"${heading}" is optional, and you left it out.`, [], observed);
        // The template doesn't say this section is required, so leaving it out is fine
        if (requirement === "unmarked") {
            return result("skip", `The template doesn't say the "${heading}" section is required.`, [], observed);
        }
        return result(
            failStatus([rule]),
            missing ? `The "${heading}" section from the template is missing.` : `The "${heading}" section is empty.`,
            steps(`Edit the PR description and ${missing ? `add a "${heading}" section` : `write something under "${heading}"`}.`),
            observed
        );
    }

    if (PLACEHOLDER.test(content)) {
        const placeholder = PLACEHOLDER.exec(content)?.[0] ?? "";
        return result(
            // Leftover placeholder outside a required section: tidy up, but not red
            requirement === "required" ? failStatus([rule]) : "warn",
            `The "${heading}" section still has placeholder text from the template.`,
            steps(`Replace ${placeholder} with your own words${requirement === "required" ? "" : ", or delete the section"}.`),
            `Found ${placeholder}`
        );
    }

    // Same as the template: maybe fine (stdlib's "Questions" template already says
    // "No."), maybe forgotten. We can't know, so the user decides.
    if (sameText(content, templateText) && templateText.trim() !== "") {
        return result(
            "manual",
            `The "${heading}" section is exactly the same as the template. Check that it really answers the question.`,
            steps(`Read the "${heading}" section and change it if it doesn't describe your PR.`),
            "Text is unchanged from the template"
        );
    }

    return result("pass", `The "${heading}" section is filled in.`, [], `${plural(content.split(/\s+/).filter(Boolean).length, "word")} written`);
}

function checkGroup(groupId: number, rules: CheckboxRule[], body: Body): Check {
    const { requirement, heading } = rules[0].details;
    const label = heading ? `"${heading}" checkboxes` : "Checkboxes";
    const state = rules.map((rule) => ({ rule, ticked: body.boxes.get(normalize(rule.details.text)) }));
    // Missing from the description = not ticked
    const ticked = state.filter((s) => s.ticked === true);
    const notTicked = state.filter((s) => s.ticked !== true);
    const describe = (s: (typeof state)[number]) =>
        `${s.ticked === true ? "[x]" : s.ticked === false ? "[ ]" : "(missing)"} ${s.rule.details.text}`;

    const base = {
        id: `template-checkboxes:${groupId}`,
        ruleType: "pr-template" as const,
        stage: "pr" as const,
        evidence: { rules: evidenceOf(rules), observed: state.map(describe) },
    };
    // Only the box's own "(if applicable)" can make one box optional inside a group
    const mustTick = notTicked.filter((s) => s.rule.details.requirement === "required");
    // Red only if a box that still needs ticking is strict
    const failed = failStatus(requirement === "required" ? mustTick.map((s) => s.rule) : rules);

    switch (requirement) {
        case "required":
            return mustTick.length === 0
                ? { ...base, status: "pass", message: `${label}: all required boxes are ticked.`, howToFix: [] }
                : {
                      ...base,
                      status: failed,
                      message: `${label}: ${plural(mustTick.length, "required box")} ${mustTick.length === 1 ? "is" : "are"} not ticked.`,
                      howToFix: steps(
                          "Do what each box says first. Only then edit the PR description and change [ ] to [x].",
                          ...mustTick.map((s) => `- ${s.rule.details.text}`),
                      ),
                  };
        case "pick-at-least-one":
            return ticked.length > 0
                ? { ...base, status: "pass", message: `${label}: at least one box is ticked.`, howToFix: [] }
                : {
                      ...base,
                      status: failed,
                      message: `${label}: tick at least one box that describes your PR.`,
                      howToFix: steps("Edit the PR description and change [ ] to [x] for the option that fits your PR."),
                  };
        case "optional":
            return { ...base, status: "pass", message: `${label}: optional, tick only the ones that apply.`, howToFix: [] };
        case "unknown":
            return {
                ...base,
                status: "manual",
                message: `${label}: the template doesn't say which boxes you must tick. Check them yourself.`,
                howToFix: steps("Read these boxes and tick the ones that are true for your PR."),
            };
    }
}

function blockText(block: Block): string {
    return toPlainText(block.parts.map((p) => p.raw).join(" "));
}

// "Read the [guide](x)." and "read the guide" should match: lowercase, no punctuation
function normalize(text: string): string {
    return toPlainText(text)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, "")
        .replace(/\s+/g, " ")
        .trim();
}

function sameText(a: string, b: string): boolean {
    return normalize(a) === normalize(b);
}
