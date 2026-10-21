import React, { useState, useEffect } from "react";
import { NAME_KEY, greetingForHour } from "./family-shopping-list.jsx";
import { speakHe } from "./speech.js";

// SHA-256 of the family password. Only the hash is kept in the code, so the
// password itself can't be read from the public repository.
const PASSWORD_HASH = "4d3c81d0207371f8835c36ac47b14d3a7582a537acc3095b0ec88e8aa74dfd2e";
// Leaving the app for longer than this locks it again. A short grace period
// keeps the file picker and the WhatsApp/email hand-off from locking it.
const AWAY_LOCK_MS = 60 * 1000;

// Plain-JS SHA-256, so the check also works where crypto.subtle is missing
// (for example when the file is opened straight from the phone).
function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const K = [];
  const H = [];
  const frac = (x) => ((x - Math.floor(x)) * 4294967296) | 0;
  for (let n = 2, found = 0; found < 64; n++) {
    let prime = true;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) { prime = false; break; }
    if (!prime) continue;
    if (found < 8) H.push(frac(Math.pow(n, 1 / 2)));
    K.push(frac(Math.pow(n, 1 / 3)));
    found++;
  }
  const len = bytes.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor((len * 8) / 4294967296));
  view.setUint32(padded.length - 4, (len * 8) >>> 0);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  const W = new Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}

export default function PasswordGate({ children }) {
  // Kept in memory only: closing or reloading the app always asks again.
  const [unlocked, setUnlocked] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  // The name is asked once per device, on the first visit, and then greets them.
  const [savedName, setSavedName] = useState(null);
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(NAME_KEY, false);
        setSavedName(res && res.value ? res.value : "");
      } catch {
        setSavedName("");
      }
    })();
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    let hiddenAt = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (hiddenAt !== null && Date.now() - hiddenAt > AWAY_LOCK_MS) {
        setUnlocked(false);
        setValue("");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [unlocked]);

  if (unlocked) return children;

  const askName = savedName === "";
  const canSubmit = value.trim() && (!askName || nameDraft.trim());

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (sha256(value.trim()) === PASSWORD_HASH) {
      if (askName) {
        const n = nameDraft.trim();
        try { await window.storage.set(NAME_KEY, n, false); } catch {}
        setSavedName(n);
      }
      const who = askName ? nameDraft.trim() : savedName;
      speakHe(`${greetingForHour(new Date().getHours())}${who ? `, ${who}` : ""}. לשליטה קולית, לחצו על כפתור המיקרופון בפינה השמאלית התחתונה של המסך.`);
      setUnlocked(true);
    } else {
      setError("הסיסמה לא נכונה. נסו שוב.");
      speakHe("הסיסמה לא נכונה. נסו שוב.");
      setValue("");
    }
  };

  return (
    <div dir="rtl" style={styles.page}>
      <style>{"@import url('https://fonts.googleapis.com/css2?family=Suez+One&family=Heebo:wght@400;600;700&display=swap');"}</style>
      <form onSubmit={submit} style={styles.card}>
        <h1 style={styles.title}>קניות משפחת דריימן</h1>
        {savedName ? (
          <p style={styles.greet}>{greetingForHour(new Date().getHours())}, {savedName}</p>
        ) : null}
        <p style={styles.sub}>הכניסה למשפחה בלבד. הקלידו את הסיסמה כדי להמשיך.</p>
        {askName && (
          <>
            <label htmlFor="family-name" style={styles.label}>השם שלך</label>
            <input
              id="family-name"
              type="text"
              autoComplete="given-name"
              placeholder="למשל: גיל"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              style={{ ...styles.input, direction: "rtl", textAlign: "right" }}
            />
            <p style={styles.hint}>נשאל רק בפעם הראשונה בטלפון הזה.</p>
          </>
        )}
        <label htmlFor="family-password" style={styles.label}>סיסמה</label>
        <input
          id="family-password"
          type="password"
          autoComplete="current-password"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(""); }}
          style={styles.input}
        />
        {error && <p role="alert" style={styles.error}>{error}</p>}
        <button type="submit" disabled={!canSubmit} style={{ ...styles.button, opacity: canSubmit ? 1 : 0.5 }}>
          כניסה
        </button>
      </form>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "radial-gradient(ellipse at top, #F7F8EF 0%, #EFF1E3 55%, #E6E9D7 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", boxSizing: "border-box", fontFamily: "'Heebo', sans-serif" },
  card: { width: "100%", maxWidth: 360, background: "#FFFFFF", border: "1px solid #24302618", borderRadius: 18, padding: "32px 24px", boxShadow: "0 10px 40px #24302612", display: "flex", flexDirection: "column", gap: 10, boxSizing: "border-box" },
  title: { fontFamily: "'Suez One', serif", fontWeight: 400, fontSize: "1.5rem", color: "#243026", margin: 0, textAlign: "center" },
  sub: { margin: "0 0 8px", color: "#5C6657", fontSize: "0.95rem", textAlign: "center" },
  label: { color: "#243026", fontWeight: 600, fontSize: "0.9rem" },
  input: { padding: "12px 14px", borderRadius: 10, border: "1px solid #24302640", fontSize: 16, fontFamily: "'Heebo', sans-serif", direction: "ltr", textAlign: "left" },
  greet: { margin: 0, color: "#3E7C59", fontWeight: 700, fontSize: "1.1rem", textAlign: "center" },
  hint: { margin: "-4px 0 4px", color: "#7C8574", fontSize: "0.8rem" },
  error: { margin: 0, color: "#A33A31", fontSize: "0.9rem" },
  button: { marginTop: 6, padding: "12px 14px", borderRadius: 10, border: "none", background: "#3E7C59", color: "#FFFFFF", fontSize: "1rem", fontWeight: 700, fontFamily: "'Heebo', sans-serif", cursor: "pointer" },
};
