"use client";
import { useApp } from "@/lib/client/AppProvider";
import { ChatPanel } from "./Panels";
import { LiveStream } from "./stream/LiveStream";

/** The stream beside the one chat everybody shares. Everything the cast says comes from this chat. */
export function LiveRoom() {
  const { status, viewers } = useApp();
  return (
    <div className="grid gap-3 lg:h-[min(calc(100svh-12rem),820px)] lg:grid-cols-[minmax(0,1fr)_400px]">
      <LiveStream className="aspect-[4/3] w-full rounded-3xl border border-white/10 shadow-[0_30px_80px_-30px_rgba(255,61,139,.45)] sm:aspect-video lg:aspect-auto lg:h-full" />
      <aside className="glass glass-strong flex h-[560px] flex-col overflow-hidden rounded-3xl lg:h-full">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span className={`h-2 w-2 rounded-full ${status.live ? "on-air-dot bg-danger" : "bg-mist"}`} />
          <h2 className="text-sm font-black uppercase tracking-widest">Live chat</h2>
          <span className="numeric ml-auto text-xs text-frost">{viewers} here</span>
        </div>
        <ChatPanel className="min-h-0 flex-1" />
      </aside>
    </div>
  );
}
