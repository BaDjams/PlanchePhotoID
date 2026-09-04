const CACHE = "planche-photo-id-v8";
const ASSETS = ["./", "index.html", "styles.css?v=8", "layout.js?v=8", "app.js?v=8", "icon.svg", "manifest.webmanifest"];
self.addEventListener("install", event => event.waitUntil(
  caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
));
self.addEventListener("activate", event => event.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim())
));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const networkFirst = event.request.mode === "navigate" || ["script", "style"].includes(event.request.destination);
  event.respondWith(caches.open(CACHE).then(cache => {
    if (networkFirst) {
      return fetch(event.request).then(response => {
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      }).catch(() => cache.match(event.request).then(hit => hit || (event.request.mode === "navigate" ? cache.match("index.html") : undefined)));
    }
    return cache.match(event.request).then(hit => hit || fetch(event.request).then(response => {
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    }));
  }));
});
