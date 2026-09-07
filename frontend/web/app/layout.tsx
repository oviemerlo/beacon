import type { Metadata } from "next";
import { Nunito, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Nunito({ subsets: ["latin"], variable: "--font-display", weight: ["400", "600", "700"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500"] });

const SITE_URL = "https://www.echotocrowd.com";
const SITE_DESCRIPTION = "Find people and businesses near you who share where you're from.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "EchoToCrowd",
  description: SITE_DESCRIPTION,
  openGraph: {
    title: "EchoToCrowd",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: "EchoToCrowd",
    type: "website",
    images: [{ url: "/og-share.png", width: 512, height: 512, alt: "EchoToCrowd" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "EchoToCrowd",
    description: SITE_DESCRIPTION,
    images: ["/og-share.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
