import React, { useState, useEffect } from "react";
import { NAME_KEY, greetingForHour } from "./family-shopping-list.jsx";
import { speakHe } from "./speech.js";
import { familyForPassword, rememberedFamily, currentFamily, setFamily } from "./families.js";
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
  // The family this phone signs in to; the password decides it.
  const [family, setFamilyState] = useState(rememberedFamily());
  // After a correct password on a phone that has no name for that family yet.
  const [askNameStep, setAskNameStep] = useState(null); // { password }

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

  // A new key per family makes the list start fresh from that family's data.
  if (unlocked) return <React.Fragment key={currentFamily().id}>{children}</React.Fragment>;

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

  // Never waits more than a moment, so the login can't get stuck here.
  const loadName = async () => {
    try {
      const res = await Promise.race([
        window.storage.get(NAME_KEY, false),
        new Promise((resolve) => setTimeout(() => resolve(null), 1500)),
      ]);
      return res && res.value ? res.value : "";
    } catch {
      return "";
    }
  };

  // Correct password and a known name: open the family's list.
  const enter = (password, who) => {
    startSync(password);
    if (faceSupported && !hasFaceLogin() && !faceLoginDeclined()) {
      speakHe(`${greetingForHour(new Date().getHours())}${who ? `, ${who}` : ""}.`);
      setOfferFace(true);
    } else {
      welcome(who);
    }
  };

  const canSubmit = !!value.trim();

  // No real form: some previews (like inside Claude) block form sending.
  const submit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!canSubmit) return;
    const f = familyForPassword(value);
    if (f) {
      const password = value.trim();
      setFamily(f.id);
      setFamilyState(f);
      setFaceReady(hasFaceLogin());
      const who = await loadName();
      setSavedName(who);
      if (!who) {
        setNameDraft("");
        setAskNameStep({ password });
        return;
      }
      enter(password, who);
    } else {
      setError("הסיסמה לא נכונה. נסו שוב.");
      speakHe("הסיסמה לא נכונה. נסו שוב.");
      setValue("");
    }
  };

  const saveName = async (n) => {
    const name = String(n || "").trim();
    if (!name) return;
    window.storage.set(NAME_KEY, name, false).catch(() => {});
    setSavedName(name);
    const { password } = askNameStep;
    setAskNameStep(null);
    enter(password, name);
  };

  if (askNameStep) {
    const members = currentFamily().members;
    return (
      <div dir="rtl" style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.title}>ברוכים הבאים ל{currentFamily().name}</h1>
          <p style={styles.sub}>{members.length ? "מי את/ה?" : "איך קוראים לך?"} נשאל רק בפעם הראשונה בטלפון הזה.</p>
          {members.length > 0 && (
            <div style={styles.chips}>
              {members.map((m) => (
                <button key={m} type="button" onClick={() => saveName(m)} style={styles.chip}>{m}</button>
              ))}
            </div>
          )}
          <label htmlFor="family-name" style={styles.label}>{members.length ? "או הקלידו שם" : "השם שלך"}</label>
          <input
            id="family-name"
            type="text"
            autoComplete="given-name"
            placeholder={currentFamily().namePlaceholder}
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveName(nameDraft); } }}
            style={{ ...styles.input, direction: "rtl", textAlign: "right" }}
          />
          <button type="button" onClick={() => saveName(nameDraft)} disabled={!nameDraft.trim()} style={{ ...styles.button, opacity: nameDraft.trim() ? 1 : 0.5 }}>
            המשך
          </button>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" style={styles.page}>
      <style>{"@import url('https://fonts.googleapis.com/css2?family=Suez+One&family=Heebo:wght@400;600;700&display=swap');"}</style>
      <div style={styles.card}>
        <h1 style={styles.title}>{family ? `קניות ${family.name}` : "רשימת קניות משפחתית"}</h1>
        {family && savedName ? (
          <p style={styles.greet}>{greetingForHour(new Date().getHours())}, {savedName}</p>
        ) : null}
        <p style={styles.sub}>הכניסה למשפחה בלבד. {family && faceReady && faceSupported ? "היכנסו עם זיהוי פנים או הקלידו סיסמה." : "הקלידו את הסיסמה כדי להמשיך."}</p>
        {family && faceReady && faceSupported && (
          <>
            <button type="button" onClick={loginWithFace} disabled={faceBusy} style={{ ...styles.button, ...styles.faceBtn, opacity: faceBusy ? 0.6 : 1 }}>
              <ScanFace size={22} style={{ marginInlineEnd: 8, verticalAlign: "-6px" }} />
              כניסה עם זיהוי פנים
            </button>
            <p style={styles.or}>או עם סיסמה</p>
          </>
        )}
        <label htmlFor="family-password" style={styles.label}>סיסמה</label>
        <input
          id="family-password"
          type="password"
          autoComplete="current-password"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") submit(e); }}
          style={styles.input}
        />
        {error && <p role="alert" style={styles.error}>{error}</p>}
        <button type="button" onClick={submit} disabled={!canSubmit} style={{ ...styles.button, opacity: canSubmit ? 1 : 0.5 }}>
          כניסה
        </button>
        {family && faceSupported && !faceReady && faceLoginDeclined() && (
          <button type="button" onClick={() => { undeclineFaceLogin(); setFaceNote("הקלידו את הסיסמה, ומיד אחר כך נפעיל זיהוי פנים."); }} style={styles.linkBtn}>
            להפעיל כניסה עם זיהוי פנים
          </button>
        )}
        {faceNote && <p style={styles.hint}>{faceNote}</p>}
      </div>
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
  chips: { display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", margin: "4px 0 6px" },
  chip: { padding: "10px 18px", borderRadius: 999, border: "1px solid #3E7C5966", background: "#EEF5EF", color: "#243026", fontSize: "1.05rem", fontWeight: 600, fontFamily: "'Heebo', sans-serif", cursor: "pointer" },
  linkBtn: { marginTop: 4, padding: "8px", border: "none", background: "transparent", color: "#3E7C59", fontSize: "0.9rem", fontWeight: 600, fontFamily: "'Heebo', sans-serif", cursor: "pointer", textDecoration: "underline" },
  error: { margin: 0, color: "#A33A31", fontSize: "0.9rem" },
  button: { marginTop: 6, padding: "12px 14px", borderRadius: 10, border: "none", background: "#3E7C59", color: "#FFFFFF", fontSize: "1rem", fontWeight: 700, fontFamily: "'Heebo', sans-serif", cursor: "pointer" },
};
