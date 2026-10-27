// Red mark on the home-screen icon when someone ELSE changes the list.
// The phone that made the change gets nothing; opening the app clears the mark.

const COUNT_KEY = "drayman-badge-count";
const PROMPT_KEY = "drayman-badge-prompt-done";

const ls = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch {} },
};

export const isInstalled = () =>
  (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const notifyPermission = () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission);
export const badgePromptDone = () => !!ls.get(PROMPT_KEY);
export const markBadgePromptDone = () => ls.set(PROMPT_KEY, "1");

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

// Must run from a tap (iPhone asks only then).
export async function enableBadge() {
  if (typeof Notification === "undefined") return "unsupported";
  const res = await Notification.requestPermission();
  markBadgePromptDone();
  return res;
}

function setBadge(n) {
  try {
    if (n > 0 && navigator.setAppBadge) navigator.setAppBadge(n).catch(() => {});
    else if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
  } catch {}
}

async function showNotice(by, n) {
  if (notifyPermission() !== "granted" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification("רשימת הקניות עודכנה", {
      body: by && by.name ? `${by.name} שינה/תה את הרשימה${n > 1 ? ` (${n} שינויים)` : ""}` : "מישהו מהמשפחה שינה את הרשימה",
      tag: "list-update",
      renotify: true,
      icon: "icon-192.png",
      badge: "icon-192.png",
    });
  } catch {}
}

async function clearAll() {
  ls.set(COUNT_KEY, "0");
  setBadge(0);
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) (await reg.getNotifications({ tag: "list-update" })).forEach((n) => n.close());
  } catch {}
}

export function startBadges() {
  // "family-sync" with detail.by is fired only for changes made on another phone.
  window.addEventListener("family-sync", (e) => {
    const by = e.detail && e.detail.by;
    if (!by || document.visibilityState === "visible") return;
    const n = (parseInt(ls.get(COUNT_KEY), 10) || 0) + 1;
    ls.set(COUNT_KEY, String(n));
    setBadge(n);
    showNotice(by, n);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") clearAll();
  });
  clearAll();
}
