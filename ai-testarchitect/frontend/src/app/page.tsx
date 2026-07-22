"use client";

import { Sidebar } from "@/components/sidebar/Sidebar";
import { ChatArea } from "@/components/chat/ChatArea";

export default function Home() {
  return (
    <>
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <ChatArea />
      </main>
    </>
  );
}
