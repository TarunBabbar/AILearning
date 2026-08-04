import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Audio-First Cartoon Generator",
  description: "Generate lip-synced cartoon videos — audio first, then video.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
