# Labeling: what did maintainers object to?

19 PRs · 13 suggestions · 10 PRs with no suggestion · 20 boilerplate bot comments ignored (same text on 3+ PRs).

**How to review** (decisions go in `eval/data/labels.json`):

1. For each PR, read its block in eval/LABELING.md (links first, suggestions marked with ➤).
2. For each suggestion, set "decision" to "confirm", "reject", or "change:<category>" (e.g. "change:tests").
3. If the maintainers objected to something the script missed, add it to "added": { "category": "...", "evidence": "<link or quote>" }.
4. Set "reviewed": true when done with a PR (a PR with no suggestions and nothing to add still needs "reviewed": true).
5. Only count what maintainers or bots raised BEFORE the PR was merged or closed.

Categories: `template`, `commit-format`, `dco`, `linked-issue`, `tests`, `assignment`, `not-checkable`. `not-checkable` = code quality, design, duplicate, other.

Suggestions come only from maintainer and bot activity on each PR, never from MergeReady's output. Rules: `eval/SELECTION.md`.

## stdlib-js/stdlib

### stdlib-js/stdlib#15330 · merged

<https://github.com/stdlib-js/stdlib/pull/15330> · by @himayurjogade

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (2)</summary>

- stdlib-bot (bot), comment: “## Coverage Report No coverage information available.” [↗](https://github.com/stdlib-js/stdlib/pull/15330#issuecomment-5863665708)
- kgryte (MEMBER), review: “LGTM” [↗](https://github.com/stdlib-js/stdlib/pull/15330#pullrequestreview-5334218934)

</details>

### stdlib-js/stdlib#15317 · open

<https://github.com/stdlib-js/stdlib/pull/15317> · by @Abhist17 · first commit failed: Check Contributing Guidelines Acceptance

- ➤ **`template`** ← comment by stdlib-bot (bot): “2. Update your pull request description to include this checked box:” [↗](https://github.com/stdlib-js/stdlib/pull/15317#issuecomment-5726304059)
  - also: author fix by Abhist17: “Author edited the description” [↗](https://github.com/stdlib-js/stdlib/pull/15317)
- ➤ **`not-checkable`** ← comment by kgryte (MEMBER): “@nakul-krishnakumar Would you mind doing an initial review of this PR? Cheers!” [↗](https://github.com/stdlib-js/stdlib/pull/15317#issuecomment-5854387212)

<details><summary>Maintainer and bot comments (2)</summary>

- stdlib-bot (bot), comment: “Hello! Thank you for your contribution to stdlib. We noticed that the contributing guidelines acknowledgment is missing from your pull request. Here's what you …” [↗](https://github.com/stdlib-js/stdlib/pull/15317#issuecomment-5726304059)
- kgryte (MEMBER), comment: “@nakul-krishnakumar Would you mind doing an initial review of this PR? Cheers!” [↗](https://github.com/stdlib-js/stdlib/pull/15317#issuecomment-5854387212)

</details>

### stdlib-js/stdlib#15297 · closed

<https://github.com/stdlib-js/stdlib/pull/15297> · by @Abhist17

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (2)</summary>

- kgryte (MEMBER), comment: “Ref: https://github.com/stdlib-js/stdlib/pull/15177” [↗](https://github.com/stdlib-js/stdlib/pull/15297#issuecomment-5826614963)
- stdlib-bot (bot), comment: “Thank you for working on this pull request. However, we cannot accept your contribution as the issue this pull request seeks to resolve has already been address…” [↗](https://github.com/stdlib-js/stdlib/pull/15297#issuecomment-5826617071)

</details>

### stdlib-js/stdlib#15293 · merged

<https://github.com/stdlib-js/stdlib/pull/15293> · by @Abhist17 · first commit failed: Lint Changed Files

- ➤ **`tests`** ← comment by stdlib-bot (bot): “3. You'll need to address any failures in linting or unit tests.” [↗](https://github.com/stdlib-js/stdlib/pull/15293#issuecomment-5711826216)
- ➤ **`not-checkable`** ← review comment by kgryte (MEMBER): “Suggested a code change” [↗](https://github.com/stdlib-js/stdlib/pull/15293#discussion_r4080659363)
  - also: review comment by kgryte (MEMBER): “Suggested a code change” [↗](https://github.com/stdlib-js/stdlib/pull/15293#discussion_r4080661117)
  - also: author fix by Abhist17: “Author added commit "Apply batched suggestions from code review"” [↗](https://github.com/stdlib-js/stdlib/pull/15293)
- ➤ **`commit-format`** ← maintainer title edit by kgryte: “Title changed: "chore: fix JavaScript lint errors (issue #15228)" → "chore: fix JavaScript lint errors"” [↗](https://github.com/stdlib-js/stdlib/pull/15293)

<details><summary>Maintainer and bot comments (5)</summary>

- stdlib-bot (bot), comment: “:wave: Hi there! :wave: And thank you for opening your first pull request! We will review it shortly. :runner: :dash: ## Getting Started - Please read our [cont…” [↗](https://github.com/stdlib-js/stdlib/pull/15293#issuecomment-5711826216)
- kgryte (MEMBER), review: “LGTM” [↗](https://github.com/stdlib-js/stdlib/pull/15293#pullrequestreview-5288779707)
- stdlib-bot (bot), comment: “## Coverage Report | Package | Statements | Branches | Functions | Lines | | --------- | ------------ | ---------- | ----------- | ----- | | &lt;a href= https:/…” [↗](https://github.com/stdlib-js/stdlib/pull/15293#issuecomment-5791861605)
- kgryte (MEMBER), review-comment: “```suggestion var hasToPrimitiveSymbolSupport = require( '@stdlib/assert/has-to-primitive-symbol-support' ); // eslint-disable-line id-length ```” [↗](https://github.com/stdlib-js/stdlib/pull/15293#discussion_r4080659363)
- kgryte (MEMBER), review-comment: “```suggestion t.strictEqual( Sym, Symbol.toPrimitive, 'returns expected value' ); ```” [↗](https://github.com/stdlib-js/stdlib/pull/15293#discussion_r4080661117)

</details>

### stdlib-js/stdlib#15289 · merged

<https://github.com/stdlib-js/stdlib/pull/15289> · by @himayurjogade

- ➤ **`not-checkable`** ← review comment by kgryte (MEMBER): “Suggested a code change” [↗](https://github.com/stdlib-js/stdlib/pull/15289#discussion_r4118856551)
  - also: author fix by himayurjogade: “Author added commit "style: add empty line"” [↗](https://github.com/stdlib-js/stdlib/pull/15289)
  - also: review comment by kgryte (MEMBER): “Suggested a code change” [↗](https://github.com/stdlib-js/stdlib/pull/15289#discussion_r4118870386)
  - and 1 more

<details><summary>Maintainer and bot comments (4)</summary>

- stdlib-bot (bot), comment: “## Coverage Report | Package | Statements | Branches | Functions | Lines | | --------- | ------------ | ---------- | ----------- | ----- | | &lt;a href= https:/…” [↗](https://github.com/stdlib-js/stdlib/pull/15289#issuecomment-5863664719)
- kgryte (MEMBER), review-comment: “```suggestion // cppcheck-suppress invalidPointerCast ```” [↗](https://github.com/stdlib-js/stdlib/pull/15289#discussion_r4118856551)
- kgryte (MEMBER), review-comment: “```suggestion #include &lt;stdint.h> #include &lt;stdbool.h> ```” [↗](https://github.com/stdlib-js/stdlib/pull/15289#discussion_r4118870386)
- kgryte (MEMBER), review: “LGTM” [↗](https://github.com/stdlib-js/stdlib/pull/15289#pullrequestreview-5334349390)

</details>

## nodejs/node

### nodejs/node#66113 · closed

<https://github.com/nodejs/node/pull/66113> · by @adnankhan123-hub · first commit failed: **lint-commit-message** (used)

- ➤ **`commit-format`** ← failed check by GitHub Actions: “Check "lint-commit-message" failed on the first commit” [↗](https://github.com/nodejs/node/runs/105706369254)

### nodejs/node#66088 · merged

<https://github.com/nodejs/node/pull/66088> · by @xia-chao · first commit failed: **lint-commit-message** (used)

- ➤ **`commit-format`** ← failed check by GitHub Actions: “Check "lint-commit-message" failed on the first commit” [↗](https://github.com/nodejs/node/runs/105240254711)
  - also: author fix by xia-chao: “Author force-pushed new commits” [↗](https://github.com/nodejs/node/pull/66088)

### nodejs/node#66085 · merged

<https://github.com/nodejs/node/pull/66085> · by @osztenkurden

- ➤ **`not-checkable`** ← review by avivkeller (MEMBER): “LGTM, and thanks for the ping! just note it's differing from the HTML Spec (which is fine, but @nodejs/web-standards should take a look)” [↗](https://github.com/nodejs/node/pull/66085#pullrequestreview-5291380630)
  - also: review comment by avivkeller (MEMBER): “Can we lazy load this with `getLazy`?” [↗](https://github.com/nodejs/node/pull/66085#discussion_r4082769759)
  - also: comment by KhafraDev (MEMBER): “Why would *web* workers strip types?” [↗](https://github.com/nodejs/node/pull/66085#issuecomment-5795740645)
  - and 3 more

<details><summary>Maintainer and bot comments (11)</summary>

- nodejs-github-bot (bot), comment: “Review requested: - [ ] @nodejs/typescript” [↗](https://github.com/nodejs/node/pull/66085#issuecomment-5714209199)
- avivkeller (MEMBER), review: “LGTM, and thanks for the ping! just note it's differing from the HTML Spec (which is fine, but @nodejs/web-standards should take a look)” [↗](https://github.com/nodejs/node/pull/66085#pullrequestreview-5291380630)
- avivkeller (MEMBER), review-comment: “You might wanna add a note to the section on spec differences” [↗](https://github.com/nodejs/node/pull/66085#discussion_r4082759097)
- avivkeller (MEMBER), review-comment: “Can we lazy load this with `getLazy`?” [↗](https://github.com/nodejs/node/pull/66085#discussion_r4082769759)
- KhafraDev (MEMBER), comment: “Why would *web* workers strip types?” [↗](https://github.com/nodejs/node/pull/66085#issuecomment-5795740645)
- jasnell (MEMBER), review-comment: “I'm wondering if we should mark this experimental on it's own, at least initially.” [↗](https://github.com/nodejs/node/pull/66085#discussion_r4083886994)
- jasnell (MEMBER), review-comment: “Should likely also list this in the "Differences from the HTML Standard" section” [↗](https://github.com/nodejs/node/pull/66085#discussion_r4083922163)
- jasnell (MEMBER), review: “Generally LGTM but I think we should probably handle it as independently experimental in case we need to tweak it separately from graduating the main web worker…” [↗](https://github.com/nodejs/node/pull/66085#pullrequestreview-5292774310)
- KhafraDev (MEMBER), comment: “I'm fine with it landing.” [↗](https://github.com/nodejs/node/pull/66085#issuecomment-5798715952)
- mcollina (MEMBER), review: “lgtm” [↗](https://github.com/nodejs/node/pull/66085#pullrequestreview-5299846520)
- nodejs-github-bot (bot), comment: “### Commit Queue failed This pull request has multiple commits, but no landing policy was selected. Add https://github.com/nodejs/node/labels/commit-queue-squas…” [↗](https://github.com/nodejs/node/pull/66085#issuecomment-5844028521)

</details>

### nodejs/node#66082 · open

<https://github.com/nodejs/node/pull/66082> · by @pkubaj

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (1)</summary>

- nodejs-github-bot (bot), comment: “Review requested: - [ ] @nodejs/gyp - [ ] @nodejs/startup” [↗](https://github.com/nodejs/node/pull/66082#issuecomment-5713134713)

</details>

### nodejs/node#66077 · open

<https://github.com/nodejs/node/pull/66077> · by @ammar3040 · first commit failed: **lint-commit-message** (used)

- ➤ **`commit-format`** ← failed check by GitHub Actions: “Check "lint-commit-message" failed on the first commit” [↗](https://github.com/nodejs/node/runs/105093373568)
  - also: author fix by ammar3040: “Author force-pushed new commits” [↗](https://github.com/nodejs/node/pull/66077)

<details><summary>Maintainer and bot comments (2)</summary>

- nodejs-github-bot (bot), comment: “Review requested: - [ ] @nodejs/tsc” [↗](https://github.com/nodejs/node/pull/66077#issuecomment-5709654764)
- mcollina (MEMBER), comment: “I think we can keep those there for now... ;).” [↗](https://github.com/nodejs/node/pull/66077#issuecomment-5711153820)

</details>

## prometheus/prometheus

### prometheus/prometheus#19746 · merged

<https://github.com/prometheus/prometheus/pull/19746> · by @Suhail98 · first commit failed: Go tests on Windows

No suggestions. Skim the comments below for anything missed.

### prometheus/prometheus#19736 · closed

<https://github.com/prometheus/prometheus/pull/19736> · by @hktitof · first commit failed: Go tests

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (1)</summary>

- roidelapluie (MEMBER), comment: “commented in the issue” [↗](https://github.com/prometheus/prometheus/pull/19736#issuecomment-5730464762)

</details>

### prometheus/prometheus#19722 · open

<https://github.com/prometheus/prometheus/pull/19722> · by @dmatth1

- ➤ **`not-checkable`** ← comment by bboreham (MEMBER): “I agree we should not silently drop data, however I don't think we should read the last sample value from every mmapped chunk, since that seems like an enormous amount of work.” [↗](https://github.com/prometheus/prometheus/pull/19722#issuecomment-5798528790)
  - also: author fix by dmatth1: “Author added commit "PR feedback: route mmap-only equal-timestamp appends through OOO"” [↗](https://github.com/prometheus/prometheus/pull/19722)
  - also: author fix by dmatth1: “Author added commit "PR feedback: verify mmap-only conflicts reach OOO storage"” [↗](https://github.com/prometheus/prometheus/pull/19722)
- ➤ **`template`** ← author fix by dmatth1: “Author edited the description” [↗](https://github.com/prometheus/prometheus/pull/19722)
  - also: author fix by dmatth1: “Author edited the description” [↗](https://github.com/prometheus/prometheus/pull/19722)
  - also: author fix by dmatth1: “Author edited the description” [↗](https://github.com/prometheus/prometheus/pull/19722)

<details><summary>Maintainer and bot comments (1)</summary>

- bboreham (MEMBER), comment: “> A series has mapped samples 100 → 1, 150 → 2 and a newer head sample 200 → 3. If recovery cannot rebuild that head chunk, a new 125 → 4 within the OOO window …” [↗](https://github.com/prometheus/prometheus/pull/19722#issuecomment-5798528790)

</details>

### prometheus/prometheus#19713 · open

<https://github.com/prometheus/prometheus/pull/19713> · by @AruneshDwivedi · first commit failed: golangci-lint

- ➤ **`tests`** ← comment by machine424 (MEMBER): “(As a side; please take a look at your PRs changes, at the CI, try to understand what is going on, to add tests etc before asking for reviews)” [↗](https://github.com/prometheus/prometheus/pull/19713#issuecomment-5720335961)

<details><summary>Maintainer and bot comments (1)</summary>

- machine424 (MEMBER), comment: “Thanks for the PR. But we usually try to agree on the change before opening PRs. Especially for such opinionated architectural choices. We need Remote-write mai…” [↗](https://github.com/prometheus/prometheus/pull/19713#issuecomment-5720335961)

</details>

## vitejs/vite

### vitejs/vite#23519 · merged

<https://github.com/vitejs/vite/pull/23519> · by @murugu-21 · first commit failed: Build&Test: node-20, ubuntu-latest

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (1)</summary>

- sapphi-red (MEMBER), review: “LGTM. I've also added the handling for `sources` field” [↗](https://github.com/vitejs/vite/pull/23519#pullrequestreview-5302967612)

</details>

### vitejs/vite#23517 · closed

<https://github.com/vitejs/vite/pull/23517> · by @GruffElixir

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (1)</summary>

- copilot-pull-request-reviewer (bot), review: “Copilot was unable to review this pull request because the user who requested the review has reached their quota limit.” [↗](https://github.com/vitejs/vite/pull/23517#pullrequestreview-5246680946)

</details>

### vitejs/vite#23516 · closed

<https://github.com/vitejs/vite/pull/23516> · by @murugappan-medme-1 · first commit failed: Build&Test: node-20, ubuntu-latest, Build&Test: node-24.15.0, windows-latest

No suggestions. Skim the comments below for anything missed.

### vitejs/vite#23509 · closed

<https://github.com/vitejs/vite/pull/23509> · by @scs0209 · first commit failed: Build&Test: node-24.15.0, windows-latest

No suggestions. Skim the comments below for anything missed.

### vitejs/vite#23507 · closed

<https://github.com/vitejs/vite/pull/23507> · by @scs0209 · first commit failed: Build&Test: node-24.15.0, windows-latest, Build&Test: node-22, ubuntu-latest

No suggestions. Skim the comments below for anything missed.
