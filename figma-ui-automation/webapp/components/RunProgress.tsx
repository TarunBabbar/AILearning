'use client';

import { useEffect, useRef, useState } from 'react';

export default function RunProgress({ streamUrl, onDone }: { streamUrl: string | null; onDone?: () => void }) {
  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!streamUrl) return;
    setLines([]);
    setStatus('running');
    const es = new EventSource(streamUrl);

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'log') {
          setLines((prev) => [...prev, data.line]);
        } else if (data.type === 'done') {
          setStatus('done');
          es.close();
          onDone?.();
        }
      } catch {
        /* ignore malformed */
      }
    };
    es.onerror = () => {
      setStatus('error');
      es.close();
    };

    return () => es.close();
  }, [streamUrl, onDone]);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [lines]);

  if (!streamUrl) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`w-2 h-2 rounded-full ${status === 'running' ? 'bg-amber-600 animate-pulse' : status === 'done' ? 'bg-green-600' : 'bg-gray-400'}`} />
        <span className="text-[12px] font-medium text-[#52606d]">
          {status === 'running' ? 'Running…' : status === 'done' ? 'Completed' : 'Stream error'}
        </span>
      </div>
      <div
        ref={boxRef}
        className="bg-[#faf7f5] border border-[#ede3da] rounded-lg p-3 h-56 overflow-y-auto mono text-[11px] text-[#3e4c59] leading-relaxed"
      >
        {lines.length === 0 && <span className="text-[#9aa5b1]">waiting for output…</span>}
        {lines.map((l, i) => (
          <div key={i} className="whitespace-pre-wrap break-words">
            {l.trim() || '\u00a0'}
          </div>
        ))}
      </div>
    </div>
  );
}
