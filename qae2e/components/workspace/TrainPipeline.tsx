"use client";

// Train-style pipeline visual.
//
//   ●═══════════════●═══════════════●═══════════════● ...   one straight rail
//   RI             MT              AS                    with the six agents as
//     ▾              ▾              ▾                     round station dots and
//     ◇              ◇              ◇                     their 2-letter code
//                                                         underneath. At each gap
//   A little side-view locomotive with spinning wheels rides the rail. It leaves
//   the first station as soon as Run is clicked, rolls toward each station,
//   halts at the AI-judge gate below the rail to be scored, continues when the
//   judge passes it, and — if the judge sends an agent back — an ORANGE engine
//   rolls back along the dashed lower rail to the earlier station, then re-runs.
//
// Colours carry ALL state (no running/done pills):
//   station dot  green = reached     yellow = moving toward it / active
//   station dot  red   = stop ahead (not reached yet)
//   judge gate   green pulse = scoring · green ✓ = passed · orange = sent back
//   engine       amber forward · orange on the return rail
//
// Motion is TIME-BASED and ticks while running, so the train always moves.
// Agent outputs are hidden by default; click a station dot to expand.

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  ListChecks,
  FileCode2,
  Container,
  GitBranch,
  Rocket,
  CheckCircle2,
  ChevronDown,
  XCircle,
} from "lucide-react";
import type { AgentEvent, Evaluation } from "@/lib/types";

const STATIONS: Array<{ key: string; code: string; label: string; sub: string; agentId: string; stageKey: string; icon: React.ReactNode }> = [
  { key: "ri", code: "RI", label: "Requirement Intelligence", sub: "Rules · criteria · risks", agentId: "requirement-intelligence", stageKey: "analyze", icon: <Sparkles size={15} /> },
  { key: "mt", code: "MT", label: "Manual Test Cases", sub: "Editable coverage", agentId: "manual-test-case", stageKey: "coverage", icon: <ListChecks size={15} /> },
  { key: "as", code: "AS", label: "Automation Scripts", sub: "Playwright POM code", agentId: "automation-script", stageKey: "automate", icon: <FileCode2 size={15} /> },
  { key: "ex", code: "EX", label: "Execution & Defects", sub: "Cycle + evidence", agentId: "execution-defect", stageKey: "execute", icon: <Container size={15} /> },
  { key: "do", code: "DO", label: "DevOps Pipeline", sub: "CI/CD evidence", agentId: "devops-execution", stageKey: "execute", icon: <GitBranch size={15} /> },
  { key: "iq", code: "IQ", label: "Release Confidence", sub: "Readiness gauge", agentId: "quality-intelligence", stageKey: "release", icon: <Rocket size={15} /> },
];

const N = STATIONS.length - 1; // 5 segments
const stF = (k: number) => k / N;

type Phase = "pending" | "running" | "rerunning" | "done" | "error";
interface AgentState {
  phase: Phase;
  tools: string[];
  artifacts: string[];
  chunks: string[];
  runs: number;
  legStartTs: number; // when the current run leg started (agent_start)
  doneTs: number; // when the agent produced its output (agent_done)
  retTs: number; // when the judge said re-run (return-rail timing)
}
type JudgePhase = "idle" | "scoring" | "passed" | "return";

const EMPTY = (): AgentState => ({
  phase: "pending",
  tools: [],
  artifacts: [],
  chunks: [],
  runs: 0,
  legStartTs: 0,
  doneTs: 0,
  retTs: 0,
});

// Position in "half-station units": station k sits at u = k, and the AI-judge
// gate that inspects station k sits at u = k + 0.5 (the gap before the next
// station). SEG_MS = time to cover one full unit (station→gate→station).
const SEG_MS = 7000;
const RET_MS = 1200;

export function TrainPipeline({
  events,
  evaluations,
  running,
  evaluating,
}: {
  events: AgentEvent[];
  evaluations: Record<string, Evaluation>;
  running: boolean;
  evaluating: { stage: string; agentCode: string } | null;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const [trackW, setTrackW] = useState(720);
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTrackW(el.clientWidth));
    ro.observe(el);
    setTrackW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // ---- LIVE CLOCK: drives all animation progress ----
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 120);
    return () => clearInterval(id);
  }, [running]);

  // ---------------- Derive per-station + judge state from events -----------
  const { agent, judge } = useMemo(() => {
    const am = new Map<string, AgentState>();
    for (const s of STATIONS) am.set(s.key, EMPTY());
    const jm = new Map<string, JudgePhase>();
    for (const s of STATIONS) jm.set(s.key, "idle");

    const sOf = (id: string | null) => STATIONS.find((x) => x.agentId === id);
    let current: string | null = null;

    for (const e of events) {
      const sCur = sOf(current);
      const ts = e.ts ?? Date.now();
      switch (e.type) {
        case "agent_start": {
          current = e.agentId;
          const s = sOf(e.agentId);
          if (s) {
            const t = am.get(s.key)!;
            if (t.phase === "done") t.phase = "rerunning";
            else t.phase = "running";
            t.runs += 1;
            t.legStartTs = ts;
          }
          break;
        }
        case "agent_done": {
          const s = sOf(e.agentId);
          if (s) {
            const t = am.get(s.key)!;
            if (t.phase !== "error") {
              t.phase = "done";
              t.doneTs = ts;
            }
          }
          break;
        }
        case "eval_start": {
          const s = sOf(e.agentId) || sCur;
          if (s) jm.set(s.key, "scoring");
          break;
        }
        case "evaluation": {
          const s = sOf(e.agentId) || sCur;
          if (s) jm.set(s.key, "passed");
          break;
        }
        case "eval_retry": {
          const s = sOf(e.agentId) || sCur;
          if (s) {
            jm.set(s.key, "return");
            const t = am.get(s.key)!;
            t.phase = "rerunning";
            t.retTs = ts;
            t.legStartTs = ts;
          }
          break;
        }
        case "tool_call":
        case "artifact":
        case "chunk": {
          const s = sOf(e.agentId) || sCur;
          if (s) {
            const t = am.get(s.key)!;
            if (e.type === "tool_call") {
              if (!t.tools.includes(e.tool)) t.tools.push(e.tool);
            } else if (e.type === "artifact") {
              if (!t.artifacts.includes(e.artifact)) t.artifacts.push(e.artifact);
            } else {
              const text = e.text.trim();
              if (text && t.chunks.length < 2) t.chunks.push(text.slice(0, 300));
            }
          }
          break;
        }
        case "error": {
          const s = sOf(e.agentId);
          if (s) am.get(s.key)!.phase = "error";
          break;
        }
        default:
          break;
      }
    }
    return { agent: am, judge: jm };
  }, [events]);

  const liveScoringCode = evaluating?.agentCode ?? null;

  // ---------------- geometry ----------------
  const PAD = 6;
  const RAIL_Y = 16; // rail y (engine wheels sit here)
  const GATE_Y = 48; // judge gate below the rail
  const RET_Y = 92; // dashed return rail
  const pxX = (f: number) => PAD * 0.01 * trackW + trackW * (1 - PAD * 0.02) * f;
  const toXPct = (f: number) => `${PAD + (100 - PAD * 2) * f}%`;
  const judgeX = (k: number) => pxX((k + 0.5) / N);

  // ---------------- engine position (in gap units) ----------------
  // u ∈ [0, N]: station k sits at u = k, the judge gate that inspects station k
  // sits at u = k + 0.5 (mid-gap before station k+1). Pixel x = pxX(u / N).
  const computeUnit = (): { u: number; returnK: number | null } => {
    const nowMs = now;
    let cur = 0; // resting position of the engine (last station / gate reached)

    for (let k = 0; k < STATIONS.length; k++) {
      const t = agent.get(STATIONS[k].key)!;
      const jp = judge.get(STATIONS[k].key) ?? "idle";
      const stationU = k;
      const gateU = k + 0.5; // judge gate after station k (none after the last)

      // Judge rejected this station: the ORANGE engine rolls back on the
      // dashed lower rail (gate → station) for RET_MS, then the agent re-runs.
      if (jp === "return") {
        const retAge = nowMs - (t.retTs || nowMs);
        if (retAge >= 0 && retAge < RET_MS) return { u: gateU, returnK: k };
        // Return animation finished → treat as a re-run leg below.
      }

      if (t.phase === "done" || t.phase === "error") {
        // Finished. Park at the gate while the judge inspects, else at station.
        cur = jp === "scoring" || jp === "passed" ? gateU : stationU;
        continue;
      }

      if (t.phase === "running" || t.phase === "rerunning") {
        const isRerun = t.phase === "rerunning";
        // Re-run legs depart from the station (the return rail already brought
        // the engine back); normal legs depart from wherever the engine rested
        // (the previous gate/station) so motion is continuous.
        const fromU = isRerun ? stationU : cur;
        const baseTs = isRerun && (t.legStartTs || 0) <= (t.retTs || 0) + RET_MS
          ? (t.retTs || nowMs) + RET_MS // re-run work hasn't started yet → hold
          : t.legStartTs || nowMs;
        const since = nowMs - baseTs;
        const span = gateU - fromU; // units to travel
        const dur = Math.max(1, span) * SEG_MS;
        const f = span > 0 ? Math.min(1, Math.max(0, since / dur)) : 1;
        return { u: fromU + span * f, returnK: null };
      }

      // Not started yet — hold at the last resting point (or the start).
      return { u: cur, returnK: null };
    }
    return { u: N, returnK: null };
  };

  const view = useMemo(() => {
    const { u, returnK } = computeUnit();
    return { u, returnK };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent, judge, running, now, trackW]);

  const xHead = pxX(Math.min(1, Math.max(0, view.u / N)));
  const activeK = Math.min(N, Math.round(view.u));

  const dotFor = (s: (typeof STATIONS)[number], t: AgentState, k: number) => {
    if (t.phase === "done")
      return { cls: "bg-emerald-500 border-emerald-500 text-white", icon: <CheckCircle2 size={11} /> };
    if (t.phase === "error")
      return { cls: "bg-red-500 border-red-500 text-white", icon: <XCircle size={11} /> };
    if (t.phase === "running" || t.phase === "rerunning")
      return { cls: "bg-amber-400 border-amber-400 text-white ring-4 ring-amber-400/30", icon: <span className="text-[8px] font-bold">{s.code}</span> };
    const isTarget = running && activeK === k;
    if (isTarget)
      return { cls: "bg-amber-400 border-amber-400 text-white ring-4 ring-amber-400/30", icon: <span className="text-[8px] font-bold">{s.code}</span> };
    return { cls: "bg-red-400/70 border-red-400 text-white", icon: <span className="text-[8px] font-bold">{s.code}</span> };
  };

  const doneCount = [...agent.values()].filter((a) => a.phase === "done").length;
  const allDone = doneCount === STATIONS.length;
  const returningStation = view.returnK !== null ? STATIONS[view.returnK] : null;
  const rolling = running && view.returnK === null;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="font-semibold text-text-primary">Agent pipeline</h3>
        {running && returningStation && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            Judge sent {returningStation.code} back — returning
          </span>
        )}
        {running && !returningStation && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            {STATIONS[Math.min(activeK, N)] ? `Train → ${STATIONS[Math.min(activeK, N)].code}` : "Train moving…"}
          </span>
        )}
        {!running && doneCount > 0 && (
          <span className="ml-auto text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
            <CheckCircle2 size={13} /> {doneCount}/{STATIONS.length} stations reached
          </span>
        )}
      </div>

      <style>{`
        @keyframes retRoll { from { left: var(--r0, 0px); } to { left: var(--r1, 0px); } }
        @keyframes spinWheel { to { transform: rotate(360deg); } }
        @keyframes puff { 0%,100% { opacity: 0.15; transform: translateY(0); } 50% { opacity: 0.7; transform: translateY(-3px); } }
      `}</style>

      {/* ==================== THE JOURNEY ==================== */}
      <div ref={trackRef} className="relative mt-4 overflow-hidden select-none" style={{ height: 116, minWidth: 640 }}>
        {/* Main straight rail */}
        <div className="absolute h-[3px] rounded-full bg-border" style={{ top: RAIL_Y - 1.5, left: `${PAD}%`, right: `${PAD}%` }} />
        {/* Progress highlight */}
        <div
          className="absolute h-[3px] rounded-full bg-amber-400/60 transition-all duration-200 ease-linear"
          style={{ top: RAIL_Y - 1.5, left: `${PAD}%`, width: `calc((100% - ${PAD * 2}%) * ${Math.min(1, view.u / N)})` }}
        />

        {/* Judge gates below the rail + stub line */}
        {STATIONS.slice(0, -1).map((s, k) => {
          const jp = judge.get(s.key) ?? "idle";
          const ev = evaluations[s.stageKey];
          const isLiveScoring = liveScoringCode === s.code;
          const isScoring = jp === "scoring" || isLiveScoring;
          const isPassed = jp === "passed" || !!ev;
          const isReturn = jp === "return";
          const xM = judgeX(k);
          const lineActive = isScoring || isPassed || isReturn;
          return (
            <div key={`judge-${s.key}`} className="absolute inset-x-0" style={{ top: 0, height: 116 }}>
              {/* stub: rail down to the gate */}
              <svg className="absolute overflow-visible" width={trackW} height={116} style={{ left: 0 }}>
                <path
                  d={`M ${xM} ${RAIL_Y + 2} L ${xM} ${GATE_Y - 5}`}
                  stroke={lineActive ? (isReturn ? "#f97316" : "#10b981") : "#d6d3d1"}
                  strokeOpacity={lineActive ? 0.8 : 0.4}
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                />
              </svg>
              {/* gate marker */}
              <div
                className={cn(
                  "absolute z-10 flex items-center justify-center rounded-md border-2 transition-all duration-300",
                  isReturn
                    ? "w-[14px] h-[14px] bg-orange-500 border-orange-500 text-white"
                    : isScoring
                      ? "w-[14px] h-[14px] bg-emerald-500 border-emerald-500 text-white ring-4 ring-emerald-500/25"
                      : isPassed
                        ? "w-[12px] h-[12px] bg-emerald-500/15 border-emerald-500/70 text-emerald-600"
                        : "w-[12px] h-[12px] bg-bg-surface border-border text-text-muted"
                )}
                style={{ left: xM - 7, top: GATE_Y - 7 }}
                title={`AI judge — inspects ${s.label} output`}
              >
                {isScoring ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                ) : isReturn ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                ) : isPassed ? (
                  <CheckCircle2 size={9} />
                ) : null}
              </div>
              {(isScoring || isReturn) && (
                <div className="absolute text-center pointer-events-none" style={{ left: xM - 22, top: GATE_Y + 3, width: 44 }}>
                  <span className={cn("text-[8px] font-bold uppercase tracking-wide", isReturn ? "text-orange-600" : "text-emerald-700")}>
                    {isReturn ? "↺ back" : "judge…"}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {/* Dashed return rail + orange engine returning */}
        {running && view.returnK !== null && (() => {
          const k = view.returnK!;
          const t = agent.get(STATIONS[k].key)!;
          const age = now - (t.retTs || now);
          if (age < 0 || age >= RET_MS) return null;
          const xFrom = judgeX(k);
          const xTo = pxX(k / N);
          return (
            <>
              <div className="absolute h-0 border-t-2 border-dashed border-orange-400/70" style={{ top: RET_Y, left: `${PAD}%`, width: `calc(100% - ${PAD * 2}%)` }} />
              <div
                className="absolute z-20"
                style={{ top: RET_Y - 13, left: 0, ["--r0" as string]: `${xFrom}px`, ["--r1" as string]: `${xTo}px`, animation: `retRoll ${RET_MS}ms ease-in-out forwards` }}
              >
                <div className="relative h-[20px] w-[34px]">
                  <div className="absolute bottom-[6px] left-0 h-[11px] w-[26px] rounded-[5px] bg-orange-500" />
                  <div className="absolute bottom-[13px] left-[14px] h-[8px] w-[14px] rounded-t-[4px] bg-orange-500" />
                  {[5, 19].map((wx) => (
                    <span key={wx} className="absolute bottom-0 flex h-[7px] w-[7px] items-center justify-center rounded-full bg-[#5b2d00]" style={{ left: wx, animation: "spinWheel 0.5s linear infinite" }}>
                      <span className="h-[2px] w-[2px] rounded-full bg-orange-300" />
                    </span>
                  ))}
                </div>
              </div>
            </>
          );
        })()}

        {/* Main amber engine rolling on the rail */}
        {rolling && (
          <div className="absolute z-20 transition-all duration-200 ease-linear" style={{ left: xHead - 25, top: RAIL_Y - 13 }}>
            <div className="relative h-[26px] w-[50px] origin-bottom scale-[0.72]">
              {/* smoke puff */}
              <span className="absolute -top-[11px] left-[24px] h-[6px] w-[6px] rounded-full bg-stone-400/80" style={{ animation: "puff 1.1s ease-in-out infinite" }} />
              {/* chimney */}
              <div className="absolute bottom-[19px] left-[24px] h-[6px] w-[7px] rounded-t-[2px] bg-stone-700" />
              {/* cab */}
              <div className="absolute bottom-[7px] left-0 h-[15px] w-[18px] rounded-bl-[6px] bg-amber-500" />
              <div className="absolute bottom-[13px] left-[3px] h-[8px] w-[8px] rounded-sm bg-amber-100/80" />
              {/* boiler */}
              <div className="absolute bottom-[7px] left-[16px] h-[15px] w-[32px] rounded-tr-[8px] bg-amber-500" />
              <div className="absolute bottom-[10px] left-[19px] h-[9px] w-[26px] rounded-[3px] bg-amber-400/60" />
              {/* front light */}
              <div className="absolute bottom-[10px] right-[2px] h-[4px] w-[4px] rounded-full bg-yellow-200" />
              {/* wheels */}
              {[6, 20, 35].map((wx) => (
                <span key={wx} className="absolute bottom-0 flex h-[9px] w-[9px] items-center justify-center rounded-full bg-[#5b2d00] ring-1 ring-amber-900/40" style={{ left: wx, animation: "spinWheel 0.5s linear infinite" }}>
                  <span className="h-[2.5px] w-[2.5px] rounded-full bg-amber-200" />
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Station dots (codes below each dot) */}
        {STATIONS.map((s, k) => {
          const t = agent.get(s.key)!;
          const isOpen = expanded === s.key;
          const d = dotFor(s, t, k);
          const left = toXPct(stF(k));
          return (
            <div key={s.key} className="absolute flex flex-col items-center" style={{ left, top: 0, transform: "translateX(-50%)" }}>
              <button
                onClick={() => setExpanded(isOpen ? null : s.key)}
                className="group relative flex flex-col items-center"
                style={{ marginTop: RAIL_Y - 9 }}
                title={
                  t.phase === "done"
                    ? `${s.code} completed — click to view output`
                    : t.phase === "running" || t.phase === "rerunning"
                      ? `${s.code} working — click to view live output`
                      : t.phase === "error"
                        ? `${s.code} failed — click to view`
                        : `${s.code} — click to preview`
                }
              >
                <span className={cn("z-[5] flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 transition-all", d.cls)}>{d.icon}</span>
                <span className={cn("mt-1 text-center text-[9px] font-bold tracking-wide", t.phase === "done" || t.phase === "running" || t.phase === "rerunning" ? "text-text-secondary" : "text-text-muted")}>
                  {s.code}
                </span>
                {isOpen && <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-amber-500" />}
              </button>
            </div>
          );
        })}
      </div>

      {/* ==================== Expanded agent output ==================== */}
      {expanded && (
        <div className="mt-3 rounded-xl border border-border bg-bg-page p-4">
          {(() => {
            const s = STATIONS.find((x) => x.key === expanded)!;
            const a = agent.get(s.key)!;
            const ev = evaluations[s.stageKey];
            return (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/10 text-amber-700">{s.icon}</span>
                  <h4 className="text-sm font-semibold text-text-primary">
                    {s.code} · {s.label}
                  </h4>
                  <ChevronDown size={14} className="ml-auto text-text-muted rotate-180" />
                </div>
                <p className="text-xs text-text-secondary">
                  {a.phase === "done" && "Completed."}
                  {a.phase === "running" && "Working…"}
                  {a.phase === "rerunning" && `Re-running after judge feedback (run ${a.runs})…`}
                  {a.phase === "error" && "Failed."}
                  {a.phase === "pending" && "Not started yet."}
                  {a.tools.length > 0 && ` Tools: ${a.tools.join(", ")}.`}
                  {a.artifacts.length > 0 && ` Artifacts: ${a.artifacts.join(", ")}.`}
                </p>
                {a.chunks.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto space-y-1.5">
                    {a.chunks.map((c, i) => (
                      <p key={i} className="text-[11px] text-text-muted whitespace-pre-wrap bg-bg-page/60 rounded-md p-1.5 border border-border/60">
                        {c}
                      </p>
                    ))}
                  </div>
                )}
                {ev && (
                  <p className="mt-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-2.5 py-1.5 text-[11px] text-text-secondary">
                    <span className="font-bold text-emerald-700">AI Evaluation:</span> precision {ev.precision}% ·
                    accuracy {ev.accuracy}%{ev.overall ? ` — ${ev.overall}` : ""}
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {!running && doneCount === 0 && events.length === 0 && (
        <p className="mt-3 text-xs text-text-muted">Run the pipeline — the train leaves RI and the AI judge inspects each station on the way.</p>
      )}
      {!running && allDone && (
        <p className="mt-2 text-xs font-semibold text-emerald-700">All stations reached — release ready. ✓</p>
      )}
    </Card>
  );
}
