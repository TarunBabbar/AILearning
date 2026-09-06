import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import ChatWidget from "@/components/ChatWidget";

export const metadata: Metadata = {
  title: "Tarun Kumar Babbar — AI QA Architect | 1st Place, AI Tester Blueprint 3x",
  description:
    "AI QA Architect and Test Automation Engineer with 18+ years. 1st place at The Testing Academy's AI Tester Blueprint 3x hackathon. Building multi-agent QA orchestration frameworks with Playwright, TypeScript, DeepEval, and Azure DevOps.",
  icons: {
    icon: "/tarunfavicon.png",
    shortcut: "/tarunfavicon.png",
  },
  openGraph: {
    title: "Tarun Kumar Babbar — AI QA Architect",
    description:
      "1st place, AI Tester Blueprint 3x hackathon · AI applications built with Playwright, TypeScript, DeepEval & agent orchestration. 18+ years in QA.",
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
        <ChatWidget />
        <Analytics />
      </body>
    </html>
  );
}
