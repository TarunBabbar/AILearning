import Sidebar from "@/components/Sidebar";
import SWRProvider from "@/components/SWRProvider";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SWRProvider>
      <div className="flex h-screen overflow-hidden bg-[#f5f4ef]">
        <Sidebar />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-4">
          {children}
        </main>
      </div>
    </SWRProvider>
  );
}
