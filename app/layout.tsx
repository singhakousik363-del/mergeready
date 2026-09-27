import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

// next/font downloads these at build time and serves them from our own
// site: no request to Google from the visitor's browser
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Only for the big headline and section titles
const instrumentSerif = Instrument_Serif({ variable: "--font-instrument-serif", weight: "400", subsets: ["latin"] });

const TITLE = "MergeReady: check your first pull request";
const DESCRIPTION =
    "Paste a GitHub issue or PR link. MergeReady reads the repo's own rules and shows what to fix before a maintainer has to tell you. No AI: every rule comes with proof.";

export const metadata: Metadata = {
    // Makes the Open Graph image URL absolute, which link previews need
    metadataBase: new URL("https://mergeready-three.vercel.app"),
    title: TITLE,
    description: DESCRIPTION,
    openGraph: {
        title: TITLE,
        description: DESCRIPTION,
        url: "/",
        siteName: "MergeReady",
        type: "website",
    },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = {
    // Browser UI colour matches the page in light and dark mode
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#faf7f2" },
        { media: "(prefers-color-scheme: dark)", color: "#15140f" },
    ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <html
            lang="en"
            className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
        >
            <body className="min-h-full flex flex-col">{children}</body>
        </html>
    );
}
