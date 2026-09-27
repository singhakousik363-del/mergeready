// Honest loading: the server does one call, so there are no fake
// "step 1 of 4" messages. Just what is happening and how long it takes.
export function LoadingState() {
    return (
        <div className="mt-10" aria-hidden="true">
            <p className="text-muted">Reading the repo&apos;s rules and your PR, usually 2–6 seconds…</p>
            {/* Calm placeholder shapes where the results will appear */}
            <div className="mt-6 flex animate-pulse flex-col gap-4">
                <div className="h-20 rounded-2xl bg-line/60" />
                <div className="h-32 rounded-2xl bg-line/40" />
                <div className="h-32 rounded-2xl bg-line/30" />
            </div>
        </div>
    );
}
