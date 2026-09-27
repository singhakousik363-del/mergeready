# AI Usage Log

| Date | Tool | What AI did | What I did myself |
|---|---|---|---|
| 25 Sep | Claude (chat) | Helped brainstorm & validate ideas, planned the build | Chose the idea, set project rules |
| 25 Sep | Claude Code | Created CLAUDE.md, DEVLOG.md, AI_LOG.md from my text | Wrote the project rules with Claude chat's help |
| 25 Sep | Claude Code | Scaffolded Next.js 16 + Tailwind + Vitest, set up folders | Reviewed the plan, asked for --ignore-existing so my CLAUDE.md wasn't overwritten |
| 26 Sep | Claude Code + Claude (chat) | Claude Code wrote parseUrl.test.ts and hints; Claude chat wrote parseUrl.ts | Decided to accept /files and /commits links, read and understood every line |
| 27 Sep | Claude Code | Wrote fetchGuidelines.ts, errors.ts, 12 tests, real-repo script | Chose community-profile-first approach, required warnings instead of hiding large files, asked to test on real repos and found that React and Node CONTRIBUTING files mostly link elsewhere |
| 27 Sep | Claude Code | Added per-request timeout, silent logging, same-repo doc link following (docLinks.ts) with tests | Decided to follow linked docs now, fixed scoring to use file name/link text only, added first/newcomer priority, asked to support stdlib's full-URL links |
| 27 Sep | Claude Code | Wrote fetchIssue, fetchPullRequest, linkedIssues, pagination, 104 tests | Required search-based new-contributor detection, newest-pages timeline strategy, maintainer exclusion; real-repo run revealed fine-grained token hides linked PRs |
| 27 Sep | Claude Code | Built deterministic rule extraction: sentence splitter, PR template parser, prose matcher, config reader (GraphQL + yaml), 210 tests | Decided to drop AI entirely, chose yaml package over regex, designed checkbox classification and "less strict wins" precedence, required real-repo verification |
| 27 Sep | Claude Code | Learned rules from commit history (fetchRecentCommits, fromHistory), added obligation phrases and curly-apostrophe negation fix, 241 tests | Proposed learning rules from commit history, added PR-URL as squash signal, required history rules to be yellow not red, asked for all obligation phrases at once |
