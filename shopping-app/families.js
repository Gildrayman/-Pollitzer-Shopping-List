// The families that use the app. Each family has its own password, and the
// password decides which family's lists open. Families never see each other's
// data: on the server each family has its own place (derived from its password),
// and on a phone each family's copy is kept under its own names.

import { sha256 } from "./auth.js";

export const FAMILIES = {
  // The original family. Its keys on the phone have no prefix, exactly as before,
  // so nothing changes for phones that already use the app.
  drayman: {
    id: "drayman",
    passwordHash: "4d3c81d0207371f8835c36ac47b14d3a7582a537acc3095b0ec88e8aa74dfd2e",
    sendPasswordHash: "4d3c81d0207371f8835c36ac47b14d3a7582a537acc3095b0ec88e8aa74dfd2e",
    name: "משפחת דריימן",
    mailEnabled: true,
    members: [],
    namePlaceholder: "למשל: גיל",
    keyPrefix: "",
    passkeyKey: "drayman-passkey-id",
    passkeyDeclinedKey: "drayman-passkey-declined",
    order: {
      email: "karkur@politzer.co.il",
      header: ["גיל דריימן", "המגדל 11 כרכור", "052-4350444"],
      subject: "גיל דריימן - 052-4350444",
    },
  },
  eshel: {
    id: "eshel",
    // Password changed 2.11.2026; the old one no longer opens anything.
    passwordHash: "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92",
    sendPasswordHash: "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92",
    // The family's lists moved from the old password's place on the server to the
    // new one. The old place is locked with the new password, so only someone who
    // knows the new password can move the data; after the move it is emptied.
    migrateFrom: {
      masked: "072ef927a8f21e8e091bb7da1cbb6976189b0c92fe1eafe4dd9eb91de8f7d4b1",
      keyHash: "c3f54e7d4b624b4096ca77ecc43ccaa946f70045bfc0482599487f51d841cf72",
    },
    name: "משפחת אשל",
    members: ["טלי", "דני", "שי", "שני", "שחר"],
    namePlaceholder: "למשל: טלי",
    keyPrefix: "eshel/",
    passkeyKey: "eshel/passkey-id",
    passkeyDeclinedKey: "eshel/passkey-declined",
    // Orders go to the same store as before. Nothing of the Drayman family appears:
    // the header is the family name plus the family's own email, typed once and kept.
    mailEnabled: true,
    order: {
      email: "karkur@politzer.co.il",
      header: ["משפחת אשל"],
      subject: "משפחת אשל",
      // The family's own address gets a hidden copy (bcc) of each order.
      // It is asked once, on the first send, and kept for the whole family.
      askCopyEmail: true,
    },
  },
};

const ACTIVE_KEY = "shopping-active-family";

const ls = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch {} },
};

// The family this phone last signed in to. Phones that used the app before
// families existed belong to the Drayman family.
function initialFamily() {
  const saved = ls.get(ACTIVE_KEY);
  if (saved && FAMILIES[saved]) return saved;
  if (ls.get("drayman-sync-key") || ls.get("family-shopping-list-member-name") || ls.get("drayman-passkey-id")) return "drayman";
  return null;
}

let activeId = initialFamily();

// null on a brand-new phone, until someone types a password.
export const rememberedFamily = () => (activeId ? FAMILIES[activeId] : null);
export const currentFamily = () => FAMILIES[activeId || "drayman"];

// remember=false: the manager visits a family without changing which family
// this phone opens next time (so Face ID and the saved family stay as they were).
export function setFamily(id, remember = true) {
  if (!FAMILIES[id]) return;
  activeId = id;
  if (remember) ls.set(ACTIVE_KEY, id);
}

// Back to the family this phone normally opens (after a manager visit).
export function restoreFamily() {
  activeId = initialFamily();
}

// Which family a typed password opens, or null.
export function familyForPassword(password) {
  const h = sha256(String(password || "").trim());
  return Object.values(FAMILIES).find((f) => f.passwordHash === h) || null;
}

// The name under which a key of the current family is kept on this phone.
export const localKey = (key) => currentFamily().keyPrefix + key;

// The manager's password (Gil). It opens a screen to choose any family.
// Only its hash is here, never the password itself.
const ADMIN_HASH = "905c33403195a095fefcbcecea55df203f89c042148afbf4892e0c1a9650f457";
export const isAdminPassword = (value) => sha256(String(value || "").trim()) === ADMIN_HASH;

// Each family's place on the server, locked with the manager's password, so the
// manager can open a family without knowing its password. A family missing here
// is opened with its own password once on each device, then remembered.
const ADMIN_LOCKED_KEYS = {
  eshel: "1edacfe382b6e1ab8c31acf049f37820b5cd984ea01c1d2f11ac89ced5dd7e69",
};
export const xorHex = (a, b) => [...a].map((c, i) => (parseInt(c, 16) ^ parseInt(b[i], 16)).toString(16)).join("");

// A server key that belonged to a family's old, cancelled password.
export const isRetiredKey = (f, key) => !!(f && f.migrateFrom && key && sha256(key) === f.migrateFrom.keyHash);

// The server key of a family for the manager, or null if this device doesn't know it yet.
export function adminFamilyKey(id, adminPassword) {
  const f = FAMILIES[id];
  if (!f) return null;
  const known = ls.get(f.keyPrefix + "drayman-sync-key");
  if (known && !isRetiredKey(f, known)) return known;
  const locked = ADMIN_LOCKED_KEYS[id];
  if (!locked) return null;
  return xorHex(locked, sha256(`admin-key|${id}|${String(adminPassword || "").trim()}`));
}

// The password asked before an order is sent, per family. The manager's password works everywhere.
export const isSendPassword = (value) => {
  const h = sha256(String(value || "").trim());
  return h === currentFamily().sendPasswordHash || h === ADMIN_HASH;
};
