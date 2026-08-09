import { cn } from "@/lib/utils";

/**
 * Fixed page header + independent scroll body.
 * Header never overlaps content — the list scrolls in the panel below.
 * Consistent horizontal padding keeps content clear of the sidebar edge.
 */
export default function PageChrome({
  header,
  children,
  className,
  maxWidthClass = "max-w-7xl",
  hideHeader = false,
  bodyClassName,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  maxWidthClass?: string;
  /** Hide page header (e.g. while a full-screen modal is open). */
  hideHeader?: boolean;
  /** Extra classes for the scroll body (e.g. tighter lists). */
  bodyClassName?: string;
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
        <header className="relative z-10 shrink-0 border-b border-border bg-bg-page px-5 pb-2.5 pt-3">
          {header}
        </header>
      )}
      <div
        id="page-scroll"
        className={cn(
          "relative z-0 min-h-0 flex-1 overflow-y-auto px-5",
          hideHeader ? "pt-3" : "pt-3",
          bodyClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
