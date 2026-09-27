import { ImageResponse } from "next/og";

// The picture shown when someone shares a MergeReady link (Slack, WhatsApp, X...)
export const alt = "MergeReady: check your first pull request before a maintainer has to";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const STAGES = ["Issue", "Work", "Commit", "PR", "Merge"];

export default function Image() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "72px 80px",
                    background: "#faf7f2",
                    color: "#1c1b19",
                }}
            >
                <div style={{ display: "flex", fontSize: 32, color: "#0f5f58", letterSpacing: 1 }}>MergeReady</div>
                <div style={{ display: "flex", fontSize: 72, lineHeight: 1.1, maxWidth: 980 }}>
                    Check your first pull request before a maintainer has to.
                </div>
                {/* The journey as a git graph: five dots on one line */}
                <div style={{ display: "flex", alignItems: "center" }}>
                    {STAGES.map((stage, i) => (
                        <div key={stage} style={{ display: "flex", alignItems: "center" }}>
                            {/* Same width for every stage, so the dots are evenly spaced */}
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 120 }}>
                                <div
                                    style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: 14,
                                        border: "5px solid #0f5f58",
                                        background: i < 2 ? "#0f5f58" : "#faf7f2",
                                    }}
                                />
                                <div style={{ display: "flex", marginTop: 12, fontSize: 26, fontFamily: "sans-serif" }}>
                                    {stage}
                                </div>
                            </div>
                            {i < STAGES.length - 1 && (
                                <div style={{ width: 110, height: 5, background: "#0f5f58", marginBottom: 38 }} />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        ),
        size
    );
}
