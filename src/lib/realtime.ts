"use client";
// ──────────────────────────────────────────────────────────────
// shop-891 — Real-time notification transport (singleton socket)
//
// One socket.io connection to the notify mini-service per browser
// tab, shared by every subscriber (the bell, the orders view…).
// The `sv_token` cookie rides along on the handshake, so the
// service knows which user's room this socket belongs to — no
// client-side identity to spoof. The socket is created lazily on
// the first subscriber and torn down when the last one leaves
// (e.g. on sign-out), so a fresh login always performs a fresh
// handshake with the current cookie.
// ──────────────────────────────────────────────────────────────
import { io, type Socket } from "socket.io-client";
import type { AppNotificationDTO } from "@/lib/types";

const NOTIFY_SOCKET_PORT = 3006;

let socket: Socket | null = null;
const listeners = new Set<(n: AppNotificationDTO) => void>();

function ensureSocket(): Socket {
  if (socket) return socket;
  // Never put the port in the URL — the gateway routes on the
  // XTransformPort query param, and the path must stay "/".
  socket = io(`/?XTransformPort=${NOTIFY_SOCKET_PORT}`, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });
  socket.on("notification", (n: AppNotificationDTO) => {
    for (const cb of listeners) {
      try {
        cb(n);
      } catch {
        /* a broken listener must not break the others */
      }
    }
  });
  return socket;
}

/**
 * Subscribe to live notification pushes. The returned function
 * unsubscribes; when the last listener unsubscribes the socket is
 * disconnected (it reconnects lazily on the next subscribe).
 */
export function subscribeToNotifications(
  cb: (n: AppNotificationDTO) => void
): () => void {
  listeners.add(cb);
  ensureSocket();
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) disconnectRealtime();
  };
}

/** Tear the socket down (used on sign-out / last unsubscribe). */
export function disconnectRealtime() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}
