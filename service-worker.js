// Farm Ledger v9 has been replaced by v10 (/farm-ledger-v10/). This worker replaces the old v9
// one on phones that still have it: it clears v9's saved copy, removes itself and sends any open
// v9 window to the new app. v10's own caches (fl10-*) are left alone.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("farm-ledger-v9")) await caches.delete(k);
    await self.registration.unregister();
    for (const c of await self.clients.matchAll({ type: "window" })) c.navigate("/farm-ledger-v10/").catch(() => {});
  })());
});
