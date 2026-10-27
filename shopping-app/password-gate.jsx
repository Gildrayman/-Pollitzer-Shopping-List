import React, { useState, useEffect } from "react";
import { NAME_KEY, greetingForHour } from "./family-shopping-list.jsx";
import { speakHe } from "./speech.js";
import { sha256, PASSWORD_HASH } from "./auth.js";
import { startSync } from "./sync.js";
import { ScanFace } from "lucide-react";
import {
  faceLoginSupported, hasFaceLogin, faceLoginDeclined, declineFaceLogin, undeclineFaceLogin,
  registerFaceLogin, faceLogin,
} from "./passkey.js";

// Leaving the app for longer than this locks it again. A short grace period
// keeps the file picker and the WhatsApp/email hand-off from locking it.
const AWAY_LOCK_MS = 60 * 1000;

export default function PasswordGate({ children }) {
  // Kept in memory only: closing or reloading the app always asks again.
  const [unlocked, setUnlocked] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  // The name is asked once per device, on the first visit, and then greets them.
  const [savedName, setSavedName] = useState(null);
  const [nameDraft, setNameDraft] = useState("");
  // Face ID / fingerprint: offered after a correct password, then used instead of it.
  const [faceSupported, setFaceSupported] = useState(false);
  const [faceReady, setFaceReady] = useState(hasFaceLogin());
  const [offerFace, setOfferFace] = useState(false);
  const [faceBusy, setFaceBusy] = useState(false);
  const [faceNote, setFaceNote] = useState("");

  useEffect(() => {
    faceLoginSupported().then(setFaceSupported);
  }, []);

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

  const welcome = (who) => {
    speakHe(`${greetingForHour(new Date().getHours())}${who ? `, ${who}` : ""}. לשליטה קולית, לחצו על כפתור המיקרופון בפינה השמאלית התחתונה של המסך.`);
    setUnlocked(true);
  };

  const loginWithFace = async () => {
    setError("");
    setFaceNote("");
    setFaceBusy(true);
    try {
      if (await faceLogin()) {
        startSync();
        welcome(savedName);
        return;
      }
      setError("זיהוי הפנים לא הצליח. נסו שוב או הקלידו סיסמה.");
    } catch (e) {
      setError("זיהוי הפנים בוטל או לא הצליח. נסו שוב או הקלידו סיסמה.");
    } finally {
      setFaceBusy(false);
    }
  };

  const enableFace = async () => {
    setFaceBusy(true);
    setFaceNote("");
    try {
      await registerFaceLogin(savedName);
      setFaceReady(true);
      speakHe("זיהוי הפנים הופעל. בפעם הבאה אפשר להיכנס בלי סיסמה.");
      setOfferFace(false);
      setUnlocked(true);
    } catch (e) {
      setFaceNote("לא הצלחנו להפעיל זיהוי פנים בטלפון הזה. אפשר להמשיך עם סיסמה.");
    } finally {
      setFaceBusy(false);
    }
  };

  const skipFace = () => {
    declineFaceLogin();
    setOfferFace(false);
    setUnlocked(true);
  };

  if (offerFace) {
    return (
      <div dir="rtl" style={styles.page}>
        <div style={styles.card}>
          <ScanFace size={44} color="#3E7C59" style={{ alignSelf: "center" }} />
          <h1 style={styles.title}>כניסה מהירה</h1>
          <p style={styles.sub}>להיכנס בפעם הבאה עם זיהוי פנים (או טביעת אצבע) במקום להקליד סיסמה?</p>
          {faceNote && <p role="alert" style={styles.error}>{faceNote}</p>}
          <button type="button" onClick={enableFace} disabled={faceBusy} style={{ ...styles.button, opacity: faceBusy ? 0.6 : 1 }}>
            כן, להפעיל זיהוי פנים
          </button>
          <button type="button" onClick={skipFace} style={styles.linkBtn}>לא עכשיו</button>
        </div>
      </div>
    );
  }

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
      startSync(value);
      const who = askName ? nameDraft.trim() : savedName;
      if (faceSupported && !hasFaceLogin() && !faceLoginDeclined()) {
        speakHe(`${greetingForHour(new Date().getHours())}${who ? `, ${who}` : ""}.`);
        setOfferFace(true);
      } else {
        welcome(who);
      }
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
        <p style={styles.sub}>הכניסה למשפחה בלבד. {faceReady && faceSupported ? "היכנסו עם זיהוי פנים או הקלידו סיסמה." : "הקלידו את הסיסמה כדי להמשיך."}</p>
        {faceReady && faceSupported && (
          <>
            <button type="button" onClick={loginWithFace} disabled={faceBusy} style={{ ...styles.button, ...styles.faceBtn, opacity: faceBusy ? 0.6 : 1 }}>
              <ScanFace size={22} style={{ marginInlineEnd: 8, verticalAlign: "-6px" }} />
              כניסה עם זיהוי פנים
            </button>
            <p style={styles.or}>או עם סיסמה</p>
          </>
        )}
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
        {faceSupported && !faceReady && faceLoginDeclined() && (
          <button type="button" onClick={() => { undeclineFaceLogin(); setFaceNote("הקלידו את הסיסמה, ומיד אחר כך נפעיל זיהוי פנים."); }} style={styles.linkBtn}>
            להפעיל כניסה עם זיהוי פנים
          </button>
        )}
        {faceNote && <p style={styles.hint}>{faceNote}</p>}
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
  faceBtn: { marginTop: 0, display: "flex", alignItems: "center", justifyContent: "center" },
  or: { margin: "2px 0", color: "#7C8574", fontSize: "0.85rem", textAlign: "center" },
  linkBtn: { marginTop: 4, padding: "8px", border: "none", background: "transparent", color: "#3E7C59", fontSize: "0.9rem", fontWeight: 600, fontFamily: "'Heebo', sans-serif", cursor: "pointer", textDecoration: "underline" },
  error: { margin: 0, color: "#A33A31", fontSize: "0.9rem" },
  button: { marginTop: 6, padding: "12px 14px", borderRadius: 10, border: "none", background: "#3E7C59", color: "#FFFFFF", fontSize: "1rem", fontWeight: 700, fontFamily: "'Heebo', sans-serif", cursor: "pointer" },
};
