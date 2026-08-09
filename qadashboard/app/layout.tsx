import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ProtectedLayout } from "@/components/ui/ProtectedLayout";
import SWRProvider from "@/components/ui/SWRProvider";

export const metadata: Metadata = {
  title: "QA AI Dashboard",
  description: "Unified QA platform — resume matching, interview prep, test architect & more",
};

// All pages are authenticated + client-fetched; never statically prerender.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">
        <AuthProvider>
          <SWRProvider>
            <ProtectedLayout>
              {children}
            </ProtectedLayout>
          </SWRProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
