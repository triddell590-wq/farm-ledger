// Farm Ledger service worker: keeps a full copy of the app on the phone so it opens
// with no signal or one bar. Updates still arrive on their own when the signal is good.
const CACHE = "farm-ledger-v9-14";
const ASSETS = [
  "./", "./index.html", "./manifest.json", "./icons/icon-192.png", "./icons/icon-512.png", "./board-feed.js",
  "./vendor/firebase-app-compat.js", "./vendor/firebase-firestore-compat.js", "./vendor/firebase-auth-compat.js",
  "./vendor/leaflet.js", "./vendor/leaflet.css",
  "./vendor/images/layers.png", "./vendor/images/layers-2x.png", "./vendor/images/marker-icon.png",
  "./vendor/images/marker-icon-2x.png", "./vendor/images/marker-shadow.png",
];
// Offline photo reader (about 13 MB). Kept in its own cache so it is downloaded once, not on every app update.
const OCR_CACHE = "farm-ledger-ocr-v1";
const OCR_ASSETS = ["./ocr/ocr-worker.js", "./ocr/tesseract-core-simd-lstm.wasm.js", "./ocr/tesseract-core-lstm.wasm.js", "./ocr/eng.traineddata"];
// Satellite map tiles you've looked at, so the Land map still shows your fields with no signal.
const TILE_CACHE = "farm-ledger-tiles-v1";
const TILE_MAX = 4000; // about 60-80 MB at most
const TILE_HOSTS = ["server.arcgisonline.com", "services.arcgisonline.com", "sh.dataspace.copernicus.eu"];
// How long to wait for the internet before opening the saved copy instead.
const NET_WAIT_MS = 3000;

self.addEventListener("install", (e) => {
  e.waitUntil(Promise.all([
    caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: "reload" })))),
    caches.open(OCR_CACHE).then(async (c) => {
      for (const u of OCR_ASSETS) { if (!(await c.match(u))) { try { await c.add(u); } catch (err) {} } }
    }),
  ]));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  const keep = [CACHE, OCR_CACHE, TILE_CACHE];
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k)))));
  self.clients.claim();
});

let tilePuts = 0;
async function trimTiles(c) {
  const keys = await c.keys();
  if (keys.length > TILE_MAX) await Promise.all(keys.slice(0, keys.length - TILE_MAX).map((k) => c.delete(k)));
}

// The app itself: try the internet, but never wait more than NET_WAIT_MS if a saved copy exists.
// A slow download carries on in the background and is used next time.
function appFirst(e) {
  const req = e.request;
  return caches.open(CACHE).then(async (c) => {
    const net = fetch(req).then((res) => { if (res && res.ok) c.put(req, res.clone()); return res; });
    e.waitUntil(net.catch(() => {}));
    let saved = await c.match(req, { ignoreSearch: true });
    if (!saved && req.mode === "navigate") saved = await c.match("./index.html");
    if (!saved) return net.catch(() => c.match("./index.html"));
    const wait = new Promise((r) => setTimeout(() => r(saved), NET_WAIT_MS));
    return Promise.race([net.then((res) => (res && res.ok ? res : saved)).catch(() => saved), wait]);
  });
}

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  if (url.origin === self.location.origin && url.pathname.includes("/ocr/")) {
    e.respondWith(caches.open(OCR_CACHE).then((c) => c.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
      if (res && res.ok) c.put(e.request, res.clone());
      return res;
    }))));
    return;
  }

  // Everything except the page itself is saved per version: phone copy first, no waiting.
  if (url.origin === self.location.origin && e.request.mode !== "navigate" && !/\/(index\.html)?$/.test(url.pathname)) {
    e.respondWith(caches.open(CACHE).then((c) => c.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
      if (res && res.ok) c.put(e.request, res.clone());
      return res;
    }))));
    return;
  }

  if (TILE_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(TILE_CACHE).then(async (c) => {
      const hit = await c.match(e.request);
      const net = fetch(e.request).then((res) => {
        if (res && (res.ok || res.type === "opaque")) {
          c.put(e.request, res.clone());
          if (++tilePuts % 100 === 0) trimTiles(c);
        }
        return res;
      });
      if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
      return net.catch(() => new Response("", { status: 504 }));
    }));
    return;
  }

  // Sign-in and database traffic (Google) is handled by Firebase's own offline storage.
  if (url.origin !== self.location.origin) return;

  e.respondWith(appFirst(e));
});
