import type { CheckStatus } from "@/lib/checks/types";
import { STATUS_LABEL } from "@/lib/ui/labels";

// Tailwind only includes classes it can find written out in full, so each
// status lists its classes here instead of building them from strings
// border = all sides (journey circles); borderLeft = only the left edge (check cards)
export const STATUS_STYLE: Record<CheckStatus, { text: string; soft: string; border: string; borderLeft: string }> = {
    pass: { text: "text-pass", soft: "bg-pass-soft", border: "border-pass", borderLeft: "border-l-pass" },
    fail: { text: "text-fail", soft: "bg-fail-soft", border: "border-fail", borderLeft: "border-l-fail" },
    warn: { text: "text-warn", soft: "bg-warn-soft", border: "border-warn", borderLeft: "border-l-warn" },
    manual: { text: "text-manual", soft: "bg-manual-soft", border: "border-manual", borderLeft: "border-l-manual" },
    pending: { text: "text-pending", soft: "bg-pending-soft", border: "border-pending", borderLeft: "border-l-pending" },
    skip: { text: "text-skip", soft: "bg-skip-soft", border: "border-skip", borderLeft: "border-l-skip" },
};

// A different SHAPE per status, so it's clear without colour too
export function StatusIcon({ status, className = "h-4 w-4" }: { status: CheckStatus; className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            {status === "pass" && <path d="M5 12.5l4.5 4.5L19 7.5" />}
            {status === "fail" && <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />}
            {status === "warn" && (
                <>
                    <path d="M12 3.5l9.5 16.5h-19z" />
                    <path d="M12 10v4M12 17.2v.3" />
                </>
            )}
            {status === "manual" && (
                <>
                    <path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z" />
                    <circle cx="12" cy="12" r="2.8" />
                </>
            )}
            {status === "pending" && (
                <>
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M12 7.5V12l3 2" />
                </>
            )}
            {status === "skip" && <path d="M6.5 12h11" />}
        </svg>
    );
}

// Icon + word, e.g. "✕ Fix this"
export function StatusBadge({ status }: { status: CheckStatus }) {
    const style = STATUS_STYLE[status];
    return (
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium ${style.soft} ${style.text}`}>
            <StatusIcon status={status} />
            {STATUS_LABEL[status]}
        </span>
    );
}
