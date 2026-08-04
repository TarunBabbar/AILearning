import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mom & Son Cartoon Generator",
  description:
    "Generate Mom & Son educational cartoon videos about vegetables, fruits and healthy foods.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
