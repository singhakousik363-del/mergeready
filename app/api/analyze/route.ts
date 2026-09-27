import { createAnalyzeHandler } from "@/lib/server/handleAnalyze";

// POST /api/analyze { url, username? } -> journey, checks, rules, sections, PR description.
// All the logic is in lib/server (tested there); this file only connects it to Next.js.

// Seconds Vercel lets this run: the analysis stops itself at 25s (BUDGET_MS),
// and the extra 5s leave time to send the friendly timeout message.
export const maxDuration = 30;

export const POST = createAnalyzeHandler();
