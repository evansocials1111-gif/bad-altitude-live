"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { useApp } from "@/lib/client/AppProvider";
import type { ShowLine } from "@/lib/shared/types";
import { useTypewriter } from "../Stage";
import { CouchScene } from "./Couch";

// Name-tag color per person, so captions read at a glance.
const TAG: Record<string, string> = { tanner: "bg-acid text-black", jade: "bg-ember text-black" };

type Clips = { idle: string[]; talking: Record<string, { any: string[]; plain: string[]; byEmotion: Record<string, string[]> }> } | null;

const pick = (list: string[], not?: string | null) => {
  const pool = list.length > 1 ? list.filter((x) => x !== not) : list;
  return pool[Math.floor(Math.random() * pool.length)];
};

/**
 * Filmed footage, when it exists. Two stacked players: the next clip loads in the hidden one and
 * swaps in once it can play, so cuts never flash black. Talking clips match the line's mood when a
 * take for it exists; idle takes rotate so the loop doesn't give itself away.
 */
function Footage({ clips, line, onBroken }: { clips: NonNullable<Clips>; line: ShowLine | null; onBroken: () => void }) {
  const players = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)];
  const [front, setFront] = useState(0);
  const current = useRef<string | null>(null);
  const [want, setWant] = useState(() => pick(clips.idle));

  // Choose a clip when the speaker changes: their take for this mood, any take of theirs, or idle.
  useEffect(() => {
    if (!line) { setWant((w) => (clips.idle.includes(w) ? w : pick(clips.idle))); return; }
    const t = clips.talking[line.characterId];
    if (!t) return;
    setWant(pick(t.byEmotion[line.emotion]?.length ? t.byEmotion[line.emotion] : t.plain.length ? t.plain : t.any, current.current));
  }, [line?.id, clips]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (want === current.current) return;
    const back = players[1 - front].current;
    if (!back) return;
    back.src = want;
    back.currentTime = 0;
    const ready = () => {
      back.play().catch(() => {});
      current.current = want;
      setFront(1 - front);
    };
    back.addEventListener("canplay", ready, { once: true });
    // A clip that won't load (deleted, renamed, bad file) must never leave the stream black.
    back.addEventListener("error", onBroken, { once: true });
    back.load();
    return () => { back.removeEventListener("canplay", ready); back.removeEventListener("error", onBroken); };
  }, [want]); // eslint-disable-line react-hooks/exhaustive-deps

  // Several idle takes: move to another when one finishes. Otherwise everything loops.
  const ended = () => {
    if (!line && clips.idle.length > 1) setWant(pick(clips.idle, current.current));
    else players[front].current?.play().catch(() => {});
  };

  return (
    <>
      {players.map((ref, i) => (
        <video key={i} ref={ref} muted playsInline preload="auto" onEnded={i === front ? ended : undefined}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ${i === front ? "opacity-100" : "opacity-0"}`} />
      ))}
    </>
  );
}

function Caption({ line }: { line: ShowLine }) {
  const text = useTypewriter(line);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.18 }}
      className="absolute inset-x-3 bottom-14 z-20 flex justify-center sm:bottom-16">
      <p className="max-w-[44rem] rounded-xl bg-black/75 px-3.5 py-2 text-center text-sm font-semibold leading-snug text-white shadow-2xl backdrop-blur-sm sm:text-lg">
        <span className={`mr-2 rounded px-1.5 py-0.5 align-middle text-[10px] font-black uppercase tracking-wider sm:text-xs ${TAG[line.characterId] ?? "bg-white text-black"}`}>{line.characterName}</span>
        {text}
      </p>
    </motion.div>
  );
}

/** The chat message they're answering, popped on screen the way streamers do it. */
function Highlight({ line }: { line: ShowLine }) {
  return (
    <motion.div initial={{ opacity: 0, x: -24, rotate: -2 }} animate={{ opacity: 1, x: 0, rotate: -1 }} exit={{ opacity: 0, x: -16 }}
      className="absolute left-3 top-14 z-20 max-w-[min(80%,22rem)] rounded-2xl border-2 border-acid bg-black/80 px-3.5 py-2.5 shadow-[0_10px_40px_-10px_rgba(198,255,61,.6)] sm:left-5 sm:top-16">
      <p className="text-[10px] font-black uppercase tracking-widest text-acid">From chat</p>
      <p className="mt-0.5 text-sm text-white"><strong>@{line.addressedTo}</strong> <span className="text-white/85">{line.question}</span></p>
    </motion.div>
  );
}

function useGrain() {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 160;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    setUrl(c.toDataURL());
  }, []);
  return url;
}

export function LiveStream({ className = "" }: { className?: string }) {
  const { line, status, viewers, soundOn, setSoundOn, connected } = useApp();
  const [clips, setClips] = useState<Clips>(null);
  const grain = useGrain();
  // Ask again when a clip breaks, so footage added or removed while the page is open is picked up.
  const loadClips = () => api("/api/scene").then((r) => setClips(r.clips)).catch(() => setClips(null));
  useEffect(() => { void loadClips(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const live = line && Date.now() - line.startedAt < line.durationMs + 400 ? line : null;

  return (
    <div className={`relative overflow-hidden bg-black ${className}`}>
      {clips ? <Footage key={JSON.stringify(clips)} clips={clips} line={live} onBroken={() => { setClips(null); void loadClips(); }} /> : <CouchScene line={live} className="absolute inset-0 h-full w-full [filter:blur(.4px)_contrast(1.06)_saturate(1.05)]" />}
      {grain && <div className="cam-grain pointer-events-none absolute inset-0 z-10 opacity-[.12]" style={{ backgroundImage: `url(${grain})` }} />}
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,.55))]" />

      <div className="absolute inset-x-3 top-3 z-30 flex items-center gap-2 text-[11px] font-bold text-white sm:inset-x-5 sm:top-4 sm:text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-danger px-2 py-1 font-black tracking-widest">
          <span className={`h-1.5 w-1.5 rounded-full bg-white ${status.live ? "on-air-dot" : ""}`} />{status.live ? "LIVE" : "OFF AIR"}
        </span>
        <span className="numeric rounded-md bg-black/55 px-2 py-1 backdrop-blur">👁 {viewers}</span>
        {!connected && <span className="rounded-md bg-black/55 px-2 py-1 text-acid">reconnecting…</span>}
        <span className="ml-auto rounded-md bg-black/55 px-2 py-1 text-[10px] font-semibold text-white/75 backdrop-blur">AI characters · 18+</span>
      </div>

      <AnimatePresence>{live?.kind === "answer" && live.question && <Highlight key={`h-${live.id}`} line={live} />}</AnimatePresence>
      <AnimatePresence>{live && <Caption key={live.id} line={live} />}</AnimatePresence>

      <div className="absolute bottom-3 left-3 z-30 sm:bottom-4 sm:left-5">
        <button type="button" onClick={() => setSoundOn(!soundOn)} aria-pressed={soundOn}
          className={`rounded-full px-4 py-2 text-xs font-black transition ${soundOn ? "bg-black/55 text-white backdrop-blur hover:bg-black/70" : "animate-pulse bg-white text-black"}`}>
          {soundOn ? "🔊 Sound on" : "🔇 Tap for sound"}
        </button>
      </div>
    </div>
  );
}
