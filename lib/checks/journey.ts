import type { Check, CheckStatus, Stage } from "./types";

export const STAGES: Stage[] = ["issue", "work", "commit", "pr", "merge"];

// One box on the journey map
export type JourneyStep = {
    stage: Stage;
    status: CheckStatus;
    // Short text under the box, e.g. "1 to fix"
    summary: string;
};

// Worst first: a stage shows the worst status of its checks
export const WORST_FIRST: CheckStatus[] = ["fail", "warn", "manual", "pending", "pass", "skip"];

// mode: what the user pasted. With only an issue, the later stages can't be checked yet.
export function buildJourney(checks: Check[], mode: "issue" | "pr"): JourneyStep[] {
    return STAGES.map((stage) => {
        const inStage = checks.filter((c) => c.stage === stage);
        const status = worstStatus(inStage);

        if (status === "skip") {
            const later = mode === "issue" && stage !== "issue";
            return { stage, status, summary: later ? "Open a PR to check this." : "Nothing to check here." };
        }
        return { stage, status, summary: summarize(inStage, status) };
    });
}

export function worstStatus(checks: Check[]): CheckStatus {
    for (const status of WORST_FIRST) {
        if (checks.some((c) => c.status === status)) return status;
    }
    // No checks at all
    return "skip";
}

function summarize(checks: Check[], status: CheckStatus): string {
    const count = (s: CheckStatus) => checks.filter((c) => c.status === s).length;
    switch (status) {
        case "fail":
            return `${count("fail")} to fix${count("warn") > 0 ? `, ${count("warn")} to look at` : ""}`;
        case "warn":
            return `${count("warn")} to look at`;
        case "manual":
            return `${count("manual")} to check yourself`;
        case "pending":
            // Only the merge stage is ever pending: show its own message
            return checks.find((c) => c.status === "pending")?.message ?? "Waiting";
        case "pass":
            return "All good";
        case "skip":
            return "Nothing to check here.";
    }
}
