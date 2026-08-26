const STATE_COLORS: Record<string, string> = {
  'design-only': 'bg-gray-100 text-gray-700 border-gray-200',
  'design-extracted': 'bg-amber-50 text-amber-800 border-amber-200',
  'impl-inspected': 'bg-amber-50 text-amber-800 border-amber-200',
  validated: 'bg-green-50 text-green-700 border-green-200',
  'tests-generated': 'bg-amber-50 text-amber-800 border-amber-200',
  'tests-approved': 'bg-blue-50 text-blue-700 border-blue-200',
  'automation-generated': 'bg-blue-50 text-blue-700 border-blue-200',
  'pending-dev': 'bg-purple-50 text-purple-700 border-purple-200',
  'dev-shipped': 'bg-green-50 text-green-700 border-green-200',
  'eval-failed': 'bg-red-50 text-red-700 border-red-200',
};

export default function StatusBadge({ state }: { state: string }) {
  const cls = STATE_COLORS[state] ?? 'bg-gray-100 text-gray-700 border-gray-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cls}`}>
      {state.replace(/-/g, ' ')}
    </span>
  );
}
