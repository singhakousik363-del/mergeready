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
  exact sentences in its docs, extracted by deterministic TypeScript in
  /lib/rules. Every rule MUST have a sourceQuote (exact text from the
  file) and a sourceUrl (link to where it came from).
- All actual verification is deterministic TypeScript code in
  /lib/checks.
- Rule confidence: config > template > prose. Relevant CONTRIBUTING
  sections are also shown to the user as "read this yourself".

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
Day 2: GitHub data layer done (guidelines, linked docs, issue, PR,
new-contributor detection). Decided: no AI API. Next: deterministic
rule extraction in /lib/rules.

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
