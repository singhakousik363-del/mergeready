# Labeling: what did maintainers object to?

80 PRs · 30 suggestions · 51 PRs with no suggestion · 119 boilerplate bot comments ignored (same text on 3+ PRs).

**How to review** (decisions go in `eval/data/labels.json`):

1. For each PR, read its block in eval/LABELING.md (links first, suggestions marked with ➤).
2. For each suggestion, set "decision" to "confirm", "reject", or "change:<category>" (e.g. "change:tests").
3. If the maintainers objected to something the script missed, add it to "added": { "category": "...", "evidence": "<link or quote>" }.
4. Set "reviewed": true when done with a PR (a PR with no suggestions and nothing to add still needs "reviewed": true).
5. Only count what maintainers or bots raised BEFORE the PR was merged or closed.

Categories: `template`, `commit-format`, `dco`, `linked-issue`, `tests`, `assignment`, `not-checkable`. `not-checkable` = code quality, design, duplicate, other.

Suggestions come only from maintainer and bot activity on each PR, never from MergeReady's output. Rules: `eval/SELECTION.md`.

## stdlib-js/stdlib

### stdlib-js/stdlib#15218 · merged

<https://github.com/stdlib-js/stdlib/pull/15218> · by @Devansh-18155

- ➤ **`not-checkable`** ← review comment by kgryte (MEMBER): “All of these whitespace changes need to be reverted.” [↗](https://github.com/stdlib-js/stdlib/pull/15218#discussion_r4011761384)
  - also: review by kgryte (MEMBER): “Left initial comments.” [↗](https://github.com/stdlib-js/stdlib/pull/15218#pullrequestreview-5205308565)
  - also: author fix by Devansh-18155: “Author force-pushed new commits” [↗](https://github.com/stdlib-js/stdlib/pull/15218)

<details><summary>Maintainer and bot comments (3)</summary>

- kgryte (MEMBER), review-comment: “All of these whitespace changes need to be reverted.” [↗](https://github.com/stdlib-js/stdlib/pull/15218#discussion_r4011761384)
- kgryte (MEMBER), review: “Left initial comments.” [↗](https://github.com/stdlib-js/stdlib/pull/15218#pullrequestreview-5205308565)
- kgryte (MEMBER), review: “LGTM” [↗](https://github.com/stdlib-js/stdlib/pull/15218#pullrequestreview-5206453538)

</details>

### stdlib-js/stdlib#15215 · open

<https://github.com/stdlib-js/stdlib/pull/15215> · by @himayurjogade

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (1)</summary>

- Sachinn-64 (MEMBER), review: “LGTM.” [↗](https://github.com/stdlib-js/stdlib/pull/15215#pullrequestreview-5257560588)

</details>

### stdlib-js/stdlib#15208 · merged

<https://github.com/stdlib-js/stdlib/pull/15208> · by @Devansh-18155

No suggestions. Skim the comments below for anything missed.

### stdlib-js/stdlib#15199 · open

<https://github.com/stdlib-js/stdlib/pull/15199> · by @himayurjogade

- ➤ **`not-checkable`** ← review comment by Sachinn-64 (MEMBER): “Suggested a code change” [↗](https://github.com/stdlib-js/stdlib/pull/15199#discussion_r4064428975)
  - also: author fix by himayurjogade: “Author added commit "style: update output label"” [↗](https://github.com/stdlib-js/stdlib/pull/15199)
  - also: author fix by himayurjogade: “Author added commit "fix: reorder parameters in vector function for consistency"” [↗](https://github.com/stdlib-js/stdlib/pull/15199)

<details><summary>Maintainer and bot comments (2)</summary>

- Sachinn-64 (MEMBER), review-comment: “```suggestion printf( "mid-range: %f\n", v ); ```” [↗](https://github.com/stdlib-js/stdlib/pull/15199#discussion_r4064428975)
- Sachinn-64 (MEMBER), review: “LGTM.” [↗](https://github.com/stdlib-js/stdlib/pull/15199#pullrequestreview-5269960246)

</details>

### stdlib-js/stdlib#15179 · closed

<https://github.com/stdlib-js/stdlib/pull/15179> · by @unfinished-summer

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (1)</summary>

- kgryte (MEMBER), comment: “Ref: https://github.com/stdlib-js/stdlib/pull/15177” [↗](https://github.com/stdlib-js/stdlib/pull/15179#issuecomment-5826612067)

</details>

### stdlib-js/stdlib#15177 · merged

<https://github.com/stdlib-js/stdlib/pull/15177> · by @akkupratap323 · first commit failed: Check Contributing Guidelines Acceptance

- ➤ **`commit-format`** ← maintainer title edit by kgryte: “Title changed: "chore: fix JavaScript lint errors (issue #15176)" → "chore: fix JavaScript lint errors"” [↗](https://github.com/stdlib-js/stdlib/pull/15177)

### stdlib-js/stdlib#15161 · open

<https://github.com/stdlib-js/stdlib/pull/15161> · by @himayurjogade

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (1)</summary>

- Sachinn-64 (MEMBER), review: “LGTM.” [↗](https://github.com/stdlib-js/stdlib/pull/15161#pullrequestreview-5200842492)

</details>

### stdlib-js/stdlib#15160 · merged

<https://github.com/stdlib-js/stdlib/pull/15160> · by @scs0209 · first commit failed: Check Contributing Guidelines Acceptance

- ➤ **`commit-format`** ← maintainer title edit by kgryte: “Title changed: "chore: fix JavaScript lint errors (issue #15154)" → "chore: fix JavaScript lint errors"” [↗](https://github.com/stdlib-js/stdlib/pull/15160)

<details><summary>Maintainer and bot comments (1)</summary>

- kgryte (MEMBER), review: “LGTM” [↗](https://github.com/stdlib-js/stdlib/pull/15160#pullrequestreview-5175794450)

</details>

### stdlib-js/stdlib#15157 · closed

<https://github.com/stdlib-js/stdlib/pull/15157> · by @kunalKumar-13

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (1)</summary>

- kgryte (MEMBER), comment: “Similar comments as discussed in https://github.com/stdlib-js/stdlib/pull/11003 apply to this PR.” [↗](https://github.com/stdlib-js/stdlib/pull/15157#issuecomment-5629578619)

</details>

### stdlib-js/stdlib#15134 · closed

<https://github.com/stdlib-js/stdlib/pull/15134> · by @Rajdeep0511 · first commit failed: Check Contributing Guidelines Acceptance

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (1)</summary>

- kgryte (MEMBER), comment: “Ref: https://github.com/stdlib-js/stdlib/pull/15099” [↗](https://github.com/stdlib-js/stdlib/pull/15134#issuecomment-5625565705)

</details>

### stdlib-js/stdlib#15133 · open

<https://github.com/stdlib-js/stdlib/pull/15133> · by @himayurjogade

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (1)</summary>

- Sachinn-64 (MEMBER), review: “LGTM.” [↗](https://github.com/stdlib-js/stdlib/pull/15133#pullrequestreview-5199280622)

</details>

### stdlib-js/stdlib#15103 · open

<https://github.com/stdlib-js/stdlib/pull/15103> · by @himayurjogade · first commit failed: Check Contributing Guidelines Acceptance

- ➤ **`not-checkable`** ← review comment by ujjwalv01 (MEMBER): “Suggested a code change” [↗](https://github.com/stdlib-js/stdlib/pull/15103#discussion_r3979518309)
  - also: review comment by ujjwalv01 (MEMBER): “Suggested a code change” [↗](https://github.com/stdlib-js/stdlib/pull/15103#discussion_r3979518810)
  - also: author fix by himayurjogade: “Author added commit "style: remove extraneous blank lines"” [↗](https://github.com/stdlib-js/stdlib/pull/15103)
  - and 1 more

<details><summary>Maintainer and bot comments (3)</summary>

- ujjwalv01 (MEMBER), review-comment: “```suggestion ```” [↗](https://github.com/stdlib-js/stdlib/pull/15103#discussion_r3979518309)
- ujjwalv01 (MEMBER), review-comment: “```suggestion ```” [↗](https://github.com/stdlib-js/stdlib/pull/15103#discussion_r3979518810)
- ujjwalv01 (MEMBER), comment: “Looks good to me. Thanks @himayurjogade for making changes; cc : @kgryte” [↗](https://github.com/stdlib-js/stdlib/pull/15103#issuecomment-5622359403)

</details>

### stdlib-js/stdlib#15020 · merged

<https://github.com/stdlib-js/stdlib/pull/15020> · by @utsavbhardwaj · first commit failed: Check Contributing Guidelines Acceptance

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (1)</summary>

- kgryte (MEMBER), review: “LGTM” [↗](https://github.com/stdlib-js/stdlib/pull/15020#pullrequestreview-5123526237)

</details>

### stdlib-js/stdlib#15017 · closed

<https://github.com/stdlib-js/stdlib/pull/15017> · by @shahidul5

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (1)</summary>

- kgryte (MEMBER), comment: “Ref: https://github.com/stdlib-js/stdlib/pull/14510” [↗](https://github.com/stdlib-js/stdlib/pull/15017#issuecomment-5554932513)

</details>

### stdlib-js/stdlib#15013 · merged

<https://github.com/stdlib-js/stdlib/pull/15013> · by @abdoo303

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (1)</summary>

- kgryte (MEMBER), review: “LGTM” [↗](https://github.com/stdlib-js/stdlib/pull/15013#pullrequestreview-5123115511)

</details>

### stdlib-js/stdlib#14953 · merged

<https://github.com/stdlib-js/stdlib/pull/14953> · by @wofiporia

- ➤ **`commit-format`** ← maintainer title edit by kgryte: “Title changed: "chore: fix JavaScript lint errors (issue #14949)" → "chore: fix JavaScript lint error"” [↗](https://github.com/stdlib-js/stdlib/pull/14953)

### stdlib-js/stdlib#14945 · merged

<https://github.com/stdlib-js/stdlib/pull/14945> · by @itz-puneet

- ➤ **`not-checkable`** ← review comment by kgryte (MEMBER): “This change is not correct. When evaluated on Wolfram Alpha and then rounded in double-precision:” [↗](https://github.com/stdlib-js/stdlib/pull/14945#discussion_r3930223556)
  - also: review by kgryte (MEMBER): “Other than the two undesired changes, this PR is looking good.” [↗](https://github.com/stdlib-js/stdlib/pull/14945#pullrequestreview-5108466591)

<details><summary>Maintainer and bot comments (3)</summary>

- copilot-pull-request-reviewer (bot), review: “Copilot wasn't able to review any files in this pull request. --- 💡 &lt;a href="/stdlib-js/stdlib/new/develop?filename=.github/skills/code-review/SKILL.md" cla…” [↗](https://github.com/stdlib-js/stdlib/pull/14945#pullrequestreview-5106643568)
- kgryte (MEMBER), review-comment: “This change is not correct. When evaluated on Wolfram Alpha and then rounded in double-precision: ``` In [2]: 9.999999500000033333330833333533333316666668095237…” [↗](https://github.com/stdlib-js/stdlib/pull/14945#discussion_r3930223556)
- kgryte (MEMBER), review: “Other than the two undesired changes, this PR is looking good.” [↗](https://github.com/stdlib-js/stdlib/pull/14945#pullrequestreview-5108466591)

</details>

### stdlib-js/stdlib#14941 · closed

<https://github.com/stdlib-js/stdlib/pull/14941> · by @siddheshbandgar · first commit failed: Check Contributing Guidelines Acceptance

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (1)</summary>

- kgryte (MEMBER), comment: “Ref: https://github.com/stdlib-js/stdlib/pull/14926” [↗](https://github.com/stdlib-js/stdlib/pull/14941#issuecomment-5676690719)

</details>

### stdlib-js/stdlib#14926 · merged

<https://github.com/stdlib-js/stdlib/pull/14926> · by @MehulNegi · first commit failed: Check Contributing Guidelines Acceptance

- ➤ **`commit-format`** ← maintainer title edit by kgryte: “Title changed: "chore: fix EditorConfig lint errors (issue #14919)" → "chore: fix EditorConfig lint errors"” [↗](https://github.com/stdlib-js/stdlib/pull/14926)

<details><summary>Maintainer and bot comments (1)</summary>

- kgryte (MEMBER), comment: “As the CI failure is not due to changes introduced in this PR, I'll go ahead and merge.” [↗](https://github.com/stdlib-js/stdlib/pull/14926#issuecomment-5676724038)

</details>

### stdlib-js/stdlib#14865 · merged

<https://github.com/stdlib-js/stdlib/pull/14865> · by @i-am-paradox · first commit failed: Check Contributing Guidelines Acceptance

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (1)</summary>

- Planeshifter (MEMBER), review: “Thank you, @i-am-paradox!” [↗](https://github.com/stdlib-js/stdlib/pull/14865#pullrequestreview-5085723782)

</details>

## nodejs/node

### nodejs/node#66025 · merged

<https://github.com/nodejs/node/pull/66025> · by @ViniciusDev26 · first commit failed: node-test-commit, node-test-linux-linked-openssl111, node-test-pull-request

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (2)</summary>

- nodejs-github-bot (bot), comment: “Review requested: - [ ] @nodejs/crypto - [ ] @nodejs/net” [↗](https://github.com/nodejs/node/pull/66025#issuecomment-5670222590)
- nodejs-github-bot (bot), comment: “### Commit Queue failed This pull request has multiple commits, but no landing policy was selected. Add https://github.com/nodejs/node/labels/commit-queue-squas…” [↗](https://github.com/nodejs/node/pull/66025#issuecomment-5708029648)

</details>

### nodejs/node#66019 · merged

<https://github.com/nodejs/node/pull/66019> · by @krassx · first commit failed: **lint-commit-message** (used)

- ➤ **`not-checkable`** ← review comment by legendecas (MEMBER): “Please refrain from commenting impl internals in tests.” [↗](https://github.com/nodejs/node/pull/66019#discussion_r4006934765)
  - also: review comment by legendecas (MEMBER): “Ditto, please refrain from including impl internals in the test comments.” [↗](https://github.com/nodejs/node/pull/66019#discussion_r4006943005)
  - also: review comment by legendecas (MEMBER): “Please avoid explain what the code already literally explained.” [↗](https://github.com/nodejs/node/pull/66019#discussion_r4006972489)
  - and 1 more
- ➤ **`commit-format`** ← failed check by GitHub Actions: “Check "lint-commit-message" failed on the first commit” [↗](https://github.com/nodejs/node/runs/103929647136)
  - also: author fix by krassx: “Author force-pushed new commits” [↗](https://github.com/nodejs/node/pull/66019)
  - also: author fix by krassx: “Author edited the description” [↗](https://github.com/nodejs/node/pull/66019)

<details><summary>Maintainer and bot comments (5)</summary>

- nodejs-github-bot (bot), comment: “Review requested: - [ ] @nodejs/gyp - [ ] @nodejs/node-api” [↗](https://github.com/nodejs/node/pull/66019#issuecomment-5662073011)
- legendecas (MEMBER), review-comment: “Please refrain from commenting impl internals in tests. ```suggestion // must fail with an error -- not a crash. ```” [↗](https://github.com/nodejs/node/pull/66019#discussion_r4006934765)
- legendecas (MEMBER), review-comment: “Ditto, please refrain from including impl internals in the test comments.” [↗](https://github.com/nodejs/node/pull/66019#discussion_r4006943005)
- legendecas (MEMBER), review-comment: “Please avoid explain what the code already literally explained. ```suggestion // `module_api_version` is not supported. ```” [↗](https://github.com/nodejs/node/pull/66019#discussion_r4006972489)
- legendecas (MEMBER), comment: “Would you mind addressing https://github.com/nodejs/node/pull/66019/changes#r4006943005 as well? Thank you!” [↗](https://github.com/nodejs/node/pull/66019#issuecomment-5681150265)

</details>

### nodejs/node#66018 · closed

<https://github.com/nodejs/node/pull/66018> · by @wen2go · first commit failed: **lint-commit-message** (used)

- ➤ **`commit-format`** ← failed check by GitHub Actions: “Check "lint-commit-message" failed on the first commit” [↗](https://github.com/nodejs/node/runs/103919519765)

<details><summary>Maintainer and bot comments (1)</summary>

- nodejs-github-bot (bot), comment: “Review requested: - [ ] @nodejs/actions - [ ] @nodejs/config - [ ] @nodejs/gyp - [ ] @nodejs/security-wg” [↗](https://github.com/nodejs/node/pull/66018#issuecomment-5661628198)

</details>

### nodejs/node#66005 · closed

<https://github.com/nodejs/node/pull/66005> · by @splincode

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (1)</summary>

- nodejs-github-bot (bot), comment: “Review requested: - [ ] @nodejs/performance - [ ] @nodejs/security-wg” [↗](https://github.com/nodejs/node/pull/66005#issuecomment-5647613868)

</details>

### nodejs/node#66000 · open

<https://github.com/nodejs/node/pull/66000> · by @WhatCats · first commit failed: test-linux (ubuntu-24.04-arm), test-linux (ubuntu-24.04), test-tarball-linux +11 more

- ➤ **`not-checkable`** ← review by pimterry (MEMBER): “Totally agree this is weird behaviour and we should fix it, thanks @WhatCats! I think there are tweaks to make here though:” [↗](https://github.com/nodejs/node/pull/66000#pullrequestreview-5222150060)
  - also: review comment by pimterry (MEMBER): “This doesn't match the symbol naming around it” [↗](https://github.com/nodejs/node/pull/66000#discussion_r4025584844)
  - also: comment by pimterry (MEMBER): “Ah, there's now a conflict here, can you rebase this @WhatCats?” [↗](https://github.com/nodejs/node/pull/66000#issuecomment-5795872951)

<details><summary>Maintainer and bot comments (7)</summary>

- nodejs-github-bot (bot), comment: “Review requested: - [ ] @nodejs/http - [ ] @nodejs/net” [↗](https://github.com/nodejs/node/pull/66000#issuecomment-5645663782)
- pimterry (MEMBER), review: “Totally agree this is weird behaviour and we should fix it, thanks @WhatCats! I think there are tweaks to make here though: * I don't think we should expose an …” [↗](https://github.com/nodejs/node/pull/66000#pullrequestreview-5222150060)
- pimterry (MEMBER), review-comment: “This doesn't match the symbol naming around it” [↗](https://github.com/nodejs/node/pull/66000#discussion_r4025584844)
- pimterry (MEMBER), review-comment: “I think this doesn't fully work - `active()` is the sockets who are still parsing the request, but it doesn't include sockets are have fully received the reques…” [↗](https://github.com/nodejs/node/pull/66000#discussion_r4025665833)
- pimterry (MEMBER), review: “LGTM, thanks @WhatCats!” [↗](https://github.com/nodejs/node/pull/66000#pullrequestreview-5291727815)
- pimterry (MEMBER), comment: “Ah, there's now a conflict here, can you rebase this @WhatCats?” [↗](https://github.com/nodejs/node/pull/66000#issuecomment-5795872951)
- pimterry (MEMBER), comment: “Hmm, also, is this semver-major? Ping @nodejs/http Previously if you had requests in flight during `server.close()` they weren't shut down: they continued norma…” [↗](https://github.com/nodejs/node/pull/66000#issuecomment-5795977557)

</details>

### nodejs/node#65963 · merged

<https://github.com/nodejs/node/pull/65963> · by @ac-mmi

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (1)</summary>

- nodejs-github-bot (bot), comment: “Review requested: - [ ] @nodejs/streams” [↗](https://github.com/nodejs/node/pull/65963#issuecomment-5620430953)

</details>

### nodejs/node#65952 · merged

<https://github.com/nodejs/node/pull/65952> · by @barathraj048

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (2)</summary>

- nodejs-github-bot (bot), comment: “Review requested: - [ ] @nodejs/http - [ ] @nodejs/net” [↗](https://github.com/nodejs/node/pull/65952#issuecomment-5614148874)
- mcollina (MEMBER), review: “lgtm” [↗](https://github.com/nodejs/node/pull/65952#pullrequestreview-5191984839)

</details>

### nodejs/node#65947 · merged

<https://github.com/nodejs/node/pull/65947> · by @johnfinnerty-nz

- ➤ **`template`** ← comment by jasnell (MEMBER): “@johnfinnerty-nz ... While the change here looks fine and is acceptable, if you make future additional contributions, please do ensure that the PR description is not just AI generated. We need to know…” [↗](https://github.com/nodejs/node/pull/65947#issuecomment-5611677951)
  - also: author fix by johnfinnerty-nz: “Author added commit "doc: correct QUIC writer drain guidance"” [↗](https://github.com/nodejs/node/pull/65947)

<details><summary>Maintainer and bot comments (3)</summary>

- nodejs-github-bot (bot), comment: “Review requested: - [ ] @nodejs/quic” [↗](https://github.com/nodejs/node/pull/65947#issuecomment-5608626416)
- jasnell (MEMBER), comment: “@johnfinnerty-nz ... While the change here looks fine and is acceptable, if you make future additional contributions, please do ensure that the PR description i…” [↗](https://github.com/nodejs/node/pull/65947#issuecomment-5611677951)
- nodejs-github-bot (bot), comment: “### Commit Queue failed This pull request has multiple commits, but no landing policy was selected. Add https://github.com/nodejs/node/labels/commit-queue-squas…” [↗](https://github.com/nodejs/node/pull/65947#issuecomment-5674731044)

</details>

### nodejs/node#65941 · closed

<https://github.com/nodejs/node/pull/65941> · by @jimmyhmiller

- ➤ **`not-checkable`** ← review comment by legendecas (MEMBER): “I don't find this new flag `resources_released`, and the enum state `kResourceCleanup` to be necessary. This makes the TSFN harder to maintain.” [↗](https://github.com/nodejs/node/pull/65941#discussion_r3983291427)

<details><summary>Maintainer and bot comments (2)</summary>

- nodejs-github-bot (bot), comment: “Review requested: - [ ] @nodejs/node-api” [↗](https://github.com/nodejs/node/pull/65941#issuecomment-5604671551)
- legendecas (MEMBER), review-comment: “I don't find this new flag `resources_released`, and the enum state `kResourceCleanup` to be necessary. This makes the TSFN harder to maintain. I think the exis…” [↗](https://github.com/nodejs/node/pull/65941#discussion_r3983291427)

</details>

### nodejs/node#65940 · open

<https://github.com/nodejs/node/pull/65940> · by @NAVEENKUMARKR777 · first commit failed: **lint-commit-message** (used)

- ➤ **`commit-format`** ← failed check by GitHub Actions: “Check "lint-commit-message" failed on the first commit” [↗](https://github.com/nodejs/node/runs/102524799603)
  - also: author fix by NAVEENKUMARKR777: “Author force-pushed new commits” [↗](https://github.com/nodejs/node/pull/65940)
  - also: author fix by NAVEENKUMARKR777: “Author force-pushed new commits” [↗](https://github.com/nodejs/node/pull/65940)
  - and 1 more

### nodejs/node#65939 · closed

<https://github.com/nodejs/node/pull/65939> · by @positivef

No suggestions. Skim the comments below for anything missed.

### nodejs/node#65918 · open

<https://github.com/nodejs/node/pull/65918> · by @peppergrayxyz · first commit failed: **lint-commit-message** (used)

- ➤ **`commit-format`** ← failed check by GitHub Actions: “Check "lint-commit-message" failed on the first commit” [↗](https://github.com/nodejs/node/runs/102362939072)
  - also: author fix by peppergrayxyz: “Author force-pushed new commits” [↗](https://github.com/nodejs/node/pull/65918)
  - also: author fix by peppergrayxyz: “Author force-pushed new commits” [↗](https://github.com/nodejs/node/pull/65918)

<details><summary>Maintainer and bot comments (1)</summary>

- nodejs-github-bot (bot), comment: “Review requested: - [ ] @nodejs/build - [ ] @nodejs/gyp - [ ] @nodejs/tsc - [ ] @nodejs/v8-update” [↗](https://github.com/nodejs/node/pull/65918#issuecomment-5591457956)

</details>

### nodejs/node#65916 · closed

<https://github.com/nodejs/node/pull/65916> · by @rohitkr0111 · first commit failed: **lint-commit-message** (used)

- ➤ **`commit-format`** ← failed check by GitHub Actions: “Check "lint-commit-message" failed on the first commit” [↗](https://github.com/nodejs/node/runs/102399426655)

### nodejs/node#65915 · closed

<https://github.com/nodejs/node/pull/65915> · by @krsnaSuraj

No suggestions. Skim the comments below for anything missed.

### nodejs/node#65890 · open

<https://github.com/nodejs/node/pull/65890> · by @lukiano · first commit failed: **lint-commit-message** (used)

- ➤ **`commit-format`** ← failed check by GitHub Actions: “Check "lint-commit-message" failed on the first commit” [↗](https://github.com/nodejs/node/runs/101977696619)

<details><summary>Maintainer and bot comments (1)</summary>

- nodejs-github-bot (bot), comment: “Review requested: - [ ] @nodejs/streams” [↗](https://github.com/nodejs/node/pull/65890#issuecomment-5575581171)

</details>

### nodejs/node#65887 · merged

<https://github.com/nodejs/node/pull/65887> · by @christopher-buss

No suggestions. Skim the comments below for anything missed.

### nodejs/node#65876 · merged

<https://github.com/nodejs/node/pull/65876> · by @colinhacks · first commit failed: format-cpp

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (3)</summary>

- nodejs-github-bot (bot), comment: “Review requested: - [ ] @nodejs/startup” [↗](https://github.com/nodejs/node/pull/65876#issuecomment-5570240963)
- panva (MEMBER), comment: “cc @nodejs/single-executable” [↗](https://github.com/nodejs/node/pull/65876#issuecomment-5601396541)
- nodejs-github-bot (bot), comment: “### Commit Queue failed ``` ⚠ Could not retrieve the email or name of the PR author's from user's GitHub profile! ⚠ Commits were pushed since the last approving…” [↗](https://github.com/nodejs/node/pull/65876#issuecomment-5639108485)

</details>

### nodejs/node#65851 · closed

<https://github.com/nodejs/node/pull/65851> · by @roit37

No suggestions. Skim the comments below for anything missed.

### nodejs/node#65849 · closed

<https://github.com/nodejs/node/pull/65849> · by @santusht06

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (1)</summary>

- nodejs-github-bot (bot), comment: “Review requested: - [ ] @nodejs/loaders - [ ] @nodejs/performance” [↗](https://github.com/nodejs/node/pull/65849#issuecomment-5558473709)

</details>

### nodejs/node#65841 · closed

<https://github.com/nodejs/node/pull/65841> · by @colinhacks

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (1)</summary>

- nodejs-github-bot (bot), comment: “Review requested: - [ ] @nodejs/startup” [↗](https://github.com/nodejs/node/pull/65841#issuecomment-5557646859)

</details>

## prometheus/prometheus

### prometheus/prometheus#19691 · closed

<https://github.com/prometheus/prometheus/pull/19691> · by @Retr0-XD · first commit failed: **DCO** (used), check, Go tests, Go tests on Windows +5 more

- ➤ **`dco`** ← failed check by DCO: “Check "DCO" failed on the first commit” [↗](https://github.com/prometheus/prometheus/runs/103719614545)
  - also: author fix by Retr0-XD: “Author force-pushed new commits” [↗](https://github.com/prometheus/prometheus/pull/19691)
  - also: author fix by Retr0-XD: “Author force-pushed new commits” [↗](https://github.com/prometheus/prometheus/pull/19691)
  - and 5 more

### prometheus/prometheus#19686 · closed

<https://github.com/prometheus/prometheus/pull/19686> · by @priyanshu7739410

No suggestions. Skim the comments below for anything missed.

### prometheus/prometheus#19681 · merged

<https://github.com/prometheus/prometheus/pull/19681> · by @gluedtea · first commit failed: check

- ➤ **`template`** ← maintainer body edit by krajorama: “Edited the PR description” [↗](https://github.com/prometheus/prometheus/pull/19681)

<details><summary>Maintainer and bot comments (1)</summary>

- krajorama (MEMBER), review: “thanks” [↗](https://github.com/prometheus/prometheus/pull/19681#pullrequestreview-5177906882)

</details>

### prometheus/prometheus#19674 · closed

<https://github.com/prometheus/prometheus/pull/19674> · by @leaanthony

No suggestions. Skim the comments below for anything missed.

### prometheus/prometheus#19663 · merged

<https://github.com/prometheus/prometheus/pull/19663> · by @simpleqt · first commit failed: check, Build Prometheus for common architectures (1)

No suggestions. Skim the comments below for anything missed.

### prometheus/prometheus#19662 · open

<https://github.com/prometheus/prometheus/pull/19662> · by @simpleqt · first commit failed: check

- ➤ **`template`** ← maintainer body edit by jan--f: “Edited the PR description” [↗](https://github.com/prometheus/prometheus/pull/19662)

<details><summary>Maintainer and bot comments (1)</summary>

- krajorama (MEMBER), review-comment: “this seems to work when I test on https://prometheus.io/docs/prometheus/latest/querying/examples/” [↗](https://github.com/prometheus/prometheus/pull/19662#discussion_r3965373329)

</details>

### prometheus/prometheus#19661 · merged

<https://github.com/prometheus/prometheus/pull/19661> · by @jakezwang

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (1)</summary>

- copilot-pull-request-reviewer (bot), review: “### 🟢 Approval recommended The fix is focused, correctly preserves uncompressed behavior, and includes comprehensive regression coverage. &lt;details> &lt;summ…” [↗](https://github.com/prometheus/prometheus/pull/19661#pullrequestreview-5143981676)

</details>

### prometheus/prometheus#19660 · closed

<https://github.com/prometheus/prometheus/pull/19660> · by @dmatth1

No suggestions. Skim the comments below for anything missed.

### prometheus/prometheus#19659 · merged

<https://github.com/prometheus/prometheus/pull/19659> · by @youdie006

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (2)</summary>

- krajorama (MEMBER), review: “LGTM” [↗](https://github.com/prometheus/prometheus/pull/19659#pullrequestreview-5138142835)
- krajorama (MEMBER), comment: “wdyt @zenador ?” [↗](https://github.com/prometheus/prometheus/pull/19659#issuecomment-5580333242)

</details>

### prometheus/prometheus#19658 · merged

<https://github.com/prometheus/prometheus/pull/19658> · by @youdie006

- ➤ **`template`** ← maintainer body edit by aknuds1: “Edited the PR description” [↗](https://github.com/prometheus/prometheus/pull/19658)

### prometheus/prometheus#19657 · merged

<https://github.com/prometheus/prometheus/pull/19657> · by @youdie006

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (2)</summary>

- krajorama (MEMBER), comment: “cc @zenador” [↗](https://github.com/prometheus/prometheus/pull/19657#issuecomment-5581583911)
- krajorama (MEMBER), review: “Approved. Change makes sense and also based on @zenador 's review. Thanks both of you.” [↗](https://github.com/prometheus/prometheus/pull/19657#pullrequestreview-5176668797)

</details>

### prometheus/prometheus#19588 · open

<https://github.com/prometheus/prometheus/pull/19588> · by @AbdelrahmanHafez

- ➤ **`not-checkable`** ← comment by roidelapluie (MEMBER): “Nice, can we have the tests in the regular test instead of a new one? thanks.” [↗](https://github.com/prometheus/prometheus/pull/19588#issuecomment-5567162574)
  - also: comment by roidelapluie (MEMBER): “can we get rid of the duration-specific test?” [↗](https://github.com/prometheus/prometheus/pull/19588#issuecomment-5816951084)
  - also: author fix by AbdelrahmanHafez: “Author added commit "test(promql/parser): use one expected output per pretty case"” [↗](https://github.com/prometheus/prometheus/pull/19588)
  - and 1 more

<details><summary>Maintainer and bot comments (4)</summary>

- roidelapluie (MEMBER), comment: “Nice, can we have the tests in the regular test instead of a new one? thanks.” [↗](https://github.com/prometheus/prometheus/pull/19588#issuecomment-5567162574)
- roidelapluie (MEMBER), comment: “can we get rid of the duration-specific test?” [↗](https://github.com/prometheus/prometheus/pull/19588#issuecomment-5816951084)
- roidelapluie (MEMBER), comment: “or at least rid of `durationOut`” [↗](https://github.com/prometheus/prometheus/pull/19588#issuecomment-5816961890)
- roidelapluie (MEMBER), review-comment: “this is not needed I think?” [↗](https://github.com/prometheus/prometheus/pull/19588#discussion_r4095517027)

</details>

### prometheus/prometheus#19572 · merged

<https://github.com/prometheus/prometheus/pull/19572> · by @shilohlee98 · first commit failed: Go tests on Windows

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (1)</summary>

- bboreham (MEMBER), comment: “Thank you for your interest in the Prometheus project. Is there some way we could fix this inside the JSON logger rather than whack-a-mole finding all the place…” [↗](https://github.com/prometheus/prometheus/pull/19572#issuecomment-5600788878)

</details>

### prometheus/prometheus#19570 · open

<https://github.com/prometheus/prometheus/pull/19570> · by @ShivanshhhG · first commit failed: check, More Go tests, Go tests for 32-bit x86 +4 more

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (1)</summary>

- roidelapluie (MEMBER), comment: “Thanks for your contribution. Prometheus already has a health endpoint available. Orchestration setups can be configured to point their liveness/readiness probe…” [↗](https://github.com/prometheus/prometheus/pull/19570#issuecomment-5522497376)

</details>

### prometheus/prometheus#19558 · open

<https://github.com/prometheus/prometheus/pull/19558> · by @iamsharduld

- ➤ **`not-checkable`** ← comment by roidelapluie (MEMBER): “This is breaking. We should find a better solution (I have none on top of my head).” [↗](https://github.com/prometheus/prometheus/pull/19558#issuecomment-5492465654)

<details><summary>Maintainer and bot comments (1)</summary>

- roidelapluie (MEMBER), comment: “This is breaking. We should find a better solution (I have none on top of my head).” [↗](https://github.com/prometheus/prometheus/pull/19558#issuecomment-5492465654)

</details>

### prometheus/prometheus#19556 · merged

<https://github.com/prometheus/prometheus/pull/19556> · by @janeblower · first commit failed: check

- ➤ **`template`** ← maintainer body edit by bboreham: “Edited the PR description” [↗](https://github.com/prometheus/prometheus/pull/19556)

<details><summary>Maintainer and bot comments (1)</summary>

- bboreham (MEMBER), review: “OK, we can do this. I removed the changelog entry since this has no user-visible impact.” [↗](https://github.com/prometheus/prometheus/pull/19556#pullrequestreview-5293942103)

</details>

### prometheus/prometheus#19553 · merged

<https://github.com/prometheus/prometheus/pull/19553> · by @shilohlee98 · first commit failed: **DCO** (used)

- ➤ **`dco`** ← failed check by DCO: “Check "DCO" failed on the first commit” [↗](https://github.com/prometheus/prometheus/runs/98956715498)
  - also: author fix by shilohlee98: “Author edited the description” [↗](https://github.com/prometheus/prometheus/pull/19553)
  - also: author fix by shilohlee98: “Author edited the description” [↗](https://github.com/prometheus/prometheus/pull/19553)
  - and 3 more

### prometheus/prometheus#19539 · closed

<https://github.com/prometheus/prometheus/pull/19539> · by @anupamme · first commit failed: UI tests, Check generated parser, Go tests +3 more

No suggestions. Skim the comments below for anything missed.

### prometheus/prometheus#19526 · closed

<https://github.com/prometheus/prometheus/pull/19526> · by @longxiucai · first commit failed: check

No suggestions. Skim the comments below for anything missed.

### prometheus/prometheus#19525 · closed

<https://github.com/prometheus/prometheus/pull/19525> · by @shoemoney

No suggestions. Skim the comments below for anything missed.

## vitejs/vite

### vitejs/vite#23479 · closed

<https://github.com/vitejs/vite/pull/23479> · by @mrchatam

No suggestions. Skim the comments below for anything missed.

### vitejs/vite#23478 · closed

<https://github.com/vitejs/vite/pull/23478> · by @mrchatam

No suggestions. Skim the comments below for anything missed.

### vitejs/vite#23474 · closed

<https://github.com/vitejs/vite/pull/23474> · by @scs0209

No suggestions. Skim the comments below for anything missed.

### vitejs/vite#23473 · closed

<https://github.com/vitejs/vite/pull/23473> · by @scs0209

No suggestions. Skim the comments below for anything missed.

### vitejs/vite#23469 · merged

<https://github.com/vitejs/vite/pull/23469> · by @koriyoshi2041

- ➤ **`commit-format`** ← maintainer title edit by bluwy: “Title changed: "docs(config): document preserveEntrySignatures defaults (fix #23451)" → "docs(config): document preserveEntrySignatures defaults"” [↗](https://github.com/vitejs/vite/pull/23469)

### vitejs/vite#23468 · closed

<https://github.com/vitejs/vite/pull/23468> · by @dvd233

No suggestions. Skim the comments below for anything missed.

### vitejs/vite#23467 · closed

<https://github.com/vitejs/vite/pull/23467> · by @1t1sCooL

No suggestions. Skim the comments below for anything missed.

### vitejs/vite#23454 · closed

<https://github.com/vitejs/vite/pull/23454> · by @cuishuang

No suggestions. Skim the comments below for anything missed.

### vitejs/vite#23452 · closed

<https://github.com/vitejs/vite/pull/23452> · by @eeminionn

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (2)</summary>

- copilot-pull-request-reviewer (bot), review: “### 🟡 Changes recommended The new wording is slightly ambiguous and should explicitly state these defaults apply only when the user does not set `build.rolldow…” [↗](https://github.com/vitejs/vite/pull/23452#pullrequestreview-5134016169)
- copilot-pull-request-reviewer (bot), review-comment: “The wording “Vite may override” is a bit ambiguous here: in `resolveRolldownOptions`, Vite sets its own default but then spreads `...options.rolldownOptions`, s…” [↗](https://github.com/vitejs/vite/pull/23452#discussion_r3951438092)

</details>

### vitejs/vite#23446 · merged

<https://github.com/vitejs/vite/pull/23446> · by @StirStudios

- ➤ **`commit-format`** ← maintainer title edit by sapphi-red: “Title changed: "perf(build): avoid settling empty preload dependency results" → "feat: avoid settling seen preload dependencies for performance"” [↗](https://github.com/vitejs/vite/pull/23446)
  - also: maintainer title edit by sapphi-red: “Title changed: "feat: avoid settling seen preload dependencies for performance" → "feat(build): avoid settling seen preload dependencies for performance"” [↗](https://github.com/vitejs/vite/pull/23446)

<details><summary>Maintainer and bot comments (5)</summary>

- sapphi-red (MEMBER), comment: “> * Representative Nuxt production consumer: three interleaved mobile Lighthouse runs, median TBT 607 → 453 ms; LCP 2.04 → 1.99 s; 162 script requests in both v…” [↗](https://github.com/vitejs/vite/pull/23446#issuecomment-5569398579)
- sapphi-red (MEMBER), review: “Thank you!” [↗](https://github.com/vitejs/vite/pull/23446#pullrequestreview-5137052495)
- sapphi-red (MEMBER), comment: “/ecosystem-ci run” [↗](https://github.com/vitejs/vite/pull/23446#issuecomment-5578805983)
- pkg-pr-new (bot), comment: “[Open in StackBlitz](https://pkg.pr.new/template/36468cb2-1283-4ad6-b892-60d39d2aac23) &lt;details>&lt;summary>&lt;b>@vitejs/plugin-legacy&lt;/b>&lt;/summary>&l…” [↗](https://github.com/vitejs/vite/pull/23446#issuecomment-5578813895)
- vite-ecosystem-ci (bot), comment: “📝 Ran ecosystem CI on [`abf4a55`](https://github.com/vitejs/vite/pull/23446/commits/abf4a55cf0198cbc57e6cb1caa65f395d0fc37fd): [Open](https://github.com/vitejs…” [↗](https://github.com/vitejs/vite/pull/23446#issuecomment-5579104131)

</details>

### vitejs/vite#23443 · closed

<https://github.com/vitejs/vite/pull/23443> · by @orangeCatDeveloper · first commit failed: Lint: node-24, ubuntu-latest, Build&Test: node-24, macos-latest, Build&Test: node-26, ubuntu-latest +4 more

- ➤ **`not-checkable`** ← review by sapphi-red (MEMBER): “Please link to the commit that fixed the issue in latest chokidar.” [↗](https://github.com/vitejs/vite/pull/23443#pullrequestreview-5137088221)

<details><summary>Maintainer and bot comments (1)</summary>

- sapphi-red (MEMBER), review: “Please link to the commit that fixed the issue in latest chokidar. The corresponding line in v5 has the same code: - https://github.com/paulmillr/chokidar/blob/…” [↗](https://github.com/vitejs/vite/pull/23443#pullrequestreview-5137088221)

</details>

### vitejs/vite#23442 · closed

<https://github.com/vitejs/vite/pull/23442> · by @leonardoventurini

- ➤ **`not-checkable`** ← comment by sapphi-red (MEMBER): “Sorry I noticed this PR after I made the fix (#23567)” [↗](https://github.com/vitejs/vite/pull/23442#issuecomment-5812898175)

<details><summary>Maintainer and bot comments (1)</summary>

- sapphi-red (MEMBER), comment: “Sorry I noticed this PR after I made the fix (#23567)” [↗](https://github.com/vitejs/vite/pull/23442#issuecomment-5812898175)

</details>

### vitejs/vite#23439 · closed

<https://github.com/vitejs/vite/pull/23439> · by @Bhumika-1432006 · first commit failed: Build&Test: node-24.15.0, windows-latest

No suggestions. Skim the comments below for anything missed.

### vitejs/vite#23438 · closed

<https://github.com/vitejs/vite/pull/23438> · by @Bhumika-1432006 · first commit failed: Build&Test: node-24.15.0, windows-latest

No suggestions. Skim the comments below for anything missed.

### vitejs/vite#23428 · closed

<https://github.com/vitejs/vite/pull/23428> · by @xia-chao · first commit failed: Lint: node-24, ubuntu-latest, Build&Test: node-22, ubuntu-latest

No suggestions. Skim the comments below for anything missed.

### vitejs/vite#23420 · closed

<https://github.com/vitejs/vite/pull/23420> · by @dennisameling

No suggestions. Skim the comments below for anything missed.

<details><summary>Maintainer and bot comments (1)</summary>

- sapphi-red (MEMBER), comment: “Vite specifies the Rolldown dep with `~` which allows new patch versions. So the new Rolldown can be installed without this change.” [↗](https://github.com/vitejs/vite/pull/23420#issuecomment-5519733024)

</details>

### vitejs/vite#23403 · closed

<https://github.com/vitejs/vite/pull/23403> · by @QuarkOS

No suggestions. Skim the comments below for anything missed.

### vitejs/vite#23402 · closed

<https://github.com/vitejs/vite/pull/23402> · by @QuarkOS · first commit failed: Build&Test: node-24.15.0, windows-latest

No suggestions. Skim the comments below for anything missed.

### vitejs/vite#23400 · closed

<https://github.com/vitejs/vite/pull/23400> · by @ethanstoner

No suggestions. Skim the comments below for anything missed.

### vitejs/vite#23396 · closed

<https://github.com/vitejs/vite/pull/23396> · by @santusht06 · first commit failed: Build&Test: node-24, macos-latest

No suggestions. Skim the comments below for anything missed.
