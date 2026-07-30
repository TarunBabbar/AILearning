import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ProtectedLayout } from "@/components/ui/ProtectedLayout";

export const metadata: Metadata = {
  title: "QA AI Dashboard",
  description: "Unified QA platform — resume matching, interview prep, test architect & more",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">
        <AuthProvider>
          <ProtectedLayout>
            {children}
          </ProtectedLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
