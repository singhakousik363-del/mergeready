// Writes eval/REPORT.md from the results files, datasets and locked labels.
// Every number in the report comes from those files, not typed by hand.
import type { LabelsFile } from "./labelingDoc";
import { relabelLintFailures, score, type Pair, type Rate, type Scores } from "./metrics";
import type { Dataset, Results } from "./run";
import type { Snapshots } from "./types";

type SetInputs = { results: Results; dataset: Dataset; labels: LabelsFile; snapshots: Snapshots };

export type ReportInputs = {
    main: SetInputs & { afterFixes: Results; firstRun: Dataset };
    heldout: SetInputs;
    // nodejs/node lint-commit-message failures and the linter rules that failed
    lintReasons: { prs: { pr: string; job: string; failedRules: string[] }[] };
};

// Commits that prove the order of events (git log is the source)
const TIMELINE: [string, string][] = [
    ["65015b1", "Selection and labeling rules pre-registered (eval/SELECTION.md)"],
    ["efcd163", "Change 1 to the scan limit, before any PR was rebuilt or labeled"],
    ["1d02016", "First set's labels locked (80 PRs)"],
    ["963005d", "MergeReady run on the first set; first report"],
    ["3a8c9bb", "MergeReady changed (fixes below) and frozen"],
    ["dd89cf4", "Held-out test pre-registered (addendum in SELECTION.md); first set re-scored with the frozen tool"],
    ["5c96ef1", "Held-out PRs selected and rebuilt"],
    ["73b100a", "Neutral summaries for the held-out review written"],
    ["8bf17b6", "Held-out labels locked, then the frozen tool was run on them"],
];

const WRITTEN_CRITERIA = [
    'A failed "Check Contributing Guidelines Acceptance" check counts as a template objection.',
    'A maintainer only removing "(issue #...)" from an already valid title is not a commit-format objection.',
    "Failed lint-commit-message or DCO checks count as objections.",
    "Maintainer requests about code content are not-checkable.",
    "Closed without merge while referencing another PR counts as not-checkable (likely duplicate).",
    'PRs with only bot welcome or "may be AI-generated" messages have no objections.',
];

function pct(rate: Rate): string {
    if (rate.value === null || rate.low === null || rate.high === null) return `${rate.k}/${rate.n} (no data)`;
    return `${rate.k}/${rate.n} = ${Math.round(rate.value * 100)}% (${Math.round(rate.low * 100)}–${Math.round(rate.high * 100)}%)`;
}

function table(title: string, rows: [string, Scores][]): string[] {
    return [
        `| ${title} | Objections | Flags | Recall | Precision | Precision (red) | Precision (yellow) |`,
        "|---|---|---|---|---|---|---|",
        ...rows.map(
            ([name, s]) =>
                `| ${name} | ${s.objections} | ${s.flags} | ${pct(s.recall)} | ${pct(s.precision)} | ${pct(s.precisionRed)} | ${pct(s.precisionYellow)} |`
        ),
    ];
}

function resultTables(results: Results): string[] {
    return [
        ...table("Overall", [["All", results.overall]]),
        "",
        ...table("Rule type", Object.entries(results.byRuleType)),
        "",
        ...table("Repo", Object.entries(results.byRepo)),
        "",
        `PRs with a not-checkable objection (not scored): ${Object.entries(results.notCheckableByRepo)
            .map(([repo, n]) => `${repo} ${n}`)
            .join(", ")}.`,
    ];
}

function flagSources(results: Results, limit: number): string[] {
    const counts = new Map<string, number>();
    for (const t of results.tool) {
        for (const c of t.checks) {
            if (c.status !== "fail" && c.status !== "warn") continue;
            const key = `${t.repo} · ${c.id} (${c.status === "fail" ? "red" : "yellow"})`;
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
    }
    return [
        "| Check | Flags |",
        "|---|---|",
        ...[...counts]
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([k, n]) => `| ${k} | ${n} |`),
    ];
}

function reviewNumbers(labels: LabelsFile): string {
    const suggestions = labels.prs.flatMap((p) => p.suggestions);
    const count = (prefix: string) => suggestions.filter((s) => s.decision.startsWith(prefix)).length;
    const added = labels.prs.reduce((n, p) => n + p.added.length, 0);
    return `Script suggestions: ${suggestions.length} (confirmed ${count("confirm")}, rejected ${count("reject")}, changed ${count("change:")}). Objections added that the script missed: ${added}.`;
}

function datasetTable(dataset: Dataset): string[] {
    return [
        "| Repo | PRs | Scanned | Skipped: maintainer | not new | bot | nobody looked |",
        "|---|---|---|---|---|---|---|",
        ...dataset.repos.map(
            (r) =>
                `| ${r.repo.owner}/${r.repo.repo} | ${r.prs.length} | ${r.scanned} | ${r.skipped.maintainer} | ${r.skipped["not-new"]} | ${r.skipped.bot} | ${r.skipped["not-looked-at"]} |`
        ),
    ];
}

// Authors with more than one PR in a set (their PRs are not independent)
function repeatAuthors(dataset: Dataset): string {
    const counts = new Map<string, number>();
    for (const r of dataset.repos) {
        for (const pr of r.prs) {
            const who = `${r.repo.repo}: @${pr.author}`;
            counts.set(who, (counts.get(who) ?? 0) + 1);
        }
    }
    const repeats = [...counts].filter(([, n]) => n > 1).map(([who, n]) => `${who} (${n})`);
    return repeats.length ? repeats.join(", ") : "none";
}

function sensitivity(pairs: Pair[], reasons: Map<string, string[]>): Scores {
    return score(relabelLintFailures(pairs, reasons));
}

export function buildReport({ main, heldout, lintReasons }: ReportInputs): string {
    const h = heldout.results.overall;
    const reasons = new Map(lintReasons.prs.map((p) => [p.pr, p.failedRules]));
    const heldoutSensitivity = sensitivity(heldout.results.pairs, reasons);
    const afterSensitivity = sensitivity(main.afterFixes.pairs, reasons);
    const signOffFailures = lintReasons.prs.filter((p) => p.failedRules.includes("signed-off-by")).length;
    const heldoutPrs = heldout.snapshots.snapshots.length;
    const notCheckable = (results: Results) => Object.values(results.notCheckableByRepo).reduce((a, b) => a + b, 0);

    return [
        "# MergeReady evaluation report",
        "",
        "How well does MergeReady predict what maintainers actually object to in first-time contributors' pull requests?",
        "",
        "## Main result: held-out test",
        "",
        `${heldoutPrs} PRs from first-time contributors, opened 15–18 Sep 2026, chosen **after** MergeReady was frozen and labeled **before** it was run on them (MergeReady \`${heldout.results.toolCommit}\`, labels \`${heldout.results.labelsCommit}\`).`,
        "",
        `- **Recall:** MergeReady flagged ${pct(h.recall)} of the checkable objections maintainers raised.`,
        `- **Precision:** ${pct(h.precision)} of its flags matched an objection. Red: ${pct(h.precisionRed)}. Yellow: ${pct(h.precisionYellow)}.`,
        `- **Read with care:** only ${h.objections} checkable objections and ${h.flags} flags, so the 95% intervals (in brackets) are very wide. These PRs are 10–13 days old, so some objections may not have happened yet.`,
        `- Most objections are not rule problems: ${notCheckable(heldout.results)} of ${heldoutPrs} PRs had a "not-checkable" objection (code, design, duplicates), which MergeReady does not try to check.`,
        "",
        ...resultTables(heldout.results),
        "",
        "Where the held-out flags came from:",
        "",
        ...flagSources(heldout.results, 10),
        "",
        "## All three runs",
        "",
        "| Run | PRs | Objections | Flags | Recall | Precision |",
        "|---|---|---|---|---|---|",
        `| First run (MergeReady before fixes) | ${main.snapshots.snapshots.length} | ${main.results.overall.objections} | ${main.results.overall.flags} | ${pct(main.results.overall.recall)} | ${pct(main.results.overall.precision)} |`,
        `| After fixes (optimistic, same data) | ${main.snapshots.snapshots.length} | ${main.afterFixes.overall.objections} | ${main.afterFixes.overall.flags} | ${pct(main.afterFixes.overall.recall)} | ${pct(main.afterFixes.overall.precision)} |`,
        `| **Held-out (main result)** | ${heldoutPrs} | ${h.objections} | ${h.flags} | ${pct(h.recall)} | ${pct(h.precision)} |`,
        "",
        'The fixes were designed by looking at the first run\'s mistakes, so "after fixes" on the same 80 PRs is optimistic by construction. The held-out set is the fair test of the fixed tool.',
        "",
        "## Sensitivity check: node's commit linter also checks sign-off",
        "",
        `Found **after** the held-out run, while looking at why two node objections were missed. nodejs/node's \`lint-commit-message\` check also fails when a commit has no \`Signed-off-by\` line. The written criteria filed every failed lint-commit-message check under commit-format. The job logs (saved in \`eval/data/node-lint-reasons.json\`) show that ${signOffFailures} of the ${lintReasons.prs.length} failures included \`signed-off-by\`, the same problem MergeReady's red DCO flags on node are about.`,
        "",
        "Re-scored with the linter's own failed rules (a sign-off failure is a dco objection; it stays commit-format only if another rule failed too). **This is not the main result**: the locked labels stay as they are, and this reading was chosen after seeing the misses.",
        "",
        "| Run | Recall | Precision | Precision (red) |",
        "|---|---|---|---|",
        `| After fixes, same data | ${pct(afterSensitivity.recall)} | ${pct(afterSensitivity.precision)} | ${pct(afterSensitivity.precisionRed)} |`,
        `| Held-out | ${pct(heldoutSensitivity.recall)} | ${pct(heldoutSensitivity.precision)} | ${pct(heldoutSensitivity.precisionRed)} |`,
        "",
        "## Method",
        "",
        "### Order of events (commits)",
        "",
        "| Commit | What |",
        "|---|---|",
        ...TIMELINE.map(([sha, what]) => `| \`${sha}\` | ${what} |`),
        "",
        "### Datasets",
        "",
        "For each of stdlib-js/stdlib, nodejs/node, prometheus/prometheus and vitejs/vite: the newest PRs by non-bot, non-maintainer authors with no merged PR in that repo before, that were closed or had a maintainer comment or review.",
        "",
        `- **First set:** 20 per repo, opened on or before 2026-09-14. Rebuilt ${main.snapshots.snapshots.length}, excluded ${main.snapshots.excluded.length}.`,
        `- **Held-out set:** 5 per repo, opened 15–18 Sep 2026; fewer than 5 means "take what exists", never widen the window. Rebuilt ${heldoutPrs}, excluded ${heldout.snapshots.excluded.length}.`,
        "",
        "First set:",
        "",
        ...datasetTable(main.dataset),
        "",
        "Held-out set:",
        "",
        ...datasetTable(heldout.dataset),
        "",
        "Each PR was rebuilt as first submitted: original body (edit history), original title (first rename), commits from before the first force-push or dated by the PR's creation, and the linked issue's assignees at that time. MergeReady's history rules only used commits from before the PR was opened. MergeReady's real `analyze()` was called directly (not the HTTP route).",
        "",
        "### Labels",
        "",
        "A script suggested objections only from maintainer and bot activity (comments, reviews, maintainer edits, failed DCO/commitlint/semantic checks, author fixes right after such a trigger), never from MergeReady's output.",
        "",
        "- **First set:** The first 4 PRs were labeled one by one by the author. For the remaining 76, an assistant drafted labels from neutral summaries using written criteria; the author read the draft and the notes on uncertain cases (A16, A29, A31, A33, A35, A38, A52) and approved it.",
        "- **Held-out set:** Same method: an assistant (Claude chat) drafted these from the neutral summaries using the written criteria; the author read the draft and the notes on uncertain cases (H4a, H10, H12, H13b, H15) and approved it.",
        "- In both sets the drafting assistant was separate from the assistant that wrote the summaries and ran this evaluation; the summarizing assistant made no labeling decisions. MergeReady had not been run on a set when its summaries were written.",
        "",
        "Written criteria (written during the first set's labeling, before MergeReady was first run; reused unchanged for the held-out set):",
        "",
        ...WRITTEN_CRITERIA.map((c) => `- ${c}`),
        "",
        `- First set: ${reviewNumbers(main.labels)}`,
        `- Held-out set: ${reviewNumbers(heldout.labels)}`,
        "",
        "### Scoring",
        "",
        'One unit = one (PR, rule type) pair, 6 rule types per PR. A pair is flagged when that rule type\'s check is red or yellow. Recall = flagged objections / objections. Precision = flags matching an objection / flags. 95% Wilson intervals. "Not-checkable" objections are counted but not scored.',
        "",
        "## What changed in MergeReady between the runs",
        "",
        "Designed after the first run, as general rules (no repo-specific cases); see CLAUDE.md:",
        "",
        "1. **Severity from the source's words.** A failed rule is red only for config rules or when its own words say must / required / mandatory / cannot be merged / will be closed / will not be accepted. Everything else is yellow.",
        '2. **Templates.** HTML comments and examples ("e.g. `fixes #123`") never create a rule. "If it applies", "if applicable", "optional", "remove if" make things optional. A linked-issue rule without strict words is a reminder ("manual"), not a flag.',
        "3. **Empty template sections** are flagged only when the template marks them required; a leftover `{{...}}` placeholder elsewhere is yellow.",
        '4. **Commit history** also learns a lowercase "prefix: message" format (like node\'s "subsystem: message") at 90%, as a yellow rule. Two commits sharing one PR-URL mean the repo keeps each PR\'s commits.',
        "",
        "First run, where the flags came from (top 10):",
        "",
        ...flagSources(main.results, 10),
        "",
        "After fixes, same data:",
        "",
        ...flagSources(main.afterFixes, 10),
        "",
        "<details><summary>Full tables: first run (before fixes)</summary>",
        "",
        ...resultTables(main.results),
        "",
        "</details>",
        "",
        "<details><summary>Full tables: after fixes (optimistic, same data)</summary>",
        "",
        ...resultTables(main.afterFixes),
        "",
        "</details>",
        "",
        "## What the results show",
        "",
        `- **Linked-issue false alarms are gone.** The first run had ${main.results.byRuleType["linked-issue"]?.flags ?? 0} linked-issue flags and 0 objections, all from template or doc text (examples, comments, "If it applies"). After the fix: ${main.afterFixes.byRuleType["linked-issue"]?.flags ?? 0} on the same data, ${heldout.results.byRuleType["linked-issue"]?.flags ?? 0} on held-out.`,
        '- **Template:** stdlib\'s contributing-guidelines checkbox still catches what stdlib\'s bot enforces, now as yellow (the template says "please ensure", not "must").',
        "- **Commit format is the weak spot.** The prefix rule only checks the first line's shape. node's linter also checks line length (72 columns), the subsystem name and the sign-off line, so most node commit-format objections are still missed.",
        `- **Red flags:** every red flag of the fixed tool came from node\'s docs saying commits "must" have a Signed-off-by line. By the locked labels they match nothing; in the sensitivity check ${afterSensitivity.precisionRed.k} of ${afterSensitivity.precisionRed.n} (same data) and ${heldoutSensitivity.precisionRed.k} of ${heldoutSensitivity.precisionRed.n} (held-out) match a sign-off failure that node\'s linter reported.`,
        "- **Tests:** yellow tests flags (from CONTRIBUTING text) are mostly not raised by maintainers.",
        "",
        "## Deviations from SELECTION.md",
        "",
        `1. **Change 1 (first set).** The first selection run counted PRs opened after the cutoff toward the 400-PR scan limit, giving stdlib ${main.firstRun.repos[0]?.prs.length ?? "?"} and node ${main.firstRun.repos[1]?.prs.length ?? "?"} PRs. The limit now counts only PRs opened on or before the cutoff, the same for all repos. Recorded before the re-run.`,
        '2. **Boilerplate bot comments.** Bot messages posted with the same text on 3+ PRs in a set (for example welcome notes and "may be AI-generated" notes) were not used for suggestions.',
        '3. **"Maintainer comment" as a trigger** was read as a comment that raised something; an author change after an approval ("LGTM") was not counted.',
        "4. **Suggestion patterns** for not-checkable requests were widened once after reading the first set's comments (before MergeReady was first run).",
        '5. **Guidelines check.** stdlib\'s "Check Contributing Guidelines Acceptance" was not in the pre-registered check list; the written criteria counted it as a template objection.',
        "6. **Labeling method (first set).** Planned as a one-by-one review; after 4 PRs it changed to the batch review described in Method.",
        "7. **Held-out network errors.** The first rebuild of the held-out set lost 2 stdlib PRs to GitHub timeouts. That is a network error, not a PR that can't be rebuilt, so the stage was run again (cached answers reused) and all 19 were rebuilt, before any summary or label.",
        "8. **Sensitivity check** (above) was added after the held-out run and does not replace the locked labels.",
        "",
        "## Limitations",
        "",
        `- **Small samples.** Held-out: ${heldoutPrs} PRs (prometheus had only 4 in the window), ${h.objections} checkable objections. A few PRs more or less can move the numbers a lot.`,
        `- **Repeat authors.** Held-out: ${repeatAuthors(heldout.dataset)}. First set: ${repeatAuthors(main.dataset)}. Their PRs are not independent.`,
        "- **Young PRs.** Held-out PRs were 10–13 days old; some are still open, so objections may be missing.",
        "- **Today's guideline files.** Rules were read from the files as of 28 Sep, not from each PR's day. The PR templates, CONTRIBUTING files and node's pull-requests.md did not change during the first set's window, except vite's CONTRIBUTING.md (2 commits).",
        "- **Approximate rebuild.** Commits added later without a force-push are told apart by date.",
        '- **"Not raised" is not proof of a false alarm.** Maintainers may fix things silently, or not care in one PR but care in another.',
        "- **Maintainers** were identified by GitHub's current author association; triagers without that association were missed.",
        "- **One human labeler** (with an assistant's draft), so no agreement between independent labelers could be measured. The category rules themselves can hide real hits (see the sensitivity check).",
        "- **The fixes were designed on the first set.** Only the held-out numbers test them fairly.",
        "",
        "## Files",
        "",
        "`eval/SELECTION.md` (rules and held-out addendum), `eval/data/` (first set) and `eval/data/heldout/` (dataset, rebuilt PRs, locked labels), `eval/REVIEW.md` and `eval/REVIEW-heldout.md` (neutral summaries), `eval/results.json`, `eval/results.after-fixes.json`, `eval/results.heldout.json` (every flag and check), `eval/data/node-lint-reasons.json`. Regenerate this report: `node --import tsx eval/run.ts report` (no API calls).",
        "",
    ].join("\n");
}
