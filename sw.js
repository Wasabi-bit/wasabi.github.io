const CACHE_NAME = "family-voice-book-v1";
const APP_FILES = ["./", "./index.html", "./styles.css", "./app.js", "./manifest.json", "./app-icon.svg", "./apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
