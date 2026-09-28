# MergeReady

**Check your first pull request before a maintainer has to.**

Live: https://mergeready-three.vercel.app

MergeReady reads a GitHub repository's own contribution rules and checks a first-time contributor's issue or pull request against them, before anyone has to leave a "please fix this" comment. Every rule it shows comes with proof: the exact sentence, config file or commit history it was taken from.

Built solo for the [FirstCommit hackathon](https://firstcommit.devpost.com) (25 to 30 September 2026).

## The problem

New contributors often get their first pull request sent back for reasons that have nothing to do with their code: a missing sign-off, an unticked checklist, a commit message in the wrong format, or an issue that someone else was already working on.

A real example: on [stdlib-js/stdlib#12959](https://github.com/stdlib-js/stdlib/issues/12959), a "Good First Issue", two newcomers each said "I'd like to work on this" and each opened their own pull request. Nobody was assigned. At most one of those PRs can be merged.

Big projects already use bots to catch these problems, but bots only speak up after the pull request is public. MergeReady works before that, on any public repository, privately.

## What it does

Paste a link to an issue or a pull request.

**Issue link: before you start work**
- Is the issue already assigned, or claimed in the comments?
- Are there already open pull requests for it?
- Is the repository archived or inactive?
- Does this repo ask you to be assigned first?

**Pull request link: before you ask for review**
- Commit or PR-title format (for example Conventional Commits)
- DCO sign-off on every commit
- PR template: required sections filled, required checkboxes ticked
- Linked issue (and a warning if `Fixes #123` won't work because the PR doesn't target the default branch)
- Issue assigned to you, if the repo asks for it
- Tests changed when code changed

Results are shown as a journey map (Issue, Work, Commit, PR, Merge). Each check explains what's wrong in plain English, gives exact fix steps with copyable commands, and shows the evidence. MergeReady also generates a PR description that follows the repo's template. It never ticks checkboxes for you: only you can make those promises.

## How it works

There is **no AI** in MergeReady. Rules are extracted by deterministic TypeScript, so the same input always gives the same result, and every rule can be traced to its source.

Rules come from four sources, strongest first:

| Source | Example | Shown as |
|---|---|---|
| Config files | `commitlint.config.js`, `.github/dco.yml`, GitHub workflows | Repo config |
| PR template | Headings, checkboxes, `Fixes #` fields | PR template |
| Commit history | "41 of the last 41 commits follow Conventional Commits" | Commit history |
| Contributing docs | Sentences like "Your commit must contain the Signed-off-by line" | CONTRIBUTING text |

Commit history matters because some rules are never written down in a readable form. stdlib builds its commitlint config with code we won't execute, and many CNCF projects run the DCO app without a config file. Their history still shows the rule.

A failed rule is **red** only when the source clearly says it is required (a config file, or words like "must" and "required"). Everything else is **yellow**. If no rule is found, the check is skipped, never failed.

```
URL -> GitHub API (guidelines, linked docs, configs, recent commits, issue/PR)
    -> extractRules (config + template + history + prose)
    -> runChecks -> journey map, check cards, PR description
```

## Evaluation

I measured MergeReady against what maintainers actually objected to in first-time contributors' pull requests, using stdlib-js/stdlib, nodejs/node, prometheus/prometheus and vitejs/vite. The selection rules were committed before the tool was run, each PR was rebuilt as it was when first submitted, and labels were locked before scoring.

| Run | Recall | Precision |
|---|---|---|
| First version, 80 PRs | 9/18 (50%) | 9/90 (10%) |
| After fixing bugs found by that run, same 80 PRs (optimistic) | 9/18 (50%) | 9/31 (29%) |
| **Held-out: 19 PRs the tool had never seen (main result)** | **3/5** | **3/7** |

The first run showed that MergeReady raised far too many false alarms, mostly by treating conditional template lines ("If it applies, fixes #...") as required. I fixed the rules in a general way, froze the tool, and tested on new pull requests. The held-out sample is small, so the uncertainty is large (95% intervals are in the report).

Full method, labels, deviations and limitations: [eval/REPORT.md](eval/REPORT.md)

## Tech stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- Octokit (`@octokit/rest`) for the GitHub REST and GraphQL APIs
- `yaml` to read YAML configs safely (config files are parsed, never executed)
- `react-markdown` + `remark-gfm` to show contributing sections safely (raw HTML is not rendered)
- Vitest for tests (430 tests)
- Deployed on Vercel

## Run it locally

Requirements: Node.js 22 or newer, and a GitHub **classic** personal access token with **no scopes** (it only needs to read public data).

> Fine-grained tokens hide some timeline events, so MergeReady would miss pull requests that mention an issue. Use a classic token.

```bash
git clone https://github.com/singhakousik363-del/mergeready.git
cd mergeready
npm install
echo "GITHUB_TOKEN=ghp_your_token" > .env.local
npm run dev
```

Open http://localhost:3000.

Other commands:

```bash
npm test         # run all tests
npm run lint
npm run build
node --env-file=.env.local --import tsx scripts/try-rules.ts stdlib-js/stdlib
node --env-file=.env.local --import tsx scripts/try-checks.ts https://github.com/stdlib-js/stdlib/issues/12959
```

## Project structure

```
app/            page, API route (/api/analyze), UI components
lib/github/     GitHub data: guidelines, linked docs, configs, commits, issues, PRs
lib/rules/      rule extraction from config, template, history and prose
lib/checks/     the checks, journey map and PR description
lib/server/     input validation, cache, rate limit, time budget
eval/           evaluation scripts, data and REPORT.md
scripts/        small scripts to try each part on real repos
```

## Known limitations

- English only. Rules written in unusual wording can be missed.
- Linked docs are followed one level deep; rules on external websites (like React's) can't be read, and the UI says so.
- Commit format checks look at the shape of the message only, not things like line length or subsystem names.
- Cache and rate limit are per server instance on Vercel.

The full list is kept in [CLAUDE.md](CLAUDE.md).

## AI usage

I built MergeReady with a lot of AI help, and I want to be clear about it.

- **Claude Code** (in my terminal) wrote most of the code and tests, following plans that I reviewed and approved step by step.
- **Claude (chat)** helped me brainstorm and check ideas, planned the build, wrote the first version of `parseUrl.ts`, drafted evaluation labels from neutral summaries (which I approved), and drafted this README and my DEVLOG from our conversation, which I reviewed and edited.
- **My part:** choosing the idea after checking that similar tools already existed; key design decisions (no AI in the product, rules with proof, learning rules from commit history, never ticking checkboxes for users, yellow instead of red when the evidence is weak); insisting on testing everything on real repositories; and designing a pre-registered, held-out evaluation.

Every step is logged in [AI_LOG.md](AI_LOG.md), and commits written with Claude Code are marked `Co-Authored-By`.

## What I learned

- **Passing tests is not the same as working.** 104 mocked tests passed, but on real data my GitHub token type was silently hiding the very pull requests the tool exists to find.
- **Real data beats assumptions.** React's CONTRIBUTING.md is one link, Node's points to 19 other documents, and GitHub's `author_association` doesn't reliably mark first-time contributors. I only learned this by running on real repositories.
- **Measure yourself honestly.** My first evaluation scored 10% precision. Finding out why, fixing it in a general way, and re-testing on data the tool had never seen taught me more than any feature.
- **Check before you build.** Several ideas I liked (elephant alerts, scam checkers, heat-stress planners) already existed. Searching first saved me days.
- **Directing AI is a skill.** Getting good results meant asking for plans first, questioning every result, and saying no to changes I didn't understand.

## Credits

- Data: public GitHub data from stdlib-js/stdlib, nodejs/node, prometheus/prometheus, vitejs/vite and other open-source repositories, used for tests and evaluation.
- Fonts: Geist and Geist Mono (Vercel), Instrument Serif, loaded through `next/font`.
- Libraries: Next.js, React, Tailwind CSS, Octokit, yaml, react-markdown, remark-gfm, Vitest, tsx.

## Author

Kousik Singha, first-year B.Tech CSE student.
