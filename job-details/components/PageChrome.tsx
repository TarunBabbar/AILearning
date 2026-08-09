import { cn } from "@/lib/utils";

/**
 * Fixed page header + independent scroll body.
 * Header never overlaps content — list scrolls in the panel below.
 */
export default function PageChrome({
  header,
  children,
  className,
  maxWidthClass = "max-w-7xl",
  hideHeader = false,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  maxWidthClass?: string;
  /** Hide page header (e.g. while a full-screen modal is open). */
  hideHeader?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex h-full min-h-0 w-full flex-col",
        maxWidthClass,
        className
      )}
    >
      {!hideHeader && (
        <header className="relative z-10 shrink-0 border-b border-claude-border bg-[#f5f4ef] pb-2.5">
          {header}
        </header>
      )}
      <div
        id="page-scroll"
        className={cn(
          "relative z-0 min-h-0 flex-1 overflow-y-auto",
          hideHeader ? "pt-0" : "pt-3"
        )}
      >
        {children}
      </div>
    </div>
  );
}
