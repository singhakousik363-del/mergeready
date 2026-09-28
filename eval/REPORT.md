# MergeReady evaluation report

How well does MergeReady predict what maintainers actually object to in first-time contributors' pull requests?

## Short answer

- **Recall:** MergeReady flagged 9/18 = 50% (95% CI 29–71%) of the checkable objections maintainers raised.
- **Precision:** 9/90 = 10% (95% CI 5–18%) of MergeReady's flags matched an objection. Most flags were not raised by maintainers.
- Many objections were not about rules at all: 19 of 80 PRs had a "not-checkable" objection (code, design, duplicates), which MergeReady does not try to check.
- The biggest source of false alarms is the linked-issue check built from PR templates (details below). This is a real weakness, not fixed here: changing MergeReady after seeing these results and re-scoring the same PRs would overstate how good it is.

## Method

Rules were fixed in `eval/SELECTION.md` and committed before any evaluation code ran (commit `65015b1`).

1. **Dataset.** For each of stdlib-js/stdlib, nodejs/node, prometheus/prometheus and vitejs/vite, the 20 newest PRs opened on or before 2026-09-14 by non-bot, non-maintainer authors who had no merged PR in that repo before, and that were closed or had a maintainer comment/review.
2. **As first submitted.** Each PR was rebuilt as it was when opened: original body (edit history), original title (first rename), commits from before the first force-push or dated by the PR's creation, and the linked issue's assignees at that time. MergeReady's commit-history rule only used commits from before the PR was opened.
3. **Labels.** A script suggested objections only from maintainer and bot activity (comments, reviews, maintainer edits, failed DCO/commitlint checks, author fixes right after such a trigger), never from MergeReady's output. The first 4 PRs were labeled one by one by the author. For the remaining 76, an assistant drafted labels from neutral summaries using written criteria; the author read the draft and the notes on uncertain cases (A16, A29, A31, A33, A35, A38, A52) and approved it. (That drafting assistant was a separate assistant, not the one that wrote the summaries and ran this evaluation; the summarizing assistant made no labeling decisions.)
4. **Locked, then run.** The labels were committed (commit `1d02016`) before MergeReady was run on the dataset. MergeReady's real `analyze()` was called directly (not the HTTP route).
5. **Scoring.** One unit = one (PR, rule type) pair, 6 rule types per PR. A pair is flagged when that rule type's check is red or yellow. Recall = flagged objections / objections. Precision = flags matching an objection / flags. 95% Wilson intervals.

### Written labeling criteria

Written during labeling (after the pre-registration, before MergeReady was run):

- A failed "Check Contributing Guidelines Acceptance" check counts as a template objection.
- A maintainer only removing "(issue #...)" from an already valid title is not a commit-format objection.
- Failed lint-commit-message or DCO checks count as objections.
- Maintainer requests about code content are not-checkable.
- Closed without merge while referencing another PR counts as not-checkable (likely duplicate).
- PRs with only bot welcome or "may be AI-generated" messages have no objections.

### Label review numbers

- Script suggestions: 30. Confirmed 21, rejected 8, changed to another category 1.
- Objections added that the script missed: 15.

## Dataset

| Repo | PRs | Opened on/before cutoff and scanned | Skipped: maintainer | not new | bot | nobody looked |
|---|---|---|---|---|---|---|
| stdlib-js/stdlib | 20 | 350 | 258 | 38 | 19 | 15 |
| nodejs/node | 20 | 156 | 79 | 45 | 6 | 6 |
| prometheus/prometheus | 20 | 159 | 16 | 29 | 70 | 24 |
| vitejs/vite | 20 | 67 | 6 | 14 | 12 | 15 |

Rebuilt: 80. Excluded: 0.

## Results

| Overall | Objections | Flags | Recall | Precision | Precision (red) | Precision (yellow) |
|---|---|---|---|---|---|---|
| All | 18 | 90 | 9/18 = 50% (95% CI 29–71%) | 9/90 = 10% (95% CI 5–18%) | 7/55 = 13% (95% CI 6–24%) | 2/35 = 6% (95% CI 2–19%) |

| Rule type | Objections | Flags | Recall | Precision | Precision (red) | Precision (yellow) |
|---|---|---|---|---|---|---|
| conventional-commits | 7 | 1 | 0/7 = 0% (95% CI 0–35%) | 0/1 = 0% (95% CI 0–79%) | 0/0 (no data) | 0/1 = 0% (95% CI 0–79%) |
| pr-template | 9 | 21 | 7/9 = 78% (95% CI 45–94%) | 7/21 = 33% (95% CI 17–55%) | 7/21 = 33% (95% CI 17–55%) | 0/0 (no data) |
| linked-issue | 0 | 47 | 0/0 (no data) | 0/47 = 0% (95% CI 0–8%) | 0/34 = 0% (95% CI 0–10%) | 0/13 = 0% (95% CI 0–23%) |
| dco-signoff | 2 | 9 | 2/2 = 100% (95% CI 34–100%) | 2/9 = 22% (95% CI 6–55%) | 0/0 (no data) | 2/9 = 22% (95% CI 6–55%) |
| issue-assigned | 0 | 0 | 0/0 (no data) | 0/0 (no data) | 0/0 (no data) | 0/0 (no data) |
| tests-changed | 0 | 12 | 0/0 (no data) | 0/12 = 0% (95% CI 0–24%) | 0/0 (no data) | 0/12 = 0% (95% CI 0–24%) |

| Repo | Objections | Flags | Recall | Precision | Precision (red) | Precision (yellow) |
|---|---|---|---|---|---|---|
| stdlib-js/stdlib | 8 | 22 | 6/8 = 75% (95% CI 41–93%) | 6/22 = 27% (95% CI 13–48%) | 6/17 = 35% (95% CI 17–59%) | 0/5 = 0% (95% CI 0–43%) |
| nodejs/node | 6 | 27 | 0/6 = 0% (95% CI 0–39%) | 0/27 = 0% (95% CI 0–12%) | 0/0 (no data) | 0/27 = 0% (95% CI 0–12%) |
| prometheus/prometheus | 3 | 33 | 3/3 = 100% (95% CI 44–100%) | 3/33 = 9% (95% CI 3–24%) | 1/30 = 3% (95% CI 1–17%) | 2/3 = 67% (95% CI 21–94%) |
| vitejs/vite | 1 | 8 | 0/1 = 0% (95% CI 0–79%) | 0/8 = 0% (95% CI 0–32%) | 0/8 = 0% (95% CI 0–32%) | 0/0 (no data) |

PRs with a not-checkable objection: stdlib-js/stdlib 9, nodejs/node 4, prometheus/prometheus 3, vitejs/vite 3.

### Where the flags came from (top 10)

| Check | Flags |
|---|---|
| prometheus/prometheus · linked-issue (red) | 16 |
| prometheus/prometheus · template-section:Release notes for end users (ALL commits must be considered). (red) | 14 |
| nodejs/node · linked-issue (yellow) | 13 |
| stdlib-js/stdlib · linked-issue (red) | 10 |
| vitejs/vite · linked-issue (red) | 8 |
| stdlib-js/stdlib · template-checkboxes:1 (red) | 7 |
| nodejs/node · dco-signoff (yellow) | 7 |
| nodejs/node · tests-changed (yellow) | 7 |
| stdlib-js/stdlib · template-section:Questions (red) | 6 |
| stdlib-js/stdlib · template-section:Other (red) | 6 |

## What this shows

- **Linked issue (0 objections, many flags).** Red flags come from PR templates: stdlib's `Resolves #{{TODO}}` line, a comment in prometheus's template (`Usage: Fixes #<issue number>`, which starts with "If it applies"), and a comment in vite's template (`Reference the issues it solves (e.g. fixes #123)`). MergeReady treats these as required fields, but maintainers merged PRs without them and never asked. Yellow flags in node come from a prose rule in its pull-requests.md ("Use the `Fixes:` prefix and the full issue URL."), which is about commit metadata for PRs that fix an issue, not a demand that every PR has one.
- **PR template.** Most template objections were caught (see the table), mostly stdlib's unticked contributing-guidelines checkbox, which its bot check also failed on. But missing template sections were flagged red even when maintainers didn't mind (prometheus's release-notes section, stdlib's Questions/Other).
- **Commit format (recall 0).** 6 of 7 objections are node's `lint-commit-message` check, which enforces node's own `subsystem: message` format. MergeReady only knows Conventional Commits (the MVP scope), so it can't catch these. The 7th is a maintainer changing a valid `perf:` title to `feat:`, a judgment call no format check can make.
- **DCO.** Both prometheus objections (failed DCO check) were flagged (yellow, from commit history, since prometheus has no DCO config file). In node, 7 first commits had no sign-off although node's docs require one, and no maintainer raised it in these PRs.
- **Tests.** Yellow tests flags (from CONTRIBUTING text) matched no objection.

Ideas to test on NEW data (not applied here): treat template-derived linked-issue rules as yellow; ignore issue fields inside HTML comments or after "If it applies"/"e.g."; treat missing template sections as yellow when the repo doesn't enforce the template.

## Deviations from SELECTION.md (all made before MergeReady was run)

1. **Change 1.** The first selection run counted PRs opened after the cutoff toward the 400-PR scan limit, giving stdlib 3 and node 17 PRs. The limit now counts only PRs opened on or before the cutoff, the same for all repos. Recorded in SELECTION.md before the re-run.
2. **Boilerplate bot comments.** Bot messages posted with the same text on 3+ PRs (for example welcome notes and "may be AI-generated" notes) were not used for suggestions.
3. **"Maintainer comment" as a trigger** was read as a comment that raised something; an author change after an approval ("LGTM") was not counted.
4. **Suggestion patterns** for not-checkable requests were widened once after reading the dataset's comments.
5. **Guidelines check.** stdlib's "Check Contributing Guidelines Acceptance" was not in the pre-registered check list; the written criteria counted it as a template objection at labeling time.
6. **Labeling method.** Planned as a one-by-one review; after 4 PRs it changed to the batch review described in Method.

## Limitations

- Small sample: 80 PRs, 18 checkable objections. Intervals are wide.
- Rules were read from today's guideline files, not those from each PR's day. Checked: the PR templates, CONTRIBUTING files and node's pull-requests.md did not change during the dataset window, except vite's CONTRIBUTING.md (2 commits). All 8 vite flags are red linked-issue flags, which come from the unchanged template (a template rule outranks a CONTRIBUTING rule).
- Rebuilding commits is partly approximate: commits added later without a force-push are told apart by date.
- "Not raised by maintainers" is not proof of a false alarm: maintainers may fix things silently or not care in one PR but care in another.
- Maintainers were identified by GitHub's current author association; triagers without that association were missed.
- One human labeler (plus an assistant's draft for 76 PRs), so no agreement between independent labelers could be measured.

## Files

`eval/SELECTION.md` (rules), `eval/data/dataset.json`, `eval/data/snapshots.json` (rebuilt PRs), `eval/data/labels.json` (locked labels), `eval/REVIEW.md` (neutral summaries), `eval/results.json` (every flag and check). Re-run: `node --env-file=.env.local --import tsx eval/run.ts evaluate` then `... report` (cached, no API calls).
