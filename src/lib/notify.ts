// ──────────────────────────────────────────────────────────────
// shop-891 — Notification creation (persist + real-time push)
//
// Every notification in the app goes through `createNotification`:
// it writes the document to MongoDB (the durable feed the bell
// reads on load) and then fire-and-forget POSTs the serialized DTO
// to the notify mini-service, which broadcasts it over socket.io
// to the user's room so the bell badge updates instantly — no page
// refresh needed. The push never blocks or fails the request: if
// the mini-service is down, the DB write still succeeded and the
// feed simply catches up on the next fetch.
// ──────────────────────────────────────────────────────────────
import { Notification } from "@/lib/db";

const NOTIFY_EMIT_URL =
  process.env.NOTIFY_EMIT_URL || "http://127.0.0.1:3005/emit";
const NOTIFY_INTERNAL_KEY =
  process.env.NOTIFY_INTERNAL_KEY || "shopverse-notify-internal";

export type NotificationInput = {
  user: unknown; // ObjectId | string | populated { _id } user doc
  kind: string;
  title: string;
  body: string;
  amount?: number | null;
  orderNumber?: string | null;
  read?: boolean;
};

/** Best-effort string form of a user reference (id, ObjectId or doc). */
function userIdOf(user: unknown): string {
  if (!user) return "";
  if (typeof user === "string") return user;
  if (typeof user === "object") {
    const u = user as { _id?: unknown; toHexString?: () => string };
    if (typeof u.toHexString === "function") return u.toHexString();
    if (u._id !== undefined && u._id !== null) {
      return typeof u._id === "string" ? u._id : String(u._id);
    }
  }
  return String(user);
}

export async function createNotification(input: NotificationInput) {
  const doc = await Notification.create(input);

  // Real-time push (fire-and-forget — never blocks the response)
  const payload = {
    id: String(doc._id),
    kind: doc.kind,
    title: doc.title,
    body: doc.body,
    amount: doc.amount ?? null,
    orderNumber: doc.orderNumber ?? null,
    read: Boolean(doc.read),
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
  };
  fetch(NOTIFY_EMIT_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-notify-key": NOTIFY_INTERNAL_KEY,
    },
    body: JSON.stringify({ userId: userIdOf(input.user), notification: payload }),
    signal: AbortSignal.timeout(2500),
  }).catch(() => undefined);

  return doc;
}
