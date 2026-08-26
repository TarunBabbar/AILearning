const PALETTE: Record<string, string> = {
  Product: "bg-gold/20 text-gold-deep border-gold/40",
  Service: "bg-mocha/20 text-mocha border-mocha/40",
  Consulting: "bg-taupe/25 text-coffee border-taupe/50",
  Staffing: "bg-sand/50 text-mocha border-sand",
  Startup: "bg-cream/60 text-coffee border-taupe/40",
  Other: "bg-transparent text-mocha border-sand/60",
};

export default function TypeBadge({
  type,
  className = "",
}: {
  type: string;
  className?: string;
}) {
  const palette = PALETTE[type] ?? PALETTE.Other;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize tracking-wide ${palette} ${className}`}
    >
      {type}
    </span>
  );
}