export default function ProsCons({ good, bad }: { good: string[]; bad: string[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section className="rounded-xl border border-green-300/40 bg-green-50/60 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-green-800">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-green-600 text-[11px] text-white">✓</span>
          What&apos;s Good
        </h3>
        {good.length === 0 ? (
          <p className="text-sm text-green-700/70">No positive signals captured yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {good.map((item, i) => (
              <li
                key={i}
                className="flex gap-2 rounded-md border-l-2 border-green-500 bg-white/60 px-3 py-2 text-sm leading-snug text-green-900"
              >
                {item}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-rose-300/40 bg-rose-50/60 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-rose-800">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-rose-500 text-[11px] text-white">✕</span>
          What Needs Work
        </h3>
        {bad.length === 0 ? (
          <p className="text-sm text-rose-700/70">No negative signals captured yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {bad.map((item, i) => (
              <li
                key={i}
                className="flex gap-2 rounded-md border-l-2 border-rose-500 bg-white/60 px-3 py-2 text-sm leading-snug text-rose-900"
              >
                {item}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}