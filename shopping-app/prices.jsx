// Estimated prices beside each product's quantity.
// The store prices come from Pulitzer's official price-transparency files for the
// Karkur branch, refreshed every night at midnight by .github/workflows/prices.yml
// into prices.json (read from GitHub so a new night's prices need no app release).
// A price the family types in (tap the price) is kept in PRICES_KEY, shared with
// the family, and wins over the store price; clearing it brings the store price back.
// Unit: "k" = per kilo, "u" = per unit. A third number, when there, is the typical
// kilos of one unit (medium piece or usual pack), for TotalTag's estimate. Prices are not added to the emailed list.
import React, { useState, useEffect } from "react";

export const PRICES_KEY = "family-shopping-list-price-overrides";
const PRICES_URL = "https://raw.githubusercontent.com/Gildrayman/-Pollitzer-Shopping-List/main/prices.json";

let store = { updated: "", prices: {} };
let storeLoaded = false;
const storeSubs = new Set();
async function loadStore() {
  try {
    const r = await fetch(`${PRICES_URL}?t=${Math.floor(Date.now() / 600000)}`, { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      if (j && j.prices) store = { updated: j.updated || "", prices: j.prices };
      storeSubs.forEach((f) => f(store));
    }
  } catch { /* offline: keep what we have */ }
}
function ensureStore() {
  if (storeLoaded) return;
  storeLoaded = true;
  loadStore();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") loadStore(); });
}
function useStore() {
  const [s, set] = useState(store);
  useEffect(() => { ensureStore(); storeSubs.add(set); set(store); return () => storeSubs.delete(set); }, []);
  return s;
}

// "מעודכן ל-11.11.2026": when the store prices were last refreshed.
export function PricesUpdated({ style }) {
  const s = useStore();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.updated || "");
  if (!m) return null;
  return <div style={style} aria-hidden="true">מעודכן ל-{`${m[3]}.${m[2]}.${m[1]}`}</div>;
}

const FINALS = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };
const STOP = new Set(["של", "עם", "ב", "ו", "ל", "גר", "גרם", "קג", "מל", "ליטר", "יח", "ישראלי", "ישראל", "טרי", "טריים", "טרייה", "טריה"]);
function rawToks(s) {
  return String(s || "").replace(/[״"'׳`’]/g, "").replace(/[()\/\-.,+%*:]/g, " ").toLowerCase().split(/\s+/).filter(Boolean);
}
function toks(s) {
  return String(s || "").replace(/[״"'׳`’]/g, "").replace(/[()\/\-.,+%*:]/g, " ").toLowerCase()
    .split(/\s+/).filter(Boolean)
    .map((t) => t.replace(/[ךםןףץ]/g, (c) => FINALS[c]))
    .map((t) => (t.length > 3 ? t.replace(/(יות|ימ|ות|יה|ה)$/, "") : t))
    .filter((t) => t && !STOP.has(t) && !/^\d+$/.test(t));
}
// 1 = same word, 0.4 = one starts with the other (plural/ending), 0 = different.
function same(a, b) {
  if (a === b) return 1;
  return a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a)) ? 0.4 : 0;
}
// Best store item for a product name the family typed: every word must appear in the
// item's name; among those, the item whose name has the fewest other words wins,
// with a bonus when it starts with the same word.
function bestMatch(name, index) {
  const q = toks(name);
  if (!q.length) return null;
  const q0 = rawToks(name)[0];
  let best = null, bestScore = -1;
  for (const it of index) {
    const t = it.t;
    let sum = 0, ok = true;
    for (const w of q) {
      let b = 0;
      for (const x of t) b = Math.max(b, same(w, x));
      if (!b) { ok = false; break; }
      sum += b;
    }
    if (!ok) continue;
    // Ties: the item whose first word is exactly the first word typed, then the shorter name.
    const score = sum / t.length + 0.5 * same(q[0], t[0]) + (it.r0 === q0 ? 0.1 : 0) - it.n.length / 1000;
    if (score > bestScore) { bestScore = score; best = it; }
  }
  return best;
}


// Products the family added by hand are not in mapping.json: they are matched by name
// against every item of the branch (prices/all.json), and the best match's price is used.
// A per-kilo match without a known weight per unit is estimated at DEFAULT_UNIT_KG.
const ALL_URL = "https://raw.githubusercontent.com/Gildrayman/-Pollitzer-Shopping-List/main/prices/all.json";
const DEFAULT_UNIT_KG = 0.2;
let allIndex = null;
let allLoading = false;
const guessCache = new Map();
async function loadAll() {
  if (allLoading) return;
  allLoading = true;
  try {
    const r = await fetch(`${ALL_URL}?t=${Math.floor(Date.now() / 3600000)}`, { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      allIndex = (j.items || []).map(([n, p, w]) => ({ n, p, w, t: toks(n), r0: rawToks(n)[0] }));
      guessCache.clear();
      storeSubs.forEach((f) => f({ ...store }));
    }
  } catch { /* offline */ }
  allLoading = false;
}
// [price, unit, kilos per unit, store item name] for a hand-added product, or null.
function guessPrice(key) {
  if (!key) return null;
  if (!allIndex) { loadAll(); return null; }
  if (guessCache.has(key)) return guessCache.get(key);
  const m = bestMatch(key, allIndex);
  const g = m ? (m.w ? [m.p, "k", DEFAULT_UNIT_KG, m.n] : [m.p, "u", 0, m.n]) : null;
  guessCache.set(key, g);
  return g;
}

let overrides = {};
let loaded = false;
const subs = new Set();
const emit = () => subs.forEach((f) => f({ ...overrides }));
async function load() {
  try {
    const r = await window.storage.get(PRICES_KEY, true);
    overrides = r && r.value ? JSON.parse(r.value) || {} : {};
  } catch { /* keep what we have */ }
  emit();
}
function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  load();
  window.addEventListener("family-sync", (e) => {
    const keys = (e.detail && e.detail.keys) || [];
    if (!keys.length || keys.includes(PRICES_KEY)) load();
  });
}
async function savePrice(name, entry) {
  const next = { ...overrides };
  if (entry) next[name] = entry; else delete next[name];
  overrides = next;
  emit();
  try { await window.storage.set(PRICES_KEY, JSON.stringify(next), true); } catch (e) { console.error("שגיאת שמירה", e); }
}

export function priceOf(name) {
  const k = String(name || "").trim();
  return overrides[k] || store.prices[k] || guessPrice(k);
}

const fmt = (n) => (Math.round(n * 100) / 100).toFixed(2);

export function PriceTag({ name }) {
  const key = String(name || "").trim();
  const [ov, setOv] = useState(overrides);
  const [draft, setDraft] = useState(null);
  const [unit, setUnit] = useState("u");
  const st = useStore();
  useEffect(() => { ensureLoaded(); subs.add(setOv); return () => subs.delete(setOv); }, []);
  const own = ov[key];
  const auto = st.prices[key] || guessPrice(key);
  const p = own || auto || null;

  const start = () => { setDraft(p ? String(p[0]) : ""); setUnit(p ? p[1] : "u"); };
  const commit = () => {
    if (draft === null) return;
    const v = parseFloat(String(draft).replace(",", "."));
    setDraft(null);
    if (!draft.trim()) { if (own) savePrice(key, null); return; }
    if (!Number.isFinite(v) || v <= 0) return;
    const r = auto;
    if (r && r[0] === v && r[1] === unit) { if (own) savePrice(key, null); return; }
    savePrice(key, [v, unit]);
  };

  const box = { flex: "0 0 54px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1.1, padding: "3px 2px", borderRadius: 8, fontFamily: "'Heebo', sans-serif", cursor: "pointer", border: "none", background: "transparent", color: "#3E7C59" };

  if (draft !== null) {
    return (
      <span className="pr-price" style={{ ...box, gap: 2, cursor: "default" }}>
        <input
          autoFocus type="text" inputMode="decimal" value={draft} placeholder="₪"
          onChange={(e) => setDraft(e.target.value.replace(/[^\d.,]/g, "").slice(0, 7))}
          onBlur={commit} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          aria-label={`מחיר משוער של ${key}`}
          style={{ width: 52, height: 24, textAlign: "center", border: "1px solid #3E7C59", borderRadius: 6, fontSize: 16, padding: 0, boxSizing: "border-box", color: "#243026", background: "#FFFFFF" }}
        />
        <button
          type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setUnit(unit === "k" ? "u" : "k")}
          style={{ border: "1px solid #24302633", borderRadius: 6, background: "#FFFFFF", color: "#4B5347", fontSize: "0.62rem", padding: "1px 4px", cursor: "pointer" }}
        >
          {unit === "k" ? "לק״ג ⇄" : "ליח׳ ⇄"}
        </button>
      </span>
    );
  }

  if (!p) {
    return (
      <button type="button" className="pr-price" onClick={start} style={{ ...box, color: "#B5BBAF" }} aria-label={`הוסף מחיר משוער ל${key}`}>
        <span style={{ fontSize: "0.72rem" }}>+ ₪</span>
        <span style={{ fontSize: "0.56rem" }}>מחיר</span>
      </button>
    );
  }
  return (
    <button
      type="button" className="pr-price" onClick={start}
      title={own ? "מחיר משוער שהוקלד ידנית (לחיצה לעריכה)" : p[3] ? `מחיר של "${p[3]}" בפוליצר כרכור, נמצא לפי השם (לחיצה לעריכה)` : "מחיר לפי מחירון פוליצר כרכור (לחיצה לעריכה)"}
      aria-label={`מחיר משוער ${fmt(p[0])} שקלים ${p[1] === "k" ? "לקילו" : "ליחידה"}, לחיצה לעריכה`}
      style={{ ...box, background: "#3E7C5912", outline: own ? "1px dashed #3E7C59" : "none" }}
    >
      <span style={{ fontSize: "0.76rem", fontWeight: 700 }}>₪{fmt(p[0])}</span>
      <span style={{ fontSize: "0.56rem", color: "#7C8574" }}>{p[1] === "k" ? "לק״ג" : "ליח׳"}</span>
    </button>
  );
}

// Total for one row, not editable: units x unit price, or kilos x kilo price. A per-kilo
// product chosen by units is estimated with its typical weight per unit ("סה״כ משוער").
export function rowTotal(name, units, kg) {
  const key = String(name || "").trim();
  const own = overrides[key];
  const st = store.prices[key] || guessPrice(key);
  const p = own || st;
  if (!p) return null;
  const unitKg = (p.length > 2 && p[2]) || (st && st[2]) || 0;
  const [price, unit] = p;
  if (kg > 0) {
    if (unit === "k") return { sum: kg * price, est: false };
    if (unitKg) return { sum: (kg / unitKg) * price, est: true };
    return null;
  }
  if (units > 0) {
    if (unit === "u") return { sum: units * price, est: false };
    if (unitKg) return { sum: units * unitKg * price, est: true };
    return null;
  }
  return { sum: 0, est: false };
}

export function TotalTag({ name, units = 0, kg = 0 }) {
  useStore();
  const [, setOv] = useState(overrides);
  useEffect(() => { ensureLoaded(); subs.add(setOv); return () => subs.delete(setOv); }, []);
  const t = rowTotal(name, units, kg);
  const box = { flex: "0 0 50px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1.1, fontFamily: "'Heebo', sans-serif", color: "#243026" };
  if (!t || !(t.sum > 0)) return <span className="pr-total" style={{ ...box, color: "#B5BBAF", fontSize: "0.72rem" }} aria-hidden="true">—</span>;
  return (
    <span className="pr-total" style={box} aria-label={`${t.est ? "סך הכל משוער" : "סך הכל"} ${fmt(t.sum)} שקלים`}>
      <span style={{ fontSize: "0.78rem", fontWeight: 700 }}>₪{fmt(t.sum)}</span>
      <span style={{ fontSize: "0.56rem", color: "#7C8574" }}>{t.est ? "סה״כ משוער" : "סה״כ"}</span>
    </span>
  );
}

// Price, then the total to its left (the row reads right to left: name, amount, price,
// total). In meat and fish, which also has a kilo stepper, they stack in one column
// (price above total) so the row still fits a phone.
export function PriceCell({ name, units = 0, kg = 0, stack = false }) {
  if (!stack) return <><PriceTag name={name} /><TotalTag name={name} units={units} kg={kg} /></>;
  return (
    <span style={{ flex: "0 0 54px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <span style={{ display: "flex" }}><PriceTag name={name} /></span>
      <span style={{ display: "flex" }}><TotalTag name={name} units={units} kg={kg} /></span>
    </span>
  );
}

// Empty space the width of PriceCell, for rows that have none (the add-by-hand row),
// so the amount columns line up.
export function PriceCellSpace({ stack = false }) {
  return <span className="pr-space" style={{ flex: `0 0 ${stack ? 54 : 114}px` }} aria-hidden="true" />;
}
