"use client";

import { SWRConfig } from "swr";
import { swrFetcher } from "@/lib/swr-fetcher";

export default function SWRProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SWRConfig
      value={{
        fetcher: swrFetcher,
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        dedupingInterval: 2000,
        keepPreviousData: true,
        errorRetryCount: 2,
      }}
    >
      {children}
    </SWRConfig>
  );
}
