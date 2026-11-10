// History of SENT shopping lists. Every time the list is sent (WhatsApp or mail)
// from this phone, the list as it was sent is kept here, so it can be seen or
// brought back. Kept per family, on this phone, never sent anywhere.
// Older versions of the app saved every change; those unsent versions are removed.

import { localKey } from "./families.js";

const KEY = () => localKey("drayman-list-history");
const MAX_ENTRIES = 300;
const MAX_CHARS = 1500000; // about 1.5 MB, well inside the phone's storage
const MAX_AGE_MS = 40 * 24 * 3600e3; // sent lists older than 40 days are deleted

const sig = (items) => JSON.stringify(items || []);

function write(list) {
  let text = JSON.stringify(list);
  while (text.length > MAX_CHARS && list.length > 1) {
    list.shift();
    text = JSON.stringify(list);
  }
  try {
    window.localStorage.setItem(KEY(), text);
  } catch {
    // Storage full: keep the newer half and try once more.
    try {
      window.localStorage.setItem(KEY(), JSON.stringify(list.slice(Math.floor(list.length / 2))));
    } catch {}
  }
}

// Only sent lists from the last 40 days. Older ones, and any unsent version left
// from an older app version, are deleted.
export function readHistory() {
  let list;
  try {
    list = JSON.parse(window.localStorage.getItem(KEY()) || "[]");
  } catch {
    list = [];
  }
  if (!Array.isArray(list)) list = [];
  const since = Date.now() - MAX_AGE_MS;
  const sent = list.filter((e) => e && e.sent && Array.isArray(e.items) && e.at >= since);
  if (sent.length !== list.length) write(sent);
  return sent;
}

// Keeps the list that was just sent. via: "whatsapp" or "mail".
export function recordSent(items, by, via) {
  if (!Array.isArray(items) || !items.some((it) => !it.done)) return;
  const list = readHistory();
  const last = list[list.length - 1];
  // The same list sent again within 2 minutes (a double tap) is kept once.
  if (last && sig(last.items) === sig(items) && last.via === via && Date.now() - last.at < 120000) return;
  list.push({ at: Date.now(), by: by || "", items, sent: true, via });
  while (list.length > MAX_ENTRIES) list.shift();
  write(list);
}
