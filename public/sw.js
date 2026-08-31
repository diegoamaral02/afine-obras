// public/sw.js — Service Worker v5: offline, background sync, push notifications
const CACHE = "afine-v5";
const STATIC = ["/", "/index.html", "/logo.png", "/manifest.json"];

// ── Install: cache static assets ──────────────────────────────────────────────
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────────────────────────
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for Firebase, cache-first for static ─────────────────
self.addEventListener("fetch", e => {
  if (
    e.request.url.includes("firebase") ||
    e.request.url.includes("googleapis") ||
    e.request.url.includes("firestore") ||
    e.request.method !== "GET"
  ) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
      // Cache first (fast), background revalidate for HTML
      return cached || networkFetch.catch(() => caches.match("/index.html"));
    })
  );
});

// ── Background Sync: avisar app para processar fila offline ───────────────────
self.addEventListener("sync", e => {
  if (e.tag === "afine-offline-queue") {
    e.waitUntil(notifyClientsToSync());
  }
});

async function notifyClientsToSync() {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  clients.forEach(client => client.postMessage({ type: "SYNC_QUEUE" }));
}

// ── Message from app ──────────────────────────────────────────────────────────
self.addEventListener("message", e => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (e.data?.type === "REGISTER_SYNC") {
    self.registration.sync?.register("afine-offline-queue").catch(() => {});
  }
});
