"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/client/AppProvider";
import type { ShowLine } from "@/lib/shared/types";
import { Rig } from "./rigs/Rig";
import { TownScene } from "./TownScene";

// Position and size of each character on stage, left to right. Height is a share of stage height.
const LAYOUT: Record<string, { left: number; h: number; z: number }> = {
  mort: { left: 13, h: 46, z: 4 },
  dale: { left: 36, h: 76, z: 2 },
  ronda: { left: 60, h: 72, z: 3 },
  yolanda: { left: 84, h: 62, z: 4 },
};

export function useTypewriter(line: ShowLine | null) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!line) { setCount(0); return; }
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - line.startedAt) / (line.durationMs * 0.92));
      setCount(Math.ceil(p * line.text.length));
    }, 40);
    return () => clearInterval(id);
  }, [line]);
  return line ? line.text.slice(0, count) : "";
}

function Bubble({ line, compact }: { line: ShowLine; compact: boolean }) {
  const text = useTypewriter(line);
  const pos = LAYOUT[line.characterId]?.left ?? 50;
  return (
    <motion.div
      key={line.id}
      initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      // Follows the speaker, but stays fully inside the stage.
      style={{ left: compact ? "50%" : `clamp(15.5rem, ${pos}%, calc(100% - 15.5rem))` }}
      className={`glass glass-strong absolute z-40 w-[min(92%,30rem)] -translate-x-1/2 rounded-2xl px-4 py-3 top-3 sm:top-5`}
    >
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
        <strong className="text-ember-soft">{line.characterName}</strong>
        {line.addressedTo && <span className="text-frost">to @{line.addressedTo}</span>}
        {line.llmProvider === "mock" && <span className="rounded bg-violet/25 px-1.5 text-[10px] font-bold text-frost">MOCK DIALOGUE</span>}
        {line.llmProvider === "rerun" && <span className="rounded bg-white/10 px-1.5 text-[10px] font-bold text-frost">RERUN</span>}
      </div>
      {line.question && <p className="mb-1.5 line-clamp-2 border-l-2 border-ember/60 pl-2 text-xs italic text-frost">&ldquo;{line.question}&rdquo;</p>}
      <p className="min-h-[3.2em] text-[15px] font-semibold leading-snug sm:text-base">{text}</p>
    </motion.div>
  );
}

const STATUS_COPY: Record<string, string> = {
  off: "Off air", idle: "On air · idle", banter: "On air · cast talking", answering: "On air · answering a holder",
  paused_no_viewers: "On air", budget_exhausted: "On air · reruns",
};

export function CharacterChip({ state }: { state: "speaking" | "answering" | "banter" | "idle" }) {
  const map = { speaking: ["Speaking", "#ff7a1a"], answering: ["Answering", "#5ef0d0"], banter: ["Talking", "#b49bff"], idle: ["Idle", "#6f7c94"] } as const;
  const [label, color] = map[state];
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide backdrop-blur sm:px-2 sm:text-[10px]" style={{ color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{label}
    </span>
  );
}

export function Stage({ className = "", showControls = true, onAsk }: { className?: string; showControls?: boolean; onAsk?: (characterId: string) => void }) {
  const { characters, line, status, viewers, soundOn, setSoundOn, connected } = useApp();
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const on = () => setCompact(window.innerWidth < 640);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const speakerId = line?.characterId;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <TownScene glow={line ? 1 : 0} />
      <div className="absolute inset-0 z-20">
        {characters.map((c) => {
          const pos = LAYOUT[c.id] ?? { left: 50, h: 60, z: 2 };
          const isSpeaker = speakerId === c.id;
          const look = speakerId && !isSpeaker ? ((LAYOUT[speakerId]?.left ?? 50) > pos.left ? 2.5 : -2.5) : 0;
          const chip = isSpeaker ? (line?.kind === "answer" ? "answering" : "speaking") : status.mode === "banter" ? "banter" : "idle";
          return (
            <motion.button
              key={c.id} type="button" onClick={() => onAsk?.(c.id)} disabled={!onAsk}
              animate={{ scale: isSpeaker ? 1.06 : 1, y: isSpeaker ? -4 : 0, filter: speakerId && !isSpeaker ? "brightness(.8)" : "brightness(1)" }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              style={{ left: `${pos.left}%`, height: `${pos.h * (compact ? 0.68 : 1)}%`, zIndex: pos.z, transformOrigin: "bottom center" }}
              className={`group absolute bottom-[17%] sm:bottom-[12%] -translate-x-1/2 ${onAsk ? "cursor-pointer" : "cursor-default"}`}
              aria-label={onAsk ? `Ask ${c.name}` : c.name}
            >
              <Rig rig={c.rig} line={isSpeaker ? line : null} look={look} className="h-full w-auto overflow-visible drop-shadow-[0_18px_18px_rgba(0,0,0,.45)]" />
              <span className="absolute -bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 whitespace-nowrap">
                {(!compact || isSpeaker) && <CharacterChip state={chip} />}
              </span>
              {onAsk && <span className="absolute left-1/2 top-[-6%] hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-ember px-2 py-0.5 text-[11px] font-extrabold text-black opacity-0 transition group-hover:opacity-100 sm:block">Ask {c.name.split(" ")[0]}</span>}
            </motion.button>
          );
        })}
      </div>
      <AnimatePresence>{line && <Bubble key={line.id} line={line} compact={compact} />}</AnimatePresence>
      {showControls && (
        <div className={`absolute left-2 z-40 flex items-center gap-1.5 sm:left-4 sm:gap-2 bottom-2 sm:bottom-3`}>
          <span className="glass inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-bold sm:gap-2 sm:px-3 sm:text-xs">
            <span className={`h-2 w-2 rounded-full ${status.live ? "on-air-dot bg-danger" : "bg-mist"}`} />
            {connected ? STATUS_COPY[status.mode] ?? "On air" : "Reconnecting"}
            <span className="numeric text-frost">· {viewers} online</span>
          </span>
          <button type="button" onClick={() => setSoundOn(!soundOn)} className="btn btn-glass px-2.5 py-1.5 text-[11px] sm:px-3 sm:text-xs" aria-pressed={soundOn}>
            {soundOn ? "Sound on" : compact ? "Sound" : "Turn on sound"}
          </button>
        </div>
      )}
    </div>
  );
}
