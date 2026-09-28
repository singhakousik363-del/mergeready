# MergeReady: Build Log

## Day 0: 25 Sep 2026
**What I did:** Read the FirstCommit brief and looked for an idea. Several ideas I liked already existed (elephant alert apps in North Bengal, scam message checkers, heat-stress planners, phone help for seniors), so I chose MergeReady, a checker for first pull requests. I scored my own idea as a judge would and added pre-start checks (is the issue already taken?) to make it stronger. Created the repo, wrote CLAUDE.md with the project rules, scaffolded Next.js 16 and deployed an empty page to Vercel.
**What I learned:** Search before building; most "new" ideas already exist. Next.js 16's template ships its own CLAUDE.md, which would have overwritten mine, so I asked for a copy step that never overwrites existing files.
**What confused me:** In Claude Code, the difference between sending a message to Claude and running a command directly with `!`.
**Tomorrow:** Parse GitHub links and fetch data from the GitHub API.

## Day 1: 26 Sep 2026
**What I did:** Wrote the `parseUrl` code; its tests had been committed the day before (25 Sep), before the code. The code itself was written by Claude chat and I pasted it; I decided it should also accept links like `/pull/456/files`, because beginners often copy links from that tab. Created a GitHub token and kept it in `.env.local`. Upgraded from Node 20 to Node 24 with nvm.
**What I learned:** Node 20 had reached end of life. With nvm, global tools like Claude Code must be reinstalled for each Node version, and npm 11 blocks install scripts until you allow them.
**What confused me:** Why `claude` stopped working after the Node upgrade.
**Tomorrow:** Fetch CONTRIBUTING files and PR templates.

## Day 2: 27 Sep 2026
**What I did:** Fetched guidelines using GitHub's community profile API with a fallback search. Real repos surprised me: React's CONTRIBUTING.md is a single link and Node's links to 9 other docs, so I added following same-repo doc links, scored by file name and link text, with priority for "first contributions" docs. Fetched issue and PR data. Decided to drop Gemini and build rule extraction with plain code, so every rule comes with its exact source. Proposed learning rules from commit history, which found stdlib's commit format (41 of 41) and the DCO rules of Node (49 of 49) and Prometheus (19 of 19).
**What I learned:** GitHub's `author_association` does not reliably mark first-time contributors, so I switched to counting merged PRs with the search API. The biggest lesson: 104 mocked tests passed, but my fine-grained token was hiding cross-referenced events, so the tool said "no open PRs" on an issue that had two. A classic token with no scopes fixed it. Tests also caught a `../../` path bug and a curly-apostrophe bug.
**What confused me:** Why real repositories behaved so differently from the mocks.
**Tomorrow:** Checks, API route and UI.

## Day 3: 28 Sep 2026
**What I did:** Built the checks, including awareness of the user's own username, old claims with no PR, and a rule that the tool never ticks checkboxes for users. Built the API with a rate limit high enough for classmates on one college Wi-Fi, and tested it live. Built the "Maintainer's desk" UI. Designed an evaluation: selection rules committed before running, 80 real PRs rebuilt as first submitted, labels locked before scoring.
**What I learned:** The first evaluation scored 10% precision: 90 flags, only 9 real. Most false alarms came from template and doc text that wasn't a real requirement: examples, HTML comments and "If it applies" lines, and Prometheus's "ALL commits must be considered", which made a template section look required. I fixed this with general rules instead of special cases, froze the tool, and tested it on 19 new PRs it had never seen: 3 of 5 objections caught, 3 of 7 flags correct. Being honest about a bad number taught me more than a good one would have. I labeled the first 4 PRs one by one; for the rest, Claude chat drafted labels from neutral summaries and I approved them.
**What confused me:** How to improve a tool using an evaluation without fooling myself. The answer was a held-out test.
**Tomorrow:** Classmate testing, README, video script.
