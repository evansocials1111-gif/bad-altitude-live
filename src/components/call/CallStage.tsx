"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useApp, type CharacterInfo } from "@/lib/client/AppProvider";
import type { ShowLine } from "@/lib/shared/types";
import { useTypewriter } from "../Stage";
import { PEOPLE } from "./People";

/** A small tile of random noise, made once, that the grain overlay scrolls over. */
function useGrain() {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 160;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    setUrl(c.toDataURL());
  }, []);
  return url;
}

function Caption({ line }: { line: ShowLine }) {
  const text = useTypewriter(line);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-x-3 bottom-12 z-20 flex justify-center sm:bottom-14">
      <p className="max-w-[34rem] rounded-lg bg-black/70 px-3 py-1.5 text-center text-sm font-semibold leading-snug text-white sm:text-[15px]">{text}</p>
    </motion.div>
  );
}

/** Real footage when the operator has added clips; otherwise the drawn face. */
function Feed({ c, line, listening, toward }: { c: CharacterInfo; line: ShowLine | null; listening: boolean; toward: number }) {
  const idle = useRef<HTMLVideoElement>(null);
  const talk = useRef<HTMLVideoElement>(null);
  const speaking = !!line;
  useEffect(() => {
    const v = speaking ? talk.current : idle.current;
    v?.play().catch(() => {});
  }, [speaking]);
  if (c.clips) {
    return (
      <>
        <video ref={idle} src={c.clips.idle} muted loop playsInline autoPlay className={`absolute inset-0 h-full w-full object-cover ${speaking ? "opacity-0" : "opacity-100"}`} />
        <video ref={talk} src={c.clips.talking} muted loop playsInline className={`absolute inset-0 h-full w-full object-cover ${speaking ? "opacity-100" : "opacity-0"}`} />
      </>
    );
  }
  const Person = PEOPLE[c.face ?? c.id];
  if (!Person) return <div className="absolute inset-0 flex items-center justify-center bg-ink text-4xl font-black text-frost">{c.name[0]}</div>;
  return <Person line={line} emotion={line?.emotion ?? "neutral"} toward={toward} listening={listening} className="absolute inset-0 h-full w-full [filter:blur(.35px)_contrast(1.04)_saturate(.94)]" />;
}

function Tile({ c, index, onAsk, grain }: { c: CharacterInfo; index: number; onAsk?: (id: string) => void; grain: string | null }) {
  const { line } = useApp();
  const speaking = line?.characterId === c.id;
  const listening = !!line && !speaking;
  // Marlene holds her phone. Everyone else has a laptop on a desk.
  const handheld = c.id === "marlene";
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!handheld) return;
    const id = setInterval(() => setT(performance.now() / 1000), 50);
    return () => clearInterval(id);
  }, [handheld]);
  const wobble = handheld ? `translate(${Math.sin(t * 0.9) * 3}px, ${Math.sin(t * 1.3) * 2.5}px) rotate(${Math.sin(t * 0.7) * 0.8}deg) scale(1.06)` : undefined;

  return (
    <button
      type="button" onClick={() => onAsk?.(c.id)} disabled={!onAsk} aria-label={onAsk ? `Ask ${c.name}` : c.name}
      className={`group relative min-h-0 overflow-hidden rounded-2xl bg-black text-left outline-none ring-offset-2 ring-offset-black transition-shadow duration-300 ${speaking ? "ring-[3px] ring-[#34c759]" : "ring-0"} ${onAsk ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className="absolute inset-0" style={{ transform: wobble }}>
        <Feed c={c} line={speaking ? line : null} listening={listening} toward={index === 0 ? 1 : -1} />
      </div>
      {grain && <div className="cam-grain pointer-events-none absolute inset-0 z-10 opacity-[.13]" style={{ backgroundImage: `url(${grain})` }} />}
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,.45))]" />

      {speaking && line?.question && (
        <div className="absolute inset-x-3 top-3 z-20 flex">
          <p className="line-clamp-2 max-w-full rounded-xl bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur">
            <strong className="text-[#5ef0d0]">@{line.addressedTo}</strong> <span className="text-white/85">{line.question}</span>
          </p>
        </div>
      )}
      <AnimatePresence>{speaking && line && <Caption key={line.id} line={line} />}</AnimatePresence>

      <div className="absolute bottom-2.5 left-2.5 z-20 flex items-center gap-2 rounded-full bg-black/55 py-1 pl-2.5 pr-3 text-xs text-white backdrop-blur sm:bottom-3 sm:left-3">
        <span className={`h-2 w-2 rounded-full ${speaking ? "bg-[#34c759]" : "bg-white/40"}`} />
        <strong>{c.name}</strong>
        {c.room && <span className="hidden text-white/60 md:inline">· {c.room}</span>}
      </div>
      {onAsk && <span className="absolute bottom-3 right-3 z-20 hidden rounded-full bg-ember px-2.5 py-1 text-[11px] font-extrabold text-black opacity-0 transition group-hover:opacity-100 sm:block">Ask {c.name.split(" ")[0]}</span>}
    </button>
  );
}

function useCallTimer() {
  const [s, setS] = useState(0);
  useEffect(() => {
    const start = Date.now() - (37 * 60 + 12) * 1000;
    const id = setInterval(() => setS(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** The show as a two-way video call: one tile per caller, live captions, the speaker outlined. */
export function CallStage({ className = "", onAsk }: { className?: string; onAsk?: (characterId: string) => void }) {
  const { characters, status, viewers, soundOn, setSoundOn, connected, me } = useApp();
  const grain = useGrain();
  const timer = useCallTimer();
  const cast = characters.slice(0, 2);

  return (
    <div className={`relative flex flex-col overflow-hidden bg-[#0b0b0d] ${className}`}>
      <div className="z-30 flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-white sm:text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-danger px-2 py-0.5 tracking-wide">
          <span className={`h-1.5 w-1.5 rounded-full bg-white ${status.live ? "on-air-dot" : ""}`} />{status.live ? "LIVE" : "OFF AIR"}
        </span>
        <span className="numeric text-white/70">{timer}</span>
        <span className="numeric text-white/70">· {viewers} watching</span>
        {!connected && <span className="text-[#ffb35c]">· reconnecting</span>}
        <span className="ml-auto rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/70" title="Both callers are AI-generated characters">AI characters</span>
      </div>

      <div className={`grid min-h-0 flex-1 gap-1.5 px-1.5 ${cast.length > 1 ? "grid-rows-2 sm:grid-cols-2 sm:grid-rows-1" : ""}`}>
        {cast.map((c, i) => <Tile key={c.id} c={c} index={i} onAsk={onAsk} grain={grain} />)}
        {!cast.length && <div className="flex items-center justify-center text-sm text-white/60">Connecting the call…</div>}
      </div>

      <div className="z-30 flex items-center justify-center gap-2 px-3 py-2">
        <button type="button" onClick={() => setSoundOn(!soundOn)} aria-pressed={soundOn} className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${soundOn ? "bg-white/15 text-white" : "bg-white text-black"}`}>
          {soundOn ? "🔊 Sound on" : "🔇 Tap for sound"}
        </button>
        <span className="hidden rounded-full bg-white/10 px-3 py-2 text-xs text-white/70 sm:inline">
          {me?.user ? <>You&apos;re watching as <strong className="text-white">{me.user.username}</strong></> : "Type in the chat to talk to them"}
        </span>
      </div>
    </div>
  );
}
