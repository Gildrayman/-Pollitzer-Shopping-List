// A small on-screen trace, shown only outside the real site (for example in
// the test preview inside Claude), so a problem there can be seen and reported.
// The trace survives a reload of the page (kept in window.name).

const ON = typeof location !== "undefined" && !/github\.io$/.test(location.hostname);
const MAX = 14;
let lines = [];
let box = null;

function load() {
  try {
    const m = /^dbg:(.*)$/.exec(window.name || "");
    if (m) lines = JSON.parse(m[1]);
  } catch {}
}
function save() {
  try { window.name = "dbg:" + JSON.stringify(lines.slice(-MAX)); } catch {}
}
function draw() {
  if (!ON) return;
  try {
    if (!box) {
      box = document.createElement("div");
      box.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#000c;color:#9f9;font:11px/1.35 monospace;direction:ltr;text-align:left;padding:4px 6px;max-height:34vh;overflow:auto;white-space:pre-wrap;pointer-events:none";
      (document.body || document.documentElement).appendChild(box);
    }
    box.textContent = lines.slice(-MAX).join("\n");
  } catch {}
}

export function trace(msg) {
  if (!ON) return;
  const t = new Date();
  const p = (n) => String(n).padStart(2, "0");
  lines.push(`${p(t.getMinutes())}:${p(t.getSeconds())} ${msg}`);
  lines = lines.slice(-MAX);
  save();
  draw();
}

if (ON) {
  load();
  let lsOk = "no";
  try { window.localStorage.setItem("_t", "1"); window.localStorage.removeItem("_t"); lsOk = "yes"; } catch {}
  trace(`LOAD build=${typeof __BUILD__ !== "undefined" ? __BUILD__ : "?"} localStorage=${lsOk} top=${(() => { try { return window.top === window ? "self" : "framed"; } catch { return "framed-x"; } })()}`);
  window.addEventListener("error", (e) => trace("ERROR " + (e.message || e.type)));
  window.addEventListener("unhandledrejection", (e) => trace("REJECT " + (e.reason && e.reason.message ? e.reason.message : String(e.reason))));
  document.addEventListener("visibilitychange", () => trace("visibility " + document.visibilityState));
  window.addEventListener("pagehide", () => trace("pagehide"));
  window.addEventListener("beforeunload", () => trace("beforeunload"));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", draw);
  else setTimeout(draw, 0);
}
