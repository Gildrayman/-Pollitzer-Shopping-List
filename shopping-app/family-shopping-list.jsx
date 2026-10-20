import React, { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Check, ShoppingBasket, X, Users, Upload, FileText, Eye, ArrowRight, Send, MessageCircle, Save, History, Trash2 } from "lucide-react";

const CATEGORIES = [
  { id: "produce", label: "ירקות ופירות", color: "#8FB996", dark: "#4E7A5C" },
  { id: "dairy", label: "מוצרי חלב", color: "#6F9EBF", dark: "#3F6C8C" },
  { id: "frozen", label: "קפואים", color: "#7EC8C0", dark: "#43897F" },
  { id: "meat", label: "בשר ודגים", color: "#C1554B", dark: "#8C3931" },
  { id: "bakery", label: "מאפים", color: "#E8935A", dark: "#B8683A" },
  { id: "pantry", label: "מזווה ויבשים", color: "#D4A94A", dark: "#A6812F" },
  { id: "household", label: "ניקיון ובית", color: "#8FA6C9", dark: "#556F94" },
  { id: "other", label: "שונות", color: "#B7A8C9", dark: "#7E6C95" },
];

const catInfo = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

// Catalog curated from the family's own WhatsApp group ("קניות משפחת דריימן - פוליצר") —
// only products that actually appear there, with their notes/descriptions from the messages.
const COMMON_ITEMS = {
  produce: [
    { name: "עגבניות טריות", note: "טריות ולא פגומות" },
    { name: "עגבניות שרי", note: "אריזת פלסטיק" },
    { name: "מלפפונים טריים", note: "" },
    { name: "בצל ירוק", note: "" },
    { name: "בצלים גדולים", note: "לא פגומים" },
    { name: "גזר", note: "חבילה" },
    { name: "קישואים / זוקיני", note: "בינוניים וטריים" },
    { name: "חצילים", note: "יפים וטריים" },
    { name: "פלפלים אדומים", note: "קטנים/בינוניים" },
    { name: "פלפלים חריפים", note: "ירוקים" },
    { name: "חסה רומית", note: "בכור" },
    { name: "חסה לליק", note: "" },
    { name: "רוקט / רוקולה", note: "" },
    { name: "כוסברה טרייה", note: "לא ארוזה (אם אין אז ארוזה)" },
    { name: "פטרוזיליה טרייה", note: "לא ארוזה (אם אין אז ארוזה)" },
    { name: "שמיר טרי", note: "לא ארוז (אם אין אז ארוז)" },
    { name: "אפונת שלג", note: "טריה, בשקית" },
    { name: "במיה טריה", note: "בשקית" },
    { name: "קולורבי", note: "בינוניים" },
    { name: "בטטות", note: "" },
    { name: "סלק", note: "גדול" },
    { name: "שום קלוף", note: "בקופסת פלסטיק" },
    { name: "דלעת", note: "חתיכה, לא גדולה" },
    { name: "סלרי", note: "גבעולים נקיים ושטופים" },
    { name: "פטריות", note: "מארז כפול שמפניון ופורטבלו" },
    { name: "לימונים צהובים", note: "טריים ויפים" },
    { name: "אבטיח", note: "גדול, רק אם טרי" },
    { name: "בננות", note: "" },
    { name: "תפוחי פינק ליידי", note: "אדומים" },
    { name: "אפרסקים", note: "קשים" },
    { name: "ענבי תלמי", note: "קטנים וקשים" },
    { name: "אפרסמון", note: "" },
    { name: "תמרים מגעול", note: "אריזה שקופה פוליצר" },
    { name: "פקאנים קלופים", note: "אריזת פלסטיק פוליצר" },
    { name: "תרד בייבי", note: "שטוף, בשקיות" },
  ],
  dairy: [
    { name: "חלב תנובה", note: "2 ליטר 3% (אם אין אז 4 של 1 ליטר)" },
    { name: "חלב סויה", note: "ללא סוכר" },
    { name: "דנונה אקטיביה", note: "פרוביוטי אפרסק (אם אין אז תות)" },
    { name: "יוגורט דנונה פרו 20", note: "1.5%, ללא טעמים (ירוק)" },
    { name: "יוגורט ביו דנונה", note: "1.5%" },
    { name: "קוטג' 5%", note: "תנובה" },
    { name: "גבינת 5% לבנה", note: "שטראוס סקי" },
    { name: "לבנה", note: "5% או 9%, שטראוס" },
    { name: "גבינת עיזים", note: "300 גר', טרייה מהמעדנייה" },
    { name: "גבינה צפתית", note: "עם קצח, במשקל" },
    { name: "גבינה בולגרית", note: "עיזים, במשקל" },
    { name: "גבינת פטה", note: "עיזים, במשקל" },
    { name: "גבינה צהובה (גבנ״צ)", note: "200 גרם, מהמעדנייה" },
    { name: "קרם קוקוס", note: "פחית שימורים (אם אין אז קופסה)" },
    { name: "ביצים L", note: "אריזה של 12" },
  ],
  frozen: [
    { name: "ברוקולי סנפרוסט", note: "קפוא" },
    { name: "שעועית ירוקה עדינה", note: "סנפרוסט" },
    { name: "אפונה עדינה", note: "סנפרוסט בלבד" },
    { name: "כרוב ניצנים", note: "קפוא" },
    { name: "פלפל חריף ירוק", note: "קפוא" },
  ],
  meat: [
    { name: "שוק הודו מפורק טחון", note: "טרי, מחולק ל-2" },
    { name: "סטייק פרגית", note: "נקי מעור, גידים ועצמות" },
    { name: "פילה עוף", note: "נתחים חתוכים" },
    { name: "גרונות הודו", note: "חתוכים" },
    { name: "עצמות מח", note: "חבילה קפואה או 6 עצמות טריות" },
    { name: "בשר בקר טחון", note: "עם מעט שומן כבש" },
    { name: "שניצלים", note: "טריים" },
    { name: "פילה דג ברמונדי", note: "חתיכות" },
    { name: "דגים מפולטים", note: "ברמונדי, ואם אין אז בס" },
    { name: "סלמון טרי", note: "כ-1.5 ק״ג" },
  ],
  bakery: [
    { name: "פיתות כוסמין", note: "" },
    { name: "לחמניות קמח מלא", note: "" },
    { name: "לחם כוסמין מלא", note: "מהמאפייה במושבה" },
  ],
  pantry: [
    { name: "רוטב סויה קיקומן", note: "בקבוק גדול" },
    { name: "אורז בסמטי", note: "" },
    { name: "טחינה מלאה", note: "הר ברכה, אריזת קילו" },
    { name: "טחינה רגילה", note: "הר ברכה, אריזת קילו" },
    { name: "חמאת בוטנים", note: "צנצנת זכוכית / אורגנית פלסטיק" },
    { name: "שמן זית", note: "ליטר (אם אין אז 750 מ״ל)" },
    { name: "סוכר", note: "שקית קילו, סוגת" },
    { name: "מלח", note: "שולחן / גס, שקית קילו" },
    { name: "מוטי עגבניות מרוסקות", note: "אריזה של 3" },
    { name: "קטשופ אוסם", note: "מופחת סוכר" },
    { name: "מיונז תלמה", note: "קטן" },
    { name: "דבש חורש", note: "צנצנת גדולה" },
    { name: "קפה טורקי עלית", note: "שקיות" },
    { name: "אובלטים", note: "" },
    { name: "חטיפי חלבון", note: "און אין, טעמים שונים" },
    { name: "שוקולד מריר", note: "ריטר / סלים דליס עם תפוז" },
    { name: "פרומי/פרוני מצופה", note: "פטל, שוקולד מריר" },
    { name: "קורנפלקס אלופים", note: "עם דבש" },
    { name: "ברנפלקס", note: "" },
    { name: "פופקורן", note: "גרעיני תירס, סוגת" },
    { name: "מגנום פיסטוק", note: "קטנים" },
    { name: "חרדל דיז׳ון", note: "גרגרים, צרפתי" },
    { name: "רוטב בלסמי", note: "איטלקי, אריזה בינונית-גדולה" },
    { name: "אבקת מרק עוף", note: "ויטה" },
    { name: "קוקוס טחון", note: "" },
  ],
  household: [
    { name: "אקונומיקה", note: "סנו ז׳אבל" },
    { name: "אבקת כביסה", note: "טייד" },
    { name: "מרכך כביסה", note: "מקסימה, CALM" },
    { name: "פלמוליב", note: "סבון נוזל לכלים" },
    { name: "סנו לניקוי רצפות", note: "Green Power" },
    { name: "ספריי אנטי קאלק", note: "" },
    { name: "פוליויקס לרצפות", note: "" },
    { name: "נייר טואלט", note: "3 שכבות" },
    { name: "קסמיות אוזניים", note: "איכות גבוהה" },
    { name: "משחת שיניים", note: "פרודונטקס רגילה" },
    { name: "שמפו שמן מרוקאי", note: "" },
    { name: "תחליב רחצה", note: "שמן מרוקאי" },
    { name: "סנו לניקוי אסלות", note: "" },
    { name: "ספוג לכלים", note: "סנו, חזק" },
    { name: "סמרטוטי רצפה", note: "סנו" },
  ],
  other: [],
};


const STORAGE_KEY = "family-shopping-list-items";
const SUMMARY_KEY = "family-shopping-list-summary-text";
const SAVED_KEY = "family-shopping-list-saved-lists";
const CUSTOM_KEY = "family-shopping-list-custom-products";
export const NAME_KEY = "family-shopping-list-member-name";
const NOTES_KEY = "family-shopping-list-note-overrides";
const NAMES_KEY = "family-shopping-list-name-overrides";
const CURRENT_KEY = "family-shopping-list-current-saved-id";

// window.storage exists only inside Claude.ai. Anywhere else, fall back to this
// device's localStorage so the app still opens; lists are then not shared
// between family members until a real shared backend replaces it.
if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key) {
      const value = window.localStorage.getItem(key);
      if (value === null) throw new Error("not found: " + key);
      return { key, value };
    },
    async set(key, value) {
      window.localStorage.setItem(key, value);
      return { key, value };
    },
  };
}

export function greetingForHour(h) {
  if (h >= 5 && h < 12) return "בוקר טוב";
  if (h >= 12 && h < 18) return "צהריים טובים";
  if (h >= 18 && h < 22) return "ערב טוב";
  return "לילה טוב";
}

// Quantity control: "+" / "−" buttons, plus a number the user can type directly (0–20).
function QtyStepper({ qty, disabled, onInc, onDec, onSet, max = 20, label = "כמות" }) {
  const [draft, setDraft] = useState(null);
  const shown = draft !== null ? draft : String(qty);

  const commit = () => {
    if (draft === null) return;
    const n = parseInt(draft, 10);
    setDraft(null);
    if (!Number.isFinite(n)) return;
    onSet(Math.min(max, Math.max(0, n)));
  };

  return (
    <div style={styles.stepper}>
      <button
        onClick={onInc}
        disabled={disabled || qty >= max}
        style={{ ...styles.stepperBtn, opacity: disabled || qty >= max ? 0.35 : 1 }}
        aria-label={`הגדל ${label}`}
      >
        +
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={shown}
        disabled={disabled}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 2))}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        style={styles.stepperInput}
        aria-label={label}
      />
      <button
        onClick={onDec}
        disabled={disabled || qty <= 0}
        style={{ ...styles.stepperBtn, opacity: disabled || qty <= 0 ? 0.35 : 1 }}
        aria-label={`הקטן ${label}`}
      >
        −
      </button>
    </div>
  );
}

// Splits a pasted line into the product and its quantity, so "3 עגבניות", "3. עגבניות",
// "2 × חלב", "חלב x2" or "בננות - 4" become a name plus a number. A bare number
// at the end ("דנונה פרו 20") counts only when the rest is a known product, since
// many product names end in a number. The app's own list ("1 × name (note)")
// pastes back too: a trailing "(note)" is dropped when the name without it is known.
function splitImportQty(line, isKnown) {
  // Copied text often carries invisible direction marks and non-breaking spaces.
  let text = line.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "").replace(/\u00a0/g, " ").trim();
  let qty = 1;
  const clamp = (n) => Math.min(20, Math.max(1, n));
  const lead = text.match(/^(\d{1,2})\s*(?:[x×X*.):\-–]|יח['׳]?|יחידות)?\s*(\D.*)$/);
  const marked = text.match(/^(.+?)\s*(?:[-–:]\s*|[x×X*]\s*|\(\s*)(\d{1,2})\s*(?:יח['׳]?|יחידות)?\s*\)?$/);
  const unit = text.match(/^(.+?)\s+(\d{1,2})\s*(?:יח['׳]?|יחידות)$/);
  const bare = text.match(/^(.+?)\s+(\d{1,2})$/);
  if (lead) {
    // A number before the name is always the quantity.
    qty = clamp(parseInt(lead[1], 10));
    text = lead[2].trim();
  } else if (isKnown(text)) {
    // The whole line is a product name as it stands.
  } else if (marked) {
    qty = clamp(parseInt(marked[2], 10));
    text = marked[1].trim();
  } else if (unit) {
    qty = clamp(parseInt(unit[2], 10));
    text = unit[1].trim();
  } else if (bare && isKnown(bare[1].trim())) {
    qty = clamp(parseInt(bare[2], 10));
    text = bare[1].trim();
  }
  if (!isKnown(text) && text.endsWith(")")) {
    for (let i = text.indexOf("("); i > 0; i = text.indexOf("(", i + 1)) {
      const before = text.slice(0, i).trim();
      if (isKnown(before)) { text = before; break; }
    }
  }
  return { text, qty };
}

// Meat and fish can also be ordered by weight: a kilo stepper beside the count.
const KG_CATEGORY = "meat";
const MAX_KG = 10;

function KgStepper({ kg, disabled, onSet }) {
  return (
    <div style={styles.kgWrap}>
      <QtyStepper
        qty={kg}
        max={MAX_KG}
        label="קילו"
        disabled={disabled}
        onInc={() => onSet(Math.min(MAX_KG, kg + 1))}
        onDec={() => onSet(Math.max(0, kg - 1))}
        onSet={onSet}
      />
      <span style={styles.kgLabel}>קילו</span>
    </div>
  );
}

// In meat and fish the count stepper gets a caption too, so it reads apart from the kilos.
function WithUnitsLabel({ show, children }) {
  if (!show) return children;
  return (
    <div style={styles.kgWrap}>
      {children}
      <span style={styles.kgLabel}>יחידות</span>
    </div>
  );
}

// One line of the list as it is sent and saved: "2 × שם (הערה)", or with a weight
// "2 קילו שם (הערה)" (and "3 × 2 קילו שם" when both are set).
// The email leaves out the "×" ("2 שם"), as the family asked (plain = true).
function formatListLine({ qty, kg, name, note }, plain = false) {
  const times = plain ? " " : " × ";
  const weight = kg > 0 ? `${kg} קילו ` : "";
  const count = kg > 0 ? (qty > 1 ? `${qty}${times}` : "") : `${qty}${times}`;
  return `${count}${weight}${name}${note ? ` (${note})` : ""}`;
}

function stripWhatsAppPrefix(line) {
  let s = line.trim();
  s = s.replace(/^\[[^\]]*\]\s*/, "");
  s = s.replace(/^\u200e?\d{1,2}[./]\d{1,2}[./]\d{2,4},?\s*\d{1,2}:\d{2}(:\d{2})?\s*[-–]\s*/, "");
  const colonIdx = s.indexOf(":");
  if (colonIdx > 0 && colonIdx < 28) s = s.slice(colonIdx + 1).trim();
  return s.trim();
}

// Products the family added through the "מוצר חדש" tab. Kept in sync from component state on every render,
// so the helpers below can see them too.
let customCatalog = [];

function guessCategory(text) {
  const t = text.toLowerCase();
  const custom = customCatalog.find((p) => p.name.trim().toLowerCase() === t.trim());
  if (custom) return custom.category;
  for (const [cat, list] of Object.entries(COMMON_ITEMS)) {
    if (list.some((it) => t.includes(it.name.toLowerCase().split(" ")[0]))) return cat;
  }
  return "other";
}

// Notes the family edited by tapping a note. The last edit wins until the next edit.
let noteOverrides = {};

// A note that can be tapped and edited in place (saves on Enter or when leaving the field).
function EditableNote({ note, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); onSave(draft.trim()); }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        placeholder="הערה"
        style={styles.noteInput}
      />
    );
  }
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => { setDraft(note || ""); setEditing(true); }}
      style={note ? { ...styles.pickNote, cursor: "pointer" } : styles.pickNoteEmpty}
    >
      {note || "+ הערה"}
    </span>
  );
}

// Product names the family renamed by tapping a name, keyed by the catalog's
// original name. The last rename wins, like notes.
let nameOverrides = {};
const displayName = (name) =>
  Object.prototype.hasOwnProperty.call(nameOverrides, name.trim()) ? nameOverrides[name.trim()] : name;

function EditableName({ name, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); if (draft.trim() && draft.trim() !== name) onSave(draft.trim()); }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        placeholder="שם המוצר"
        style={{ ...styles.noteInput, fontSize: 16, fontWeight: 600 }}
      />
    );
  }
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => { setDraft(name); setEditing(true); }}
      style={{ ...styles.pickLabel, cursor: "pointer" }}
    >
      {name}
    </span>
  );
}

function getCatalogNote(itemName) {
  const trimmed = itemName.trim();
  if (Object.prototype.hasOwnProperty.call(noteOverrides, trimmed)) return noteOverrides[trimmed];
  for (const list of Object.values(COMMON_ITEMS)) {
    const match = list.find((it) => displayName(it.name).trim() === trimmed);
    if (match && match.note) return match.note;
  }
  const custom = customCatalog.find((p) => displayName(p.name).trim() === trimmed);
  return custom && custom.note ? custom.note : "";
}

export default function ShoppingList() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [syncPulse, setSyncPulse] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const skipNextPoll = useRef(false);

  const [activeTab, setActiveTab] = useState("produce");
  const [customPick, setCustomPick] = useState("");

  const [showFinal, setShowFinal] = useState(false);
  const [finalCustomText, setFinalCustomText] = useState("");
  const [mailFailed, setMailFailed] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");

  // Greeting: follows the phone's clock; the name is saved on each device separately.
  const [hour, setHour] = useState(new Date().getHours());
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const t = setInterval(() => setHour(new Date().getHours()), 60000);
    return () => clearInterval(t);
  }, []);


  const [showSaved, setShowSaved] = useState(false);
  const [savedLists, setSavedLists] = useState([]);
  const [searchDate, setSearchDate] = useState("");
  const [openSavedId, setOpenSavedId] = useState(null);
  const [saveMsg, setSaveMsg] = useState("");
  const [currentListId, setCurrentListId] = useState(null);

  const [customProducts, setCustomProducts] = useState([]);
  const [newProdName, setNewProdName] = useState("");
  const [newProdNote, setNewProdNote] = useState("");
  const [newProdCat, setNewProdCat] = useState("produce");
  const [newProdMsg, setNewProdMsg] = useState("");
  customCatalog = customProducts;
  const [noteMap, setNoteMap] = useState({});
  noteOverrides = noteMap;
  const [nameMap, setNameMap] = useState({});
  nameOverrides = nameMap;

  const setProductNote = async (name, text) => {
    const key = name.trim();
    if ((getCatalogNote(key) || "") === text) return;
    const next = { ...noteOverrides, [key]: text };
    setNoteMap(next);
    try {
      await window.storage.set(NOTES_KEY, JSON.stringify(next), true);
    } catch (e) {
      console.error("שגיאת שמירה", e);
    }
  };

  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [importPreview, setImportPreview] = useState(null);

  useEffect(() => {
    try {
      document.title = "קניות משפחת דריימן";
    } catch (e) {
      // document not available in this environment — ignore
    }
    (async () => {
      await refreshList();
      try {
        const res = await window.storage.get(SAVED_KEY, true);
        if (res && res.value) setSavedLists(JSON.parse(res.value));
      } catch {
        // no saved lists yet
      }
      try {
        const res = await window.storage.get(CURRENT_KEY, true);
        if (res && res.value) setCurrentListId(res.value);
      } catch {
        // no current saved list yet
      }
      try {
        const res = await window.storage.get(CUSTOM_KEY, true);
        if (res && res.value) setCustomProducts(JSON.parse(res.value));
      } catch {
        // no custom products yet
      }
      try {
        const res = await window.storage.get(NAME_KEY, false);
        if (res && res.value) setUserName(res.value);
      } catch {
        // no name saved on this device yet
      }
      setLoaded(true);
    })();
  }, []);

  const refreshList = useCallback(async () => {
    try {
      const res = await window.storage.get(STORAGE_KEY, true);
      if (res && res.value) setItems(JSON.parse(res.value));
    } catch {
      // Storage key not created yet, or a transient read hiccup — either way,
      // never wipe items the user already selected. Just skip this refresh.
    }
    try {
      const res = await window.storage.get(NOTES_KEY, true);
      if (res && res.value) setNoteMap(JSON.parse(res.value));
    } catch {
      // no edited notes yet
    }
    try {
      const res = await window.storage.get(NAMES_KEY, true);
      if (res && res.value) setNameMap(JSON.parse(res.value));
    } catch {
      // no renamed products yet
    }
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      if (skipNextPoll.current) {
        skipNextPoll.current = false;
        return;
      }
      refreshList();
      setSyncPulse(true);
      setTimeout(() => setSyncPulse(false), 600);
    }, 4000);
    return () => clearInterval(t);
  }, [refreshList]);

  const persist = async (next) => {
    setItems(next);
    skipNextPoll.current = true;
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify(next), true);
    } catch (e) {
      console.error("שגיאת שמירה", e);
    }
  };

  useEffect(() => {
    const lines = items
      .filter((it) => !it.done)
      .slice()
      .reverse()
      .map((it) => {
        const q = parseInt(it.qty, 10);
        const qty = Number.isFinite(q) && q > 0 ? q : 1;
        const note = getCatalogNote(it.name);
        return formatListLine({ qty, kg: it.kg || 0, name: it.name, note });
      });
    const text = lines.join("\n");
    setSummaryText(text);
    window.storage.set(SUMMARY_KEY, text, true).catch(() => {});
  }, [items]);

  const makeItem = (text, category, qty = "") => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: text,
    qty,
    category,
    done: false,
    addedBy: "מישהו",
  });

  const alreadyInList = (itemName) =>
    items.some((it) => it.name.trim() === itemName.trim() && !it.done);

  const getListQty = (itemName) => {
    const existing = items.find((it) => it.name.trim() === itemName.trim() && !it.done);
    if (!existing) return 0;
    const n = parseInt(existing.qty, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  };

  const incrementListItem = (itemName, cat) => {
    const existing = items.find((it) => it.name.trim() === itemName.trim() && !it.done);
    if (!existing) {
      persist([makeItem(itemName, cat, "1"), ...items]);
      return;
    }
    const current = getListQty(itemName);
    const next = Math.min(20, current + 1);
    persist(items.map((it) => (it.id === existing.id ? { ...it, qty: String(next) } : it)));
  };

  const decrementListItem = (itemName) => {
    const existing = items.find((it) => it.name.trim() === itemName.trim() && !it.done);
    if (!existing) return;
    const current = getListQty(itemName);
    if (current <= 1) {
      persist(items.filter((it) => it.id !== existing.id));
    } else {
      persist(items.map((it) => (it.id === existing.id ? { ...it, qty: String(current - 1) } : it)));
    }
  };

  // Set an exact quantity (typed number). 0 removes the item.
  const setListQty = (itemName, cat, n) => {
    const qty = Math.min(20, Math.max(0, n));
    const existing = items.find((it) => it.name.trim() === itemName.trim() && !it.done);
    if (qty === 0) {
      if (existing) persist(items.filter((it) => it.id !== existing.id));
      return;
    }
    if (!existing) {
      persist([makeItem(itemName, cat, String(qty)), ...items]);
      return;
    }
    persist(items.map((it) => (it.id === existing.id ? { ...it, qty: String(qty) } : it)));
  };

  const getListKg = (itemName) => {
    const existing = items.find((it) => it.name.trim() === itemName.trim() && !it.done);
    return existing && existing.kg > 0 ? existing.kg : 0;
  };

  // Setting a weight on a product that isn't on the list yet adds it (count 1).
  const setListKg = (itemName, cat, n) => {
    const kg = Math.min(MAX_KG, Math.max(0, n));
    const existing = items.find((it) => it.name.trim() === itemName.trim() && !it.done);
    if (!existing) {
      if (kg > 0) persist([{ ...makeItem(itemName, cat, "1"), kg }, ...items]);
      return;
    }
    persist(items.map((it) => (it.id === existing.id ? { ...it, kg } : it)));
  };

  const toggleCheck = (itemName, cat) => {
    const existing = items.find((it) => it.name.trim() === itemName.trim() && !it.done);
    if (existing) {
      persist(items.filter((it) => it.id !== existing.id));
    } else {
      persist([makeItem(itemName, cat, "1"), ...items]);
    }
  };

  const customQty = customPick.trim() ? getListQty(customPick.trim()) : 0;

  const incrementCustom = () => {
    const text = customPick.trim();
    if (!text) return;
    incrementListItem(text, activeTab);
  };

  const decrementCustom = () => {
    const text = customPick.trim();
    if (!text) return;
    decrementListItem(text);
  };

  const addCustomAndReset = () => {
    const text = customPick.trim();
    if (!text) return;
    if (getListQty(text) === 0) {
      incrementListItem(text, activeTab);
    }
    setCustomPick("");
  };

  const finalCustomQty = finalCustomText.trim() ? getListQty(finalCustomText.trim()) : 0;

  const incrementFinalCustom = () => {
    const text = finalCustomText.trim();
    if (!text) return;
    incrementListItem(text, guessCategory(text));
  };

  const decrementFinalCustom = () => {
    const text = finalCustomText.trim();
    if (!text) return;
    decrementListItem(text);
  };

  const addFinalCustomAndReset = () => {
    const text = finalCustomText.trim();
    if (!text) return;
    if (getListQty(text) === 0) {
      incrementListItem(text, guessCategory(text));
    }
    setFinalCustomText("");
  };

  const finalItems = items.filter((it) => !it.done).slice().reverse();

  // Built-in catalog for a category plus the products the family added to it.
  // origName stays the catalog's own name, so a renamed product can be renamed again.
  const catalogFor = (cat) => [
    ...(COMMON_ITEMS[cat] || []),
    ...customProducts.filter((p) => p.category === cat).map((p) => ({ ...p, custom: true })),
  ].map((p) => ({ ...p, origName: p.name, name: displayName(p.name) }));

  // Renames a product everywhere: in the catalog, on the current list, and its note follows it.
  const renameProduct = async (currentName, newName) => {
    const from = currentName.trim();
    const to = newName.trim();
    if (!to || to === from) return;
    const taken = CATEGORIES.some((c) => catalogFor(c.id).some((p) => p.name.trim() === to)) || alreadyInList(to);
    if (taken) return;
    let origName = null;
    for (const c of CATEGORIES) {
      const hit = catalogFor(c.id).find((p) => p.name.trim() === from);
      if (hit) { origName = hit.origName.trim(); break; }
    }
    const note = getCatalogNote(from);
    if (origName) {
      const nextNames = { ...nameOverrides, [origName]: to };
      setNameMap(nextNames);
      try { await window.storage.set(NAMES_KEY, JSON.stringify(nextNames), true); } catch (e) { console.error("שגיאת שמירה", e); }
    }
    if (note) {
      const nextNotes = { ...noteOverrides, [to]: note };
      setNoteMap(nextNotes);
      try { await window.storage.set(NOTES_KEY, JSON.stringify(nextNotes), true); } catch (e) { console.error("שגיאת שמירה", e); }
    }
    if (items.some((it) => it.name.trim() === from)) {
      persist(items.map((it) => (it.name.trim() === from ? { ...it, name: to } : it)));
    }
  };

  const persistCustom = async (next) => {
    setCustomProducts(next);
    try {
      await window.storage.set(CUSTOM_KEY, JSON.stringify(next), true);
    } catch (e) {
      console.error("שגיאת שמירה", e);
    }
  };

  const addNewProduct = () => {
    const name = newProdName.trim();
    if (!name) return;
    const exists = CATEGORIES.some((c) =>
      catalogFor(c.id).some((p) => p.name.trim().toLowerCase() === name.toLowerCase())
    );
    if (exists) {
      setNewProdMsg("המוצר הזה כבר קיים בקטלוג");
      return;
    }
    const product = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      note: newProdNote.trim(),
      category: newProdCat,
    };
    persistCustom([...customProducts, product]);
    setNewProdName("");
    setNewProdNote("");
    setNewProdMsg("");
    setActiveTab(newProdCat);
  };

  const removeCustomProduct = (id) => persistCustom(customProducts.filter((p) => p.id !== id));

  const persistSaved = async (next) => {
    setSavedLists(next);
    try {
      await window.storage.set(SAVED_KEY, JSON.stringify(next), true);
    } catch (e) {
      console.error("שגיאת שמירה", e);
    }
  };

  const setCurrentId = async (id) => {
    setCurrentListId(id);
    try {
      await window.storage.set(CURRENT_KEY, id || "", true);
    } catch (e) {
      console.error("שגיאת שמירה", e);
    }
  };

  // Saves the current list. Repeated saves of the same list update one entry
  // (keeping its creation date) until "רשימה חדשה" is pressed.
  const saveCurrentList = () => {
    if (finalItems.length === 0) return false;
    const snapshot = finalItems.map((it) => {
      const q = parseInt(it.qty, 10);
      return {
        name: it.name,
        category: it.category,
        qty: Number.isFinite(q) && q > 0 ? q : 1,
        kg: it.kg || 0,
        note: getCatalogNote(it.name),
      };
    });
    const existing = currentListId ? savedLists.find((l) => l.id === currentListId) : null;
    if (existing) {
      persistSaved(savedLists.map((l) => (l.id === existing.id ? { ...l, items: snapshot } : l)));
    } else {
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        savedAt: new Date().toISOString(),
        items: snapshot,
      };
      persistSaved([entry, ...savedLists]);
      setCurrentId(entry.id);
    }
    setSaveMsg("הרשימה נשמרה ✓");
    setTimeout(() => setSaveMsg(""), 2500);
    return true;
  };

  // Keeps the old list in "רשימות קודמות" and starts an empty one.
  const startNewList = () => {
    if (finalItems.length > 0) saveCurrentList();
    setCurrentId(null);
    persist([]);
    setShowFinal(false);
    setSaveMsg("נפתחה רשימה חדשה ✓");
    setTimeout(() => setSaveMsg(""), 2500);
  };

  // --- Offer to save before leaving / closing the app ---
  const [showLeavePrompt, setShowLeavePrompt] = useState(false);
  const listSig = (arr) => arr.map((x) => `${x.name.trim()}|${x.qty}|${x.kg || 0}`).join(";");
  const savedForCurrent = currentListId ? savedLists.find((l) => l.id === currentListId) : null;
  const currentSig = listSig(
    finalItems.map((it) => {
      const q = parseInt(it.qty, 10);
      return { name: it.name, qty: Number.isFinite(q) && q > 0 ? q : 1, kg: it.kg || 0 };
    })
  );
  const hasUnsaved =
    finalItems.length > 0 && (!savedForCurrent || listSig(savedForCurrent.items) !== currentSig);
  const unsavedRef = useRef(false);
  unsavedRef.current = hasUnsaved;
  const leftWithUnsavedRef = useRef(false);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!unsavedRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    // On iPhone the page can't stop the app from closing, so when the app is
    // sent to the background with unsaved changes we ask again on return.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        leftWithUnsavedRef.current = unsavedRef.current;
      } else if (leftWithUnsavedRef.current) {
        leftWithUnsavedRef.current = false;
        if (unsavedRef.current) setShowLeavePrompt(true);
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const deleteSaved = (id) => persistSaved(savedLists.filter((l) => l.id !== id));

  // Adds the saved list's items to the current list (items already there are left as they are).
  const loadSaved = (list) => {
    const toAdd = list.items
      .filter((s) => !items.some((it) => it.name.trim() === s.name.trim() && !it.done))
      .map((s) => ({ ...makeItem(s.name, s.category, String(s.qty)), ...(s.kg ? { kg: s.kg } : {}) }));
    if (toAdd.length) persist([...toAdd.reverse(), ...items]);
    setShowSaved(false);
    setShowFinal(true);
  };

  const localDay = (iso) => new Date(iso).toLocaleDateString("sv-SE");
  const formatSavedAt = (iso) =>
    new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
  const sortedSaved = savedLists.slice().sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
  const visibleSaved = searchDate ? sortedSaved.filter((l) => localDay(l.savedAt) === searchDate) : sortedSaved;

  const buildEmailBody = () => {
    const lines = finalItems.map((it) => {
      const q = parseInt(it.qty, 10);
      const qty = Number.isFinite(q) && q > 0 ? q : 1;
      const note = getCatalogNote(it.name);
      return formatListLine({ qty, kg: it.kg || 0, name: it.name, note }, true);
    });
    // Plain-text mail has no alignment setting; a right-to-left mark at the start
    // of each line makes mail apps lay the Hebrew lines out from the right.
    const RLM = "\u200f";
    return ["גיל דריימן", "המגדל 11 כרכור", "052-4350444", "", "", ...lines]
      .map((line) => (line ? RLM + line : line))
      .join("\n");
  };

  const emailSubject = "גיל דריימן - 052-4350444";
  const mailtoHref = `mailto:Karkur@politzer.vo.il?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(buildEmailBody())}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(buildEmailBody())}`;

  // Opens the phone's mail app with recipient, subject and body filled in (nothing is sent automatically).
  // If the page didn't lose focus within ~1.5s the browser blocked it, so we show a copy fallback.
  const openMail = () => {
    setMailFailed(false);
    let left = false;
    const onLeave = () => { left = true; };
    window.addEventListener("blur", onLeave);
    document.addEventListener("visibilitychange", onLeave);
    try {
      window.top.location.href = mailtoHref;
    } catch (e) {
      try {
        window.location.href = mailtoHref;
      } catch (e2) {
        // blocked — the fallback below will appear
      }
    }
    setTimeout(() => {
      window.removeEventListener("blur", onLeave);
      document.removeEventListener("visibilitychange", onLeave);
      if (!left) setMailFailed(true);
    }, 1500);
  };

  const copyMailText = async () => {
    const text = buildEmailBody();
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch (e) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch (e2) {
        ok = false;
      }
    }
    setCopyMsg(ok ? "הועתק ✓" : "ההעתקה נחסמה");
    setTimeout(() => setCopyMsg(""), 2500);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setImportText(String(reader.result || ""));
    reader.readAsText(file, "utf-8");
  };

  // An imported line that names a catalog product takes the catalog's exact name,
  // so it shows as picked in its category, the same as tapping it in the app.
  const findCatalogMatch = (name) => {
    const key = name.trim().toLowerCase();
    for (const c of CATEGORIES) {
      const hit = catalogFor(c.id).find((p) => p.name.trim().toLowerCase() === key);
      if (hit) return { name: hit.name, category: c.id };
    }
    return null;
  };

  const runImportPreview = () => {
    const lines = importText.split("\n");
    const seen = new Set();
    const parsed = [];
    for (const raw of lines) {
      // Pasted lists often start lines with a bullet ("- ", "• "). A number there is a quantity.
      const cleaned = stripWhatsAppPrefix(raw).replace(/^[\u200e\u200f\s]*[-–•*·]\s*/, "").trim();
      if (!cleaned) continue;
      if (/^(https?:\/\/|<|תמונה|image omitted|video omitted|✏)/i.test(cleaned)) continue;
      const { text, qty } = splitImportQty(cleaned, (t) => !!findCatalogMatch(t));
      if (text.length < 2 || text.length > 40) continue;
      const match = findCatalogMatch(text);
      const name = match ? match.name : text;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      if (alreadyInList(name)) continue;
      seen.add(key);
      parsed.push({ name, qty, category: match ? match.category : guessCategory(name), include: true });
    }
    setImportPreview(parsed);
  };

  const toggleImportInclude = (idx) =>
    setImportPreview((prev) => prev.map((p, i) => (i === idx ? { ...p, include: !p.include } : p)));
  const setImportCategory = (idx, cat) =>
    setImportPreview((prev) => prev.map((p, i) => (i === idx ? { ...p, category: cat } : p)));

  const confirmImport = () => {
    const chosen = (importPreview || []).filter((p) => p.include);
    if (chosen.length === 0) {
      setShowImport(false);
      setImportPreview(null);
      setImportText("");
      setImportFileName("");
      return;
    }
    const newItems = chosen.map((c) => makeItem(c.name, c.category, String(c.qty || 1)));
    persist([...newItems, ...items]);
    setShowImport(false);
    setImportPreview(null);
    setImportText("");
    setImportFileName("");
  };

  const remaining = items.filter((i) => !i.done).length;
  const doneCount = items.length - remaining;

  return (
    <div dir="rtl" style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Suez+One&family=Heebo:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::selection { background: #3E7C5955; }
        .pick-row input::placeholder { color: #7C8574; }
        input:focus, button:focus, select:focus, textarea:focus { outline: 2px solid #3E7C59; outline-offset: 2px; }
        .item-row { animation: fadeIn 0.25s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes sheetIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { .item-row, .sheet { animation: none !important; } }
        .chalk-btn:active { transform: scale(0.96); }
        .sheet { animation: sheetIn 0.22s ease; }
        .tab-btn { transition: background .15s, color .15s; }
        .pick-row { transition: background .12s; }
        .pick-row:hover { background: #2430260d; }
        @media (max-width: 400px) {
          .final-top-title { font-size: 1.4rem !important; }
          .final-top-btn { padding: 7px 12px !important; font-size: 0.78rem !important; }
          .preview-btn { padding: 7px 10px !important; font-size: 0.78rem !important; }
        }
      `}</style>

      <div style={styles.texture} />

      <div style={styles.board}>
       {showSaved ? (
        <>
          <h2 style={styles.finalTitle}>רשימות קודמות</h2>

          <div style={styles.finalTopBar}>
            <button onClick={() => setShowSaved(false)} className="chalk-btn final-top-btn" style={styles.finalTopBtn}>
              <ArrowRight size={16} style={{ marginInlineEnd: 6, verticalAlign: "-3px" }} />
              חזור
            </button>
          </div>

          <div style={styles.searchRow}>
            <label style={styles.searchLabel} htmlFor="saved-date">חיפוש לפי תאריך</label>
            <input
              id="saved-date"
              type="date"
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              style={styles.dateInput}
            />
            {searchDate && (
              <button onClick={() => setSearchDate("")} className="chalk-btn" style={styles.clearSearchBtn}>
                נקה
              </button>
            )}
          </div>

          <div style={styles.pickScroll}>
            {visibleSaved.length === 0 && (
              <p style={{ ...styles.pickHint, padding: "14px 8px" }}>
                {savedLists.length === 0 ? "עדיין לא נשמרו רשימות. לוחצים על ״שמור״ או על ״רשימה חדשה״." : "לא נמצאו רשימות בתאריך הזה."}
              </p>
            )}
            {visibleSaved.map((l) => {
              const open = openSavedId === l.id;
              return (
                <div key={l.id} style={styles.savedCard}>
                  <button onClick={() => setOpenSavedId(open ? null : l.id)} style={styles.savedHeader}>
                    <span style={styles.savedDate}>{formatSavedAt(l.savedAt)}</span>
                    <span style={styles.savedCount}>{l.items.length} מוצרים</span>
                  </button>
                  {open && (
                    <div style={styles.savedBody}>
                      {l.items.map((s, i) => (
                        <div key={i} style={styles.savedLine}>
                          {formatListLine({ qty: s.qty, kg: s.kg || 0, name: s.name, note: s.note })}
                        </div>
                      ))}
                      <div style={styles.savedActions}>
                        <button onClick={() => loadSaved(l)} className="chalk-btn" style={{ ...styles.finalTopBtn, ...styles.finalSendBtn }}>
                          הוסף לרשימה הנוכחית
                        </button>
                        <button onClick={() => deleteSaved(l.id)} className="chalk-btn" style={styles.finalTopBtn} aria-label="מחק רשימה שמורה">
                          <Trash2 size={16} style={{ marginInlineEnd: 6, verticalAlign: "-3px" }} />
                          מחק
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
       ) : !showFinal ? (
        <>
        <header style={styles.header}>
          <div style={styles.titleWrap}>
            <ShoppingBasket size={20} color="#243026" strokeWidth={1.8} />
            <h1 style={styles.title}>רשימת קניות משפחת דריימן</h1>
          </div>
          <svg width="220" height="14" viewBox="0 0 220 14" style={styles.scribble}>
            <path d="M2 8 Q 20 2, 40 8 T 80 8 T 120 8 T 160 8 T 200 8 T 218 8" stroke="#3E7C59" strokeWidth="3" fill="none" strokeLinecap="round" />
          </svg>
          <div style={styles.subRow}>
            <span style={styles.subText}>{remaining} פריטים לקנייה{doneCount > 0 ? ` · ${doneCount} נאספו` : ""}</span>
            <span style={{ ...styles.subText, opacity: syncPulse ? 1 : 0.45, transition: "opacity .3s" }}>
              <Users size={13} style={{ marginInlineEnd: 4, verticalAlign: "-2px" }} />
              משותף למשפחה
            </span>
          </div>
        </header>

        <div style={styles.greetingRow}>
          <div style={styles.greeting}>
            <span>{greetingForHour(hour)}</span>
            {/* The name is set once on the sign-in screen and can't be edited here. */}
            {userName && <span style={styles.nameText}>{userName}</span>}
          </div>
          <button onClick={() => setShowFinal(true)} className="chalk-btn preview-btn" style={styles.previewBtn}>
            <Eye size={16} style={{ marginInlineEnd: 6, verticalAlign: "-3px" }} />
            סיכום רשימה
          </button>
        </div>

        <section style={styles.pickerSection}>
          <div style={styles.tabsRow}>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                className="tab-btn"
                onClick={() => setActiveTab(c.id)}
                style={{
                  ...styles.tabBtn,
                  background: activeTab === c.id ? c.color : "transparent",
                  color: activeTab === c.id ? "#243026" : "#4B5347",
                  borderColor: c.color,
                }}
              >
                {c.label}
              </button>
            ))}
            <button
              className="tab-btn"
              onClick={() => { setActiveTab("new"); setNewProdMsg(""); }}
              style={{
                ...styles.tabBtn,
                borderStyle: activeTab === "new" ? "solid" : "dashed",
                borderColor: "#3E7C59",
                background: activeTab === "new" ? "#3E7C59" : "transparent",
                color: activeTab === "new" ? "#FFFFFF" : "#3E7C59",
                fontWeight: 600,
              }}
            >
              + מוצר חדש
            </button>
          </div>

          <div style={styles.listActionsRow}>
            <button
              onClick={saveCurrentList}
              disabled={finalItems.length === 0}
              className="chalk-btn"
              style={{ ...styles.listActionBtn, opacity: finalItems.length === 0 ? 0.5 : 1 }}
            >
              <Save size={12} style={{ marginInlineEnd: 3, verticalAlign: "-2px" }} />
              {saveMsg || "שמור"}
            </button>
            <button onClick={startNewList} className="chalk-btn" style={styles.listActionBtn}>
              <Plus size={12} style={{ marginInlineEnd: 3, verticalAlign: "-2px" }} />
              רשימה חדשה
            </button>
            <button onClick={() => setShowSaved(true)} className="chalk-btn" style={styles.listActionBtn}>
              <History size={12} style={{ marginInlineEnd: 3, verticalAlign: "-2px" }} />
              רשימות קודמות
            </button>
            <button onClick={() => setShowImport(true)} className="chalk-btn" style={styles.listActionBtn}>
              <Upload size={12} style={{ marginInlineEnd: 3, verticalAlign: "-2px" }} />
              ייבוא
            </button>
          </div>

          {activeTab === "new" ? (
            <div style={styles.newProdCard}>
              <label style={styles.newProdLabel} htmlFor="new-prod-name">שם המוצר</label>
              <input
                id="new-prod-name"
                value={newProdName}
                onChange={(e) => { setNewProdName(e.target.value); setNewProdMsg(""); }}
                onKeyDown={(e) => e.key === "Enter" && addNewProduct()}
                placeholder="למשל: חומוס מוכן"
                style={styles.newProdInput}
              />

              <label style={styles.newProdLabel} htmlFor="new-prod-note">הערה (לא חובה)</label>
              <input
                id="new-prod-note"
                value={newProdNote}
                onChange={(e) => setNewProdNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNewProduct()}
                placeholder="למשל: אריזה של 400 גרם"
                style={styles.newProdInput}
              />

              <label style={styles.newProdLabel} htmlFor="new-prod-cat">קטגוריה</label>
              <select
                id="new-prod-cat"
                value={newProdCat}
                onChange={(e) => setNewProdCat(e.target.value)}
                style={styles.newProdInput}
              >
                {CATEGORIES.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
              </select>

              {newProdMsg && <p style={styles.newProdMsg}>{newProdMsg}</p>}

              <button
                onClick={addNewProduct}
                disabled={!newProdName.trim()}
                className="chalk-btn"
                style={{ ...styles.newProdBtn, opacity: newProdName.trim() ? 1 : 0.5 }}
              >
                <Plus size={16} style={{ marginInlineEnd: 6, verticalAlign: "-3px" }} />
                הוסף לקטגוריה
              </button>
            </div>
          ) : (
          <div style={styles.pickScroll}>
            <div className="pick-row" style={styles.pickRow}>
              <button
                onClick={addCustomAndReset}
                disabled={!customPick.trim()}
                style={{ ...styles.manualAddTextBtn, background: customPick.trim() ? "#3E7C59" : "#24302633", color: customPick.trim() ? "#FFFFFF" : "#7C8574", cursor: customPick.trim() ? "pointer" : "default" }}
              >
                הוסף
              </button>
              <input
                value={customPick}
                onChange={(e) => setCustomPick(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomAndReset()}
                placeholder="הוסף ידנית..."
                style={styles.customPickInput}
              />
              {activeTab === KG_CATEGORY && (
                <KgStepper
                  kg={customPick.trim() ? getListKg(customPick.trim()) : 0}
                  disabled={!customPick.trim()}
                  onSet={(n) => customPick.trim() && setListKg(customPick.trim(), activeTab, n)}
                />
              )}
              <WithUnitsLabel show={activeTab === KG_CATEGORY}>
                <QtyStepper
                  qty={customQty}
                  disabled={!customPick.trim()}
                  onInc={incrementCustom}
                  onDec={decrementCustom}
                  onSet={(n) => customPick.trim() && setListQty(customPick.trim(), activeTab, n)}
                />
              </WithUnitsLabel>
            </div>

            {catalogFor(activeTab).length === 0 && (
              <p style={{ ...styles.pickHint, padding: "14px 8px" }}>אין עדיין פריטים קבועים בקטגוריה הזו — אפשר להוסיף מוצר אחר למעלה.</p>
            )}
            {catalogFor(activeTab).map((item) => {
              const qty = getListQty(item.name);
              const inList = qty > 0;
              return (
                <div key={item.origName} className="pick-row" style={styles.pickRow}>
                  <button
                    onClick={() => toggleCheck(item.name, activeTab)}
                    style={{ ...styles.pickCheck, borderColor: inList ? catInfo(activeTab).color : "#24302655", background: inList ? catInfo(activeTab).color : "transparent", cursor: "pointer" }}
                    aria-label={inList ? "בטל סימון" : "סמן"}
                  >
                    {inList && <Check size={12} color="#243026" strokeWidth={3} />}
                  </button>
                  <span style={styles.pickTextWrap}>
                    <EditableName name={item.name} onSave={(t) => renameProduct(item.name, t)} />
                    <EditableNote note={getCatalogNote(item.name)} onSave={(t) => setProductNote(item.name, t)} />
                  </span>
                  {item.custom && (
                    <button
                      onClick={() => removeCustomProduct(item.id)}
                      style={styles.removeProdBtn}
                      aria-label="הסר מוצר מהקטלוג"
                    >
                      <X size={14} />
                    </button>
                  )}
                  {activeTab === KG_CATEGORY && (
                    <KgStepper kg={getListKg(item.name)} onSet={(n) => setListKg(item.name, activeTab, n)} />
                  )}
                  <WithUnitsLabel show={activeTab === KG_CATEGORY}>
                    <QtyStepper
                      qty={qty}
                      onInc={() => incrementListItem(item.name, activeTab)}
                      onDec={() => decrementListItem(item.name)}
                      onSet={(n) => setListQty(item.name, activeTab, n)}
                    />
                  </WithUnitsLabel>
                </div>
              );
            })}
          </div>
          )}
        </section>

        <div style={styles.summarySection}>
          <span style={styles.summaryLabel}>רשימה לשמירה / העתקה</span>
          <textarea
            readOnly
            value={summaryText}
            placeholder="עדיין לא נבחרו מוצרים..."
            style={styles.summaryTextarea}
            rows={5}
          />
        </div>

        </>
       ) : (
        <>
          <h2 className="final-top-title" style={styles.finalTitle}>רשימת הקניות</h2>

          <div style={styles.finalTopBar}>
            <button onClick={() => setShowFinal(false)} className="chalk-btn final-top-btn" style={styles.finalTopBtn}>
              <ArrowRight size={16} style={{ marginInlineEnd: 6, verticalAlign: "-3px" }} />
              חזור
            </button>
            <button
              onClick={saveCurrentList}
              disabled={finalItems.length === 0}
              className="chalk-btn final-top-btn"
              style={{ ...styles.finalTopBtn, opacity: finalItems.length === 0 ? 0.5 : 1 }}
            >
              <Save size={16} style={{ marginInlineEnd: 6, verticalAlign: "-3px" }} />
              {saveMsg || "שמור"}
            </button>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="chalk-btn final-top-btn"
              style={styles.finalTopBtn}
            >
              <MessageCircle size={16} style={{ marginInlineEnd: 6, verticalAlign: "-3px" }} />
              שתף בווצאפ
            </a>
            <button
              onClick={openMail}
              className="chalk-btn final-top-btn"
              style={{ ...styles.finalTopBtn, ...styles.finalSendBtn }}
            >
              <Send size={16} style={{ marginInlineEnd: 6, verticalAlign: "-3px" }} />
              שלח במייל
            </button>
          </div>

          {mailFailed && (
            <div style={styles.mailFailCard}>
              <p style={styles.mailFailText}>
                תיבת המייל לא נפתחה: הדפדפן חוסם את זה מתוך התצוגה הנוכחית. בקישור המפורסם שנפתח ב־Safari באייפון זה אמור להיפתח.
                בינתיים אפשר להעתיק את תוכן המייל ולהדביק בתיבת המייל.
              </p>
              <button onClick={copyMailText} className="chalk-btn" style={styles.finalTopBtn}>
                {copyMsg || "העתק את תוכן המייל"}
              </button>
            </div>
          )}

          <div style={styles.pickScroll}>
            <div className="pick-row" style={styles.pickRow}>
              <button
                onClick={addFinalCustomAndReset}
                disabled={!finalCustomText.trim()}
                style={{ ...styles.manualAddTextBtn, background: finalCustomText.trim() ? "#3E7C59" : "#24302633", color: finalCustomText.trim() ? "#FFFFFF" : "#7C8574", cursor: finalCustomText.trim() ? "pointer" : "default" }}
              >
                הוסף
              </button>
              <input
                value={finalCustomText}
                onChange={(e) => setFinalCustomText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addFinalCustomAndReset()}
                placeholder="הוסף ידנית..."
                style={styles.customPickInput}
              />
              <QtyStepper
                qty={finalCustomQty}
                disabled={!finalCustomText.trim()}
                onInc={incrementFinalCustom}
                onDec={decrementFinalCustom}
                onSet={(n) => finalCustomText.trim() && setListQty(finalCustomText.trim(), guessCategory(finalCustomText.trim()), n)}
              />
            </div>

            {finalItems.length === 0 && (
              <p style={{ ...styles.pickHint, padding: "14px 8px" }}>הרשימה עדיין ריקה.</p>
            )}
            {finalItems.map((it) => {
              const q = parseInt(it.qty, 10);
              const qty = Number.isFinite(q) && q > 0 ? q : 1;
              const note = getCatalogNote(it.name);
              const cat = catInfo(it.category);
              return (
                <div key={it.id} className="pick-row" style={styles.pickRow}>
                  <button
                    onClick={() => toggleCheck(it.name, it.category)}
                    style={{ ...styles.pickCheck, borderColor: cat.color, background: cat.color, cursor: "pointer" }}
                    aria-label="הסר פריט"
                  >
                    <Check size={12} color="#243026" strokeWidth={3} />
                  </button>
                  <span style={styles.pickTextWrap}>
                    <EditableName name={it.name} onSave={(t) => renameProduct(it.name, t)} />
                    <EditableNote note={note} onSave={(t) => setProductNote(it.name, t)} />
                  </span>
                  {it.category === KG_CATEGORY && (
                    <KgStepper kg={it.kg || 0} onSet={(n) => setListKg(it.name, it.category, n)} />
                  )}
                  <WithUnitsLabel show={it.category === KG_CATEGORY}>
                    <QtyStepper
                      qty={qty}
                      onInc={() => incrementListItem(it.name, it.category)}
                      onDec={() => decrementListItem(it.name)}
                      onSet={(n) => setListQty(it.name, it.category, n)}
                    />
                  </WithUnitsLabel>
                </div>
              );
            })}
          </div>
        </>
       )}
      </div>


      {showLeavePrompt && (
        <div style={{ ...styles.overlay, alignItems: "center", padding: "0 16px" }} onClick={() => setShowLeavePrompt(false)}>
          <div style={{ ...styles.sheet, borderRadius: 18, borderBottom: "1px solid #24302622", maxWidth: 340, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ ...styles.sheetTitle, marginBottom: 8 }}>לשמור את הרשימה?</h3>
            <p style={{ ...styles.importHelp, marginBottom: 14 }}>יצאת מהאפליקציה והרשימה לא נשמרה. רוצה לשמור אותה ברשימות קודמות?</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                onClick={() => { saveCurrentList(); setShowLeavePrompt(false); }}
                className="chalk-btn"
                style={{ ...styles.finalTopBtn, ...styles.finalSendBtn }}
              >
                <Save size={16} style={{ marginInlineEnd: 6 }} />
                שמור
              </button>
              <button onClick={() => setShowLeavePrompt(false)} className="chalk-btn" style={styles.finalTopBtn}>
                לא עכשיו
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div style={styles.overlay} onClick={() => { setShowImport(false); setImportPreview(null); }}>
          <div className="sheet" style={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={styles.sheetHeader}>
              <h3 style={styles.sheetTitle}>ייבוא מקובץ או מטקסט</h3>
              <button onClick={() => { setShowImport(false); setImportPreview(null); }} style={styles.sheetClose}><X size={18} /></button>
            </div>

            {!importPreview ? (
              <>
                <p style={styles.importHelp}>
                  בחרו קובץ טקסט (למשל ייצוא צ'אט מוואטסאפ), או הדביקו רשימה בתיבה למטה. כל שורה תהפוך לפריט אפשרי.
                </p>
                <label style={styles.fileDropZone}>
                  <input type="file" accept=".txt,text/plain" onChange={handleFileSelect} style={{ display: "none" }} />
                  <FileText size={22} color="#4B5347" strokeWidth={1.7} />
                  <span style={styles.fileDropText}>
                    {importFileName ? importFileName : "לחצו לבחירת קובץ..."}
                  </span>
                </label>
                <label htmlFor="import-paste" style={{ ...styles.importHelp, display: "block", marginBottom: 6 }}>או הדביקו כאן טקסט, מוצר בכל שורה:</label>
                <textarea
                  id="import-paste"
                  value={importText}
                  onChange={(e) => { setImportText(e.target.value); setImportFileName(""); }}
                  placeholder={"עגבניות שרי\nחלב תנובה\nבננות"}
                  rows={6}
                  style={styles.importPaste}
                />
                <button onClick={runImportPreview} className="chalk-btn" style={styles.confirmBtn} disabled={!importText.trim()}>
                  הצג מוצרים לייבוא
                </button>
              </>
            ) : importPreview.length === 0 ? (
              <>
                <p style={styles.importHelp}>לא זוהו מוצרים חדשים. ייתכן שכולם כבר ברשימה.</p>
                <button onClick={() => { setImportPreview(null); setImportText(""); setImportFileName(""); }} className="chalk-btn" style={styles.confirmBtn}>נסה שוב</button>
              </>
            ) : (
              <>
                <p style={styles.importHelp}>סמנו מה להוסיף, ואפשר לתקן קטגוריה:</p>
                <div style={styles.pickScroll}>
                  {importPreview.map((p, idx) => (
                    <div key={idx} style={styles.importRow}>
                      <button
                        onClick={() => toggleImportInclude(idx)}
                        style={{
                          ...styles.pickCheck,
                          borderColor: p.include ? catInfo(p.category).color : "#24302655",
                          background: p.include ? catInfo(p.category).color : "transparent",
                        }}
                      >
                        {p.include && <Check size={12} color="#243026" strokeWidth={3} />}
                      </button>
                      <span style={{ ...styles.pickLabel, flex: 1, opacity: p.include ? 1 : 0.45 }}>{p.qty > 1 ? `${p.qty} × ` : ""}{p.name}</span>
                      <select value={p.category} onChange={(e) => setImportCategory(idx, e.target.value)} style={styles.importCatSelect}>
                        {CATEGORIES.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
                      </select>
                    </div>
                  ))}
                </div>
                <button onClick={confirmImport} className="chalk-btn" style={styles.confirmBtn}>
                  הוסף {importPreview.filter((p) => p.include).length} פריטים
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "radial-gradient(ellipse at top, #F7F8EF 0%, #EFF1E3 55%, #E6E9D7 100%)", padding: "28px 14px 60px", fontFamily: "'Heebo', sans-serif", position: "relative", display: "flex", justifyContent: "center" },
  texture: { position: "fixed", inset: 0, pointerEvents: "none", opacity: 0.5, backgroundImage: "radial-gradient(rgba(36,48,38,0.035) 1px, transparent 1px), radial-gradient(rgba(36,48,38,0.03) 1px, transparent 1px)", backgroundSize: "3px 3px, 7px 7px", backgroundPosition: "0 0, 2px 3px" },
  board: { width: "100%", maxWidth: 560, position: "relative", zIndex: 1 },
  header: { textAlign: "center", marginBottom: 6 },
  titleWrap: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10 },
  title: { fontFamily: "'Suez One', serif", fontWeight: 400, fontSize: "1.15rem", color: "#243026", margin: 0, letterSpacing: "0.3px" },
  scribble: { display: "none" },
  subRow: { display: "flex", justifyContent: "center", gap: 16, marginTop: 0 },
  subText: { fontSize: "0.78rem", color: "#4B5347", fontWeight: 400 },
  greetingRow: { position: "relative", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8, minHeight: 34 },
  greeting: { display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 6, textAlign: "center", color: "#243026", fontSize: "1rem", fontWeight: 600, margin: 0, paddingInlineStart: 118 },
  nameText: { color: "#3E7C59", fontFamily: "'Heebo', sans-serif", fontSize: "1rem", fontWeight: 700 },
  previewBtn: { position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", padding: "9px 16px", borderRadius: 9, border: "1px solid #24302633", background: "#FFFFFF", color: "#3E7C59", fontFamily: "'Heebo', sans-serif", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 10px #00000022", whiteSpace: "nowrap" },
  finalTitle: { textAlign: "center", fontFamily: "'Suez One', serif", fontWeight: 400, fontSize: "1.9rem", color: "#243026", margin: "0 0 16px", letterSpacing: "0.5px" },
  finalTopBar: { display: "flex", flexWrap: "wrap", justifyContent: "flex-start", gap: 10, marginBottom: 18 },
  finalTopBtn: { display: "flex", alignItems: "center", padding: "9px 16px", borderRadius: 9, border: "1px solid #24302633", background: "#FFFFFF", color: "#243026", fontFamily: "'Heebo', sans-serif", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", textDecoration: "none", boxShadow: "0 2px 10px #00000022", whiteSpace: "nowrap" },
  finalSendBtn: { background: "#3E7C59", color: "#FFFFFF", border: "none" },
  addRow: { display: "flex", gap: 8, marginBottom: 14 },
  addInput: { flex: 2, minWidth: 0, padding: "12px 14px", borderRadius: 10, border: "1px solid #24302633", background: "#FFFFFF", color: "#243026", fontFamily: "'Heebo', sans-serif", fontSize: "0.95rem" },
  qtyInput: { flex: "0 0 70px", minWidth: 0, padding: "12px 10px", borderRadius: 10, border: "1px solid #24302633", background: "#FFFFFF", color: "#243026", fontFamily: "'Heebo', sans-serif", fontSize: "0.9rem" },
  select: { flex: "0 0 128px", padding: "12px 8px", borderRadius: 10, border: "1px solid #24302633", background: "#FFFFFF", color: "#243026", fontFamily: "'Heebo', sans-serif", fontSize: "0.85rem" },
  addBtn: { flex: "0 0 44px", borderRadius: 10, border: "none", background: "#3E7C59", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  pickerSection: { marginBottom: 24 },
  list: { display: "flex", flexDirection: "column", gap: 22 },
  emptyText: { textAlign: "center", color: "#4B534799", fontSize: "0.9rem", marginTop: 30 },
  group: {},
  groupHeader: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 },
  dot: { width: 9, height: 9, borderRadius: "50%", flex: "0 0 auto" },
  groupTitle: { fontFamily: "'Suez One', serif", fontWeight: 400, fontSize: "1.05rem", margin: 0, whiteSpace: "nowrap" },
  groupDivider: { flex: 1, height: 1, background: "repeating-linear-gradient(to left, #24302633 0 6px, transparent 6px 12px)" },
  itemsUl: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 },
  itemRow: { display: "flex", alignItems: "center", gap: 12, padding: "9px 6px", borderRadius: 8 },
  checkbox: { flex: "0 0 22px", width: 22, height: 22, borderRadius: "50%", border: "2px solid", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "background .15s, border-color .15s" },
  itemTextWrap: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  itemName: { color: "#243026", fontSize: "1rem", fontWeight: 500 },
  qtyTag: { color: "#4B5347", fontWeight: 400, fontSize: "0.88rem" },
  addedBy: { color: "#7C8574", fontSize: "0.72rem", marginTop: 1 },
  deleteBtn: { flex: "0 0 auto", background: "transparent", border: "none", color: "#7C8574", cursor: "pointer", padding: 4, display: "flex" },
  clearBtn: { display: "block", margin: "30px auto 0", padding: "10px 20px", borderRadius: 10, border: "1px dashed #24302644", background: "transparent", color: "#4B5347", fontFamily: "'Heebo', sans-serif", fontSize: "0.82rem", cursor: "pointer" },
  footer: { textAlign: "center", color: "#7C8574", fontSize: "0.75rem", marginTop: 24 },
  listActionsRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5, marginBottom: 8 },
  listActionBtn: { minWidth: 0, padding: "6px 2px", borderRadius: 8, border: "1px solid #24302633", background: "#FFFFFFAA", color: "#243026", fontFamily: "'Heebo', sans-serif", fontSize: "0.66rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "center" },
  importBottomBtn: { display: "block", width: "100%", marginTop: 18, padding: "12px 8px", borderRadius: 10, border: "1px dashed #24302644", background: "transparent", color: "#4B5347", fontFamily: "'Heebo', sans-serif", fontSize: "0.83rem", cursor: "pointer" },
  newProdCard: { display: "flex", flexDirection: "column", gap: 6, padding: "14px 14px 16px", background: "#FFFFFF", border: "1px solid #24302622", borderRadius: 12 },
  newProdLabel: { color: "#4B5347", fontSize: "0.8rem", fontWeight: 600, marginTop: 6 },
  newProdInput: { width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #24302633", background: "#FFFFFF", color: "#243026", fontFamily: "'Heebo', sans-serif", fontSize: 16 },
  newProdMsg: { color: "#C1554B", fontSize: "0.82rem", margin: "6px 0 0" },
  newProdBtn: { display: "flex", alignItems: "center", justifyContent: "center", marginTop: 12, padding: "12px", borderRadius: 10, border: "none", background: "#3E7C59", color: "#FFFFFF", fontFamily: "'Heebo', sans-serif", fontSize: "0.92rem", fontWeight: 600, cursor: "pointer" },
  removeProdBtn: { flex: "0 0 auto", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: "#7C8574", cursor: "pointer", padding: 0 },
  mailFailCard: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, padding: "12px 14px", marginBottom: 16, background: "#FFFFFF", border: "1px solid #C1554B55", borderRadius: 12 },
  mailFailText: { color: "#4B5347", fontSize: "0.85rem", lineHeight: 1.6, margin: 0 },
  searchRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 },
  searchLabel: { color: "#4B5347", fontSize: "0.85rem", fontWeight: 600 },
  dateInput: { padding: "8px 10px", borderRadius: 9, border: "1px solid #24302633", background: "#FFFFFF", color: "#243026", fontFamily: "'Heebo', sans-serif", fontSize: 16 },
  clearSearchBtn: { padding: "8px 14px", borderRadius: 9, border: "1px solid #24302633", background: "#FFFFFF", color: "#243026", fontFamily: "'Heebo', sans-serif", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" },
  savedCard: { borderBottom: "1px solid #24302614" },
  savedHeader: { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 8px", background: "transparent", border: "none", cursor: "pointer", textAlign: "right", fontFamily: "'Heebo', sans-serif" },
  savedDate: { color: "#243026", fontSize: "0.95rem", fontWeight: 600 },
  savedCount: { color: "#7C8574", fontSize: "0.8rem" },
  savedBody: { padding: "0 8px 12px" },
  savedLine: { color: "#243026", fontSize: "0.88rem", padding: "3px 0" },
  savedActions: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 },
  summarySection: { marginTop: 22 },
  summaryLabel: { display: "block", color: "#7C8574", fontSize: "0.75rem", marginBottom: 6 },
  summaryTextarea: { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #24302633", background: "#FFFFFF", color: "#4B5347", fontFamily: "'Heebo', sans-serif", fontSize: "0.85rem", resize: "vertical", lineHeight: 1.6 },

  overlay: { position: "fixed", inset: 0, background: "#1E2216cc", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 10, padding: "0" },
  sheet: { width: "100%", maxWidth: 560, background: "#FFFFFF", borderRadius: "18px 18px 0 0", padding: "18px 18px 22px", maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 -8px 30px #00000022", border: "1px solid #24302622", borderBottom: "none" },
  sheetHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sheetTitle: { fontFamily: "'Suez One', serif", fontWeight: 400, fontSize: "1.2rem", color: "#243026", margin: 0 },
  sheetClose: { background: "transparent", border: "none", color: "#4B5347", cursor: "pointer", padding: 4 },
  tabsRow: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 5, paddingBottom: 4, marginBottom: 6 },
  tabBtn: { minWidth: 0, padding: "6px 2px", borderRadius: 16, border: "1.5px solid", fontFamily: "'Heebo', sans-serif", fontSize: "0.7rem", fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "center" },
  customPickInput: { flex: 1, minWidth: 0, padding: 0, border: "none", background: "transparent", color: "#243026", fontFamily: "'Heebo', sans-serif", fontSize: 16 },
  pickScroll: { overflowY: "auto", flex: 1, minHeight: 120, maxHeight: "44vh", border: "1px solid #2430261a", borderRadius: 10, padding: "4px 6px" },
  pickRow: { width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", background: "transparent", border: "none", borderBottom: "1px solid #24302614", textAlign: "right" },
  pickCheck: { flex: "0 0 18px", width: 18, height: 18, borderRadius: 5, border: "2px solid", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", padding: 0 },
  manualAddTextBtn: { flex: "0 0 auto", padding: "5px 12px", borderRadius: 7, border: "none", fontFamily: "'Heebo', sans-serif", fontSize: "0.8rem", fontWeight: 600 },
  pickTextWrap: { display: "flex", flexDirection: "column", alignItems: "flex-start", flex: 1, minWidth: 0 },
  pickLabel: { color: "#243026", fontSize: "0.92rem" },
  pickNote: { color: "#7C8574", fontSize: "0.72rem", marginTop: 1 },
  pickNoteEmpty: { color: "#7C857466", fontSize: "0.72rem", marginTop: 1, cursor: "pointer" },
  noteInput: { width: "100%", marginTop: 2, padding: "4px 6px", borderRadius: 6, border: "1px solid #3E7C59", background: "#FFFFFF", color: "#243026", fontFamily: "'Heebo', sans-serif", fontSize: "16px", boxSizing: "border-box" },
  qtyTagUnused: {},
  pickHint: { marginInlineStart: "auto", color: "#7C8574", fontSize: "0.72rem" },
  kgWrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: 1, flex: "0 0 auto" },
  kgLabel: { fontSize: "0.68rem", color: "#7C8574", lineHeight: 1 },
  stepper: { display: "flex", alignItems: "center", gap: 0, flex: "0 0 auto", background: "#FFFFFF", border: "1px solid #24302633", borderRadius: 8, overflow: "hidden" },
  stepperBtn: { width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: "#243026", fontSize: "1rem", fontWeight: 600, cursor: "pointer", lineHeight: 1 },
  stepperInput: { width: 34, height: 26, textAlign: "center", border: "none", background: "transparent", color: "#243026", fontFamily: "'Heebo', sans-serif", fontSize: 16, fontWeight: 600, padding: 0, outline: "none" },
  stepperQty: { width: 22, textAlign: "center", color: "#243026", fontSize: "0.85rem", fontWeight: 600 },
  confirmBtn: { marginTop: 14, padding: "12px", borderRadius: 10, border: "none", background: "#3E7C59", color: "#FFFFFF", fontFamily: "'Heebo', sans-serif", fontWeight: 600, fontSize: "0.92rem", cursor: "pointer" },
  importHelp: { color: "#4B5347", fontSize: "0.83rem", lineHeight: 1.6, marginBottom: 12 },
  importPaste: { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: "1px solid #24302633", background: "#FFFFFF", color: "#243026", fontFamily: "'Heebo', sans-serif", fontSize: 16, lineHeight: 1.6, resize: "vertical", marginBottom: 14 },
  fileDropZone: { display: "flex", alignItems: "center", gap: 10, padding: "16px 14px", borderRadius: 10, border: "1.5px dashed #24302644", background: "#FFFFFF", cursor: "pointer", marginBottom: 14 },
  fileDropText: { color: "#4B5347", fontSize: "0.88rem" },
  importRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 6px", borderBottom: "1px solid #24302614" },
  importCatSelect: { flex: "0 0 auto", padding: "5px 6px", borderRadius: 6, border: "1px solid #24302633", background: "#FFFFFF", color: "#4B5347", fontFamily: "'Heebo', sans-serif", fontSize: "0.72rem" },
};
