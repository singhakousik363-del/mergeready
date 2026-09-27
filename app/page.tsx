import { Analyzer } from "./_components/Analyzer";

// The page itself is rendered on the server (fast first paint, readable
// without JavaScript). Only <Analyzer> runs in the browser.
export default function Home() {
    return (
        <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12 sm:py-20">
            <header>
                <p className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-mono font-medium text-accent">MergeReady</span>
                    <span className="rounded-full border border-line px-2.5 py-0.5 text-muted">
                        No AI · every rule comes with proof
                    </span>
                </p>
                <h1 className="mt-6 font-display text-5xl leading-[1.05] sm:text-6xl">
                    Check your first pull request before a maintainer has to.
                </h1>
                <p className="mt-5 max-w-2xl text-lg text-muted">
                    Paste an issue you want to work on, or your pull request. MergeReady reads this repo&apos;s own
                    rules (its configs, PR template, commit history and CONTRIBUTING file) and shows what to fix, with
                    a link to where each rule is written.
                </p>
            </header>

            <Analyzer />
        </main>
    );
}
