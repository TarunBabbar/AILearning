import Sidebar from "@/components/Sidebar";
import SWRProvider from "@/components/SWRProvider";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SWRProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </SWRProvider>
  );
}
