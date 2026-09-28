# Evaluation: selection and labeling rules (fixed before running)

Written and committed on 2026-09-28, **before** any evaluation code was run
and before MergeReady was run on any PR in the dataset. The git history of
this file is the proof. If a rule below has to change, the change and the
reason go into REPORT.md; it must not be changed silently.

## Question

How well does MergeReady predict what maintainers actually object to in
first-time contributors' pull requests?

## Repos

stdlib-js/stdlib, nodejs/node, prometheus/prometheus, vitejs/vite.
The same rules apply to every repo.

## Which PRs (N = 20 per repo, 80 in total)

Go through each repo's pull requests from newest to oldest by creation time
and keep a PR only if ALL of these hold:

1. Created on or before **2026-09-14 23:59:59 UTC** (gives maintainers at
   least two weeks to respond).
2. The author is a person, not a bot (GitHub account type `User`, login not
   ending in `[bot]` or `-bot`).
3. The author is not a maintainer (their association is not OWNER, MEMBER or
   COLLABORATOR).
4. The author was a **new contributor** when the PR was opened: GitHub search
   finds 0 merged PRs by them in this repo, merged before this PR's creation
   time (`is:pr is:merged author:X merged:<createdAt`).
5. Someone looked at it: the PR is closed (merged or not) OR has at least one
   comment or review by a maintainer (OWNER, MEMBER or COLLABORATOR, not the
   author).

Keep the first 20 that pass. No other filtering or hand-picking. PRs where
maintainers raised nothing are kept on purpose (they measure false alarms).
At most 400 PRs per repo are scanned; if fewer than 20 pass, the report says
how many were found.

## Judging the PR as first submitted

Each PR is rebuilt as it was when opened: the original body (oldest entry in
the body's edit history), the original title (the first rename's old title),
and the original commits (from the first force-push's "before" commit when
there was one, otherwise the PR's commits; in both cases only commits dated
at or before the PR's creation plus 10 minutes). The linked issue's assignees
are taken as they were at the PR's creation time. A PR that can't be rebuilt
is excluded, and every exclusion is counted in the report with its reason.

## Labels (what maintainers objected to)

Categories: `template`, `commit-format` (commit messages or PR title), `dco`,
`linked-issue`, `tests`, `assignment`, and `not-checkable` (code quality,
design, duplicate, other).

The script suggests labels ONLY from what humans and bots did on the PR. It
never looks at MergeReady's output. Every suggestion shows its evidence (a
quote or an event, with a link). Evidence counts only if it happened before
the PR was merged or closed.

A suggestion needs one of:

- a comment or review by a maintainer (not the author), or by a bot, whose
  text matches the category;
- a **maintainer (not the author)** editing the title (commit-format) or the
  body (linked-issue if they added a "Fixes #", otherwise template);
- a **bot check that failed on the first commit** (DCO, commitlint, or a
  semantic PR title check);
- the **author** changing the title, body or commits **right after** (within
  48 hours) such a failing check or a maintainer comment.

An author editing their own PR with no such trigger is NOT an objection.

Then a person (the project author) reviews every suggestion (confirm, change
the category, or reject) and adds objections the script missed. The labels
are locked by committing them BEFORE MergeReady is run on the dataset. The
report states how many suggestions were confirmed, changed, rejected and
added.

## Scoring

Unit: one (PR, rule type) pair. MergeReady "flags" a pair when that rule
type's check is red or yellow for the rebuilt PR.

- Recall: checkable objections that MergeReady flagged / all checkable objections.
- Precision: flags that match an objection / all flags (red and yellow also
  reported separately).
- Flags with no matching objection are reported as "not raised by
  maintainers", not as proven false alarms: maintainers sometimes fix things
  silently.
- Every number is shown with its sample size (k/n) and a 95% Wilson interval,
  per rule type and per repo.

## Changes after the first run

**Change 1 (2026-09-28, before any PR was rebuilt or labeled, and before
MergeReady was run on the dataset).** The first selection run counted PRs
opened *after* the cutoff toward the "at most 400 PRs scanned" limit. stdlib
opened 378 PRs after the cutoff, so only 22 older PRs were looked at and just
3 passed; node found 17. The intended meaning was "at most 400 PRs opened on
or before the cutoff", so PRs after the cutoff no longer count toward the
limit. This applies to all four repos; prometheus and vite already had 20 and
don't change. The first run's numbers (stdlib 3, node 17) are reported in
REPORT.md.

## Addendum: held-out test (written 2026-09-28, before selecting any held-out PR)

After the first evaluation, MergeReady was changed (severity from the
source's words, template comments/examples never make rules, a "prefix:
message" history rule). Those changes were designed by looking at the 80 PRs
above, so re-scoring those same PRs is optimistic. It is reported separately
as "after fixes (optimistic, same data)". **The held-out numbers below are
the main result.**

1. **Frozen tool.** MergeReady is frozen at commit `3a8c9bb` (the last commit
   that changed `lib/`). No change to `lib/` is allowed until the held-out
   result is written. If the tool crashes on a held-out PR, that PR is
   reported as a failure; any fix would be a deviation reported in REPORT.md.
2. **Which PRs.** Same rules 2-5 as above, and the same rebuild rules. Rule 1
   becomes: created between **2026-09-15 00:00:00 UTC and 2026-09-18
   23:59:59 UTC**. Keep the **5** newest per repo that pass (20 in total).
   **If fewer than 5 pass in a repo, take what exists; the window is never
   widened.** The same 400-PR scan limit applies.
3. **Labels.** Same categories and suggestion rules as above. The assistant
   that runs this evaluation writes neutral summaries of maintainer and bot
   activity (no recommendations, no MergeReady output; MergeReady is not run
   on these PRs before the labels are locked). A separate assistant (Claude
   chat) drafts labels from those summaries using the same written criteria
   as the first evaluation (listed in REPORT.md). The project author reads
   the draft and approves it; the approved labels are recorded exactly.
4. **Lock, then run.** The held-out dataset is committed before summaries are
   written, and the labels are committed before MergeReady runs on them.
5. **Known weakness, stated now.** These PRs are only 10-13 days old, so some
   maintainer objections may not have happened yet, and 20 PRs give wide
   intervals.
