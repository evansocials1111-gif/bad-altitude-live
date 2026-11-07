import { EventEmitter } from "node:events";
import type { ShowLine, ShowStatus, StreamEvent } from "../../shared/types";

const store = globalThis as unknown as {
  __bus?: EventEmitter;
  __show?: { viewers: number; lastLine: ShowLine | null; status: ShowStatus };
};

const bus = (store.__bus ??= (() => { const e = new EventEmitter(); e.setMaxListeners(0); return e; })());
export const showState = (store.__show ??= { viewers: 0, lastLine: null, status: { live: false, mode: "off", viewers: 0 } });

export function emit(event: StreamEvent) {
  bus.emit("event", event);
}

export function subscribe(fn: (e: StreamEvent) => void) {
  bus.on("event", fn);
  return () => { bus.off("event", fn); };
}

export function setViewers(delta: number) {
  showState.viewers = Math.max(0, showState.viewers + delta);
  emit({ type: "presence", viewers: showState.viewers });
}
