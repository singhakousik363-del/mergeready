"use client";

import { useEffect, useState } from "react";

type Props = {
    text: string;
    // What is being copied, for screen readers, e.g. "command" or "share link"
    what: string;
    className?: string;
};

export function CopyButton({ text, what, className = "" }: Props) {
    const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

    // Go back to "Copy" after a moment
    useEffect(() => {
        if (status === "idle") return;
        const timer = setTimeout(() => setStatus("idle"), 2000);
        return () => clearTimeout(timer);
    }, [status]);

    async function copy() {
        try {
            await navigator.clipboard.writeText(text);
            setStatus("copied");
        } catch {
            // e.g. the browser blocked clipboard access
            setStatus("failed");
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={() => void copy()}
                aria-label={`Copy ${what}`}
                className={`shrink-0 px-3 py-2 text-sm font-medium text-accent hover:underline ${className}`}
            >
                {status === "copied" ? "Copied" : status === "failed" ? "Copy failed" : "Copy"}
            </button>
            {/* Announces the result; the button's own label stays "Copy ..." */}
            <span className="sr-only" aria-live="polite">
                {status === "copied" ? `Copied ${what}` : status === "failed" ? "Copy failed. Select the text and copy it yourself." : ""}
            </span>
        </>
    );
}
