// Turns the app's on-screen Hebrew into text that a voice reads as proper, standard Hebrew:
// numbers become words that agree with the noun after them (שתי עגבניות, שני קילו, שלושה מוצרים),
// symbols and English names are replaced by what a Hebrew speaker would say.

const FEM = ["", "אחת", "שתיים", "שלוש", "ארבע", "חמש", "שש", "שבע", "שמונה", "תשע", "עשר"];
const MASC = ["", "אחד", "שניים", "שלושה", "ארבעה", "חמישה", "שישה", "שבעה", "שמונה", "תשעה", "עשרה"];
const FEM_TEEN = ["עשר", "אחת עשרה", "שתים עשרה", "שלוש עשרה", "ארבע עשרה", "חמש עשרה", "שש עשרה", "שבע עשרה", "שמונה עשרה", "תשע עשרה"];
const MASC_TEEN = ["עשרה", "אחד עשר", "שנים עשר", "שלושה עשר", "ארבעה עשר", "חמישה עשר", "שישה עשר", "שבעה עשר", "שמונה עשר", "תשעה עשר"];
const TENS = ["", "", "עשרים", "שלושים", "ארבעים", "חמישים", "שישים", "שבעים", "שמונים", "תשעים"];

// A whole number 0-999 in words. fem: the noun is feminine. construct: a noun follows right after
// (שתי/שני instead of שתיים/שניים).
export function numberHe(n, fem = true, construct = false) {
  n = Math.round(n);
  if (n === 0) return "אפס";
  if (n < 0 || n > 999) return String(n);
  if (n < 10 || n === 10) {
    if (n === 2 && construct) return fem ? "שתי" : "שני";
    return (fem ? FEM : MASC)[n];
  }
  if (n < 20) return (fem ? FEM_TEEN : MASC_TEEN)[n - 10];
  if (n < 100) {
    const t = Math.floor(n / 10), u = n % 10;
    return u ? `${TENS[t]} ו${(fem ? FEM : MASC)[u]}` : TENS[t];
  }
  const h = Math.floor(n / 100), rest = n % 100;
  const hw = h === 1 ? "מאה" : h === 2 ? "מאתיים" : `${FEM[h]} מאות`;
  return rest ? `${hw}${rest < 20 || rest % 10 === 0 ? " ו" : " "}${numberHe(rest, fem, false)}` : hw;
}

// Feminine nouns that end in ים, and masculine ones that end in ות.
const FEM_IM = new Set(["ביצים", "פעמים", "שנים", "מילים", "עדשים", "שעורים", "תאנים", "אבנים", "ערים", "כבשים"]);
const MASC_OT = new Set(["מזונות", "חלונות", "שולחנות", "מקומות", "לילות", "קולות", "רחובות", "אוצרות", "ארונות", "כינורות"]);
const MASC_WORDS = new Set(["קילו", "קילוגרם", "גרם", "ליטר", "מוצר", "מוצרים", "יום", "ימים", "שקל", "שקלים", "מטר"]);
const FEM_WORDS = new Set(["יחידה", "יחידות", "רשימה", "רשימות", "דקה", "דקות", "שעה", "שעות", "חבילה", "חבילות", "שקית", "שקיות", "קופסה", "קופסאות"]);

// True when the Hebrew noun is feminine (a best guess from its ending when it isn't in the lists).
export function isFeminine(word) {
  const w = String(word || "").replace(/[^\u05D0-\u05EA]/g, "");
  if (!w) return true;
  if (FEM_WORDS.has(w) || FEM_IM.has(w)) return true;
  if (MASC_WORDS.has(w) || MASC_OT.has(w)) return false;
  if (/ות$/.test(w)) return true;
  if (/ים$/.test(w)) return false;
  return /[הת]$/.test(w);
}

// A Hebrew plural noun ("עגבניות", "מלפפונים"), so a number can come right before it.
export function isPluralHe(word) {
  const w = String(word || "").replace(/[^\u05D0-\u05EA]/g, "");
  return w.length > 3 && (/ים$/.test(w) || /ות$/.test(w));
}

const amountWords = (num, fem, construct) => {
  const n = parseFloat(num);
  if (Number.isNaN(n)) return num;
  const whole = Math.floor(n), frac = n - whole;
  if (Math.abs(frac - 0.5) < 1e-9) return whole ? `${numberHe(whole, fem, false)} וחצי` : "חצי";
  if (frac) return num;
  return numberHe(whole, fem, construct);
};

const HEB = "[\\u05D0-\\u05EA]";

export function prepareHe(raw) {
  let t = String(raw || "");
  // Signs and pictures that aren't spoken.
  t = t.replace(/[✓✔✅❌•·→←▶◀★☆🎤🔊]/gu, " ").replace(/[\u{1F300}-\u{1FAFF}]/gu, " ");
  t = t.replace(/×/g, " ").replace(/[״"]/g, "").replace(/[–—]/g, ", ");
  // English names, said the Hebrew way.
  t = t
    .replace(/\bGmail\b/gi, "ג׳ימייל")
    .replace(/\bGoogle\b/gi, "גוגל")
    .replace(/\bWhatsApp\b/gi, "וואטסאפ")
    .replace(/\bSiri\b/gi, "סירי")
    .replace(/\biPhone\b/gi, "אייפון")
    .replace(/\bAndroid\b/gi, "אנדרואיד")
    .replace(/\bSafari\b/gi, "ספארי")
    .replace(/\bChrome\b/gi, "כרום")
    .replace(/\baA\b/g, "איי איי");
  // A prefix letter joined by a dash is read as one word: "ב-ג׳ימייל" → "בג׳ימייל".
  t = t.replace(/(^|\s)([בלמוהשכ])[-־](?=[\u05D0-\u05EA])/g, "$1$2");
  // A Hebrew prefix letter on a number: "ל-4" → "לארבע".
  t = t.replace(new RegExp(`(^|[^\\d.:/])([למבוהש])[-־]?(\\d+(?:\\.5)?)(?![\\d:/.]\\d)(?=\\s|$|[,.?!])`, "g"),
    (m, pre, letter, num) => `${pre}${letter}${amountWords(num, true, false)}`);
  // A number before a noun agrees with it: "2 עגבניות" → "שתי עגבניות", "3 קילו" → "שלושה קילו".
  t = t.replace(new RegExp(`(^|[^\\d.:/\\w])(\\d+(?:\\.5)?)\\s+(${HEB}+)`, "g"), (m, pre, num, noun) => {
    const n = parseFloat(num);
    if (n === 1) return `${pre}${noun} ${isFeminine(noun) ? "אחת" : "אחד"}`;
    if (n === 0.5) return `${pre}חצי ${noun}`;
    return `${pre}${amountWords(num, isFeminine(noun), true)} ${noun}`;
  });
  // Any other plain number is counted: "4" → "ארבע".
  t = t.replace(/(^|[^\d.:/\w])(\d{1,3})(?![\d:/]|\.\d)/g, (m, pre, num) => `${pre}${numberHe(+num, true, false)}`);
  return t.replace(/[ \t]+/g, " ").replace(/ ([,.?!:])/g, "$1").trim();
}
