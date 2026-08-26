'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '◧' },
  { href: '/validation', label: 'Validation (A)', icon: '✓' },
  { href: '/shiftleft', label: 'Shift-Left (B)', icon: '→' },
  { href: '/review', label: 'Test Review', icon: '✎' },
  { href: '/agents', label: 'Agents', icon: '◈' },
  { href: '/runs', label: 'Runs', icon: '≡' },
  { href: '/reports', label: 'Reports', icon: '▤' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
];

interface Health {
  ok: boolean;
  hasOpenRouterKey: boolean;
  hasFigmaToken: boolean;
  hasStagingUrl: boolean;
  deepevalMode: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <aside className="w-60 shrink-0 border-r border-[#ede3da] bg-[#f5f0ea] flex flex-col">
      <div className="px-5 py-5 border-b border-[#ede3da]">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-amber-700 text-white flex items-center justify-center text-sm">◐</span>
          <div>
            <div className="font-semibold text-[15px] leading-tight text-[#1f2933]">Figma UI</div>
            <div className="text-[11px] text-[#52606d] leading-tight">Automation</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] transition-colors ${
                active
                  ? 'bg-amber-50 text-amber-800 font-medium border-l-2 border-amber-700'
                  : 'text-[#52606d] hover:bg-[#ece5dc] hover:text-[#1f2933]'
              }`}
            >
              <span className="w-4 text-center text-sm opacity-80">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-[#ede3da] text-[11.5px] text-[#52606d]">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${health?.ok ? 'bg-green-600' : 'bg-amber-600'} inline-block`} />
          Pipeline status: {health ? (health.ok ? 'ready' : 'partial') : '…'}
        </div>
        {health && (
          <div className="mt-1.5 space-y-0.5 mono text-[10.5px] opacity-80">
            <div>· OpenRouter: {health.hasOpenRouterKey ? '✓' : '–'}</div>
            <div>· Figma: {health.hasFigmaToken ? '✓' : '–'}</div>
            <div>· Staging: {health.hasStagingUrl ? '✓' : '–'}</div>
            <div>· Eval: {health.deepevalMode}</div>
          </div>
        )}
      </div>
    </aside>
  );
}
