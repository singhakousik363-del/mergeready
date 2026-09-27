"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseGithubUrl } from "@/lib/github/parseUrl";
import { requestAnalysis } from "@/lib/ui/requestAnalysis";
import { buildShareSearch, readShareParams } from "@/lib/ui/shareLink";
import type { AnalyzeResponse } from "@/lib/server/analyze";
import { CheckForm } from "./CheckForm";
import { ErrorState } from "./ErrorState";
import { LoadingState } from "./LoadingState";
import { Results } from "./Results";

type State =
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "error"; message: string; retryAfterSeconds: number | null }
    | { kind: "done"; data: AnalyzeResponse; shareUrl: string };

// The interactive part of the page: form, loading, error and results
export function Analyzer() {
    const [url, setUrl] = useState("");
    const [username, setUsername] = useState("");
    const [formError, setFormError] = useState<string | null>(null);
    const [state, setState] = useState<State>({ kind: "idle" });
    // What screen readers hear when the result changes
    const [announcement, setAnnouncement] = useState("");
    // Cancels the previous check when a new one starts
    const controllerRef = useRef<AbortController | null>(null);
    const resultsHeadingRef = useRef<HTMLHeadingElement>(null);

    const run = useCallback(async (checkUrl: string, checkUser: string) => {
        // Check the link here first: no server call for an obvious typo
        const parsed = parseGithubUrl(checkUrl);
        if (!parsed.ok) {
            setFormError(parsed.error);
            return;
        }
        setFormError(null);

        controllerRef.current?.abort();
        const controller = new AbortController();
        controllerRef.current = controller;

        setState({ kind: "loading" });
        setAnnouncement("Checking…");
        const result = await requestAnalysis({ url: checkUrl, username: checkUser }, controller.signal);
        // null = a newer check replaced this one
        if (result === null) return;

        if (!result.ok) {
            setState({ kind: "error", message: result.message, retryAfterSeconds: result.retryAfterSeconds });
            setAnnouncement(`Check failed: ${result.message}`);
            return;
        }
        // Shareable address, without reloading the page
        const search = buildShareSearch({ url: checkUrl, username: checkUser });
        window.history.replaceState(null, "", search);
        setState({ kind: "done", data: result.data, shareUrl: `${window.location.origin}/${search}` });
        setAnnouncement(`Results ready. ${summarize(result.data)}`);
    }, []);

    // A shared link (?url=...&user=...) fills the form and runs the check once
    useEffect(() => {
        const shared = readShareParams(new URLSearchParams(window.location.search));
        if (!shared) return;
        // Reading the address can only happen in the browser, after the first render
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUrl(shared.url);
        setUsername(shared.username);
        void run(shared.url, shared.username);
    }, [run]);

    // Move keyboard and screen reader focus to the new results
    useEffect(() => {
        if (state.kind === "done") resultsHeadingRef.current?.focus();
    }, [state]);

    return (
        <>
            <CheckForm
                url={url}
                username={username}
                onUrlChange={setUrl}
                onUsernameChange={setUsername}
                onSubmit={() => void run(url, username)}
                onExample={(exampleUrl) => {
                    setUrl(exampleUrl);
                    void run(exampleUrl, username);
                }}
                error={formError}
                busy={state.kind === "loading"}
            />

            {/* Screen readers announce changes here; sighted users see the real content below */}
            <p className="sr-only" aria-live="polite">
                {announcement}
            </p>

            {state.kind === "loading" && <LoadingState />}
            {state.kind === "error" && (
                <ErrorState
                    message={state.message}
                    retryAfterSeconds={state.retryAfterSeconds}
                    onRetry={() => void run(url, username)}
                />
            )}
            {state.kind === "done" && <Results data={state.data} shareUrl={state.shareUrl} headingRef={resultsHeadingRef} />}
        </>
    );
}

// "2 to fix, 1 to look at." for the screen reader announcement
function summarize(data: AnalyzeResponse): string {
    const all = data.stages.flatMap((stage) => stage.checks);
    const fix = all.filter((c) => c.status === "fail").length;
    const look = all.filter((c) => c.status === "warn").length;
    if (fix === 0 && look === 0) return "Nothing to fix.";
    return [fix > 0 ? `${fix} to fix` : "", look > 0 ? `${look} to look at` : ""].filter(Boolean).join(", ") + ".";
}
