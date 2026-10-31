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
    passwordHash: "1b65c85c905923777c0084ae775bfd5c6eef4fa3f0193d6964870a6e930a78cb",
    sendPasswordHash: "1b65c85c905923777c0084ae775bfd5c6eef4fa3f0193d6964870a6e930a78cb",
    name: "משפחת אשל",
    members: ["טלי", "דני", "שי", "שני", "שחר"],
    namePlaceholder: "למשל: טלי",
    keyPrefix: "eshel/",
    passkeyKey: "eshel/passkey-id",
    passkeyDeclinedKey: "eshel/passkey-declined",
    // Until the Eshel family's own details are given, nothing of the Drayman
    // family's appears: no recipient is filled in, and the header is the family name.
    order: {
      email: "",
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

export function setFamily(id) {
  if (!FAMILIES[id]) return;
  activeId = id;
  ls.set(ACTIVE_KEY, id);
}

// Which family a typed password opens, or null.
export function familyForPassword(password) {
  const h = sha256(String(password || "").trim());
  return Object.values(FAMILIES).find((f) => f.passwordHash === h) || null;
}

// The name under which a key of the current family is kept on this phone.
export const localKey = (key) => currentFamily().keyPrefix + key;

// The password asked before an order is sent, per family.
export const isSendPassword = (value) => sha256(String(value || "").trim()) === currentFamily().sendPasswordHash;
