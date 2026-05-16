/**
 * Browser mock for @tauri-apps/api/event
 * Used when running `pnpm dev` outside of Tauri webview.
 */

type UnlistenFn = () => void;
type EventCallback = (event: { payload: unknown }) => void;

const listeners: Record<string, EventCallback[]> = {};

export async function emit(event: string, payload?: unknown): Promise<void> {
  const cbs = listeners[event];
  if (cbs) {
    for (const cb of cbs) {
      cb({ payload });
    }
  }
}

export async function listen(event: string, handler: EventCallback): Promise<UnlistenFn> {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(handler);
  return () => {
    const idx = listeners[event]?.indexOf(handler);
    if (idx !== undefined && idx >= 0) {
      listeners[event].splice(idx, 1);
    }
  };
}
