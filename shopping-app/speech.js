// Speaks Hebrew text aloud with the phone's built-in voice, so every message the app
// shows is also heard.

import { prepareHe } from "./hebrew-speech.js";

let token = 0;
let voicesReady = false;

function synth() {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

// The best Hebrew voice on the phone: an enhanced or premium voice (on iPhone, "כרמית משופר")
// sounds far more natural than the basic one, so it wins when it is installed.
function voiceScore(v) {
  const name = `${v.name} ${v.voiceURI || ""}`;
  let s = 0;
  if (/he[-_]IL/i.test(v.lang)) s += 2;
  if (/premium|פרימיום/i.test(name)) s += 8;
  if (/enhanced|משופר|neural|natural/i.test(name)) s += 6;
  if (/compact|eloquence/i.test(name)) s -= 3;
  if (v.localService) s += 1;
  return s;
}
let bestVoice = null;
function hebrewVoice() {
  try {
    const vs = synth().getVoices();
    if (vs.length) voicesReady = true;
    const he = vs.filter((v) => /^(he|iw)/i.test(v.lang));
    if (!he.length) return null;
    if (!bestVoice || !he.includes(bestVoice)) bestVoice = he.slice().sort((a, b) => voiceScore(b) - voiceScore(a))[0];
    return bestVoice;
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
// A natural, human Hebrew voice from Google Cloud Text-to-Speech. Used when a key is set here
// (a browser key limited to this site and to the Text-to-Speech API); otherwise the free voice below.
const CLOUD_TTS_KEY = "";
const CLOUD_VOICE = { languageCode: "he-IL", name: "he-IL-Wavenet-A" };
let cloudBrokenUntil = 0; // after a failure, the free voice is used for a minute
const cloudCache = new Map();
async function cloudAudio(text) {
  if (cloudCache.has(text)) return cloudCache.get(text);
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = setTimeout(() => ctrl && ctrl.abort(), 6000);
  try {
    const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${CLOUD_TTS_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: { text }, voice: CLOUD_VOICE, audioConfig: { audioEncoding: "MP3", speakingRate: 1.0 } }),
      signal: ctrl ? ctrl.signal : undefined,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    if (!j.audioContent) throw new Error("no audio");
    const url = `data:audio/mpeg;base64,${j.audioContent}`;
    if (cloudCache.size > 60) cloudCache.delete(cloudCache.keys().next().value);
    cloudCache.set(text, url);
    return url;
  } finally {
    clearTimeout(timer);
  }
}

// Plays one whole message in the cloud voice. Calls onEnd when done, onFail if it can't.
function speakCloud(text, onEnd, onFail, mine) {
  cloudAudio(text).then((url) => {
    if (mine !== token) return;
    const a = getPlayer(0);
    if (!a) { onFail("אין נגן"); return; }
    player = a;
    let settled = false;
    const finish = (fn) => { if (settled) return; settled = true; clearTimeout(guard); a.onended = null; a.onerror = null; fn(); };
    const guard = setTimeout(() => finish(onEnd), 8000 + text.length * 150);
    a.onended = () => finish(onEnd);
    a.onerror = () => finish(() => onFail("לא התנגן"));
    a.__url = url;
    a.src = url;
    const pr = a.play();
    if (pr && pr.catch) pr.catch((e) => finish(() => onFail(e && e.name === "NotAllowedError" ? "הדפדפן חסם השמעה" : "לא התנגן")));
  }).catch((e) => { if (mine === token) onFail(e && e.message ? e.message : "שגיאה"); });
}

// Two players take turns: while one speaks a sentence, the other already loads the next one,
// so sentences follow each other without a gap, the way a person speaks.
const players = [];
let player = null;
let audioBroken = false;
function getPlayer(k = 0) {
  if (!players[k] && typeof Audio !== "undefined") {
    players[k] = new Audio();
    players[k].preload = "auto";
  }
  return players[k] || null;
}
function loadInto(a, url) {
  if (!a || a.__url === url) return;
  a.__url = url;
  a.src = url;
  try { a.load(); } catch (e) { /* loads on play */ }
}
function pauseAll() {
  players.forEach((a) => { try { a.pause(); } catch (e) { /* not playing */ } });
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
  // A touch slower than the phone's default, for clear, calm speech.
  u.rate = 0.95;
  u.pitch = 1;
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

function speakPartAudio(part, onEnd, onFail, mine, urlIdx = 0, k = 0, nextPart = "") {
  const a = getPlayer(k);
  if (!a) { onFail(); return; }
  player = a;
  let settled = false;
  const finish = (fn) => { if (settled) return; settled = true; clearTimeout(guard); a.onended = null; a.onerror = null; fn(); };
  const guard = setTimeout(() => finish(onEnd), 6000 + part.length * 150);
  a.onended = () => finish(onEnd);
  a.onerror = () => finish(() => (urlIdx + 1 < TTS_URLS.length ? speakPartAudio(part, onEnd, onFail, mine, urlIdx + 1, k, nextPart) : onFail("לא נטען")));
  const url = TTS_URLS[urlIdx](part);
  if (a.__url !== url) { a.__url = url; a.src = url; }
  else { try { a.currentTime = 0; } catch (e) { /* not loaded yet */ } }
  const pr = a.play();
  if (pr && pr.catch) pr.catch((e) => finish(() => onFail(e && e.name === "NotAllowedError" ? "הדפדפן חסם השמעה" : "לא התנגן")));
  // Meanwhile, the other player loads the next sentence.
  if (nextPart) setTimeout(() => { if (!settled) loadInto(getPlayer(1 - k), TTS_URLS[0](nextPart)); }, 50);
}

// Speaks the text, piece by piece, then calls onDone. A newer call cuts off an older one.
export function speakHe(text, onDone) {
  const mine = ++token;
  const done = () => {
    if (mine !== token) return;
    setStatus({ state: "שקט" });
    if (onDone) onDone();
  };
  const spoken = text ? prepareHe(text) : "";
  const parts = spoken ? splitParts(spoken) : [];
  if (!parts.length) { done(); return; }
  pauseAll();
  const s = synth();
  let wasBusy = false;
  try { if (s) { wasBusy = s.speaking || s.pending; if (wasBusy) s.cancel(); } } catch (e) { /* nothing to cancel */ }
  let i = 0;
  const next = () => {
    if (mine !== token) return;
    if (i >= parts.length) { done(); return; }
    const k = i % 2;
    const part = parts[i++];
    if (!audioBroken) {
      setStatus({ engine: "google", state: "מדבר" });
      speakPartAudio(part, next, (why) => {
        // Google's audio didn't play: use the phone's own voice from here on.
        audioBroken = true;
        setStatus({ engine: "phone", state: "מדבר", error: `קול Google: ${why || "שגיאה"}` });
        speakPartSynth(part, next, mine);
      }, mine, 0, k, parts[i] || "");
    } else {
      setStatus({ engine: "phone", state: "מדבר" });
      speakPartSynth(part, next, mine);
    }
  };
  // The human voice speaks the whole message at once, so its tone flows like a person's.
  if (CLOUD_TTS_KEY && Date.now() > cloudBrokenUntil && spoken.length <= 4500) {
    setStatus({ engine: "cloud", state: "מדבר" });
    speakCloud(spoken, done, (why) => {
      cloudBrokenUntil = Date.now() + 60000;
      setStatus({ error: `קול אנושי: ${why}` });
      next();
    }, mine);
    return;
  }
  if (wasBusy) setTimeout(next, 120);
  else next();
}

export function stopSpeaking() {
  token++;
  pauseAll();
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
      // Both players are unlocked, since they take turns speaking.
      [0, 1].forEach((k) => {
        const a = getPlayer(k);
        if (a && !a.src) {
          a.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
          const pr = a.play();
          if (pr && pr.catch) pr.catch(() => {});
        }
      });
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
