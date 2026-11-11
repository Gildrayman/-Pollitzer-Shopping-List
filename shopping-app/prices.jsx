// Estimated prices beside each product's quantity.
// The store prices come from Pulitzer's official price-transparency files for the
// Karkur branch, refreshed every night at midnight by .github/workflows/prices.yml
// into prices.json (read from GitHub so a new night's prices need no app release).
// A price the family types in (tap the price) is kept in PRICES_KEY, shared with
// the family, and wins over the store price; clearing it brings the store price back.
// Unit: "k" = per kilo, "u" = per unit. Prices are not added to the emailed list.
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
  return overrides[k] || store.prices[k] || null;
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
  const p = own || st.prices[key] || null;

  const start = () => { setDraft(p ? String(p[0]) : ""); setUnit(p ? p[1] : "u"); };
  const commit = () => {
    if (draft === null) return;
    const v = parseFloat(String(draft).replace(",", "."));
    setDraft(null);
    if (!draft.trim()) { if (own) savePrice(key, null); return; }
    if (!Number.isFinite(v) || v <= 0) return;
    const r = st.prices[key];
    if (r && r[0] === v && r[1] === unit) { if (own) savePrice(key, null); return; }
    savePrice(key, [v, unit]);
  };

  const box = { flex: "0 0 54px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1.1, padding: "3px 2px", borderRadius: 8, fontFamily: "'Heebo', sans-serif", cursor: "pointer", border: "none", background: "transparent", color: "#3E7C59" };

  if (draft !== null) {
    return (
      <span style={{ ...box, gap: 2, cursor: "default" }}>
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
      <button type="button" onClick={start} style={{ ...box, color: "#B5BBAF" }} aria-label={`הוסף מחיר משוער ל${key}`}>
        <span style={{ fontSize: "0.72rem" }}>+ ₪</span>
        <span style={{ fontSize: "0.56rem" }}>מחיר</span>
      </button>
    );
  }
  return (
    <button
      type="button" onClick={start}
      title={own ? "מחיר משוער שהוקלד ידנית (לחיצה לעריכה)" : "מחיר משוער לפי מחירון פוליצר כרכור (לחיצה לעריכה)"}
      aria-label={`מחיר משוער ${fmt(p[0])} שקלים ${p[1] === "k" ? "לקילו" : "ליחידה"}, לחיצה לעריכה`}
      style={{ ...box, background: "#3E7C5912", outline: own ? "1px dashed #3E7C59" : "none" }}
    >
      <span style={{ fontSize: "0.76rem", fontWeight: 700 }}>≈₪{fmt(p[0])}</span>
      <span style={{ fontSize: "0.56rem", color: "#7C8574" }}>משוער {p[1] === "k" ? "לק״ג" : "ליח׳"}</span>
    </button>
  );
}
