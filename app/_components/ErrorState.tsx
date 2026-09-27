type Props = {
    message: string;
    // Seconds to wait before trying again (rate limits), if the server said
    retryAfterSeconds: number | null;
    onRetry: () => void;
};

export function ErrorState({ message, retryAfterSeconds, onRetry }: Props) {
    return (
        // role="alert": screen readers read this out as soon as it appears
        <div role="alert" className="mt-10 rounded-2xl border border-fail/40 bg-fail-soft p-5 sm:p-6">
            <h2 className="flex items-center gap-2 font-medium">
                <span aria-hidden="true" className="text-fail">
                    ✕
                </span>
                We couldn&apos;t finish the check
            </h2>
            <p className="mt-2">{message}</p>
            <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-lg border border-line bg-card px-4 py-2 font-medium hover:border-accent"
            >
                Try again{retryAfterSeconds !== null ? ` (after ${retryAfterSeconds}s)` : ""}
            </button>
        </div>
    );
}
