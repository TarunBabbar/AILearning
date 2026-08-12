import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { getConfig } from "@/lib/config";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const cfg = getConfig();

export const metadata: Metadata = {
  title: cfg.appName
    ? `${cfg.appName} — Job Tracking Dashboard`
    : "QA Tracker — Job Tracking Dashboard",
  description:
    "Browse QA job listings, track companies, and stay on top of opportunities.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
