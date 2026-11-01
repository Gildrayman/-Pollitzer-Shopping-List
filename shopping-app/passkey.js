// Face ID / fingerprint login (WebAuthn passkey on this phone).
// The phone checks the face or finger itself; the app only learns that it succeeded.
// It is turned on after a correct password, so the phone already belongs to the family.

import { currentFamily } from "./families.js";

// Each family keeps its own Face ID on the phone (the Drayman family's names are unchanged).
const CRED_KEY = () => currentFamily().passkeyKey;
const DECLINED_KEY = () => currentFamily().passkeyDeclinedKey;

const ls = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch {} },
  del(k) { try { window.localStorage.removeItem(k); } catch {} },
};

const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// True when this phone has Face ID / fingerprint that a web page may use.
export async function faceLoginSupported() {
  try {
    if (!window.isSecureContext || !window.PublicKeyCredential) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export const hasFaceLogin = () => !!ls.get(CRED_KEY());
export const faceLoginDeclined = () => !!ls.get(DECLINED_KEY());
export const declineFaceLogin = () => ls.set(DECLINED_KEY(), "1");
export const undeclineFaceLogin = () => ls.del(DECLINED_KEY());
export const removeFaceLogin = () => ls.del(CRED_KEY());

// The manager's own Face ID on this phone, separate from the family's.
const ADMIN_CRED_KEY = "admin/passkey-id";
export const hasAdminFace = () => !!ls.get(ADMIN_CRED_KEY);

// Must run from a tap. Asks the phone for Face ID / fingerprint once and remembers it.
export async function registerFaceLogin(name, credKey = CRED_KEY()) {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: credKey === ADMIN_CRED_KEY ? "קניות: מנהל" : `קניות ${currentFamily().name}` },
      user: { id: randomBytes(16), name: name || "family", displayName: name || currentFamily().name },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
      timeout: 60000,
      attestation: "none",
    },
  });
  if (!cred) throw new Error("no credential");
  ls.set(credKey, toB64(cred.rawId));
  if (credKey !== ADMIN_CRED_KEY) ls.del(DECLINED_KEY());
}
export const registerAdminFace = () => registerFaceLogin("מנהל", ADMIN_CRED_KEY);

// Must run from a tap. Resolves true only when the phone confirmed the face or finger.
// keys: which saved Face IDs may answer (the family's by default).
export async function faceLogin(keys = [CRED_KEY()]) {
  const ids = keys.map((k) => ls.get(k)).filter(Boolean);
  if (!ids.length) return false;
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: ids.map((id) => ({ type: "public-key", id: fromB64(id), transports: ["internal", "hybrid"] })),
      userVerification: "required",
      timeout: 60000,
    },
  });
  if (!assertion) return false;
  // Byte 32 of authenticatorData holds the flags; 0x04 = the user was verified (face/finger/PIN).
  const flags = new Uint8Array(assertion.response.authenticatorData)[32];
  return (flags & 0x04) !== 0;
}

export const adminFaceLogin = () => faceLogin([ADMIN_CRED_KEY]);
// Sending an order: the family's Face ID, or the manager's on the manager's phone.
export const hasSendFace = () => hasFaceLogin() || hasAdminFace();
export const sendFaceLogin = () => faceLogin([CRED_KEY(), ADMIN_CRED_KEY]);
