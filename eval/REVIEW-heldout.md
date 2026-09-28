# Held-out label review (19 PRs, opened 15–18 Sep 2026)

Neutral summaries of what maintainers and bots did on each PR, written by the assistant running the evaluation. No recommendations. MergeReady has **not** been run on these PRs, and its output is not shown.

## Task for the drafting assistant

For each PR, decide what the maintainers (or their bots) objected to **before the PR was merged or closed**, using the categories and written criteria below. Then give one reply in the format shown.

**Categories:** `template`, `commit-format` (commit messages or PR title), `dco`, `linked-issue`, `tests`, `assignment`, `not-checkable` (code quality, design, duplicate, other).

**Written criteria (same as the first evaluation):**

- A failed "Check Contributing Guidelines Acceptance" check counts as a template objection.
- A maintainer only removing "(issue #...)" from an already valid title is not a commit-format objection.
- Failed lint-commit-message or DCO checks count as objections.
- Maintainer requests about code content are not-checkable.
- Closed without merge while referencing another PR counts as not-checkable (likely duplicate).
- PRs with only bot welcome or "may be AI-generated" messages have no objections.

Other failing CI checks (tests, lint, builds) are not one of the categories unless a maintainer or bot raised them as one.

**Reply format** (one line):
`H1 none, H2a C, H2b R, H4a tests, H6 C, H11 add:template, …`

- `C` = confirm the script's suggestion · `R` = reject it · a category name = change the suggestion to that category
- `add:<category>` = add an objection the script missed · `none` = no objections
- Every H number needs an answer. For PRs with suggestions, answer each lettered suggestion.
- Also list any PRs you are unsure about, with one sentence each.

## PRs

Format: ID | link | script's suggestion(s) (from maintainer or bot activity only) | what happened

### stdlib-js/stdlib

H1 | https://github.com/stdlib-js/stdlib/pull/15330 | — | merged। maintainer শুধু "LGTM" লিখে approve করেছেন। bot-এর coverage report ছাড়া আর কিছু নেই।
H2 | https://github.com/stdlib-js/stdlib/pull/15317 | (a) template: প্রথম commit-এ "Check Contributing Guidelines Acceptance" fail করেছিল। bot লিখেছে description-এ guidelines-এর checkbox টিক দিয়ে যোগ করতে। পরে author description edit করেছেন। (b) not-checkable: maintainer আরেকজনকে "initial review" করতে বলেছেন | খোলা। maintainer নিজে কোনো পরিবর্তন চাননি।
H3 | https://github.com/stdlib-js/stdlib/pull/15297 | — | বন্ধ, merge হয়নি। maintainer শুধু আরেকটা PR-এর link দিয়েছেন ("Ref: …/pull/15177")। bot লিখেছে issue-টা আগেই সমাধান হয়ে গেছে, তাই এটা নেওয়া যাবে না।
H4 | https://github.com/stdlib-js/stdlib/pull/15293 | (a) tests: প্রথম PR-এর welcome bot message-এর একটা ধাপ: "lint বা unit test fail হলে ঠিক করতে হবে"। প্রথম commit-এ "Lint Changed Files" fail করেছিল। (b) not-checkable: maintainer code-এ দুটো পরিবর্তন প্রস্তাব করেছেন (একটা eslint-disable comment, একটা test assertion), author সেগুলো যোগ করেছেন। (c) commit-format: maintainer title-এর শেষ থেকে "(issue #15228)" মুছেছেন ("chore: fix JavaScript lint errors (issue #15228)" → "chore: fix JavaScript lint errors") | merged। maintainer "LGTM" লিখেছেন।
H5 | https://github.com/stdlib-js/stdlib/pull/15289 | not-checkable: maintainer code-এ কয়েকটা পরিবর্তন প্রস্তাব করেছেন (একটা cppcheck-suppress comment, #include লাইন), author commit যোগ করেছেন | merged। maintainer "LGTM" লিখেছেন।

### nodejs/node

H6 | https://github.com/nodejs/node/pull/66113 | commit-format: "lint-commit-message" check প্রথম commit-এ fail করেছিল | বন্ধ, merge হয়নি। শুধু সবাইকে পাঠানো welcome message আছে, কোনো maintainer comment নেই।
H7 | https://github.com/nodejs/node/pull/66088 | commit-format: "lint-commit-message" check প্রথম commit-এ fail করেছিল, পরে author force-push করেছেন | merged। কোনো maintainer comment নেই।
H8 | https://github.com/nodejs/node/pull/66085 | not-checkable: কয়েকজন maintainer code আর নকশা নিয়ে লিখেছেন (lazy load করা যায় কি না, HTML Standard-এর সাথে পার্থক্যের অংশে note যোগ করা, feature-টা আলাদাভাবে experimental রাখা, web worker কেন type strip করবে) | merged। কয়েকজন maintainer approve করেছেন। commit-queue bot লিখেছে PR-এ একাধিক commit আছে কিন্তু কোনো landing policy label বাছা হয়নি (এই label maintainer-রা দেন)।
H9 | https://github.com/nodejs/node/pull/66082 | — | খোলা। শুধু bot-এর review-request comment আছে। author নিজে description একবার edit করেছেন, আগে কোনো trigger ছাড়াই।
H10 | https://github.com/nodejs/node/pull/66077 | commit-format: "lint-commit-message" check প্রথম commit-এ fail করেছিল, পরে author force-push করেছেন | খোলা। একজন maintainer code-এর একটা অংশ নিয়ে লিখেছেন "I think we can keep those there for now"।

### prometheus/prometheus

H11 | https://github.com/prometheus/prometheus/pull/19746 | — | merged। কোনো comment নেই। প্রথম commit-এ "Go tests on Windows" fail করেছিল। author নিজে title বদলেছেন ("textparse: …" → "model/textparse: …"), description কয়েকবার edit করেছেন, আর তিনবার force-push করেছেন। এর আগে কোনো maintainer comment ছিল না।
H12 | https://github.com/prometheus/prometheus/pull/19736 | — | বন্ধ, merge হয়নি। maintainer লিখেছেন "commented in the issue"। author উত্তরে লিখেছেন তিনি এখন বিষয়টা বুঝেছেন। প্রথম commit-এ "Go tests" fail করেছিল।
H13 | https://github.com/prometheus/prometheus/pull/19722 | (a) not-checkable: maintainer approach নিয়ে লিখেছেন (data চুপচাপ বাদ দেওয়া উচিত না, কিন্তু প্রতিটা mmapped chunk থেকে শেষ sample পড়াটা অনেক বেশি কাজ)। পরে author "PR feedback: …" নামে commit যোগ করেছেন। (b) template: সেই comment-এর পরে author নিজে description কয়েকবার edit করেছেন | খোলা।
H14 | https://github.com/prometheus/prometheus/pull/19713 | tests: maintainer লিখেছেন PR খোলার আগে সাধারণত পরিবর্তনটা নিয়ে একমত হতে হয়, বিশেষ করে এমন architectural সিদ্ধান্তে, আর remote-write maintainer-দের মত লাগবে। পাশে লিখেছেন: review চাওয়ার আগে নিজের PR-এর পরিবর্তন আর CI দেখতে, আর test যোগ করতে | খোলা। প্রথম commit-এ "golangci-lint" fail করেছিল।

### vitejs/vite

H15 | https://github.com/vitejs/vite/pull/23519 | — | merged। maintainer "LGTM" লিখেছেন, আর জানিয়েছেন তিনি নিজে `sources` field-এর handling যোগ করেছেন। প্রথম commit-এ একটা Build&Test job fail করেছিল।
H16 | https://github.com/vitejs/vite/pull/23517 | — | বন্ধ, merge হয়নি। শুধু Copilot-এর "quota শেষ, review করা যায়নি" message, আর একটা bot PR-টাকে "bot/AI দিয়ে তৈরি হতে পারে" বলে চিহ্নিত করেছে (অনেক PR-এ পাঠানো message)। কোনো maintainer comment নেই।
H17 | https://github.com/vitejs/vite/pull/23516 | — | বন্ধ, merge হয়নি। কোনো comment নেই। প্রথম commit-এ দুটো Build&Test job fail করেছিল।
H18 | https://github.com/vitejs/vite/pull/23509 | — | বন্ধ, merge হয়নি। কোনো maintainer comment নেই। একটা bot PR-টাকে "bot/AI দিয়ে তৈরি হতে পারে" বলে চিহ্নিত করেছে। প্রথম commit-এ একটা Build&Test job fail করেছিল।
H19 | https://github.com/vitejs/vite/pull/23507 | — | বন্ধ, merge হয়নি। কোনো maintainer comment নেই। একটা bot PR-টাকে "bot/AI দিয়ে তৈরি হতে পারে" বলে চিহ্নিত করেছে, author সেটার উত্তর দিয়েছেন। প্রথম commit-এ দুটো Build&Test job fail করেছিল।
