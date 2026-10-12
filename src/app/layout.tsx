import type { Metadata, Viewport } from "next";
import { Instrument_Serif, JetBrains_Mono, Manrope } from "next/font/google";
import { MOTION_INIT_SCRIPT } from "@/lib/motion";
import "./globals.css";

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});

const sans = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

// mono is never part of the first paint (LCP), so it is not preloaded
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap", preload: false });

const title = "Helix Labs — Genomic medicine, explained in person";
const description =
  "Whole-genome sequencing, cell therapy, precision diagnostics and a longevity programme — interpreted by a clinician who sits down with you. Book a consultation.";

// Vercel is the canonical site; the GitHub Pages mirror only changes where share images resolve
const siteUrl = "https://helix-labs-3d.vercel.app";
const assetBase = process.env.GH_PAGES === "1" ? "https://kyan9400.github.io" : siteUrl;

export const metadata: Metadata = {
  metadataBase: new URL(assetBase),
  title: { default: title, template: "%s · Helix Labs" },
  description,
  applicationName: "Helix Labs",
  authors: [{ name: "Alhassan Alfarran", url: "https://alhassan-portfolio-sigma.vercel.app" }],
  creator: "Alhassan Alfarran",
  keywords: ["genome sequencing", "genomic medicine", "cell therapy", "precision diagnostics", "longevity", "clinic"],
  alternates: { canonical: `${siteUrl}/` },
  openGraph: {
    type: "website",
    url: `${siteUrl}/`,
    siteName: "Helix Labs",
    title,
    description,
    locale: "en_GB",
  },
  twitter: { card: "summary_large_image", title, description },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#F4F1EA",
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
      data-motion="full"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOTION_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
