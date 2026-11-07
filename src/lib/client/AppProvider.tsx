"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { api } from "./api";
import type { ChatItem, MarketSnapshot, QueueItem, ShowLine, ShowStatus, StreamEvent, TierName } from "../shared/types";

export type CharacterInfo = {
  id: string; name: string; tagline: string; rig: string; accent: string | null;
  face: string | null; room: string | null; clips: { idle: string; talking: string } | null;
  voice: { pitch: number; rate: number; gender: "male" | "female" | null };
};

// Best-sounding built-in voices first. All free, all on the viewer's device.
const VOICE_PREFS = {
  male: ["Aaron", "Daniel", "Evan", "Nathan", "Google UK English Male", "Microsoft Guy", "Microsoft David", "Alex", "Fred"],
  female: ["Samantha", "Ava", "Allison", "Susan", "Karen", "Moira", "Google US English", "Microsoft Aria", "Microsoft Zira"],
};

function pickVoice(gender: "male" | "female" | null) {
  if (!gender) return null;
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  for (const name of VOICE_PREFS[gender]) {
    const v = voices.find((x) => x.name.startsWith(name));
    if (v) return v;
  }
  return null;
}
export type Me = {
  user: { id: string; username: string; role: string; status: string; avatarSeed: string; bio: string; hideWallet: boolean; hideFromLeaderboard: boolean; createdAt: string } | null;
  wallets?: any[]; balance?: number; tier?: TierName; rank?: number | null; mock: boolean; mintConfigured: boolean; transferProofAvailable: boolean;
};

type Ctx = {
  me: Me | null; refreshMe: () => Promise<void>;
  authOpen: boolean; openAuth: () => void; closeAuth: () => void;
  characters: CharacterInfo[]; market: MarketSnapshot | null;
  line: ShowLine | null; transcript: ShowLine[]; status: ShowStatus; viewers: number; queue: QueueItem[]; chat: ChatItem[];
  connected: boolean; soundOn: boolean; setSoundOn: (v: boolean) => void;
};

const AppContext = createContext<Ctx | null>(null);
export const useApp = () => useContext(AppContext)!;

function speak(line: ShowLine, characters: CharacterInfo[], audioRef: React.MutableRefObject<HTMLAudioElement | null>) {
  if (line.audioUrl) {
    const audio = new Audio(line.audioUrl);
    audioRef.current = audio;
    audio.currentTime = Math.max(0, (Date.now() - line.startedAt) / 1000);
    audio.play().catch(() => {});
    return;
  }
  if (typeof speechSynthesis === "undefined") return;
  const c = characters.find((x) => x.id === line.characterId);
  const u = new SpeechSynthesisUtterance(line.text);
  const voice = pickVoice(c?.voice.gender ?? null);
  if (voice) u.voice = voice;
  u.pitch = c?.voice.pitch ?? 1;
  u.rate = c?.voice.rate ?? 1;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [characters, setCharacters] = useState<CharacterInfo[]>([]);
  const [market, setMarket] = useState<MarketSnapshot | null>(null);
  const [line, setLine] = useState<ShowLine | null>(null);
  const [transcript, setTranscript] = useState<ShowLine[]>([]);
  const [status, setStatus] = useState<ShowStatus>({ live: false, mode: "off", viewers: 0 });
  const [viewers, setViewers] = useState(0);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [chat, setChat] = useState<ChatItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [soundOn, setSoundState] = useState(false);
  const soundRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const charactersRef = useRef<CharacterInfo[]>([]);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshMe = useCallback(async () => {
    try { setMe(await api<Me>("/api/auth/me")); } catch { /* the stale value stays on screen */ }
  }, []);

  const setSoundOn = useCallback((v: boolean) => {
    soundRef.current = v;
    setSoundState(v);
    if (!v) { audioRef.current?.pause(); if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); }
  }, []);

  useEffect(() => {
    void refreshMe();
    // The cast is the page, so a failed load keeps retrying rather than leaving an empty stage.
    let castRetry: ReturnType<typeof setTimeout>;
    const loadCast = () => api<{ characters: CharacterInfo[] }>("/api/characters")
      .then((r) => { charactersRef.current = r.characters; setCharacters(r.characters); })
      .catch(() => { castRetry = setTimeout(loadCast, 5000); });
    void loadCast();
    api<{ messages: ChatItem[]; lines: ShowLine[] }>("/api/chat").then((r) => {
      // Anything that arrived on the live stream while this loaded is kept.
      setChat((live) => [...r.messages, ...live.filter((m) => !r.messages.some((h) => h.id === m.id))]);
      setTranscript((live) => [...r.lines, ...live.filter((l) => !r.lines.some((h) => h.id === l.id))]);
    }).catch(() => {});
    const loadMarket = () => api<{ market: MarketSnapshot }>("/api/market").then((r) => setMarket(r.market)).catch(() => {});
    void loadMarket();
    const marketTimer = setInterval(loadMarket, 30000);

    const es = new EventSource("/api/stream");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (ev) => {
      const e = JSON.parse(ev.data) as StreamEvent | { type: "ping" };
      if (e.type === "line") {
        setLine(e.line);
        setTranscript((t) => (t.some((x) => x.id === e.line.id) ? t : [...t.slice(-59), e.line]));
        if (soundRef.current) speak(e.line, charactersRef.current, audioRef);
        if (endTimer.current) clearTimeout(endTimer.current);
        const remaining = e.line.durationMs - (Date.now() - e.line.startedAt);
        endTimer.current = setTimeout(() => setLine(null), Math.max(0, remaining) + 350);
      } else if (e.type === "status") setStatus(e.status);
      else if (e.type === "presence") setViewers(e.viewers);
      else if (e.type === "queue") setQueue(e.queue);
      else if (e.type === "chat") setChat((c) => [...c.slice(-99), e.message]);
      else if (e.type === "chat_removed") setChat((c) => c.filter((m) => m.id !== e.id));
    };
    return () => { es.close(); clearInterval(marketTimer); clearTimeout(castRetry); if (endTimer.current) clearTimeout(endTimer.current); };
  }, [refreshMe]);

  const value = useMemo<Ctx>(() => ({
    me, refreshMe, authOpen, openAuth: () => setAuthOpen(true), closeAuth: () => setAuthOpen(false),
    characters, market, line, transcript, status, viewers, queue, chat, connected, soundOn, setSoundOn,
  }), [me, refreshMe, authOpen, characters, market, line, transcript, status, viewers, queue, chat, connected, soundOn, setSoundOn]);

  return (
    <ConnectionProvider endpoint="https://api.mainnet-beta.solana.com">
      {/* Empty adapter list: Phantom, Solflare and other Wallet Standard wallets register themselves. */}
      <WalletProvider wallets={[]} autoConnect={false}>
        <AppContext.Provider value={value}>{children}</AppContext.Provider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
