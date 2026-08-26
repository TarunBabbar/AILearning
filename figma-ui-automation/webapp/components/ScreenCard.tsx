'use client';

import StatusBadge from './StatusBadge';

export interface Screen {
  id: string;
  name: string;
  state: string;
  designVersion: string | null;
  lastRunAt: string | null;
}

export default function ScreenCard({ screen, onRun }: { screen: Screen; onRun: (pipeline: 'a' | 'b') => void }) {
  return (
    <div className="bg-white border border-[#ede3da] rounded-xl p-4 flex flex-col gap-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-[15px] text-[#1f2933]">{screen.name}</div>
          <div className="mono text-[11px] text-[#52606d] mt-0.5">{screen.id}</div>
        </div>
        <StatusBadge state={screen.state} />
      </div>

      <div className="text-[11.5px] text-[#52606d] space-y-0.5">
        <div>Design: <span className="mono">{screen.designVersion ?? '—'}</span></div>
        {screen.lastRunAt && <div>Last run: {new Date(screen.lastRunAt).toLocaleString()}</div>}
      </div>

      <div className="flex gap-2 pt-1 border-t border-[#f0eae2]">
        <button
          onClick={() => onRun('a')}
          className="flex-1 rounded-md bg-amber-700 hover:bg-amber-800 text-white text-[12.5px] font-medium py-1.5 transition-colors"
        >
          Validate (A)
        </button>
        <button
          onClick={() => onRun('b')}
          className="flex-1 rounded-md bg-[#f5f0ea] hover:bg-[#ece5dc] text-[#1f2933] text-[12.5px] font-medium py-1.5 border border-[#ede3da] transition-colors"
        >
          Shift-Left (B)
        </button>
      </div>
    </div>
  );
}
