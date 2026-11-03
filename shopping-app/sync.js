// Family-wide storage: every change is saved on this phone at once and, when a
// Firebase Realtime Database is set below, also sent to the family's shared copy.
// All phones listen to that copy and update the moment someone changes something.
//
// window.storage.get(key, shared) / set(key, value, shared) keep the same shape the
// app used inside Claude.ai. Keys with shared=false (like the name) stay on this phone.

import { sha256 } from "./auth.js";
import { localKey, currentFamily, isRetiredKey, xorHex } from "./families.js";

// The address of the family's Firebase Realtime Database, for example
// "https://drayman-shopping-default-rtdb.europe-west1.firebasedatabase.app".
// Empty: the list is saved on this phone only (still kept until deleted).
export const FIREBASE_DB_URL = "https://drayman-super-shopping-default-rtdb.europe-west1.firebasedatabase.app";

// Kept per family on the phone (the Drayman family's names are unchanged).
const SYNC_KEY = () => localKey("drayman-sync-key");
const PENDING_KEY = () => localKey("drayman-sync-pending");
const DEVICE_KEY = "drayman-device-id";
const LAST_CHANGE = "_lastChange";
const MEMBER_NAME_KEY = "family-shopping-list-member-name";

const ls = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch {} },
  del(k) { try { window.localStorage.removeItem(k); } catch {} },
};
// The same, for the signed-in family's own keys.
const fs = {
  get: (k) => ls.get(localKey(k)),
  set: (k, v) => ls.set(localKey(k), v),
};

const deviceId = (() => {
  let id = ls.get(DEVICE_KEY);
  if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); ls.set(DEVICE_KEY, id); }
  return id;
})();

const readPending = (pk = PENDING_KEY()) => { try { return JSON.parse(ls.get(pk) || "{}"); } catch { return {}; } };
const writePending = (p, pk = PENDING_KEY()) => (Object.keys(p).length ? ls.set(pk, JSON.stringify(p)) : ls.del(pk));

let familyPath = null; // families/<secret> once signed in
// The family the connection belongs to (its key prefix on the phone). When the phone
// switches to another family, nothing from the old connection is written or sent,
// so one family's list can never land in another's.
let connPrefix = null;
const sameFamily = () => connPrefix === localKey("");
let source = null;
let status = FIREBASE_DB_URL ? "connecting" : "local";
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

// What this phone last knew the family copy held, per key. A change is merged
// against it, so two phones changing the list at the same moment both keep
// their change (before, the later one replaced the whole list and the other was lost).
const BASE_KEY = () => localKey("drayman-sync-base");
const readBase = (bk = BASE_KEY()) => { try { return JSON.parse(ls.get(bk) || "{}"); } catch { return {}; } };
const setBase = (key, value, bk = BASE_KEY()) => {
  const b = readBase(bk);
  if (b[key] === value) return;
  b[key] = value;
  ls.set(bk, JSON.stringify(b));
};
// The server's version tag for each key and the value it belongs to, so a write goes
// through only if nobody else wrote in between (otherwise the server returns its copy to merge with).
const etags = {};
// After a change arrives from another phone, the new tag is fetched in the background,
// so this phone's next tap is sent in one go.
async function refreshTag(url, key) {
  try {
    const res = await fetch(`${url}/${encodeURIComponent(key)}.json`, { headers: { "X-Firebase-ETag": "true" } });
    const tag = res.headers.get("ETag");
    if (!res.ok || !tag) return;
    const v = await res.json();
    etags[url + key] = { tag, value: v === null ? null : typeof v === "string" ? v : JSON.stringify(v) };
  } catch {}
}

// Merges this phone's change (base -> local) into what the server has now.
//  - lists of things with an id (the shopping list, saved lists, own products):
//    added, removed and changed entries are carried over one by one;
//  - lists of names (removed products): added and removed names;
//  - tables (notes, renamed products): changed and removed entries.
// Anything else: this phone's value, as before.
const sameJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const hasIds = (arr) => arr.every((x) => isObj(x) && x.id !== undefined);
function merge3(baseStr, localStr, serverStr) {
  if (serverStr === null || serverStr === undefined || serverStr === baseStr) return localStr;
  if (localStr === baseStr) return serverStr;
  const base = parse(baseStr), local = parse(localStr), server = parse(serverStr);
  if (Array.isArray(local) && Array.isArray(server)) {
    const b = Array.isArray(base) ? base : server;
    if (hasIds(local) && hasIds(server) && hasIds(b)) return JSON.stringify(mergeById(b, local, server));
    if ([...local, ...server, ...b].every((x) => typeof x === "string")) {
      const removed = b.filter((x) => !local.includes(x));
      const out = server.filter((x) => !removed.includes(x));
      for (const x of local) if (!b.includes(x) && !out.includes(x)) out.push(x);
      return JSON.stringify(out);
    }
    return localStr;
  }
  if (isObj(local) && isObj(server)) {
    const b = isObj(base) ? base : server;
    const out = { ...server };
    for (const k of Object.keys(b)) if (!(k in local)) delete out[k];
    for (const [k, v] of Object.entries(local)) if (!sameJSON(v, b[k])) out[k] = v;
    return JSON.stringify(out);
  }
  return localStr;
}
function mergeById(base, local, server) {
  const baseById = new Map(base.map((x) => [x.id, x]));
  const localIds = new Set(local.map((x) => x.id));
  // Removed on this phone.
  let out = server.filter((x) => !(baseById.has(x.id) && !localIds.has(x.id)));
  // Changed on this phone (and still there on the server).
  out = out.map((x) => {
    const mine = local.find((l) => l.id === x.id);
    return mine && baseById.has(x.id) && !sameJSON(mine, baseById.get(x.id)) ? mine : x;
  });
  // Added on this phone, in this phone's order, at the top as the app adds them.
  const added = [];
  for (const it of local) {
    if (baseById.has(it.id) || out.some((x) => x.id === it.id)) continue;
    // The same product added on both phones at once is kept once.
    const twin = typeof it.name === "string" && "done" in it
      ? out.find((x) => typeof x.name === "string" && x.name.trim() === it.name.trim() && !!x.done === !!it.done && !baseById.has(x.id))
      : null;
    if (twin) continue;
    added.push(it);
  }
  return [...added, ...out];
}

// Writes one key only if the server still has what this phone merged with.
// Returns the value now on the server.
async function putKey(url, key, value, base, keepalive) {
  let local = value;
  let server = base;
  for (let tries = 0; tries < 6; tries++) {
    const known = etags[url + key];
    const res = await fetch(`${url}/${encodeURIComponent(key)}.json`, {
      method: "PUT",
      keepalive,
      headers: { "Content-Type": "application/json", "X-Firebase-ETag": "true", "if-match": known && known.value === server ? known.tag : "unknown" },
      body: JSON.stringify(local),
    });
    const tag = res.headers.get("ETag");
    if (res.ok) {
      if (tag) etags[url + key] = { tag, value: local };
      return local;
    }
    if (res.status !== 412) throw new Error("HTTP " + res.status);
    // Someone else wrote in between (or the tag isn't known): merge with their copy.
    const got = await res.json();
    server = got === null ? null : typeof got === "string" ? got : JSON.stringify(got);
    if (tag) etags[url + key] = { tag, value: server };
    local = merge3(base, value, server);
    if (server !== null && local === server) return local;
  }
  throw new Error("busy");
}

// Sends every change not yet confirmed by the server. Each key goes on its own,
// so a tap on the list is never held up by another key still on its way.
// leaving: the app is being closed or hidden (the browser finishes the requests after the page is gone).
const inFlight = new Set();
function flush(leaving = false) {
  if (!familyPath || !sameFamily()) return;
  // Kept for this send, in case the manager switches family while it is on its way.
  const pk = PENDING_KEY();
  const bk = BASE_KEY();
  const url = baseUrl();
  const prefix = localKey("");
  const pending = readPending(pk);
  // A value the family copy already holds needs no sending (and must not tell the other
  // phones that this phone changed something).
  const known = readBase(bk);
  let dropped = false;
  for (const k of Object.keys(pending)) {
    if (!inFlight.has(url + k) && k in known && known[k] === pending[k]) { delete pending[k]; dropped = true; }
  }
  if (dropped) writePending(pending, pk);
  const keys = Object.keys(pending).filter((k) => !inFlight.has(url + k));
  if (!keys.length) return;
  const name = fs.get(MEMBER_NAME_KEY) || "";
  // Who changed it is sent first, so other phones can say "updated by ..." when the change lands.
  fetch(`${url}/${LAST_CHANGE}.json`, {
    method: "PUT",
    keepalive: leaving,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device: deviceId, name, at: Date.now() }),
  }).catch(() => {});
  for (const k of keys) {
    const sent = pending[k];
    inFlight.add(url + k);
    const base = readBase(bk);
    putKey(url, k, sent, k in base ? base[k] : undefined, leaving).then((onServer) => {
      inFlight.delete(url + k);
      // Drop only what was sent; anything changed meanwhile stays queued.
      const now = readPending(pk);
      if (now[k] === sent) {
        delete now[k];
        writePending(now, pk);
        setBase(k, onServer, bk);
        // Merged with another phone's change: show the joined list here too.
        if (onServer !== sent && localKey("") === prefix) {
          ls.set(prefix + k, onServer);
          notify([k], null);
        }
      } else {
        // Changed again while sending: the next send merges the newer change on top.
        setBase(k, sent, bk);
        setTimeout(flush, 0);
      }
    }, () => {
      inFlight.delete(url + k);
      clearTimeout(retryTimer);
      retryTimer = setTimeout(flush, 5000);
    });
  }
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
    setBase(k, str);
    if (fs.get(k) !== str) { fs.set(k, str); changed.push(k); }
    const known = familyPath && etags[baseUrl() + k];
    if (familyPath && (!known || known.value !== str)) refreshTag(baseUrl(), k);
  }
  notify(changed, by);
}

// The first time a phone joins the family copy, what it chose before is added to
// the family's list instead of being replaced by it, so no earlier choice is lost.
const MERGED_KEY = "drayman-sync-merged";
const parse = (v) => { try { return JSON.parse(v); } catch { return null; } };
const num = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; };
const MERGERS = {
  "family-shopping-list-items": (server, local) => {
    const out = server.map((it) => ({ ...it }));
    for (const it of local) {
      const same = out.find((x) => x.name.trim() === it.name.trim() && !!x.done === !!it.done);
      if (!same) out.push(it);
      else {
        same.qty = String(Math.max(num(same.qty), num(it.qty)) || same.qty);
        if (it.kg || same.kg) same.kg = Math.max(same.kg || 0, it.kg || 0);
      }
    }
    return out;
  },
  "family-shopping-list-custom-products": (server, local) =>
    [...server, ...local.filter((p) => !server.some((x) => x.name.trim() === p.name.trim()))],
  "family-shopping-list-saved-lists": (server, local) =>
    [...server, ...local.filter((l) => !server.some((x) => x.id === l.id))],
  "family-shopping-list-hidden-products": (server, local) => [...new Set([...server, ...local])],
  "family-shopping-list-note-overrides": (server, local) => ({ ...local, ...server }),
  "family-shopping-list-name-overrides": (server, local) => ({ ...local, ...server }),
};

function mergeOnce(entries, pending) {
  const done = parse(ls.get(MERGED_KEY)) || {};
  if (done[familyPath]) return;
  for (const [key, merge] of Object.entries(MERGERS)) {
    if (key in pending) continue;
    const server = parse(entries[key]);
    const local = parse(fs.get(key));
    if (!server || !local || entries[key] === fs.get(key)) continue;
    if (Array.isArray(server) !== Array.isArray(local)) continue;
    const merged = JSON.stringify(merge(server, local));
    if (merged !== entries[key]) { fs.set(key, merged); pending[key] = merged; }
  }
  done[familyPath] = Date.now();
  ls.set(MERGED_KEY, JSON.stringify(done));
}

function connect() {
  if (source) source.close();
  setStatus("connecting");
  // Firebase streams the data first in full, then every change (Server-Sent Events).
  source = new EventSource(`${baseUrl()}.json`);
  const es = source;
  const onData = (kind) => (e) => {
    if (!sameFamily()) { es.close(); return; }
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
          if (!(k in entries) && fs.get(k) !== null && !(k in pending)) pending[k] = fs.get(k);
        }
        mergeOnce(entries, pending);
        writePending(pending);
        // Merged keys are now pending, so applyRemote leaves them; tell the app to reload them.
        notify(Object.keys(pending), null);
      }
      applyRemote(entries, by);
    } else {
      const key = path.replace(/^\//, "").split("/")[0];
      if (key === LAST_CHANGE) {
        // Another phone is about to change something: name it, as the app shows "updated by ...".
        const last = path === `/${LAST_CHANGE}` ? data : null;
        if (last && last.device && last.device !== deviceId) {
          window.dispatchEvent(new CustomEvent("family-sync", { detail: { keys: [], by: last } }));
        }
        return;
      }
      applyRemote({ [key]: data }, null);
    }
    flush();
  };
  source.addEventListener("put", onData("put"));
  source.addEventListener("patch", onData("patch"));
  source.onerror = () => setStatus(navigator.onLine === false ? "offline" : "connecting");
}

// Keys the app has used as shared, so a first phone can seed the family copy.
// Only the signed-in family's keys are looked at, so one family's list never
// reaches another family's copy, even on a phone both have used.
const sharedKeys = {};
const familyKeyOf = (stored) => {
  const prefix = localKey("");
  if (!stored || !stored.startsWith(prefix)) return null;
  const k = stored.slice(prefix.length);
  return k.startsWith("family-shopping-list-") && k !== MEMBER_NAME_KEY ? k : null;
};
const localSharedKeys = () => {
  const keys = new Set(Object.keys(sharedKeys));
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = familyKeyOf(window.localStorage.key(i));
      if (k) keys.add(k);
    }
  } catch {}
  return [...keys];
};

// Called after a correct password or face login. The family's place in the
// database is derived from the password, so only someone who knows it can reach it.
export function startSync(password) {
  if (password) ls.set(SYNC_KEY(), sha256("drayman-family-sync|" + password.trim()));
  if (!FIREBASE_DB_URL || typeof EventSource === "undefined") { setStatus("local"); return; }
  const key = ls.get(SYNC_KEY());
  if (!key) { setStatus("local"); return; }
  // A key from the family's cancelled password is never used.
  if (isRetiredKey(currentFamily(), key)) { setStatus("local"); return; }
  if (password && currentFamily().migrateFrom && !fs.get("drayman-sync-moved")) {
    const fam = currentFamily();
    moveFamilyData(fam, key, password).then(() => {
      if (localKey("") === fam.keyPrefix) startSync();
    });
    return;
  }
  const path = `families/${key}`;
  if (path === familyPath && source && source.readyState !== 2) return;
  familyPath = path;
  connPrefix = localKey("");
  connect();
}

// The manager opens a family by its server key (see adminFamilyKey).
export function startSyncWithKey(key) {
  if (key) ls.set(SYNC_KEY(), key);
  startSync();
}

// After a family's password changes: copies its lists from the old password's place
// on the server to the new one (keys the new place lacks), then empties
// the old place so the old password reaches nothing. Runs once per phone.
async function moveFamilyData(fam, newKey, password) {
  const base = FIREBASE_DB_URL.replace(/\/+$/, "");
  try {
    const oldKey = xorHex(fam.migrateFrom.masked, sha256(`migrate|${fam.id}|${password.trim()}`));
    if (sha256(oldKey) !== fam.migrateFrom.keyHash) return;
    const now = await fetch(`${base}/families/${newKey}.json`).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
    const old = await fetch(`${base}/families/${oldKey}.json`).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
    if (old && typeof old === "object" && Object.keys(old).length) {
      // Only what the new place doesn't have yet, so nothing newer is replaced.
      const have = now && typeof now === "object" ? now : {};
      const missing = {};
      for (const [k, v] of Object.entries(old)) if (!(k in have)) missing[k] = v;
      if (Object.keys(missing).length) {
        const res = await fetch(`${base}/families/${newKey}.json`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(missing),
        });
        if (!res.ok) throw new Error("copy " + res.status);
      }
      const del = await fetch(`${base}/families/${oldKey}.json`, { method: "DELETE" });
      if (!del.ok) throw new Error("delete " + del.status);
    }
    ls.set(fam.keyPrefix + "drayman-sync-moved", String(Date.now()));
  } catch (e) {
    // Not now (no internet?): the list on this phone is still sent to the new place,
    // and the move is tried again at the next sign-in.
  }
}

// The family's password changed and this phone still has the old one.
export const needsNewPassword = () => isRetiredKey(currentFamily(), ls.get(SYNC_KEY()));

export const hasSyncKey = () => !!ls.get(SYNC_KEY());

// Everything is already on the phone; this pushes what the family copy hasn't got yet.
export const flushNow = () => flush(true);

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { if (familyPath && sameFamily()) { connect(); flush(); } });
  window.addEventListener("offline", () => { if (familyPath) setStatus("offline"); });
  // Another tab on the same phone changed something.
  window.addEventListener("storage", (e) => { const k = familyKeyOf(e.key); if (k) notify([k], null); });

  // The app always keeps its data this way, also inside Claude.ai, so each
  // family's data stays apart and the login never waits on another store.
  {
    const store = {
      async get(key, shared) {
        if (shared) sharedKeys[key] = true;
        const value = fs.get(key);
        if (value === null) throw new Error("not found: " + key);
        return { key, value };
      },
      async set(key, value, shared) {
        const same = fs.get(key) === value;
        fs.set(key, value);
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
    try {
      Object.defineProperty(window, "storage", { value: store, writable: true, configurable: true });
    } catch {
      try { window.storage = store; } catch {}
    }
  }
}
