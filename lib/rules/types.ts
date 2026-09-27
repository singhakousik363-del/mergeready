// The 6 rule types in the MVP scope (see CLAUDE.md)
export type RuleType =
    | "conventional-commits"
    | "pr-template"
    | "linked-issue"
    | "dco-signoff"
    | "issue-assigned"
    | "tests-changed";

// Where a rule came from:
// - "config":   a tool config the repo really runs (commitlint, DCO action...)
// - "template": the PR template
// - "prose":    a sentence in CONTRIBUTING or a linked doc (pattern matched)
export type Confidence = "config" | "template" | "prose";

// Lower = more trustworthy. Used to sort rules, strongest first.
export const CONFIDENCE_RANK: Record<Confidence, number> = { config: 0, template: 1, prose: 2 };

// How a PR template checkbox must be ticked:
// - "required":          every box in the group
// - "pick-at-least-one": one or more boxes in the group (e.g. "Type of change")
// - "optional":          none needed ("if applicable", "check all that apply")
// - "unknown":           the template doesn't say: shown as a manual item, never a failure
export type CheckboxRequirement = "required" | "pick-at-least-one" | "optional" | "unknown";

export type ConventionalCommitsDetails = {
    // commitlint checks commit messages; semantic PR actions check only the PR title
    appliesTo: "commits" | "pr-title";
    // Allowed types like ["feat", "fix"], or null when the source doesn't list them
    allowedTypes: string[] | null;
};

export type PrTemplateDetails =
    | {
          kind: "section";
          heading: string;
          // The template's own text under the heading (comments removed), so a
          // check can tell whether the author replaced it with real content
          templateText: string;
          // e.g. "Remove this section if this PR is NOT a breaking change"
          optional: boolean;
      }
    | {
          kind: "checkbox";
          text: string;
          // Boxes next to each other share a group, e.g. all "Type of change" boxes
          groupId: number;
          requirement: CheckboxRequirement;
      };

type RuleBase = {
    confidence: Confidence;
    // Exact text from the file (lines joined with a space when it spans several)
    sourceQuote: string;
    // Link to the file, pointing at the line when we know it
    sourceUrl: string;
};

export type Rule =
    | (RuleBase & { type: "conventional-commits"; details: ConventionalCommitsDetails })
    | (RuleBase & { type: "pr-template"; details: PrTemplateDetails })
    // These need no extra details: the quote says it all
    | (RuleBase & { type: "linked-issue" | "dco-signoff" | "issue-assigned" | "tests-changed"; details: null });
