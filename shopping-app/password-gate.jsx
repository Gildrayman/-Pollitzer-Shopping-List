import React, { useState, useEffect, useRef } from "react";
import { NAME_KEY, greetingForHour } from "./family-shopping-list.jsx";
import { speakHe } from "./speech.js";
import {
  FAMILIES, familyForPassword, rememberedFamily, currentFamily, setFamily, restoreFamily,
  isAdminPassword, adminFamilyKey,
} from "./families.js";
import { startSync, startSyncWithKey, flushNow, needsNewPassword } from "./sync.js";
import { trace } from "./debug.js";
import { ScanFace } from "lucide-react";
import {
  faceLoginSupported, hasFaceLogin, hasAdminFace, registerAdminFace, adminFaceLogin, hasAnyFace, anyFaceLogin,
  registerFaceLogin, faceLogin, markFaceStale, isFaceStale, clearFaceStale,
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
  const [faceReady, setFaceReady] = useState(hasAnyFace());
  const [offerFace, setOfferFace] = useState(false);
  const [faceBusy, setFaceBusy] = useState(false);
  const [faceNote, setFaceNote] = useState("");
  // The manager's Face ID: offered after the manager password, then a button on the login screen.
  const [offerAdminFace, setOfferAdminFace] = useState(false);
  const [adminFaceReady, setAdminFaceReady] = useState(hasAdminFace());
  // The family this phone signs in to; the password decides it.
  const [family, setFamilyState] = useState(rememberedFamily());
  // After a correct password on a phone that has no name for that family yet.
  const [askNameStep, setAskNameStep] = useState(null); // { password }
  // Manager mode (Gil's own password): kept in memory only, ends when the app locks.
  const [admin, setAdmin] = useState(null); // { password }
  const [pickFamily, setPickFamily] = useState(false);
  // A family this device can't open for the manager yet: its own password, once.
  const [adminAskFor, setAdminAskFor] = useState(null);
  const [adminPw, setAdminPw] = useState("");
  const [adminError, setAdminError] = useState("");

  useEffect(() => {
    trace("gate shown, family=" + (rememberedFamily() ? rememberedFamily().id : "none"));
    faceLoginSupported().then((v) => { trace("face supported=" + v); setFaceSupported(v); });
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
        if (admin) endAdmin();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [unlocked, admin]);

  // "שמירה ויציאה" in the app: back to the login screen (the list was already saved).
  useEffect(() => {
    const onLock = () => {
      skipAutoFaceRef.current = true; // after "exit", wait for a tap instead of logging straight back in
      setUnlocked(false);
      setValue("");
      if (admin) endAdmin();
    };
    window.addEventListener("app-lock", onLock);
    return () => window.removeEventListener("app-lock", onLock);
  }, [admin]);

  // Face ID starts only from a tap on its button. (Starting it by itself left the iPhone with a
  // Face ID request it never answered, so the button stopped working.)
  const skipAutoFaceRef = useRef(false);

  // Leaves manager mode: the phone goes back to its own family, untouched.
  function endAdmin() {
    trace("admin end");
    setAdmin(null);
    setPickFamily(false);
    setAdminAskFor(null);
    restoreFamily();
    setFamilyState(rememberedFamily());
    setFaceReady(hasAnyFace());
    (async () => {
      try {
        const res = await window.storage.get(NAME_KEY, false);
        setSavedName(res && res.value ? res.value : "");
      } catch { setSavedName(""); }
    })();
  }

  const switchFamily = () => {
    try { flushNow(); } catch {}
    setUnlocked(false);
    setPickFamily(true);
  };

  // A new key per family makes the list start fresh from that family's data.
  if (unlocked) {
    return (
      <>
        <React.Fragment key={currentFamily().id}>{children}</React.Fragment>
        {admin && (
          <button type="button" onClick={switchFamily} style={styles.adminBar} aria-label="מנהל: החלפת משפחה">
            מנהל · {currentFamily().name} · החלפה
          </button>
        )}
      </>
    );
  }

  const welcome = (who) => {
    trace("welcome -> unlock");
    speakHe(`${greetingForHour(new Date().getHours())}${who ? `, ${who}` : ""}. לשליטה קולית, לחצו על כפתור המיקרופון בפינה השמאלית התחתונה של המסך.`);
    setUnlocked(true);
  };

  // auto: started by the app itself when the password screen opens. If the phone doesn't allow
  // that without a tap, nothing is shown and the big Face ID button is there to tap.
  const loginWithFace = async (auto = false) => {
    setError("");
    setFaceNote("");
    setFaceBusy(true);
    try {
      const r = await anyFaceLogin();
      if (r && r.kind === "admin") {
        trace("admin login (face)");
        setAdmin({ password: "" });
        setAdminAskFor(null);
        setPickFamily(true);
        return;
      }
      if (r && r.kind === "family") {
        trace("face login family=" + r.familyId);
        setFamily(r.familyId);
        const f = rememberedFamily();
        setFamilyState(f);
        const who = await loadName();
        setSavedName(who);
        if (needsNewPassword()) {
          setError(`הסיסמה של ${f.name} השתנתה. הקלידו פעם אחת את הסיסמה החדשה. זיהוי הפנים יישאר.`);
          return;
        }
        startSync();
        welcome(who);
        return;
      }
      markFaceStale();
      if (!auto) setError("זיהוי הפנים לא הצליח. נסו שוב או הקלידו סיסמה.");
    } catch (e) {
      if (e && e.name === "AbortError") return; // replaced by a newer tap
      markFaceStale();
      if (!auto) setError("זיהוי הפנים בוטל או לא הצליח. נסו שוב או הקלידו סיסמה.");
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
      setFaceNote("לא הצלחנו להפעיל זיהוי פנים בטלפון הזה. אפשר להמשיך עם סיסמה." + " [" + ((e && e.name) || "?") + (e && e.message ? ": " + String(e.message).slice(0, 90) : "") + "]");
    } finally {
      setFaceBusy(false);
    }
  };

  // "Not now" holds only for this time: Face ID is the default, so it is offered again next time.
  const skipFace = () => {
    setOfferFace(false);
    setUnlocked(true);
  };

  // Manager: open a family by its server key, without changing this phone's own family.
  const openAsAdmin = async (f, key) => {
    trace("admin open " + f.id);
    setFamily(f.id, false);
    setFamilyState(f);
    try { startSyncWithKey(key); } catch (e) { trace("startSync error " + e.message); }
    let who = "";
    try {
      const res = await Promise.race([
        window.storage.get(NAME_KEY, false),
        new Promise((resolve) => setTimeout(() => resolve(null), 1500)),
      ]);
      who = res && res.value ? res.value : "";
    } catch {}
    if (!who) {
      who = "גיל (מנהל)";
      window.storage.set(NAME_KEY, who, false).catch(() => {});
    }
    setSavedName(who);
    setPickFamily(false);
    setAdminAskFor(null);
    setAdminPw("");
    welcome(who);
  };

  const chooseFamily = (f) => {
    setAdminError("");
    setFamily(f.id, false);
    const key = adminFamilyKey(f.id, admin && admin.password);
    if (key) { openAsAdmin(f, key); return; }
    setAdminPw("");
    setAdminAskFor(f);
  };

  const confirmFamilyPassword = () => {
    const f = adminAskFor;
    const found = familyForPassword(adminPw);
    if (!found || found.id !== f.id) {
      setAdminError(`זו לא הסיסמה של ${f.name}. נסו שוב.`);
      setAdminPw("");
      return;
    }
    setFamily(f.id, false);
    try { startSync(adminPw); } catch (e) { trace("startSync error " + e.message); }
    openAsAdmin(f, null);
  };

  const loginAdminWithFace = async () => {
    setError("");
    setFaceBusy(true);
    try {
      if (await adminFaceLogin()) {
        trace("admin login (face)");
        setAdmin({ password: "" });
        setAdminAskFor(null);
        setPickFamily(true);
        return;
      }
      setError("זיהוי הפנים לא הצליח. נסו שוב או הקלידו את סיסמת המנהל.");
    } catch (e) {
      setError("זיהוי הפנים בוטל או לא הצליח. נסו שוב או הקלידו את סיסמת המנהל.");
    } finally {
      setFaceBusy(false);
    }
  };

  const enableAdminFace = async () => {
    setFaceBusy(true);
    setFaceNote("");
    try {
      await registerAdminFace();
      setAdminFaceReady(true);
      setOfferAdminFace(false);
      speakHe("זיהוי הפנים למנהל הופעל.");
    } catch (e) {
      setFaceNote("לא הצלחנו להפעיל זיהוי פנים בטלפון הזה. אפשר להמשיך עם הסיסמה.");
    } finally {
      setFaceBusy(false);
    }
  };

  if (offerAdminFace && admin) {
    return (
      <div dir="rtl" style={styles.page}>
        <div style={styles.card}>
          <ScanFace size={44} color="#3E7C59" style={{ alignSelf: "center" }} />
          <h1 style={styles.title}>כניסת מנהל מהירה</h1>
          <p style={styles.sub}>להיכנס כמנהל בפעם הבאה עם זיהוי פנים, במקום להקליד את סיסמת המנהל?</p>
          {faceNote && <p role="alert" style={styles.error}>{faceNote}</p>}
          <button type="button" onClick={enableAdminFace} disabled={faceBusy} style={{ ...styles.button, opacity: faceBusy ? 0.6 : 1 }}>
            כן, להפעיל זיהוי פנים
          </button>
          <button type="button" onClick={() => { setOfferAdminFace(false); setFaceNote(""); }} style={styles.linkBtn}>לא עכשיו</button>
        </div>
      </div>
    );
  }

  if (pickFamily && admin) {
    return (
      <div dir="rtl" style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.title}>כניסת מנהל</h1>
          {adminAskFor ? (
            <>
              <p style={styles.sub}>כדי לפתוח את {adminAskFor.name} בטלפון הזה, הקלידו פעם אחת את הסיסמה של המשפחה. מהפעם הבאה היא תיפתח מיד.</p>
              <input
                type="password"
                aria-label="סיסמת המשפחה"
                value={adminPw}
                onChange={(e) => { setAdminPw(e.target.value); setAdminError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") confirmFamilyPassword(); }}
                style={styles.input}
              />
              {adminError && <p role="alert" style={styles.error}>{adminError}</p>}
              <button type="button" onClick={confirmFamilyPassword} disabled={!adminPw.trim()} style={{ ...styles.button, opacity: adminPw.trim() ? 1 : 0.5 }}>
                פתיחה
              </button>
              <button type="button" onClick={() => { setAdminAskFor(null); setAdminError(""); }} style={styles.linkBtn}>חזרה לבחירת משפחה</button>
            </>
          ) : (
            <>
              <p style={styles.sub}>לאיזו משפחה להיכנס?</p>
              {Object.values(FAMILIES).map((f) => (
                <button key={f.id} type="button" onClick={() => chooseFamily(f)} style={styles.button}>
                  {f.name}
                </button>
              ))}
              <button type="button" onClick={() => { endAdmin(); setValue(""); }} style={styles.linkBtn}>יציאה ממצב מנהל</button>
            </>
          )}
        </div>
      </div>
    );
  }

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
  // Face ID is the default for every family: after a typed password, a phone without it is asked to turn it on.
  const enter = async (password, who) => {
    trace(`enter family=${currentFamily().id} name=${who ? "yes" : "no"} face=${faceSupported}`);
    try { startSync(password); } catch (e) { trace("startSync error " + e.message); }
    let supported = faceSupported;
    if (!supported) {
      try { supported = await Promise.race([faceLoginSupported(), new Promise((r) => setTimeout(() => r(false), 1500))]); } catch { supported = false; }
      if (supported) setFaceSupported(true);
    }
    if (supported && (!hasFaceLogin() || isFaceStale())) {
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
    trace(`submit len=${value.trim().length}`);
    if (!canSubmit) return;
    if (isAdminPassword(value)) {
      trace("admin login");
      setAdmin({ password: value.trim() });
      setValue("");
      setError("");
      setAdminAskFor(null);
      let supported = faceSupported;
      if (!supported) { try { supported = await faceLoginSupported(); } catch { supported = false; } }
      if (supported && !hasAdminFace()) setOfferAdminFace(true);
      setPickFamily(true);
      return;
    }
    let f = null;
    try { f = familyForPassword(value); } catch (err) { trace("check error " + err.message); }
    trace("family=" + (f ? f.id : "none"));
    if (f) {
      const password = value.trim();
      setFamily(f.id);
      setFamilyState(f);
      setFaceReady(hasAnyFace());
      const who = await loadName();
      trace("saved name=" + (who ? "yes" : "no"));
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
    trace("pick name");
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
        <p style={styles.sub}>הכניסה למשפחה בלבד. {faceSupported ? "היכנסו עם זיהוי פנים או הקלידו סיסמה." : "הקלידו את הסיסמה כדי להמשיך."}</p>
        {faceSupported && (
          <>
            <button type="button" onClick={() => loginWithFace(false)} style={{ ...styles.button, ...styles.faceBtn, opacity: faceBusy ? 0.8 : 1 }}>
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
        {family && faceSupported && !hasFaceLogin() && (
          <p style={styles.hint}>אחרי הסיסמה אפשר להפעיל כניסה עם זיהוי פנים, ואז לא צריך להקליד אותה שוב.</p>
        )}
        {faceNote && <p style={styles.hint}>{faceNote}</p>}
        <p style={styles.version}>
          גרסה {typeof __BUILD__ !== "undefined" ? __BUILD__ : "dev"}
          {!faceSupported ? ` · זיהוי פנים: ${typeof window !== "undefined" && window.PublicKeyCredential ? (window.isSecureContext ? "לא זמין במכשיר" : "לא מאובטח") : "הדפדפן הזה לא תומך"}` : ""}
        </p>
        {faceSupported && adminFaceReady && (
          <button type="button" onClick={loginAdminWithFace} disabled={faceBusy} style={styles.linkBtn}>
            <ScanFace size={16} style={{ marginInlineEnd: 6, verticalAlign: "-3px" }} />
            כניסת מנהל עם זיהוי פנים
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  version: { margin: "10px 0 0", textAlign: "center", color: "#8A9384", fontSize: "0.72rem" },
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
  adminBar: { position: "fixed", top: 8, left: 8, zIndex: 9999, padding: "6px 12px", borderRadius: 999, border: "none", background: "#243026", color: "#FFFFFF", fontSize: "0.8rem", fontWeight: 700, fontFamily: "'Heebo', sans-serif", boxShadow: "0 4px 14px #24302640", cursor: "pointer" },
  linkBtn: { marginTop: 4, padding: "8px", border: "none", background: "transparent", color: "#3E7C59", fontSize: "0.9rem", fontWeight: 600, fontFamily: "'Heebo', sans-serif", cursor: "pointer", textDecoration: "underline" },
  error: { margin: 0, color: "#A33A31", fontSize: "0.9rem" },
  button: { marginTop: 6, padding: "12px 14px", borderRadius: 10, border: "none", background: "#3E7C59", color: "#FFFFFF", fontSize: "1rem", fontWeight: 700, fontFamily: "'Heebo', sans-serif", cursor: "pointer" },
};
