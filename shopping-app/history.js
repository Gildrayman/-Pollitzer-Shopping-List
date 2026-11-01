// Automatic history of the shopping list. Every change to the list (on this phone
// or arriving from another family member) is kept as a version on this phone,
// so any earlier state can be brought back. Kept per family, never sent anywhere,
// and never part of the family copy, so it costs nothing to sync.

import { localKey } from "./families.js";

const KEY = () => localKey("drayman-list-history");
const MAX_ENTRIES = 300;
const MAX_CHARS = 1500000; // about 1.5 MB, well inside the phone's storage

const sig = (items) => JSON.stringify(items || []);

export function readHistory() {
  try {
    const list = JSON.parse(window.localStorage.getItem(KEY()) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// Adds the list as a new version, unless it is the same as the last one.
export function recordHistory(items, by) {
  if (!Array.isArray(items)) return;
  const list = readHistory();
  const s = sig(items);
  const last = list[list.length - 1];
  if (last && sig(last.items) === s) return;
  list.push({ at: Date.now(), by: by || "", items });
  while (list.length > MAX_ENTRIES) list.shift();
  let text = JSON.stringify(list);
  while (text.length > MAX_CHARS && list.length > 1) {
    list.shift();
    text = JSON.stringify(list);
  }
  try {
    window.localStorage.setItem(KEY(), text);
  } catch {
    // Storage full: keep the newer half and try once more.
    try {
      window.localStorage.setItem(KEY(), JSON.stringify(list.slice(Math.floor(list.length / 2))));
    } catch {}
  }
}
