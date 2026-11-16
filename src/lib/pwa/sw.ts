// Der Service Worker, beim Build als Text erzeugt (kein Workbox). Die Entscheidungen stecken in zwei reinen Funktionen,
// die hier getestet werden und wörtlich in den Service Worker kommen (`toString()`): Sie dürfen daher nichts
// importieren und nur auf ihre Parameter zugreifen.
//
// Strategie:
// – install: alle Dateien der Liste in einen Cache dieser Version laden (am HTTP-Cache vorbei). Kein skipWaiting:
//   Eine neue Version wartet, bis keine Seite der alten mehr offen ist. Ein laufendes Spiel wird nie neu geladen,
//   und eine alte Seite bekommt bis zuletzt ihre alten Dateien (auch Three.js, das sie erst später per import() holt).
// – activate: Jetzt ist keine Seite der alten Version mehr offen, also sind ihre Caches überflüssig und werden
//   gelöscht (nur die eigenen, erkennbar am Präfix). clients.claim() übernimmt Seiten ohne Service Worker, etwa beim
//   allerersten Besuch.
// – fetch: nur GET auf der eigenen Seite. Dateien der Liste kommen aus dem Cache (sonst aus dem Netz), ein Aufruf der
//   Spielseite selbst bekommt ihr gespeichertes HTML – so startet das Spiel auch ohne Netz. Alles andere geht
//   unverändert ins Netz und wird nicht gespeichert.

/** Schlüssel im Cache für eine Anfrage, oder `null`: dann kümmert sich der Service Worker nicht darum */
export function cacheKey(url: string, method: string, origin: string, files: string[], scope: string): string | null {
  if (method !== 'GET') return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.origin !== origin) return null;
  const path = u.pathname === scope + 'index.html' ? scope : u.pathname;
  return files.indexOf(path) >= 0 ? path : null;
}

/** Caches, die weg können: eigene (Präfix) außer dem aktuellen. Fremde Caches derselben Seite bleiben unberührt */
export function staleCaches(keys: string[], prefix: string, current: string): string[] {
  return keys.filter((k) => k.indexOf(prefix) === 0 && k !== current);
}

export type ServiceWorkerOptions = {
  version: string; // ändert sich mit jedem Inhalt (cacheVersion)
  files: string[]; // was vorab gespeichert wird
  scope: string; // z. B. "/spielen/"
  prefix: string; // Präfix der eigenen Caches, z. B. "mitwachsen-"
};

/** Quelltext des Service Workers */
export function serviceWorkerSource({ version, files, scope, prefix }: ServiceWorkerOptions): string {
  return `// Service Worker von Mitwachsen – beim Build erzeugt (src/lib/pwa/sw.ts), nicht von Hand ändern.
'use strict';
const PREFIX = ${JSON.stringify(prefix)};
const CACHE = PREFIX + ${JSON.stringify(version)};
const SCOPE = ${JSON.stringify(scope)};
const FILES = ${JSON.stringify(files, null, 2)};
const cacheKey = ${cacheKey.toString()};
const staleCaches = ${staleCaches.toString()};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(staleCaches(keys, PREFIX, CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const key = cacheKey(event.request.url, event.request.method, self.location.origin, FILES, SCOPE);
  if (key === null) return;
  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(key))
      .then((hit) => hit || fetch(event.request)),
  );
});
`;
}
