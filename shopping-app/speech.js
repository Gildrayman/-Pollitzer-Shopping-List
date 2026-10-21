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

// True when the phone has a Hebrew voice, false when it surely has none, null while unknown.
export function hasHebrewVoice() {
  const s = synth();
  if (!s) return false;
  const vs = s.getVoices();
  if (!vs.length) return null;
  return vs.some((v) => /^(he|iw)/i.test(v.lang));
}

// What the speech is doing right now, shown on screen so a problem can be seen and reported.
const status = { engine: "google", state: "שקט", error: "" };
const listeners = new Set();
function setStatus(patch) {
  Object.assign(status, patch);
  listeners.forEach((fn) => { try { fn({ ...status }); } catch (e) { /* ignore */ } });
}
export function onSpeechStatus(fn) {
  listeners.add(fn);
  fn({ ...status });
  return () => listeners.delete(fn);
}

// Google's Hebrew voice, played as ordinary audio. It works on phones with no Hebrew voice
// installed, and audio isn't silenced by the iPhone's silent switch the way built-in speech can be.
const TTS_URLS = [
  (q) => `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=iw&client=gtx&q=${encodeURIComponent(q)}`,
  (q) => `https://translate.google.com/translate_tts?ie=UTF-8&tl=iw&client=tw-ob&q=${encodeURIComponent(q)}`,
];
let player = null;
let audioBroken = false;
function getPlayer() {
  if (!player && typeof Audio !== "undefined") {
    player = new Audio();
    player.preload = "auto";
  }
  return player;
}

// Splits text into short pieces: one per sentence or line, and long ones at commas (the audio takes up to ~180 letters).
function splitParts(text) {
  const out = [];
  const pieces = String(text).replace(/[✓✔]/g, "").replace(/([.?!])\s+/g, "$1\n").split("\n");
  for (let p of pieces) {
    p = p.trim();
    if (!p) continue;
    while (p.length > 180) {
      let cut = p.lastIndexOf(",", 180);
      if (cut < 60) cut = p.lastIndexOf(" ", 180);
      if (cut < 1) cut = 180;
      out.push(p.slice(0, cut + 1).trim());
      p = p.slice(cut + 1).trim();
    }
    if (p) out.push(p);
  }
  // Join short sentences back together, so each request carries as much as it can.
  const merged = [];
  for (const p of out) {
    const last = merged[merged.length - 1];
    if (last && last.length + p.length + 1 <= 180) merged[merged.length - 1] = `${last} ${p}`;
    else merged.push(p);
  }
  return merged;
}

function speakPartSynth(part, onEnd, mine) {
  const s = synth();
  if (!s) { onEnd(); return; }
  const u = new SpeechSynthesisUtterance(part);
  u.lang = "he-IL";
  const voice = hebrewVoice();
  if (voice) u.voice = voice;
  let finished = false;
  const end = () => { if (finished) return; finished = true; clearTimeout(guard); onEnd(); };
  u.onend = end;
  u.onerror = (e) => { setStatus({ error: `קול הטלפון: ${e && e.error ? e.error : "שגיאה"}` }); end(); };
  // If the phone never reports the end of speech, move on anyway.
  const guard = setTimeout(end, 3000 + part.length * 120);
  try {
    if (s.paused) s.resume();
    s.speak(u);
  } catch (e) {
    end();
  }
}

function speakPartAudio(part, onEnd, onFail, mine, urlIdx = 0) {
  const a = getPlayer();
  if (!a) { onFail(); return; }
  let settled = false;
  const finish = (fn) => { if (settled) return; settled = true; clearTimeout(guard); a.onended = null; a.onerror = null; fn(); };
  const guard = setTimeout(() => finish(onEnd), 6000 + part.length * 150);
  a.onended = () => finish(onEnd);
  a.onerror = () => finish(() => (urlIdx + 1 < TTS_URLS.length ? speakPartAudio(part, onEnd, onFail, mine, urlIdx + 1) : onFail("לא נטען")));
  a.src = TTS_URLS[urlIdx](part);
  const pr = a.play();
  if (pr && pr.catch) pr.catch((e) => finish(() => onFail(e && e.name === "NotAllowedError" ? "הדפדפן חסם השמעה" : "לא התנגן")));
}

// Speaks the text, piece by piece, then calls onDone. A newer call cuts off an older one.
export function speakHe(text, onDone) {
  const mine = ++token;
  const done = () => {
    if (mine !== token) return;
    setStatus({ state: "שקט" });
    if (onDone) onDone();
  };
  const parts = text ? splitParts(text) : [];
  if (!parts.length) { done(); return; }
  try { if (player) player.pause(); } catch (e) { /* not playing */ }
  const s = synth();
  let wasBusy = false;
  try { if (s) { wasBusy = s.speaking || s.pending; if (wasBusy) s.cancel(); } } catch (e) { /* nothing to cancel */ }
  let i = 0;
  const next = () => {
    if (mine !== token) return;
    if (i >= parts.length) { done(); return; }
    const part = parts[i++];
    if (!audioBroken) {
      setStatus({ engine: "google", state: "מדבר" });
      speakPartAudio(part, next, (why) => {
        // Google's audio didn't play: use the phone's own voice from here on.
        audioBroken = true;
        setStatus({ engine: "phone", state: "מדבר", error: `קול Google: ${why || "שגיאה"}` });
        speakPartSynth(part, next, mine);
      }, mine);
    } else {
      setStatus({ engine: "phone", state: "מדבר" });
      speakPartSynth(part, next, mine);
    }
  };
  if (wasBusy) setTimeout(next, 120);
  else next();
}

export function stopSpeaking() {
  token++;
  try { if (player) player.pause(); } catch (e) { /* not playing */ }
  try { window.speechSynthesis.cancel(); } catch (e) { /* nothing to cancel */ }
  setStatus({ state: "שקט" });
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
      // A tiny silent sound unlocks the audio player for later messages.
      const a = getPlayer();
      if (a && !a.src) {
        a.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
        const pr = a.play();
        if (pr && pr.catch) pr.catch(() => {});
      }
    } catch (e) {
      // audio not available
    }
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

// A short tone that says "the microphone is open, speak now". Android already beeps by itself,
// so it plays only on iPhones and iPads.
let toneCtx = null;
export function micTone() {
  try {
    if (!/iPhone|iPad|iPod/.test(navigator.userAgent)) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!toneCtx) toneCtx = new AC();
    if (toneCtx.state === "suspended") toneCtx.resume();
    const o = toneCtx.createOscillator();
    const g = toneCtx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.18, toneCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, toneCtx.currentTime + 0.15);
    o.connect(g).connect(toneCtx.destination);
    o.start();
    o.stop(toneCtx.currentTime + 0.16);
  } catch (e) {
    // no tone, the panel still shows "מקשיב"
  }
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
