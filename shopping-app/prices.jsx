// Estimated prices beside each product's quantity, from Pulitzer receipts.
// RECEIPT_PRICES grows as more receipts come in. A price the family types in
// (tap the price) is kept in PRICES_KEY, shared with the family, and wins over the
// receipt price; clearing it brings the receipt price back.
// Unit: "k" = per kilo, "u" = per unit. Prices are not added to the emailed list.
import React, { useState, useEffect } from "react";

export const PRICES_KEY = "family-shopping-list-price-overrides";

// Receipts: Pulitzer Karkur 10/11/26 and 11/11/26.
export const RECEIPT_PRICES = {
  "עגבניות טריות": [11.9, "k"], "בצל ירוק": [5.9, "u"], "בצלים גדולים": [5.9, "k"],
  "קישואים / זוקיני": [11.9, "k"], "חצילים": [8.9, "k"], "פלפלים חריפים": [9.9, "k"],
  "כוסברה טרייה": [3.9, "u"], "פטרוזיליה טרייה": [3.9, "u"], "שמיר טרי": [3.9, "u"],
  "קולורבי": [6.9, "k"], "דלעת": [12.9, "k"], "פטריות": [23.5, "u"], "לימונים צהובים": [9.9, "k"],
  "בננות": [9.9, "k"], "תפוחי פינק ליידי": [12.9, "k"], "ענבי תלמי": [24.9, "k"], "אפרסמון": [16.9, "k"],
  "חלב תנובה": [7.35, "u"], "יוגורט דנונה פרו 20": [6.5, "u"], "קוטג' 5%": [6.1, "u"],
  "גבינת 5% לבנה": [11.74, "u"], "גבינת עיזים": [175, "k"], "קרם קוקוס": [11.5, "u"], "ביצים L": [14.54, "u"],
  "שוק הודו מפורק טחון": [59.9, "k"], "סטייק פרגית": [56.9, "k"], "פילה עוף": [41.9, "k"],
  "גרונות הודו": [36.9, "k"], "עצמות מח": [75, "k"],
  "רוטב סויה קיקומן": [21.9, "u"], "אורז בסמטי": [14.6, "u"], "מלח": [2, "u"],
  "מוטי עגבניות מרוסקות": [21.9, "u"], "קטשופ אוסם": [10.9, "u"],
};

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
  return overrides[k] || RECEIPT_PRICES[k] || null;
}

const fmt = (n) => (Math.round(n * 100) / 100).toFixed(2);

export function PriceTag({ name }) {
  const key = String(name || "").trim();
  const [ov, setOv] = useState(overrides);
  const [draft, setDraft] = useState(null);
  const [unit, setUnit] = useState("u");
  useEffect(() => { ensureLoaded(); subs.add(setOv); return () => subs.delete(setOv); }, []);
  const own = ov[key];
  const p = own || RECEIPT_PRICES[key] || null;

  const start = () => { setDraft(p ? String(p[0]) : ""); setUnit(p ? p[1] : "u"); };
  const commit = () => {
    if (draft === null) return;
    const v = parseFloat(String(draft).replace(",", "."));
    setDraft(null);
    if (!draft.trim()) { if (own) savePrice(key, null); return; }
    if (!Number.isFinite(v) || v <= 0) return;
    const r = RECEIPT_PRICES[key];
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
      title={own ? "מחיר משוער שהוקלד ידנית (לחיצה לעריכה)" : "מחיר משוער לפי קבלות פוליצר (לחיצה לעריכה)"}
      aria-label={`מחיר משוער ${fmt(p[0])} שקלים ${p[1] === "k" ? "לקילו" : "ליחידה"}, לחיצה לעריכה`}
      style={{ ...box, background: "#3E7C5912", outline: own ? "1px dashed #3E7C59" : "none" }}
    >
      <span style={{ fontSize: "0.76rem", fontWeight: 700 }}>≈₪{fmt(p[0])}</span>
      <span style={{ fontSize: "0.56rem", color: "#7C8574" }}>משוער {p[1] === "k" ? "לק״ג" : "ליח׳"}</span>
    </button>
  );
}
