/* Long Ascent: offline support for the web app. The game's code is fetched fresh whenever there is a network
   (and kept as a fallback), fonts, icons and sound are served from the cache once they have been seen.
   Raise CACHE together with APP_VERSION in index.html. */
const CACHE = "long-ascent-v2";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest", "./css/style.css",
  "./js/icons.js", "./js/core.js", "./js/scene.js", "./js/fx.js", "./js/audio.js", "./js/ui.js",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png",
  "./fonts/archivo-latin-800-normal.woff2", "./fonts/besley-latin-800-normal.woff2", "./fonts/grenze-gotisch-latin-600-normal.woff2",
  "./fonts/ibm-plex-sans-latin-400-italic.woff2", "./fonts/ibm-plex-sans-latin-400-normal.woff2", "./fonts/ibm-plex-sans-latin-600-normal.woff2",
  "./fonts/ibm-plex-sans-latin-700-normal.woff2", "./fonts/im-fell-english-latin-400-italic.woff2", "./fonts/im-fell-english-latin-400-normal.woff2",
  "./fonts/michroma-latin-400-normal.woff2", "./fonts/source-serif-4-latin-400-italic.woff2", "./fonts/source-serif-4-latin-400-normal.woff2",
  "./fonts/source-serif-4-latin-600-normal.woff2", "./fonts/source-serif-4-latin-700-normal.woff2"
];
const CODE = /\.(html|js|css|webmanifest)$/;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
/* the page hands over the list of music files, so they can be played with no network later */
self.addEventListener("message", (e) => {
  const list = e.data && e.data.cache;
  if (!Array.isArray(list)) return;
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(list.map((u) => c.match(u).then((hit) => hit || c.add(u).catch(() => {}))))));
});
function keep(req, resp) {
  if (resp && resp.status === 200 && resp.type === "basic") { const copy = resp.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
  return resp;
}
/* an audio element asks for byte ranges: answer them from the cached file */
function slice(req, resp) {
  return resp.arrayBuffer().then((buf) => {
    const size = buf.byteLength, m = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") || "");
    let start = m && m[1] ? +m[1] : 0, end = m && m[2] ? +m[2] : size - 1;
    if (m && !m[1] && m[2]) { start = Math.max(0, size - +m[2]); end = size - 1; }
    end = Math.min(end, size - 1);
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + size } });
    return new Response(buf.slice(start, end + 1), { status: 206, headers: {
      "Content-Type": resp.headers.get("Content-Type") || "audio/mpeg", "Content-Range": "bytes " + start + "-" + end + "/" + size,
      "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes" } });
  });
}
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (req.headers.has("range")) {
    e.respondWith(caches.match(url.href).then((hit) => {
      if (hit) return slice(req, hit);
      caches.open(CACHE).then((c) => c.add(url.href).catch(() => {}));       // fetch the whole file once, for next time
      return fetch(req);
    }));
    return;
  }
  if (req.mode === "navigate" || CODE.test(url.pathname) || url.pathname.endsWith("/")) {
    const key = req.mode === "navigate" ? "./index.html" : req;
    e.respondWith(fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then((resp) => {
      if (resp && resp.status === 200) { const copy = resp.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); }
      return resp;
    }).catch(() => caches.match(key).then((hit) => hit || caches.match("./index.html"))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((resp) => keep(req, resp))));
});
