import type { Metadata } from "next";
import "./globals.css";
import { SidebarProvider } from "@/lib/sidebar-context";
import { AuthProvider } from "@/lib/auth-context";
import { Sidebar } from "@/components/ui/Sidebar";
import { ProtectedLayout } from "@/components/ui/ProtectedLayout";

export const metadata: Metadata = {
  title: "QA AI Dashboard",
  description: "Unified QA platform — resume matching, interview prep, test architect & more",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full flex">
        <AuthProvider>
          <ProtectedLayout>
            <SidebarProvider>
              <Sidebar />
              <main className="flex-1 flex flex-col min-w-0 overflow-auto">
                {children}
              </main>
            </SidebarProvider>
          </ProtectedLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
