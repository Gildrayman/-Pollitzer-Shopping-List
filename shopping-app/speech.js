// Speaks Hebrew text aloud with the phone's built-in voice, so every message the app
// shows is also heard.

let token = 0;
let voicesReady = false;

function synth() {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

function hebrewVoice() {
  try {
    const vs = synth().getVoices();
    if (vs.length) voicesReady = true;
    return vs.find((v) => /^(he|iw)/i.test(v.lang)) || null;
  } catch (e) {
    return null;
  }
}

// Phones load their voices a moment after the page opens; wait for them (up to 1.5s) once.
function whenVoicesReady(cb) {
  const s = synth();
  if (!s || voicesReady || s.getVoices().length) { voicesReady = true; cb(); return; }
  let fired = false;
  const go = () => { if (fired) return; fired = true; voicesReady = true; cb(); };
  try { s.addEventListener("voiceschanged", go, { once: true }); } catch (e) { /* old browser */ }
  setTimeout(go, 1500);
}

// True when the phone has a Hebrew voice, false when it surely has none, null while unknown.
export function hasHebrewVoice() {
  const s = synth();
  if (!s) return false;
  const vs = s.getVoices();
  if (!vs.length) return null;
  return vs.some((v) => /^(he|iw)/i.test(v.lang));
}

// Speaks sentence by sentence (long single utterances get cut off on some phones), then calls onDone.
// A newer call cuts off an older one.
export function speakHe(text, onDone) {
  const mine = ++token;
  const done = () => {
    if (mine === token && onDone) onDone();
  };
  const s = synth();
  if (!s || !text) { done(); return; }
  const parts = String(text).replace(/[✓✔]/g, "").replace(/([.?!:])\s+/g, "$1\n").split("\n").filter((t) => t.trim());
  if (!parts.length) { done(); return; }
  // Some phones drop an utterance that comes right after cancel(), so cancel only when needed and pause briefly.
  let wasBusy = false;
  try { wasBusy = s.speaking || s.pending; if (wasBusy) s.cancel(); } catch (e) { /* nothing to cancel */ }
  let i = 0;
  let guard = null;
  const next = () => {
    clearTimeout(guard);
    if (mine !== token) return;
    if (i >= parts.length) { done(); return; }
    const u = new SpeechSynthesisUtterance(parts[i++]);
    u.lang = "he-IL";
    const voice = hebrewVoice();
    if (voice) u.voice = voice;
    u.rate = 1;
    u.volume = 1;
    u.onend = next;
    u.onerror = next;
    // If the phone never reports the end of speech, move on anyway.
    guard = setTimeout(next, 3000 + u.text.length * 120);
    try {
      if (s.paused) s.resume();
      s.speak(u);
    } catch (e) {
      next();
    }
  };
  const begin = () => (wasBusy ? setTimeout(next, 120) : next());
  if (voicesReady || s.getVoices().length) begin();
  else whenVoicesReady(begin);
}

export function stopSpeaking() {
  token++;
  try { window.speechSynthesis.cancel(); } catch (e) { /* nothing to cancel */ }
}

// iPhones speak only after the first touch on the page; a silent utterance on that touch
// lets later messages (which come after a delay) be heard too.
export function primeSpeech() {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || window.__speechPrimed) return;
  window.__speechPrimed = true;
  const once = () => {
    window.removeEventListener("pointerdown", once, true);
    window.removeEventListener("keydown", once, true);
    try {
      const u = new SpeechSynthesisUtterance(".");
      u.volume = 0;
      u.lang = "he-IL";
      window.speechSynthesis.speak(u);
    } catch (e) {
      // speech not available
    }
  };
  window.addEventListener("pointerdown", once, true);
  window.addEventListener("keydown", once, true);
}

export const MIC_HELP =
  "אין הרשאה למיקרופון, ולכן האפליקציה לא שומעת אתכם. כך מאשרים: " +
  "באייפון, בספארי: לוחצים על הסימן aA או על הסימן שמשמאל לכתובת האתר, בוחרים הגדרות אתר, ובשורה מיקרופון בוחרים אפשר. " +
  "בנוסף, בהגדרות של האייפון, תחת Siri, צריך שהכתבה תהיה מופעלת. " +
  "באנדרואיד, בכרום: לוחצים על הסימן שמשמאל לכתובת האתר, בוחרים הרשאות, ומפעילים את המיקרופון. " +
  "אחר כך לוחצים שוב על כפתור המיקרופון.";

export const NO_HEBREW_VOICE =
  "בטלפון הזה לא נמצא קול בעברית, ולכן האפליקציה לא יכולה להקריא. כך מתקינים: " +
  "באנדרואיד: הגדרות, נגישות, המרת טקסט לדיבור, לוחצים על גלגל השיניים ליד מנוע Google, התקנת נתוני קול, ומורידים עברית. " +
  "באייפון: הגדרות, נגישות, תוכן מוקרא, קולות, ומורידים קול בעברית, למשל כרמית. " +
  "בנוסף באייפון: מתג השקט בצד הטלפון צריך להיות במצב צלצול, אחרת לא שומעים.";
