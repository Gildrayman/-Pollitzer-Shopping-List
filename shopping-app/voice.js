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

// "תוסיף/תעלה 3 X" adds 3 to the amount already on the list; "תוריד 2 X" takes 2 off it
// (1 when no number is said); "תמחק/תבטל X" sets it to zero; "X 3" alone sets it to 3.
const VERBS = {
  add: ["תכניס", "הכנס", "תכניסי", "תשים", "שים", "תשימי", "תביא", "תביאי", "רוצה", "רוצים", "צריך", "צריכה", "צריכים", "קנה", "תקנה", "תקני", "תרשום", "רשום", "תרשמי", "הזמן", "תזמין", "אני", "גם"],
  remove: ["תמחק", "מחק", "למחוק", "תמחקי", "תמחוק", "תמחוקי", "תימחק", "הסר", "תסיר", "להסיר", "תסירי", "בטל", "תבטל", "לבטל", "תבטלי", "תבטל את", "אפס", "תאפס", "לאפס", "תאפסי", "בלי"],
  set: ["שנה", "תשנה", "לשנות", "תשני", "עדכן", "תעדכן", "לעדכן", "תעדכני", "קבע", "תקבע", "תקבעי", "כמות"],
  inc: ["הוסף", "תוסיף", "תוסיפי", "להוסיף", "הוסיפי", "תוסף", "עוד", "תגדיל", "הגדל", "להגדיל", "תגדילי", "תעלה", "תעלי", "העלה", "להעלות", "תעלו", "הוסף עוד", "פלוס"],
  dec: ["תוריד", "הורד", "להוריד", "תורידי", "תורידו", "פחות", "תקטין", "הקטן", "להקטין", "תקטיני", "תפחית", "הפחת", "להפחית", "תפחיתי", "תחסיר", "החסר", "להחסיר", "תחסירי", "מינוס"],
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
  // "כמה עגבניות יש ברשימה?", "מה הכמות של חלב סויה?"
  if (has(n, ["כמה"]) || /(^|\s)(ה)?כמות(\s|$)/.test(n) && has(n, ["מה", "תגיד", "תגידי", "כמה"])) {
    const skip = new Set(NORM(["כמה", "יש", "ברשימה", "הזמנתי", "בחרתי", "שמתי", "לי", "מה", "הכמות", "כמות", "של", "את", "תגיד", "תגידי", "לי", "מ", "ממוצר", "מהמוצר", "המוצר", "מוצר", "בסל", "רשמתי", "יחידות", "קילו"]));
    const q = words.filter((w) => !skip.has(w)).join(" ");
    return { type: "ask_qty", query: q };
  }
  // "תוסיף מוצר חדש במבה למחלקת שונות": a new product in the catalog, in the named tab.
  if (has(n, ["מוצר חדש"])) {
    const cat = findCategory(n);
    const filler = new Set(NORM(["תוסיף", "הוסף", "להוסיף", "תוסיפי", "תיצור", "צור", "מוצר", "חדש", "בשם", "שנקרא", "שקוראים", "לו", "ל", "ב", "את", "של", "מחלקת", "למחלקת", "במחלקת", "בקטגוריה", "לקטגוריה", "קטגוריה", "בלשונית", "ללשונית", "לשונית", "בטאב", "לטאב", "טאב", "תחת", "בתוך", "אל"]));
    const catWords = new Set();
    for (const [, ws] of CATEGORY_WORDS) for (const w of ws) for (const t of normHe(w).split(" ")) catWords.add(t);
    const isCatWord = (w) => catWords.has(w) || catWords.has(w.slice(1)) || catWords.has(w.slice(2));
    // The name is what comes before the tab words ("במבה למחלקת שונות"); tab words after it aren't part of it.
    const kept = [];
    let inCat = false;
    for (const w of words) {
      if (/^(ל|ב)?(מחלקת|קטגוריה|לשונית|טאב)$/.test(w) || (cat && isCatWord(w) && /^[לב]/.test(w))) inCat = true;
      if (inCat) continue;
      if (filler.has(w)) continue;
      kept.push(w);
    }
    const name = kept.join(" ");
    if (name || cat) return { type: "new_product", name: prettyHe(name), category: cat };
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

  // Verbs may come anywhere ("עגבניות שרי פחות 1"), so pick them out of the whole sentence.
  const found = new Set();
  const tokens = [];
  for (const w of words) {
    let verb = null;
    for (const t of ["dec", "inc", "remove", "set", "add"]) if (V[t].has(w)) { verb = t; break; }
    if (verb) found.add(verb);
    else tokens.push(w);
  }
  const chunks = splitChunks(tokens, products).map((c) => readChunk(c, products)).filter((c) => c.query);
  if (!chunks.length) return { type: "unknown" };
  const withNumber = chunks.every((c) => c.qty != null || c.kg != null);
  let type;
  if (chunks.some((c) => c.explicitSet) || found.has("set")) type = "set";
  else if (found.has("remove")) type = "remove";
  else if (found.has("dec")) type = "dec";
  else if (found.has("inc")) type = "inc";
  else type = "add";
  return { type, items: chunks };
}

const qtyOf = (it) => {
  const q = parseInt(it.qty, 10);
  return Number.isFinite(q) && q > 0 ? q : 1;
};

// A product has either kilos or units, never both (as the family asked).
// Kilo items keep qty "0". Older items that had both count as kilos unless
// they had more units than kilos.
const isKiloItem = (it) => (it.kg || 0) > 0 && !((parseInt(it.qty, 10) || 0) > it.kg);
export const kgOf = (it) => (isKiloItem(it) ? it.kg : 0);
export const unitsOf = (it) => (isKiloItem(it) ? 0 : qtyOf(it));
// The same product with kilos only / units only.
export const withKg = (it, kg) => ({ ...it, kg, qty: "0" });
export const withUnits = (it, n) => { const { kg, ...rest } = it; return { ...rest, qty: String(n) }; };

// Says "3 עגבניות שרי" / "2 קילו שוק הודו". Like the written list, meat and fish
// say one amount: the units when there are more units than kilos, otherwise the kilos.
export function speakItem(it) {
  if (kgOf(it) > 0) return `${kgOf(it)} קילו ${it.name}`;
  const q = unitsOf(it);
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
  // Meat and fish by weight: "תוסיף 2 קילו שוק" / "תוריד קילו שוק" change the kilos.
  if ((op.type === "inc" || op.type === "dec") && wantKg != null) {
    const sign = op.type === "inc" ? 1 : -1;
    const base = existing || makeItem(name, op.product.category, "0");
    if (!existing && sign < 0) return { next: items, say: `${name} לא נמצא ברשימה.` };
    const kg = Math.min(maxKg, Math.max(0, kgOf(base) + sign * (wantKg || 1)));
    if (kg === 0) return { next: items.filter((_, i) => i !== idx), say: `הורדתי ${name} מהרשימה.` };
    const upd = withKg(base, kg);
    const next = existing ? replace(upd) : [upd, ...items];
    return { next, say: `${sign > 0 ? "הוספתי" : "הורדתי"}. עכשיו ${speakItem(upd)}.` };
  }
  if (op.type === "inc" || op.type === "dec") {
    const step = wantQty || 1;
    if (op.type === "dec") {
      if (!existing) return { next: items, say: `${name} לא נמצא ברשימה.` };
      // A kilo item lowered by a plain number loses that many kilos.
      if (kgOf(existing) > 0) {
        const kg = kgOf(existing) - step;
        if (kg <= 0) return { next: items.filter((_, i) => i !== idx), say: `הורדתי ${name} מהרשימה.` };
        return { next: replace(withKg(existing, kg)), say: `הורדתי. עכשיו ${speakItem(withKg(existing, kg))}.` };
      }
      const left = unitsOf(existing) - step;
      if (left <= 0) return { next: items.filter((_, i) => i !== idx), say: `הורדתי ${name} מהרשימה.` };
      return { next: replace(withUnits(existing, left)), say: `הורדתי. עכשיו ${speakItem(withUnits(existing, left))}.` };
    }
    if (!existing) {
      const q = clampQ(step) || 1;
      const it = makeItem(name, op.product.category, String(q));
      return { next: [it, ...items], say: `הוספתי ${speakItem(it)}.` };
    }
    // Adding units to a kilo item switches it to units (the kilos are cleared).
    const q = clampQ(unitsOf(existing) + step);
    return { next: replace(withUnits(existing, q)), say: `הוספתי. עכשיו ${speakItem(withUnits(existing, q))}.` };
  }
  if (op.type === "set") {
    if (wantQty === 0 && wantKg == null) {
      if (!existing) return { next: items, say: `${name} לא נמצא ברשימה.` };
      return { next: items.filter((_, i) => i !== idx), say: `הורדתי ${name} מהרשימה.` };
    }
    const base = existing || makeItem(name, op.product.category, "1");
    if (wantKg === 0 && wantQty == null) return { next: existing ? items.filter((_, i) => i !== idx) : items, say: existing ? `הורדתי ${name} מהרשימה.` : `${name} לא נמצא ברשימה.` };
    const upd = wantKg ? withKg(base, wantKg) : withUnits(base, clampQ(wantQty == null ? unitsOf(base) : wantQty) || 1);
    const next = existing ? replace(upd) : [upd, ...items];
    return { next, say: `עדכנתי: ${speakItem(upd)}.${kgNote}` };
  }
  // add
  // A product already on the list takes the amount just said, higher or lower ("עגבניות 1" after 3 gives 1).
  if (existing) {
    let upd;
    if (wantKg) upd = withKg(existing, wantKg);
    else if (wantQty != null) upd = withUnits(existing, clampQ(wantQty) || 1);
    else upd = withUnits(existing, clampQ(unitsOf(existing) + 1));
    return { next: replace(upd), say: `עדכנתי: ${speakItem(upd)}.${kgNote}` };
  }
  const fresh = makeItem(name, op.product.category, "1");
  const it = wantKg ? withKg(fresh, wantKg) : withUnits(fresh, clampQ(wantQty || 1) || 1);
  return { next: [it, ...items], say: `הוספתי ${speakItem(it)}.${kgNote}` };
}

export const VOICE_HELP =
  "אפשר לומר למשל: תוסיף 2 עגבניות שרי. או: 2 קילו שוק הודו. " +
  "כדי לשנות כמות: תוסיף 3 עגבניות שרי, או תעלה 2 חלב, מוסיף לכמות שכבר יש. תוריד 2 חלב מחסיר. תשנה מלפפונים ל-4 קובע. " +
  "כדי למחוק מוצר: תמחק גבינה, או תבטל גבינה. " +
  "כדי לשמוע: מה ברשימה, או: מה יש בבשר ודגים, או: מה הכמות של עגבניות שרי. כדי להוסיף מוצר חדש למחלקה: מוצר חדש במבה למחלקת שונות. " +
  "כדי לעבור לשונית אומרים את שמה, למשל: בשר ודגים, או: מוצרי חלב. ועוד: מה יש כאן, סיכום, רשימות קודמות, מוצר חדש, ייבוא, חזור, שמור, רשימה חדשה, שלח במייל, שלח בוואטסאפ. " +
  "כדי לסיים אמרו: עצור.";
