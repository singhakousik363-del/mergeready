# Test fixtures

Real output of our own fetch functions on real GitHub data (captured 27 Sep 2026),
saved as JSON so tests never call the API.

| File | Made with | Source |
|---|---|---|
| stdlib-pr-15585.json | `fetchPullRequest("stdlib-js", "stdlib", 15585)` | https://github.com/stdlib-js/stdlib/pull/15585 |
| stdlib-issue-12959.json | `fetchIssue("stdlib-js", "stdlib", 12959)` | https://github.com/stdlib-js/stdlib/issues/12959 |
| stdlib-issue-15456.json | `fetchIssue("stdlib-js", "stdlib", 15456)` (the issue PR #15585 links) | https://github.com/stdlib-js/stdlib/issues/15456 |
