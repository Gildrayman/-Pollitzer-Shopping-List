// Service worker of the shopping app. It lets the phone install the app on the home
// screen and show the "list updated" notice. Pages are not cached, so every open
// loads the newest version.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Tapping the notice opens the app (or brings it forward) and clears the badge.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (all.length) return all[0].focus();
    return self.clients.openWindow("./");
  })());
});
