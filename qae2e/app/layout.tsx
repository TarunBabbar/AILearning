import type { Metadata } from "next";
import "./globals.css";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "QAE2E Agentic Quality Engineering";

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "AI-Powered Quality Engineering. From Requirement to Release Confidence — an agentic QA workspace with six specialist AI agents.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">
        {children}
      </body>
    </html>
  );
}
