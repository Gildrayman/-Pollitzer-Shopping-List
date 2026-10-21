// Voice control: turns a spoken Hebrew sentence into list actions, and applies them.
// Pure functions only (no React, no browser APIs), so they can be tested on their own.

const NUM_WORDS = {
  אחד: 1, אחת: 1, שניים: 2, שנים: 2, שתיים: 2, שתים: 2, שני: 2, שתי: 2, זוג: 2,
  שלוש: 3, שלושה: 3, ארבע: 4, ארבעה: 4, חמש: 5, חמישה: 5, שש: 6, שישה: 6,
  שבע: 7, שבעה: 7, שמונה: 8, תשע: 9, תשעה: 9, עשר: 10, עשרה: 10, עשרים: 20,
};
const TEENS = { אחת: 11, אחד: 11, שתים: 12, שתיים: 12, שנים: 12, שניים: 12, שלוש: 13, שלושה: 13, ארבע: 14, ארבעה: 14, חמש: 15, חמישה: 15, שש: 16, שישה: 16, שבע: 17, שבעה: 17, שמונה: 18, תשע: 19, תשעה: 19 };

const KILO_WORDS = new Set(["קילו", "קילוגרם", "קילוגרמים", "קג", "קילואים"]);
const UNIT_WORDS = new Set(["יחידות", "יחידה", "יח", "חבילות", "חבילה", "קופסאות", "קופסה", "קופסא", "בקבוקים", "בקבוק", "שקיות", "שקית", "מגשים", "מגש", "של", "את", "גם", "בבקשה", "לי", "מ", "מן", "עם"]);

const VERBS = {
  add: ["הוסף", "תוסיף", "תוסיפי", "להוסיף", "הוסיפי", "תכניס", "הכנס", "תכניסי", "תשים", "שים", "תשימי", "תביא", "תביאי", "רוצה", "רוצים", "צריך", "צריכה", "צריכים", "קנה", "תקנה", "תקני", "תרשום", "רשום", "תרשמי", "הזמן", "תזמין", "אני", "גם"],
  remove: ["תוריד", "הורד", "להוריד", "תורידי", "תמחק", "מחק", "למחוק", "תמחקי", "הסר", "תסיר", "להסיר", "תסירי", "בטל", "תבטל", "לבטל", "תבטלי", "בלי"],
  set: ["שנה", "תשנה", "לשנות", "תשני", "עדכן", "תעדכן", "לעדכן", "תעדכני", "קבע", "תקבע", "תקבעי", "כמות"],
  inc: ["עוד", "תגדיל", "הגדל", "להגדיל", "תגדילי", "תעלה", "הוסף עוד"],
  dec: ["פחות", "תקטין", "הקטן", "להקטין", "תקטיני", "תפחית", "הפחת"],
};

const CATEGORY_WORDS = [
  ["produce", ["ירקות", "פירות", "ירק", "פרי", "ירקות ופירות"]],
  ["dairy", ["מוצרי חלב", "חלבי", "חלביים", "מחלבה"]],
  ["frozen", ["קפואים", "קפוא", "מוצרים קפואים"]],
  ["meat", ["בשר", "דגים", "בשר ודגים", "בשרים"]],
  ["bakery", ["מאפים", "מאפה", "לחמים", "מאפייה"]],
  ["pantry", ["מזווה", "יבשים", "מזווה ויבשים"]],
  ["household", ["ניקיון", "ניקוי", "בית", "ניקיון ובית"]],
  ["other", ["שונות", "שונים"]],
];

// Lower-cases, drops niqqud, punctuation and geresh, and writes final letters as regular ones,
// so "קג", "ק״ג" and "ק\"ג" all compare equal.
export function normHe(s) {
  return String(s || "")
    .replace(/[֑-ׇ]/g, "")
    .replace(/[‎‏‪-‮⁦-⁩﻿]/g, "")
    .replace(/[״׳"'`]/g, "")
    .replace(/[ך]/g, "כ").replace(/[ם]/g, "מ").replace(/[ן]/g, "נ").replace(/[ף]/g, "פ").replace(/[ץ]/g, "צ")
    .replace(/[-–־_/\\(),.!?;:%]/g, " ")
    .replace(/(^|\s)אחוז(ים)?(?=\s|$)/g, " ")
    .replace(/(\d)([^\d\s])/g, "$1 $2")
    .replace(/([^\d\s])(\d)/g, "$1 $2")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const NORM = (list) => list.map(normHe);
const V = Object.fromEntries(Object.entries(VERBS).map(([k, l]) => [k, new Set(NORM(l))]));
const NUMS = Object.fromEntries(Object.entries(NUM_WORDS).map(([k, n]) => [normHe(k), n]));
const TEEN = Object.fromEntries(Object.entries(TEENS).map(([k, n]) => [normHe(k), n]));
const KILO = new Set([...KILO_WORDS].map(normHe));
const UNITS = new Set([...UNIT_WORDS].map(normHe));

// Reads a number at tokens[i]: digits, a Hebrew number word ("שלוש", "שתים עשרה"),
// with an optional "ו"/"ה"/"ל" prefix. Returns { n, len } or null.
function readNumber(tokens, i) {
  let t = tokens[i];
  if (t == null) return null;
  if (/^\d{1,3}$/.test(t)) return { n: parseInt(t, 10), len: 1 };
  for (const pre of ["", "ו", "ל", "ה"]) {
    if (pre && !t.startsWith(pre)) continue;
    const w = pre ? t.slice(pre.length) : t;
    if (/^\d{1,3}$/.test(w)) return { n: parseInt(w, 10), len: 1 };
    if (TEEN[w] && (tokens[i + 1] === "עשר" || tokens[i + 1] === "עשרה")) return { n: TEEN[w], len: 2 };
    if (NUMS[w]) return { n: NUMS[w], len: 1 };
  }
  return null;
}

// Strips a Hebrew plural/feminine ending, for loose comparison ("עגבניה" ~ "עגבניות").
function stem(t) {
  let s = t;
  if (s.length > 3 && (s.startsWith("ה") || s.startsWith("ו"))) s = s.slice(1);
  return s.replace(/(ות|ים|יות|ה|ת|י)$/, "");
}

function tokenSim(a, b) {
  if (a === b) return 1;
  const sa = stem(a), sb = stem(b);
  if (sa.length >= 2 && sa === sb) return 0.9;
  const [s, l] = sa.length <= sb.length ? [sa, sb] : [sb, sa];
  if (s.length >= 3 && l.startsWith(s)) return 0.75;
  return 0;
}

// Scores how well the spoken words match a product name, 0..1.
export function matchScore(query, name) {
  const q = normHe(query).split(" ").filter((t) => t && !UNITS.has(t));
  const p = normHe(name).split(" ").filter(Boolean);
  if (!q.length || !p.length) return 0;
  if (q.join(" ") === p.join(" ")) return 1;
  let sumP = 0;
  for (const pt of p) sumP += Math.max(...q.map((qt) => tokenSim(qt, pt)));
  let sumQ = 0;
  for (const qt of q) sumQ += Math.max(...p.map((pt) => tokenSim(qt, pt)));
  const prec = sumP / p.length, rec = sumQ / q.length;
  if (prec + rec === 0) return 0;
  return Math.min(0.99, (2 * prec * rec) / (prec + rec));
}

// Finds the product the user meant. Returns { match } when one product clearly wins,
// { options } when several fit about as well, or {} when none does.
export function findProduct(query, products) {
  const scored = products
    .map((p) => ({ p, s: matchScore(query, p.name) }))
    .filter((x) => x.s >= 0.5)
    .sort((a, b) => b.s - a.s);
  if (!scored.length) return {};
  const best = scored[0];
  if (best.s === 1) return { match: best.p };
  const close = scored.filter((x) => best.s - x.s < 0.05);
  if (close.length === 1) return { match: best.p };
  return { options: close.slice(0, 4).map((x) => x.p) };
}

export function findCategory(text) {
  const n = normHe(text);
  let best = null;
  for (const [id, words] of CATEGORY_WORDS) {
    for (const w of words) {
      const nw = normHe(w);
      const re = new RegExp(`(^|\\s)[הבלמו]{0,2}${nw}(\\s|$)`);
      if (re.test(n) && (!best || nw.length > best.len)) best = { id, len: nw.length };
    }
  }
  return best ? best.id : null;
}

const YES = new Set(NORM(["כן", "בטח", "נכון", "אישור", "מאשר", "מאשרת", "יאללה", "סבבה", "אוקיי", "אוקי", "בסדר", "כמובן"]));
const NO = new Set(NORM(["לא", "ממש לא", "בטל את זה", "עזוב", "לא תודה", "אל תשלח", "לא צריך"]));

// Writes final letters back at word ends, for showing or saying a name that was normalized.
export function prettyHe(s) {
  const fin = { כ: "ך", מ: "ם", נ: "ן", פ: "ף", צ: "ץ" };
  return String(s).split(" ").map((w) => (w.length > 1 && fin[w[w.length - 1]] ? w.slice(0, -1) + fin[w[w.length - 1]] : w)).join(" ");
}

const has = (n, words) => words.some((w) => new RegExp(`(^|\\s)${normHe(w)}(\\s|$)`).test(n));

// Splits "2 עגבניות ו3 מלפפונים, וגם חלב" into one chunk per product.
function splitChunks(tokens, products) {
  const productFirst = new Set(products.map((p) => normHe(p.name).split(" ")[0]).filter(Boolean));
  const chunks = [[]];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "וגם" || t === "," || t === "ועוד") { chunks.push([]); continue; }
    if (t.length > 1 && t.startsWith("ו") && chunks[chunks.length - 1].length) {
      const rest = t.slice(1);
      const startsItem = readNumber([rest], 0) || KILO.has(rest) || productFirst.has(rest) ||
        [...productFirst].some((f) => f.length >= 3 && tokenSim(rest, f) >= 0.9);
      if (startsItem) { chunks.push([rest]); continue; }
    }
    chunks[chunks.length - 1].push(t);
  }
  return chunks.filter((c) => c.length);
}

// Reads one chunk ("2 קילו שוק הודו", "עגבניות שרי ל-5") into { query, qty, kg }.
// A product whose own name has a number ("קוטג' 5%") is taken out first, so its 5 isn't read as a quantity.
function readChunk(tokens, products) {
  let qty = null, kg = null, setTo = null;
  const rest = [];
  const joined = ` ${tokens.join(" ")} `;
  for (const p of products) {
    const pn = normHe(p.name);
    if (!/\d/.test(pn)) continue;
    const at = joined.indexOf(` ${pn} `);
    if (at >= 0) {
      const before = joined.slice(0, at).trim();
      const after = joined.slice(at + pn.length + 2).trim();
      tokens = [before, after].filter(Boolean).join(" ").split(" ").filter(Boolean);
      rest.push(...pn.split(" "));
      break;
    }
  }
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if ((t === "ל" || t === "עד") && readNumber(tokens, i + 1)) {
      const r = readNumber(tokens, i + 1);
      i += r.len;
      if (KILO.has(tokens[i + 1])) { kg = r.n; i++; } else setTo = r.n;
      continue;
    }
    if (t === "חצי" && KILO.has(tokens[i + 1])) { kg = 1; i++; continue; }
    if (KILO.has(t)) {
      if (kg == null) kg = 1;
      continue;
    }
    const r = readNumber(tokens, i);
    if (r) {
      if (KILO.has(tokens[i + r.len])) { kg = r.n; i += r.len; }
      else if (t.startsWith("ל") && !/^\d/.test(t)) { setTo = r.n; i += r.len - 1; }
      else { qty = r.n; i += r.len - 1; }
      continue;
    }
    if (UNITS.has(t)) continue;
    rest.push(t);
  }
  if (setTo != null && qty == null) qty = setTo;
  return { query: rest.join(" "), qty, kg, explicitSet: setTo != null };
}

// Turns a spoken sentence into one command.
// products: [{ name, category }] (the catalog plus whatever is on the list).
export function parseCommand(text, products = []) {
  const n = normHe(text);
  if (!n) return { type: "unknown" };
  const words = n.split(" ");
  const first = words[0];

  if (YES.has(first) && words.length <= 3) return { type: "yes" };
  if (NO.has(n) || (first === "לא" && words.length <= 2)) return { type: "no" };
  if (has(n, ["עצור", "הפסק", "תפסיק", "די", "סיום", "סיימתי", "תודה"]) && words.length <= 3) return { type: "stop" };
  if (has(n, ["עזרה", "עזור", "מה אפשר", "מה אני יכול", "פקודות", "הוראות"])) return { type: "help" };
  if (has(n, ["שלח", "תשלח", "לשלוח", "תשלחי", "שליחה"])) {
    if (/(ואטסאפ|וטסאפ|וצאפ|ואצאפ|whatsapp|ווטס)/.test(n)) return { type: "send_whatsapp" };
    return { type: "send_mail" };
  }
  if (has(n, ["שמור", "תשמור", "לשמור", "תשמרי"])) return { type: "save" };
  if (has(n, ["רשימה חדשה", "רשימה ריקה", "התחל מחדש", "תתחיל מחדש", "נקה רשימה", "תנקה את הרשימה", "מחק את הרשימה", "תמחק את הרשימה", "מחק הכל", "תמחק הכל"])) return { type: "new_list" };
  if (has(n, ["חזור", "חזרה", "תחזור", "אחורה"]) && words.length <= 3) return { type: "back" };
  if (has(n, ["סיכום", "תסכם", "סכם"]) && words.length <= 4) return { type: "summary" };
  if ((has(n, ["מה ברשימה", "מה יש ברשימה", "תקריא", "הקרא", "תקריאי", "להקריא", "מה הרשימה", "מה בסל", "מה הזמנתי", "קרא את הרשימה", "תקרא"])) && !findCategory(n)) return { type: "read_list" };
  if (has(n, ["כמה"])) {
    const q = words.filter((w) => !["כמה", "יש", "ברשימה", "הזמנתי", "בחרתי", "שמתי", "יש לי"].includes(w)).join(" ");
    return { type: "ask_qty", query: q };
  }
  if (has(n, ["רשימות קודמות", "רשימות שמורות", "רשימות ישנות", "היסטוריה", "הרשימות הקודמות"])) return { type: "goto_saved" };
  if (has(n, ["ייבוא", "יבוא", "תייבא", "לייבא", "ייבא"])) return { type: "goto_import" };
  if (has(n, ["מוצר חדש", "מוצרים חדשים"]) && words.length <= 5) return { type: "goto_new_product" };
  if (has(n, ["מה יש כאן", "מה יש פה", "מה במחלקה", "מה יש במחלקה", "תקריא את המוצרים", "הקרא את המוצרים", "אילו מוצרים יש", "איזה מוצרים יש", "מה בטאב", "מה בלשונית"])) return { type: "read_here" };
  const cat = findCategory(n);
  // Just a tab's name ("בשר ודגים", "לשונית מאפים", "תעבור לירקות") switches to that tab, like tapping it.
  if (cat) {
    const filler = new Set(NORM(["טאב", "לטאב", "הטאב", "לשונית", "ללשונית", "הלשונית", "מחלקת", "למחלקת", "המחלקה", "מחלקה", "עבור", "תעבור", "לעבור", "תעברי", "לך", "תלך", "פתח", "תפתח", "תפתחי", "תראה", "תראי", "הצג", "תציג", "אל", "את", "ל", "ה", "ב", "קטגוריה", "לקטגוריה", "בבקשה", "עכשיו"]));
    const catWords = new Set();
    for (const [, ws] of CATEGORY_WORDS) for (const w of ws) for (const t of normHe(w).split(" ")) catWords.add(t);
    const leftover = words.filter((w) => !filler.has(w) && !catWords.has(w) && !catWords.has(w.replace(/^[הבלמו]{1,2}/, "")) && w !== "ו");
    if (!leftover.length) return { type: "goto_category", category: cat };
  }
  if (cat && has(n, ["עבור", "תעבור", "לך", "פתח", "תפתח", "תראה", "מחלקת", "מה יש", "מה יש ב", "תקריא", "הקרא", "קרא", "מוצרים"])) {
    const isRead = has(n, ["מה יש", "תקריא", "הקרא", "קרא", "מה יש ב", "אילו", "איזה", "מוצרים"]);
    return { type: isRead ? "read_category" : "goto_category", category: cat };
  }

  let type = null;
  let start = 0;
  // A verb may be two words ("הוסף עוד", "אני רוצה"), so look at the first two.
  for (let k = 0; k < Math.min(2, words.length); k++) {
    const w = words[k];
    for (const t of ["remove", "set", "inc", "dec", "add"]) {
      if (V[t].has(w)) {
        if (!type || (type === "add" && t !== "add")) type = t;
        start = k + 1;
      }
    }
    if (!type) break;
  }
  const tokens = words.slice(start);
  const chunks = splitChunks(tokens, products).map((c) => readChunk(c, products)).filter((c) => c.query);
  if (!chunks.length) return { type: "unknown" };
  if (!type) type = chunks.some((c) => c.explicitSet) ? "set" : "add";
  return { type, items: chunks };
}

const qtyOf = (it) => {
  const q = parseInt(it.qty, 10);
  return Number.isFinite(q) && q > 0 ? q : 1;
};

// Says "3 עגבניות שרי" / "2 קילו שוק הודו" / "שוק הודו, 2 קילו ו-3 יחידות".
export function speakItem(it) {
  const q = qtyOf(it);
  if (it.kg > 0) return q > 1 ? `${it.name}, ${it.kg} קילו, ${q} יחידות` : `${it.kg} קילו ${it.name}`;
  return q > 1 ? `${q} ${it.name}` : `${it.name}, יחידה אחת`;
}

// Applies one resolved add/remove/set/inc/dec op to the list.
// op: { type, product: { name, category }, qty, kg }. Returns { next, say }.
export function applyOp(items, op, makeItem, { maxQty = 20, maxKg = 10, kgCategory = "meat" } = {}) {
  const name = op.product.name.trim();
  const idx = items.findIndex((it) => it.name.trim() === name && !it.done);
  const existing = idx >= 0 ? items[idx] : null;
  const clampQ = (n) => Math.min(maxQty, Math.max(0, n));
  const kgOk = op.product.category === kgCategory;
  let kgNote = "";
  if (op.kg != null && !kgOk) kgNote = ` קילו אפשר לבחור רק בבשר ודגים, אז רשמתי ${op.kg} יחידות.`;
  const wantQty = op.kg != null && !kgOk ? op.kg : op.qty;
  const wantKg = op.kg != null && kgOk ? Math.min(maxKg, Math.max(0, op.kg)) : null;
  const replace = (it) => items.map((x, i) => (i === idx ? it : x));

  if (op.type === "remove") {
    if (!existing) return { next: items, say: `${name} לא נמצא ברשימה.` };
    return { next: items.filter((_, i) => i !== idx), say: `הורדתי ${name} מהרשימה.` };
  }
  if (op.type === "inc" || op.type === "dec") {
    const step = wantQty || 1;
    if (op.type === "dec") {
      if (!existing) return { next: items, say: `${name} לא נמצא ברשימה.` };
      const left = qtyOf(existing) - step;
      if (left <= 0) return { next: items.filter((_, i) => i !== idx), say: `הורדתי ${name} מהרשימה.` };
      return { next: replace({ ...existing, qty: String(left) }), say: `הורדתי. עכשיו ${left} ${name}.` };
    }
    if (!existing) {
      const q = clampQ(step) || 1;
      const it = makeItem(name, op.product.category, String(q));
      return { next: [it, ...items], say: `הוספתי ${speakItem(it)}.` };
    }
    const q = clampQ(qtyOf(existing) + step);
    return { next: replace({ ...existing, qty: String(q) }), say: `הוספתי. עכשיו ${q} ${name}.` };
  }
  if (op.type === "set") {
    if (wantQty === 0 && wantKg == null) {
      if (!existing) return { next: items, say: `${name} לא נמצא ברשימה.` };
      return { next: items.filter((_, i) => i !== idx), say: `הורדתי ${name} מהרשימה.` };
    }
    const base = existing || makeItem(name, op.product.category, "1");
    const upd = { ...base };
    if (wantQty != null) upd.qty = String(clampQ(wantQty) || 1);
    if (wantKg != null) upd.kg = wantKg;
    const next = existing ? replace(upd) : [upd, ...items];
    return { next, say: `עדכנתי: ${speakItem(upd)}.${kgNote}` };
  }
  // add
  if (existing) {
    const upd = { ...existing };
    if (wantKg != null) upd.kg = wantKg;
    if (wantQty != null) upd.qty = String(clampQ(wantKg != null ? wantQty : qtyOf(existing) + wantQty) || 1);
    else if (wantKg == null) upd.qty = String(clampQ(qtyOf(existing) + 1));
    return { next: replace(upd), say: `${name} כבר היה ברשימה. עכשיו: ${speakItem(upd)}.${kgNote}` };
  }
  const it = makeItem(name, op.product.category, String(clampQ(wantQty || 1) || 1));
  if (wantKg != null) it.kg = wantKg;
  return { next: [it, ...items], say: `הוספתי ${speakItem(it)}.${kgNote}` };
}

export const VOICE_HELP =
  "אפשר לומר למשל: תוסיף 2 עגבניות שרי. או: 2 קילו שוק הודו. " +
  "כדי לשנות כמות: תשנה מלפפונים ל-4. או: עוד חלב, פחות חלב. " +
  "כדי להוריד: תוריד גבינה. " +
  "כדי לשמוע: מה ברשימה, או: מה יש בבשר ודגים, או: כמה עגבניות. " +
  "כדי לעבור לשונית אומרים את שמה, למשל: בשר ודגים, או: מוצרי חלב. ועוד: מה יש כאן, סיכום, רשימות קודמות, מוצר חדש, ייבוא, חזור, שמור, רשימה חדשה, שלח במייל, שלח בוואטסאפ. " +
  "כדי לסיים אמרו: עצור.";
