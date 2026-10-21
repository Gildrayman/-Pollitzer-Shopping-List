// Speaks Hebrew text aloud with the phone's built-in voice, so every message the app
// shows is also heard.

let token = 0;

function hebrewVoice() {
  try {
    const vs = window.speechSynthesis.getVoices();
    return vs.find((v) => /^(he|iw)/i.test(v.lang)) || null;
  } catch (e) {
    return null;
  }
}

// Speaks sentence by sentence (long single utterances get cut off on some phones), then calls onDone.
// A newer call cuts off an older one.
export function speakHe(text, onDone) {
  const mine = ++token;
  const done = () => {
    if (mine === token && onDone) onDone();
  };
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) { done(); return; }
  try { window.speechSynthesis.cancel(); } catch (e) { /* nothing to cancel */ }
  const parts = String(text).replace(/[✓✔]/g, "").replace(/([.?!:])\s+/g, "$1\n").split("\n").filter((t) => t.trim());
  if (!parts.length) { done(); return; }
  const voice = hebrewVoice();
  let i = 0;
  let guard = null;
  const next = () => {
    clearTimeout(guard);
    if (mine !== token) return;
    if (i >= parts.length) { done(); return; }
    const u = new SpeechSynthesisUtterance(parts[i++]);
    u.lang = "he-IL";
    if (voice) u.voice = voice;
    u.onend = next;
    u.onerror = next;
    // If the phone never reports the end of speech, move on anyway.
    guard = setTimeout(next, 2500 + u.text.length * 110);
    try { window.speechSynthesis.speak(u); } catch (e) { next(); }
  };
  next();
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
      const u = new SpeechSynthesisUtterance(" ");
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
