import React from "react";
import { createRoot } from "react-dom/client";
import PasswordGate from "./password-gate.jsx";
import ShoppingList from "./family-shopping-list.jsx";
import { registerServiceWorker, startBadges } from "./badge.js";
import { flushNow } from "./sync.js";

registerServiceWorker();
startBadges();

// Closing the app, switching away or turning the screen off: finish any typing
// (a quantity, a note or a name saves when its field loses focus) and send the
// latest list to the family copy. Each change is already saved on the phone.
const saveBeforeLeaving = () => {
  const el = document.activeElement;
  if (el && el !== document.body && typeof el.blur === "function") el.blur();
  flushNow();
};
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveBeforeLeaving();
});
window.addEventListener("pagehide", saveBeforeLeaving);

// Phones keep an old copy of the site for a while after an update. Ask the server for the
// newest page, and if its build differs from the one running, load it once.
const BUILD = typeof __BUILD__ !== "undefined" ? __BUILD__ : "dev";
(async () => {
  try {
    if (!/github\.io$/.test(location.hostname)) return;
    const res = await fetch(`${location.pathname}?check=${Date.now()}`, { cache: "no-store" });
    const html = await res.text();
    const m = html.match(/name="app-build" content="([^"]+)"/);
    const latest = m && m[1];
    const tried = sessionStorage.getItem("reloaded-for");
    if (latest && latest !== BUILD && tried !== latest) {
      sessionStorage.setItem("reloaded-for", latest);
      location.replace(`${location.pathname}?v=${latest}`);
    }
  } catch (e) {
    // offline or blocked: keep the copy we have
  }
})();

// If something breaks, say so on the screen instead of showing a blank page.
class ErrorScreen extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div dir="rtl" style={{ padding: 24, fontFamily: "sans-serif", textAlign: "center" }}>
        <p style={{ fontSize: "1.1rem", fontWeight: 700 }}>משהו השתבש. הרשימה שמורה, נסו לפתוח שוב.</p>
        <button type="button" onClick={() => location.reload()} style={{ padding: "10px 18px", fontSize: "1rem" }}>לפתוח שוב</button>
        <p style={{ color: "#888", fontSize: "0.8rem", direction: "ltr" }}>{String(this.state.error && this.state.error.message)}</p>
      </div>
    );
  }
}

createRoot(document.getElementById("root")).render(
  <ErrorScreen>
    <PasswordGate>
      <ShoppingList />
    </PasswordGate>
  </ErrorScreen>
);
