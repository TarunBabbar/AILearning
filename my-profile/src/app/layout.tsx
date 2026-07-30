import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tarun Kumar Babbar — Test Automation Architect | AI-Augmented QA",
  description:
    "Test Automation Architect with 18+ years building enterprise-grade automation frameworks, AI-augmented QA systems, and multi-agent AI test platforms. Currently building an AI Test Copilot.",
  openGraph: {
    title: "Tarun Kumar Babbar — Test Automation Architect",
    description:
      "Architecting the future of AI-powered test automation. 18+ years, 6 AI platforms, enterprise frameworks.",
    type: "website",
    locale: "en_IN",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full">
        <header className="sr-only"><h1>Tarun Kumar Babbar — AI QA Architect</h1></header>
        {children}
      </body>
    </html>
  );
}
