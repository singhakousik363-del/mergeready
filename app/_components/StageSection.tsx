import type { StageGroup } from "@/lib/server/analyze";
import { STAGE_LABEL } from "@/lib/ui/labels";
import { CheckCard } from "./CheckCard";
import { StatusBadge } from "./StatusBadge";

// Problems get full cards; things that passed or weren't checked are listed
// below them, still openable, so nothing is hidden but the problems stand out
export function StageSection({ group, index }: { group: StageGroup; index: number }) {
    const titleId = `stage-${group.stage}-title`;
    const needsAttention = group.checks.filter((c) => c.status !== "pass" && c.status !== "skip");
    const fine = group.checks.filter((c) => c.status === "pass" || c.status === "skip");

    return (
        <section id={`stage-${group.stage}`} aria-labelledby={titleId} className="mt-12 scroll-mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                <h3 id={titleId} className="font-display text-2xl sm:text-3xl">
                    {index + 1}. {STAGE_LABEL[group.stage]}
                </h3>
                <StatusBadge status={group.status} />
            </div>
            <p className="mt-3 text-muted">{group.summary}</p>

            {needsAttention.length > 0 && (
                <ul className="mt-4 flex flex-col gap-4">
                    {needsAttention.map((check) => (
                        <li key={check.id}>
                            <CheckCard check={check} />
                        </li>
                    ))}
                </ul>
            )}
            {fine.length > 0 && (
                <details className="mt-4" open={needsAttention.length === 0}>
                    <summary className="cursor-pointer text-sm font-medium text-accent">
                        {fine.length === 1 ? "1 check passed or didn't apply" : `${fine.length} checks passed or didn't apply`}
                    </summary>
                    <ul className="mt-3 flex flex-col gap-3">
                        {fine.map((check) => (
                            <li key={check.id}>
                                <CheckCard check={check} />
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </section>
    );
}
