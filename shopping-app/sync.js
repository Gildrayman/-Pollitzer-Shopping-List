// Family-wide storage: every change is saved on this phone at once and, when a
// Firebase Realtime Database is set below, also sent to the family's shared copy.
// All phones listen to that copy and update the moment someone changes something.
//
// window.storage.get(key, shared) / set(key, value, shared) keep the same shape the
// app used inside Claude.ai. Keys with shared=false (like the name) stay on this phone.

import { sha256 } from "./auth.js";

// The address of the family's Firebase Realtime Database, for example
// "https://drayman-shopping-default-rtdb.europe-west1.firebasedatabase.app".
// Empty: the list is saved on this phone only (still kept until deleted).
export const FIREBASE_DB_URL = "https://drayman-super-shopping-default-rtdb.europe-west1.firebasedatabase.app";

const SYNC_KEY = "drayman-sync-key";
const PENDING_KEY = "drayman-sync-pending";
const DEVICE_KEY = "drayman-device-id";
const LAST_CHANGE = "_lastChange";
const MEMBER_NAME_KEY = "family-shopping-list-member-name";

const ls = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch {} },
  del(k) { try { window.localStorage.removeItem(k); } catch {} },
};

const deviceId = (() => {
  let id = ls.get(DEVICE_KEY);
  if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); ls.set(DEVICE_KEY, id); }
  return id;
})();

const readPending = () => { try { return JSON.parse(ls.get(PENDING_KEY) || "{}"); } catch { return {}; } };
const writePending = (p) => (Object.keys(p).length ? ls.set(PENDING_KEY, JSON.stringify(p)) : ls.del(PENDING_KEY));

let familyPath = null; // families/<secret> once signed in
let source = null;
let status = FIREBASE_DB_URL ? "connecting" : "local";
let flushing = false;
let retryTimer = null;

const setStatus = (s) => {
  if (s === status) return;
  status = s;
  window.dispatchEvent(new CustomEvent("family-sync-status", { detail: s }));
};
export const getSyncStatus = () => status;

// Tells the app which keys just arrived from another phone.
const notify = (keys, by) => {
  if (keys.length) window.dispatchEvent(new CustomEvent("family-sync", { detail: { keys, by } }));
};

const baseUrl = () => `${FIREBASE_DB_URL.replace(/\/+$/, "")}/${familyPath}`;

// Sends every change not yet confirmed by the server, in one request.
// leaving: the app is being closed or hidden; the request is sent even if
// another one is on its way, and the browser finishes it after the page is gone.
async function flush(leaving = false) {
  if (!familyPath || (flushing && !leaving)) return;
  const pending = readPending();
  const keys = Object.keys(pending);
  if (!keys.length) return;
  flushing = true;
  const name = ls.get(MEMBER_NAME_KEY) || "";
  try {
    const res = await fetch(`${baseUrl()}.json`, {
      method: "PATCH",
      keepalive: leaving,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...pending, [LAST_CHANGE]: { device: deviceId, name, at: Date.now() } }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    // Drop only what was sent; anything changed meanwhile stays queued.
    const now = readPending();
    for (const k of keys) if (now[k] === pending[k]) delete now[k];
    writePending(now);
  } catch (e) {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(flush, 5000);
    flushing = false;
    return;
  }
  flushing = false;
  if (Object.keys(readPending()).length) setTimeout(flush, 300);
}

// Applies data from the server to this phone. Keys with a change still on its
// way up keep the local value, so a tap is never undone by an older copy.
function applyRemote(entries, by) {
  const pending = readPending();
  const changed = [];
  for (const [k, v] of Object.entries(entries)) {
    if (k === LAST_CHANGE || k in pending) continue;
    if (v === null || v === undefined) continue;
    const str = typeof v === "string" ? v : JSON.stringify(v);
    if (ls.get(k) !== str) { ls.set(k, str); changed.push(k); }
  }
  notify(changed, by);
}

function connect() {
  if (source) source.close();
  setStatus("connecting");
  // Firebase streams the data first in full, then every change (Server-Sent Events).
  source = new EventSource(`${baseUrl()}.json`);
  const onData = (kind) => (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (!msg) return;
    setStatus("live");
    const path = msg.path || "/";
    const data = msg.data;
    if (path === "/") {
      const entries = data && typeof data === "object" ? data : {};
      const last = entries[LAST_CHANGE];
      const by = kind === "patch" && last && last.device !== deviceId ? last : null;
      if (kind === "put") {
        // First load: anything this phone has that the family copy lacks is sent up.
        const pending = readPending();
        for (const k of localSharedKeys()) {
          if (!(k in entries) && ls.get(k) !== null && !(k in pending)) pending[k] = ls.get(k);
        }
        writePending(pending);
      }
      applyRemote(entries, by);
    } else {
      const key = path.replace(/^\//, "").split("/")[0];
      if (key === LAST_CHANGE) return;
      applyRemote({ [key]: data }, null);
    }
    flush();
  };
  source.addEventListener("put", onData("put"));
  source.addEventListener("patch", onData("patch"));
  source.onerror = () => setStatus(navigator.onLine === false ? "offline" : "connecting");
}

// Keys the app has used as shared, so a first phone can seed the family copy.
const sharedKeys = {};
const localSharedKeys = () => {
  const keys = new Set(Object.keys(sharedKeys));
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("family-shopping-list-") && k !== MEMBER_NAME_KEY) keys.add(k);
    }
  } catch {}
  return [...keys];
};

// Called after a correct password or face login. The family's place in the
// database is derived from the password, so only someone who knows it can reach it.
export function startSync(password) {
  if (password) ls.set(SYNC_KEY, sha256("drayman-family-sync|" + password.trim()));
  if (!FIREBASE_DB_URL || typeof EventSource === "undefined") { setStatus("local"); return; }
  const key = ls.get(SYNC_KEY);
  if (!key) { setStatus("local"); return; }
  const path = `families/${key}`;
  if (path === familyPath && source && source.readyState !== 2) return;
  familyPath = path;
  connect();
}

export const hasSyncKey = () => !!ls.get(SYNC_KEY);

// Everything is already on the phone; this pushes what the family copy hasn't got yet.
export const flushNow = () => flush(true);

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { if (familyPath) { connect(); flush(); } });
  window.addEventListener("offline", () => { if (familyPath) setStatus("offline"); });
  // Another tab on the same phone changed something.
  window.addEventListener("storage", (e) => { if (e.key && e.key.startsWith("family-shopping-list-") && e.key !== MEMBER_NAME_KEY) notify([e.key], null); });

  // Replaces Claude.ai's storage outside Claude.ai (Claude.ai keeps its own).
  if (!window.storage) {
    window.storage = {
      async get(key, shared) {
        if (shared) sharedKeys[key] = true;
        const value = ls.get(key);
        if (value === null) throw new Error("not found: " + key);
        return { key, value };
      },
      async set(key, value, shared) {
        const same = ls.get(key) === value;
        ls.set(key, value);
        if (shared && !same) {
          sharedKeys[key] = true;
          const pending = readPending();
          pending[key] = value;
          writePending(pending);
          flush();
        }
        return { key, value };
      },
    };
  }
}
