# MergeReady evaluation report

How well does MergeReady predict what maintainers actually object to in first-time contributors' pull requests?

## Main result: held-out test

19 PRs from first-time contributors, opened 15–18 Sep 2026, chosen **after** MergeReady was frozen and labeled **before** it was run on them (MergeReady `3a8c9bb`, labels `8bf17b6`).

- **Recall:** MergeReady flagged 3/5 = 60% (23–88%) of the checkable objections maintainers raised.
- **Precision:** 3/7 = 43% (16–75%) of its flags matched an objection. Red: 0/2 = 0% (0–66%). Yellow: 3/5 = 60% (23–88%).
- **Read with care:** only 5 checkable objections and 7 flags, so the 95% intervals (in brackets) are very wide. These PRs are 10–13 days old, so some objections may not have happened yet.
- Most objections are not rule problems: 9 of 19 PRs had a "not-checkable" objection (code, design, duplicates), which MergeReady does not try to check.

| Overall | Objections | Flags | Recall | Precision | Precision (red) | Precision (yellow) |
|---|---|---|---|---|---|---|
| All | 5 | 7 | 3/5 = 60% (23–88%) | 3/7 = 43% (16–75%) | 0/2 = 0% (0–66%) | 3/5 = 60% (23–88%) |

| Rule type | Objections | Flags | Recall | Precision | Precision (red) | Precision (yellow) |
|---|---|---|---|---|---|---|
| conventional-commits | 3 | 1 | 1/3 = 33% (6–79%) | 1/1 = 100% (21–100%) | 0/0 (no data) | 1/1 = 100% (21–100%) |
| pr-template | 1 | 1 | 1/1 = 100% (21–100%) | 1/1 = 100% (21–100%) | 0/0 (no data) | 1/1 = 100% (21–100%) |
| linked-issue | 0 | 0 | 0/0 (no data) | 0/0 (no data) | 0/0 (no data) | 0/0 (no data) |
| dco-signoff | 0 | 2 | 0/0 (no data) | 0/2 = 0% (0–66%) | 0/2 = 0% (0–66%) | 0/0 (no data) |
| issue-assigned | 0 | 0 | 0/0 (no data) | 0/0 (no data) | 0/0 (no data) | 0/0 (no data) |
| tests-changed | 1 | 3 | 1/1 = 100% (21–100%) | 1/3 = 33% (6–79%) | 0/0 (no data) | 1/3 = 33% (6–79%) |

| Repo | Objections | Flags | Recall | Precision | Precision (red) | Precision (yellow) |
|---|---|---|---|---|---|---|
| stdlib-js/stdlib | 1 | 1 | 1/1 = 100% (21–100%) | 1/1 = 100% (21–100%) | 0/0 (no data) | 1/1 = 100% (21–100%) |
| nodejs/node | 3 | 4 | 1/3 = 33% (6–79%) | 1/4 = 25% (5–70%) | 0/2 = 0% (0–66%) | 1/2 = 50% (9–91%) |
| prometheus/prometheus | 1 | 1 | 1/1 = 100% (21–100%) | 1/1 = 100% (21–100%) | 0/0 (no data) | 1/1 = 100% (21–100%) |
| vitejs/vite | 0 | 1 | 0/0 (no data) | 0/1 = 0% (0–79%) | 0/0 (no data) | 0/1 = 0% (0–79%) |

PRs with a not-checkable objection (not scored): stdlib-js/stdlib 3, nodejs/node 2, prometheus/prometheus 3, vitejs/vite 1.

Where the held-out flags came from:

| Check | Flags |
|---|---|
| nodejs/node · dco-signoff (red) | 2 |
| stdlib-js/stdlib · template-checkboxes:1 (yellow) | 1 |
| nodejs/node · commit-format:commits (yellow) | 1 |
| nodejs/node · tests-changed (yellow) | 1 |
| prometheus/prometheus · tests-changed (yellow) | 1 |
| vitejs/vite · tests-changed (yellow) | 1 |

## All three runs

| Run | PRs | Objections | Flags | Recall | Precision |
|---|---|---|---|---|---|
| First run (MergeReady before fixes) | 80 | 18 | 90 | 9/18 = 50% (29–71%) | 9/90 = 10% (5–18%) |
| After fixes (optimistic, same data) | 80 | 18 | 31 | 9/18 = 50% (29–71%) | 9/31 = 29% (16–47%) |
| **Held-out (main result)** | 19 | 5 | 7 | 3/5 = 60% (23–88%) | 3/7 = 43% (16–75%) |

The fixes were designed by looking at the first run's mistakes, so "after fixes" on the same 80 PRs is optimistic by construction. The held-out set is the fair test of the fixed tool.

## Sensitivity check: node's commit linter also checks sign-off

Found **after** the held-out run, while looking at why two node objections were missed. nodejs/node's `lint-commit-message` check also fails when a commit has no `Signed-off-by` line. The written criteria filed every failed lint-commit-message check under commit-format. The job logs (saved in `eval/data/node-lint-reasons.json`) show that 7 of the 9 failures included `signed-off-by`, the same problem MergeReady's red DCO flags on node are about.

Re-scored with the linter's own failed rules (a sign-off failure is a dco objection; it stays commit-format only if another rule failed too). **This is not the main result**: the locked labels stay as they are, and this reading was chosen after seeing the misses.

| Run | Recall | Precision | Precision (red) |
|---|---|---|---|
| After fixes, same data | 13/21 = 62% (41–79%) | 13/31 = 42% (26–59%) | 4/7 = 57% (25–84%) |
| Held-out | 5/6 = 83% (44–97%) | 5/7 = 71% (36–92%) | 2/2 = 100% (34–100%) |

## Method

### Order of events (commits)

| Commit | What |
|---|---|
| `65015b1` | Selection and labeling rules pre-registered (eval/SELECTION.md) |
| `efcd163` | Change 1 to the scan limit, before any PR was rebuilt or labeled |
| `1d02016` | First set's labels locked (80 PRs) |
| `963005d` | MergeReady run on the first set; first report |
| `3a8c9bb` | MergeReady changed (fixes below) and frozen |
| `dd89cf4` | Held-out test pre-registered (addendum in SELECTION.md); first set re-scored with the frozen tool |
| `5c96ef1` | Held-out PRs selected and rebuilt |
| `73b100a` | Neutral summaries for the held-out review written |
| `8bf17b6` | Held-out labels locked, then the frozen tool was run on them |

### Datasets

For each of stdlib-js/stdlib, nodejs/node, prometheus/prometheus and vitejs/vite: the newest PRs by non-bot, non-maintainer authors with no merged PR in that repo before, that were closed or had a maintainer comment or review.

- **First set:** 20 per repo, opened on or before 2026-09-14. Rebuilt 80, excluded 0.
- **Held-out set:** 5 per repo, opened 15–18 Sep 2026; fewer than 5 means "take what exists", never widen the window. Rebuilt 19, excluded 0.

First set:

| Repo | PRs | Scanned | Skipped: maintainer | not new | bot | nobody looked |
|---|---|---|---|---|---|---|
| stdlib-js/stdlib | 20 | 350 | 258 | 38 | 19 | 15 |
| nodejs/node | 20 | 156 | 79 | 45 | 6 | 6 |
| prometheus/prometheus | 20 | 159 | 16 | 29 | 70 | 24 |
| vitejs/vite | 20 | 67 | 6 | 14 | 12 | 15 |

Held-out set:

| Repo | PRs | Scanned | Skipped: maintainer | not new | bot | nobody looked |
|---|---|---|---|---|---|---|
| stdlib-js/stdlib | 5 | 48 | 33 | 3 | 1 | 6 |
| nodejs/node | 5 | 34 | 16 | 10 | 2 | 1 |
| prometheus/prometheus | 4 | 38 | 15 | 5 | 0 | 14 |
| vitejs/vite | 5 | 9 | 1 | 2 | 0 | 1 |

Each PR was rebuilt as first submitted: original body (edit history), original title (first rename), commits from before the first force-push or dated by the PR's creation, and the linked issue's assignees at that time. MergeReady's history rules only used commits from before the PR was opened. MergeReady's real `analyze()` was called directly (not the HTTP route).

### Labels

A script suggested objections only from maintainer and bot activity (comments, reviews, maintainer edits, failed DCO/commitlint/semantic checks, author fixes right after such a trigger), never from MergeReady's output.

- **First set:** The first 4 PRs were labeled one by one by the author. For the remaining 76, an assistant drafted labels from neutral summaries using written criteria; the author read the draft and the notes on uncertain cases (A16, A29, A31, A33, A35, A38, A52) and approved it.
- **Held-out set:** Same method: an assistant (Claude chat) drafted these from the neutral summaries using the written criteria; the author read the draft and the notes on uncertain cases (H4a, H10, H12, H13b, H15) and approved it.
- In both sets the drafting assistant was separate from the assistant that wrote the summaries and ran this evaluation; the summarizing assistant made no labeling decisions. MergeReady had not been run on a set when its summaries were written.

Written criteria (written during the first set's labeling, before MergeReady was first run; reused unchanged for the held-out set):

- A failed "Check Contributing Guidelines Acceptance" check counts as a template objection.
- A maintainer only removing "(issue #...)" from an already valid title is not a commit-format objection.
- Failed lint-commit-message or DCO checks count as objections.
- Maintainer requests about code content are not-checkable.
- Closed without merge while referencing another PR counts as not-checkable (likely duplicate).
- PRs with only bot welcome or "may be AI-generated" messages have no objections.

- First set: Script suggestions: 30 (confirmed 21, rejected 8, changed 1). Objections added that the script missed: 15.
- Held-out set: Script suggestions: 13 (confirmed 9, rejected 4, changed 0). Objections added that the script missed: 5.

### Scoring

One unit = one (PR, rule type) pair, 6 rule types per PR. A pair is flagged when that rule type's check is red or yellow. Recall = flagged objections / objections. Precision = flags matching an objection / flags. 95% Wilson intervals. "Not-checkable" objections are counted but not scored.

## What changed in MergeReady between the runs

Designed after the first run, as general rules (no repo-specific cases); see CLAUDE.md:

1. **Severity from the source's words.** A failed rule is red only for config rules or when its own words say must / required / mandatory / cannot be merged / will be closed / will not be accepted. Everything else is yellow.
2. **Templates.** HTML comments and examples ("e.g. `fixes #123`") never create a rule. "If it applies", "if applicable", "optional", "remove if" make things optional. A linked-issue rule without strict words is a reminder ("manual"), not a flag.
3. **Empty template sections** are flagged only when the template marks them required; a leftover `{{...}}` placeholder elsewhere is yellow.
4. **Commit history** also learns a lowercase "prefix: message" format (like node's "subsystem: message") at 90%, as a yellow rule. Two commits sharing one PR-URL mean the repo keeps each PR's commits.

First run, where the flags came from (top 10):

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

After fixes, same data:

| Check | Flags |
|---|---|
| stdlib-js/stdlib · template-checkboxes:1 (yellow) | 7 |
| nodejs/node · dco-signoff (red) | 7 |
| nodejs/node · tests-changed (yellow) | 7 |
| stdlib-js/stdlib · tests-changed (yellow) | 4 |
| nodejs/node · commit-format:commits (yellow) | 2 |
| prometheus/prometheus · dco-signoff (yellow) | 2 |
| stdlib-js/stdlib · commit-format:pr-title (yellow) | 1 |
| prometheus/prometheus · tests-changed (yellow) | 1 |

<details><summary>Full tables: first run (before fixes)</summary>

| Overall | Objections | Flags | Recall | Precision | Precision (red) | Precision (yellow) |
|---|---|---|---|---|---|---|
| All | 18 | 90 | 9/18 = 50% (29–71%) | 9/90 = 10% (5–18%) | 7/55 = 13% (6–24%) | 2/35 = 6% (2–19%) |

| Rule type | Objections | Flags | Recall | Precision | Precision (red) | Precision (yellow) |
|---|---|---|---|---|---|---|
| conventional-commits | 7 | 1 | 0/7 = 0% (0–35%) | 0/1 = 0% (0–79%) | 0/0 (no data) | 0/1 = 0% (0–79%) |
| pr-template | 9 | 21 | 7/9 = 78% (45–94%) | 7/21 = 33% (17–55%) | 7/21 = 33% (17–55%) | 0/0 (no data) |
| linked-issue | 0 | 47 | 0/0 (no data) | 0/47 = 0% (0–8%) | 0/34 = 0% (0–10%) | 0/13 = 0% (0–23%) |
| dco-signoff | 2 | 9 | 2/2 = 100% (34–100%) | 2/9 = 22% (6–55%) | 0/0 (no data) | 2/9 = 22% (6–55%) |
| issue-assigned | 0 | 0 | 0/0 (no data) | 0/0 (no data) | 0/0 (no data) | 0/0 (no data) |
| tests-changed | 0 | 12 | 0/0 (no data) | 0/12 = 0% (0–24%) | 0/0 (no data) | 0/12 = 0% (0–24%) |

| Repo | Objections | Flags | Recall | Precision | Precision (red) | Precision (yellow) |
|---|---|---|---|---|---|---|
| stdlib-js/stdlib | 8 | 22 | 6/8 = 75% (41–93%) | 6/22 = 27% (13–48%) | 6/17 = 35% (17–59%) | 0/5 = 0% (0–43%) |
| nodejs/node | 6 | 27 | 0/6 = 0% (0–39%) | 0/27 = 0% (0–12%) | 0/0 (no data) | 0/27 = 0% (0–12%) |
| prometheus/prometheus | 3 | 33 | 3/3 = 100% (44–100%) | 3/33 = 9% (3–24%) | 1/30 = 3% (1–17%) | 2/3 = 67% (21–94%) |
| vitejs/vite | 1 | 8 | 0/1 = 0% (0–79%) | 0/8 = 0% (0–32%) | 0/8 = 0% (0–32%) | 0/0 (no data) |

PRs with a not-checkable objection (not scored): stdlib-js/stdlib 9, nodejs/node 4, prometheus/prometheus 3, vitejs/vite 3.

</details>

<details><summary>Full tables: after fixes (optimistic, same data)</summary>

| Overall | Objections | Flags | Recall | Precision | Precision (red) | Precision (yellow) |
|---|---|---|---|---|---|---|
| All | 18 | 31 | 9/18 = 50% (29–71%) | 9/31 = 29% (16–47%) | 0/7 = 0% (0–35%) | 9/24 = 38% (21–57%) |

| Rule type | Objections | Flags | Recall | Precision | Precision (red) | Precision (yellow) |
|---|---|---|---|---|---|---|
| conventional-commits | 7 | 3 | 1/7 = 14% (3–51%) | 1/3 = 33% (6–79%) | 0/0 (no data) | 1/3 = 33% (6–79%) |
| pr-template | 9 | 7 | 6/9 = 67% (35–88%) | 6/7 = 86% (49–97%) | 0/0 (no data) | 6/7 = 86% (49–97%) |
| linked-issue | 0 | 0 | 0/0 (no data) | 0/0 (no data) | 0/0 (no data) | 0/0 (no data) |
| dco-signoff | 2 | 9 | 2/2 = 100% (34–100%) | 2/9 = 22% (6–55%) | 0/7 = 0% (0–35%) | 2/2 = 100% (34–100%) |
| issue-assigned | 0 | 0 | 0/0 (no data) | 0/0 (no data) | 0/0 (no data) | 0/0 (no data) |
| tests-changed | 0 | 12 | 0/0 (no data) | 0/12 = 0% (0–24%) | 0/0 (no data) | 0/12 = 0% (0–24%) |

| Repo | Objections | Flags | Recall | Precision | Precision (red) | Precision (yellow) |
|---|---|---|---|---|---|---|
| stdlib-js/stdlib | 8 | 12 | 6/8 = 75% (41–93%) | 6/12 = 50% (25–75%) | 0/0 (no data) | 6/12 = 50% (25–75%) |
| nodejs/node | 6 | 16 | 1/6 = 17% (3–56%) | 1/16 = 6% (1–28%) | 0/7 = 0% (0–35%) | 1/9 = 11% (2–44%) |
| prometheus/prometheus | 3 | 3 | 2/3 = 67% (21–94%) | 2/3 = 67% (21–94%) | 0/0 (no data) | 2/3 = 67% (21–94%) |
| vitejs/vite | 1 | 0 | 0/1 = 0% (0–79%) | 0/0 (no data) | 0/0 (no data) | 0/0 (no data) |

PRs with a not-checkable objection (not scored): stdlib-js/stdlib 9, nodejs/node 4, prometheus/prometheus 3, vitejs/vite 3.

</details>

## What the results show

- **Linked-issue false alarms are gone.** The first run had 47 linked-issue flags and 0 objections, all from template or doc text (examples, comments, "If it applies"). After the fix: 0 on the same data, 0 on held-out.
- **Template:** stdlib's contributing-guidelines checkbox still catches what stdlib's bot enforces, now as yellow (the template says "please ensure", not "must").
- **Commit format is the weak spot.** The prefix rule only checks the first line's shape. node's linter also checks line length (72 columns), the subsystem name and the sign-off line, so most node commit-format objections are still missed.
- **Red flags:** every red flag of the fixed tool came from node's docs saying commits "must" have a Signed-off-by line. By the locked labels they match nothing; in the sensitivity check 4 of 7 (same data) and 2 of 2 (held-out) match a sign-off failure that node's linter reported.
- **Tests:** yellow tests flags (from CONTRIBUTING text) are mostly not raised by maintainers.

## Deviations from SELECTION.md

1. **Change 1 (first set).** The first selection run counted PRs opened after the cutoff toward the 400-PR scan limit, giving stdlib 3 and node 17 PRs. The limit now counts only PRs opened on or before the cutoff, the same for all repos. Recorded before the re-run.
2. **Boilerplate bot comments.** Bot messages posted with the same text on 3+ PRs in a set (for example welcome notes and "may be AI-generated" notes) were not used for suggestions.
3. **"Maintainer comment" as a trigger** was read as a comment that raised something; an author change after an approval ("LGTM") was not counted.
4. **Suggestion patterns** for not-checkable requests were widened once after reading the first set's comments (before MergeReady was first run).
5. **Guidelines check.** stdlib's "Check Contributing Guidelines Acceptance" was not in the pre-registered check list; the written criteria counted it as a template objection.
6. **Labeling method (first set).** Planned as a one-by-one review; after 4 PRs it changed to the batch review described in Method.
7. **Held-out network errors.** The first rebuild of the held-out set lost 2 stdlib PRs to GitHub timeouts. That is a network error, not a PR that can't be rebuilt, so the stage was run again (cached answers reused) and all 19 were rebuilt, before any summary or label.
8. **Sensitivity check** (above) was added after the held-out run and does not replace the locked labels.

## Limitations

- **Small samples.** Held-out: 19 PRs (prometheus had only 4 in the window), 5 checkable objections. A few PRs more or less can move the numbers a lot.
- **Repeat authors.** Held-out: stdlib: @himayurjogade (2), stdlib: @Abhist17 (3), vite: @scs0209 (2). First set: stdlib: @Devansh-18155 (2), stdlib: @himayurjogade (5), node: @colinhacks (2), prometheus: @simpleqt (2), prometheus: @youdie006 (3), prometheus: @shilohlee98 (2), vite: @mrchatam (2), vite: @scs0209 (2), vite: @Bhumika-1432006 (2), vite: @QuarkOS (2). Their PRs are not independent.
- **Young PRs.** Held-out PRs were 10–13 days old; some are still open, so objections may be missing.
- **Today's guideline files.** Rules were read from the files as of 28 Sep, not from each PR's day. The PR templates, CONTRIBUTING files and node's pull-requests.md did not change during the first set's window, except vite's CONTRIBUTING.md (2 commits).
- **Approximate rebuild.** Commits added later without a force-push are told apart by date.
- **"Not raised" is not proof of a false alarm.** Maintainers may fix things silently, or not care in one PR but care in another.
- **Maintainers** were identified by GitHub's current author association; triagers without that association were missed.
- **One human labeler** (with an assistant's draft), so no agreement between independent labelers could be measured. The category rules themselves can hide real hits (see the sensitivity check).
- **The fixes were designed on the first set.** Only the held-out numbers test them fairly.

## Files

`eval/SELECTION.md` (rules and held-out addendum), `eval/data/` (first set) and `eval/data/heldout/` (dataset, rebuilt PRs, locked labels), `eval/REVIEW.md` and `eval/REVIEW-heldout.md` (neutral summaries), `eval/results.json`, `eval/results.after-fixes.json`, `eval/results.heldout.json` (every flag and check), `eval/data/node-lint-reasons.json`. Regenerate this report: `node --import tsx eval/run.ts report` (no API calls).
