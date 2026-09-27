# MergeReady

## What this is
A web app that helps first-time open-source contributors get their first
Pull Request merged. Given a GitHub repo + issue or PR link, it:
1. Checks BEFORE starting work: is the issue already assigned/claimed,
   is there already an open PR for it, is the repo active.
2. Checks BEFORE submitting: does the PR follow this repo's own rules
   (CONTRIBUTING.md, PR template, commit style, DCO, issue link, tests).
3. Shows a journey map (Issue → Work → Commit → PR → Merge) with
   green/yellow/red status, and a ready-to-copy PR description.

Built solo for the FirstCommit hackathon (Devpost), deadline 30 Sep 2026.

## Core architecture rule (never break this)
- No AI API anywhere. Rules come only from the repo's config files and
  exact sentences in its docs, or from counting the repo's recent
  commits, extracted by deterministic TypeScript in /lib/rules. Every
  rule MUST have a sourceQuote (exact text from the file) and a
  sourceUrl (link to where it came from). For history rules, sourceQuote
  is a computed statistic (clearly labelled as such in the UI) and
  sourceUrl links to those exact commits.
- All actual verification is deterministic TypeScript code in
  /lib/checks.
- Rule confidence: config > template > history > prose. Relevant
  CONTRIBUTING sections are also shown to the user as "read this yourself".
- History rules are habits, not enforcement: a failed history rule is
  shown yellow ("recommended"), never red.

## Rule extraction decisions (approved)
- Config files (commitlint, package.json "commitlint", .github/dco.yml,
  workflows) are fetched with ONE GitHub GraphQL query.
- YAML is parsed with the `yaml` package (parse only). JS configs are
  never executed; they are read with regex only.
- PR template checkboxes are classified, never all required:
  "checklist"/"before submitting"/"I have"/"I confirm"/"make sure" ->
  required; "type of change"/"select one"/"check one"/"choose" -> pick
  at least one; "optional"/"if applicable"/"check all that apply" ->
  optional; unclear -> unknown (manual item, never a failure).
  When signals conflict: pick-one > optional > required. Only the
  nearest heading counts (a "### AI Assistance" Yes/No group under
  "## Checklist" must not become required). A visible line right above
  the boxes starting with "If ..." makes that group optional.
- A template section is optional when it says "optional", "if
  applicable", "remove/delete this section", or its first sentence
  starts with "If ...".
- History: last 50 default-branch commits (one REST call). Merges and
  bots ("[bot]", "-bot", type Bot) are skipped; at least 15 must remain.
  >= 90% Conventional Commits (real types only, not node's "subsystem:")
  or >= 90% "Signed-off-by" -> rule. If more than half have a merge-time
  signal (subject ends "(#123)" or a "PR-URL:" trailer), the
  conventional rule applies to the PR title, otherwise to commits.

## Check decisions (approved)
- Pre-start: archived repo, closed issue, assigned to someone else =
  red; claims in comments, open PRs mentioning the issue, no push for
  180+ days = yellow. Optional `username`: their own claims/PRs don't
  count, and being assigned passes. Bot comments are never claims. A
  claim older than 30 days with no open PR by that person gets its own
  "Claimed N days ago with no PR yet" message (still yellow).
- Status "pending" = waiting for maintainer review (merge stage).
- One check per template section and per checkbox group. Template text
  left unchanged (e.g. stdlib's "No.") is "manual", not a failure;
  "{{...}}" placeholders are failures. The PR description generator
  never ticks a box (it unticks pre-ticked ones).

## Server decisions (approved)
- POST /api/analyze { url, username? }: 25s budget for the whole
  analysis (maxDuration 30). Caches: rules per repo 10 min, issue/PR
  data 60 s. Per-IP limit 10/min and 60/hour; requests fully served
  from cache don't count (they cost no GitHub calls).
- In PR mode the generated text is labelled "Suggested description".
- Scripts (e.g. the 29 Sep evaluation script) must call analyze() from
  lib/server/analyze.ts directly, NOT the HTTP route, so they never hit
  our own rate limit.

## Tech
- Next.js (App Router) + TypeScript + Tailwind
- This project uses Next.js 16. Its APIs may differ from your training
  data. Before writing Next.js-specific code (routes, config, layout),
  check the docs in node_modules/next/dist/docs.
- GitHub REST API via Octokit (server-side, token in GITHUB_TOKEN);
  config files come from one GraphQL query (octokit.graphql)
- `yaml` package to parse YAML config files (parse only)
- Vitest for tests of every check function
- Deployed on Vercel
- Never hardcode secrets. Use .env.local and keep it in .gitignore.

## MVP scope (do nothing outside this)
Supported rule types: conventional commit format, PR template
checkboxes/sections filled, linked issue, DCO sign-off, issue assigned
to author, test files changed when code changed.
OUT of scope: login, GitHub App/bot, code quality review, i18n,
anything not listed above. If I ask for something out of scope,
remind me of this list first.

## Quality bar (no compromises)
- Real-world first: every check must work on real repos, not just
  mock data. Test fixtures should use real CONTRIBUTING files and
  PR templates from popular repos.
- Never crash: handle rate limits, private/missing repos, 404s,
  huge files, repos with no guidelines, and broken config files. Every
  failure shows a clear, friendly message.
- Repo files are untrusted input: parse them defensively (bad JSON/YAML
  gives a warning, never a crash) and never execute them.
- TypeScript strict, no `any`, lint clean.
- Security: tokens only on the server, never logged or sent to the
  browser. Validate all user input.
- Fast: cache GitHub responses; show progress steps while loading.
- Accessible, mobile-first UI with good contrast and keyboard support.
- Before saying a step is done: run tests, lint and build, and show
  me the results.
- Be honest: if something is weak, fragile, or a shortcut, tell me
  directly instead of hiding it.

## How to work with me (very important)
- I am a first-year student and must be able to explain every line
  to hackathon judges. Explain decisions in simple Bengali (Banglish ok).
- Before writing code: explain the plan, list files you will touch,
  and WAIT for my approval.
- Work in small steps. After each step, stop and suggest a
  conventional commit message. Only run git commands when I
  explicitly ask. Always show me the exact commands before running.
- When I say "learning mode": do NOT write the code. Give me the
  function signature, hints, and failing tests. I write it, you review.
- Never add features, libraries or files I didn't approve.

## Current status
Day 2 done: rule extraction complete (config, template, history,
prose). Next (28 Sep): checks in /lib/checks, API route, UI.

## Known limitations
- Linked docs: only one level deep, max 3 files / 150KB, picked by
  file name and link text only. Repos whose doc names don't mention
  PR/commit/first-timer words (e.g. stdlib-js/stdlib) get no extra
  docs. Links to folders are not followed. External guides
  (facebook/react) can't be read; a warning shows the URL.
- stdlib's commit rules link to a folder (docs/style-guides/git), so
  they are missed. Full GitHub URLs are always read from the default
  branch, and branch names with "/" give a wrong path (skipped as 404).
- Timeout is per request; a total time budget for the whole analysis
  will be added in the API route.
- Fine-grained tokens hide cross-referenced timeline events. Use a
  classic token with no scopes.
- Issue timeline: max 3 pages. With more, page 1 + the last 2 pages
  are read and the middle is skipped (with a warning).
- Open PRs for an issue come from "cross-referenced" events, so a PR
  that only mentions the issue is listed too. PRs linked by hand in the
  sidebar ("connected" events) are missed: REST doesn't say which PR.
- Repo activity uses pushed_at, which bots also update.
- New contributor = 0 merged PRs via the search API (30 requests/min).
  OWNER/MEMBER/COLLABORATOR and bots are never new. If search fails,
  falls back to author_association (often "NONE" even for a first PR),
  with a warning. Search index can lag behind very recent merges.
- PR commits: GitHub lists at most 250. Files: first 300. A warning
  shows when more exist.
- Linked issues: only closing keywords (fixes/closes/resolves) for the
  same repo; GitHub only honours them when the PR targets the default
  branch (targetsDefaultBranch). "Fixes #1, #2" links only #1, like GitHub.
- Rule extraction (prose): English only, keyword patterns. Rules phrased
  in unusual ways are missed; weak matches happen (e.g. a how-to step
  "Add tests to the package test file(s)"). Every rule shows its quote
  so the user can judge.
- commitlint JS configs are read with regex, never run. Configs built
  with require()/variables (stdlib-js/stdlib) give a warning and no rule.
  Default type lists for config-conventional/angular and the semantic PR
  action are copied by hand. Sub-folder (monorepo) configs are not read.
- DCO: the DCO GitHub App is invisible without .github/dco.yml (most
  CNCF repos), and dco.yml doesn't prove the app is installed. Comment
  "signatures" (carbon's cla-assistant "DCO") are not commit sign-off.
- Workflows: only `uses:` action names and `run:` lines with
  "commitlint" or "Signed-off-by" count. Custom validators like node's
  core-validate-commit are not recognised. All workflow files are
  downloaded in the one GraphQL query (stdlib: ~500KB, ~3s).
- PR templates: HTML comments are not parsed as markdown (node's
  template is one big comment, so it gives no rules). "check only 1"
  becomes pick-at-least-one (no exactly-one). "the boxes that apply"
  without "all" is not optional (home-assistant's Checklist = required).
- "Read this yourself": max 6 sections x 4000 chars, linked by line.
  Setext headings (underlined with ===) are not recognised.
- History rules: only the newest 50 commits, so a repo that changed its
  habits recently can mislead either way. Squash vs. commit is guessed
  from "(#123)" / "PR-URL:"; nodejs/node lands with "PR-URL:" but keeps
  contributor commits, so a conventional rule there would wrongly say
  "PR title" (node has no such rule today). Bot accounts named without
  "bot" are counted as people.
- Checks: claims are found with English patterns ("I'd like to work
  on", "can I be assigned", "/assign"). Test files are recognised by
  path/name conventions; docs/, examples/, benchmarks/ never need tests.
  Merge commits in a PR are spotted by a "Merge " message prefix. The
  DCO fix suggests "git rebase --signoff HEAD~N", which assumes the PR's
  commits are the last N. Only the PR's first linked issue is checked
  for assignment. Template sections are matched by heading text, so a
  renamed heading counts as missing.
