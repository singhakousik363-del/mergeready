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
- AI (Gemini) ONLY reads the repo's written guidelines and converts them
  into a structured JSON checklist. Every rule MUST include the exact
  source quote from the guideline file.
- All actual verification is deterministic TypeScript code in
  /lib/checks. AI never decides pass/fail.

## Tech
- Next.js (App Router) + TypeScript + Tailwind
- This project uses Next.js 16. Its APIs may differ from your training
  data. Before writing Next.js-specific code (routes, config, layout),
  check the docs in node_modules/next/dist/docs.
- GitHub REST API via Octokit (server-side, token in GITHUB_TOKEN)
- Gemini API via @google/genai (key in GEMINI_API_KEY)
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
Day 1: parseUrl.ts done with 7 passing tests.
Next: fetch CONTRIBUTING.md and PR template from GitHub.
