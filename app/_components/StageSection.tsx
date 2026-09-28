import type { StageGroup } from "@/lib/server/analyze";
import { STAGE_LABEL } from "@/lib/ui/labels";
import { CheckCard } from "./CheckCard";
import { StatusBadge } from "./StatusBadge";

// Problems get full cards; things that passed or weren't checked are listed
// below them, still openable, so nothing is hidden but the problems stand out
export function StageSection({ group, index }: { group: StageGroup; index: number }) {
    const titleId = `stage-${group.stage}-title`;

    // Nothing to check here yet (e.g. no PR): one quiet line, not a big empty section
    if (group.checks.length === 0) {
        return (
            <section id={`stage-${group.stage}`} aria-labelledby={titleId} className="mt-6 scroll-mt-6">
                <h3 id={titleId} className="flex flex-wrap items-baseline gap-x-3 text-muted">
                    <span className="font-display text-xl text-ink">
                        {index + 1}. {STAGE_LABEL[group.stage]}
                    </span>
                    <span className="text-sm">{group.summary}</span>
                </h3>
            </section>
        );
    }

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
