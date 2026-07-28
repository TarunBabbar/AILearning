import type { Metadata } from "next";
import "../styles/globals.css";
import Sidebar from "../components/ui/Sidebar";
import { SidebarProvider } from "../lib/sidebar-context";

export const metadata: Metadata = {
  title: "QA Interview Assistant",
  description:
    "RAG-powered QA interview preparation assistant. Ask questions, browse topics, upload documents.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SidebarProvider>
          <div className="flex min-h-screen bg-claude-beige">
            <Sidebar />
            <main id="main-content" className="flex-1 min-h-screen sidebar-transition">
              {children}
            </main>
          </div>
        </SidebarProvider>
      </body>
    </html>
  );
}
