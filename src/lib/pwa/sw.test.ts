import { describe, expect, it } from 'vitest';
import { cacheKey, serviceWorkerSource, staleCaches } from './sw';

const ORIGIN = 'https://www.example.de';
const FILES = ['/_astro/game.js', '/_astro/three.js', '/manifest.webmanifest', '/spielen/'];

describe('Service Worker: Entscheidungen', () => {
  it('bedient nur GET auf der eigenen Seite und nur Dateien der Liste', () => {
    const key = (url: string, method = 'GET') => cacheKey(url, method, ORIGIN, FILES, '/spielen/');
    expect(key(`${ORIGIN}/_astro/three.js`)).toBe('/_astro/three.js');
    expect(key(`${ORIGIN}/spielen/`)).toBe('/spielen/');
    expect(key(`${ORIGIN}/spielen/?welt=1`)).toBe('/spielen/');
    expect(key(`${ORIGIN}/spielen/index.html`)).toBe('/spielen/');
    expect(key(`${ORIGIN}/_astro/game.js`, 'POST')).toBeNull();
    expect(key('https://cdn.example.com/_astro/game.js')).toBeNull();
    expect(key(`${ORIGIN}/`)).toBeNull();
    expect(key(`${ORIGIN}/spielen/anderes`)).toBeNull();
    expect(key('kaputt')).toBeNull();
  });

  it('räumt nur eigene alte Caches weg', () => {
    expect(staleCaches(['mitwachsen-a', 'mitwachsen-b', 'fremd'], 'mitwachsen-', 'mitwachsen-b')).toEqual([
      'mitwachsen-a',
    ]);
  });
});

type Handler = (event: Record<string, unknown>) => void;

/** Führt den erzeugten Service Worker in einer kleinen Nachbildung der Browser-Umgebung aus */
function runServiceWorker(version: string, store: Map<string, Map<string, string>>) {
  const handlers = new Map<string, Handler>();
  const log: string[] = [];
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Handler) => handlers.set(type, fn),
    clients: { claim: () => (log.push('claim'), Promise.resolve()) },
  };
  const cacheOf = (name: string) => {
    const entries = store.get(name) ?? new Map<string, string>();
    store.set(name, entries);
    return {
      addAll: (reqs: { url: string; cache: string }[]) => {
        for (const r of reqs) {
          log.push(`lade ${r.url} (${r.cache})`);
          entries.set(r.url, `${version}:${r.url}`);
        }
        return Promise.resolve();
      },
      match: (key: string) => Promise.resolve(entries.get(key)),
    };
  };
  const caches = {
    open: (name: string) => Promise.resolve(cacheOf(name)),
    keys: () => Promise.resolve([...store.keys()]),
    delete: (name: string) => Promise.resolve(store.delete(name)),
  };
  const fetch = (req: { url: string }) => Promise.resolve(`netz:${req.url}`);
  class Request {
    constructor(
      readonly url: string,
      readonly init: { cache: string },
    ) {}
    get cache() {
      return this.init.cache;
    }
  }
  const source = serviceWorkerSource({ version, files: FILES, scope: '/spielen/', prefix: 'mitwachsen-' });
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const run = new Function('self', 'caches', 'fetch', 'Request', source) as (...env: unknown[]) => void;
  run(self, caches, fetch, Request);

  const waitUntil = async (type: string) => {
    let done: Promise<unknown> = Promise.resolve();
    handlers.get(type)!({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
  };
  const request = async (url: string, method = 'GET') => {
    const answer: { p: Promise<unknown> | null } = { p: null };
    handlers.get('fetch')!({ request: { url, method }, respondWith: (p: Promise<unknown>) => (answer.p = p) });
    return answer.p === null ? 'durchgereicht' : await answer.p;
  };
  return { install: () => waitUntil('install'), activate: () => waitUntil('activate'), request, log };
}

describe('Service Worker: Ablauf', () => {
  it('speichert beim Installieren alles am HTTP-Cache vorbei und antwortet danach aus dem Cache', async () => {
    const store = new Map<string, Map<string, string>>();
    const sw = runServiceWorker('v1', store);
    await sw.install();
    expect(sw.log).toContain('lade /_astro/three.js (reload)');
    expect([...store.keys()]).toEqual(['mitwachsen-v1']);
    await sw.activate();
    expect(sw.log).toContain('claim');
    expect(await sw.request(`${ORIGIN}/spielen/`)).toBe('v1:/spielen/');
    expect(await sw.request(`${ORIGIN}/_astro/three.js`)).toBe('v1:/_astro/three.js');
    expect(await sw.request(`${ORIGIN}/_astro/game.js`, 'POST')).toBe('durchgereicht');
    expect(await sw.request('https://cdn.example.com/x.js')).toBe('durchgereicht');
    store.get('mitwachsen-v1')!.delete('/_astro/game.js');
    expect(await sw.request(`${ORIGIN}/_astro/game.js`)).toBe(`netz:${ORIGIN}/_astro/game.js`);
  });

  it('eine neue Version lässt die alte stehen, bis sie aktiv wird, und räumt erst dann auf', async () => {
    const store = new Map<string, Map<string, string>>([['fremd', new Map()]]);
    const old = runServiceWorker('v1', store);
    await old.install();
    await old.activate();
    const next = runServiceWorker('v2', store);
    await next.install();
    // Die alte Seite läuft noch und holt Three.js erst jetzt: Es kommt aus ihrem Cache
    expect([...store.keys()].sort()).toEqual(['fremd', 'mitwachsen-v1', 'mitwachsen-v2']);
    expect(await old.request(`${ORIGIN}/_astro/three.js`)).toBe('v1:/_astro/three.js');
    await next.activate();
    expect([...store.keys()].sort()).toEqual(['fremd', 'mitwachsen-v2']);
    expect(await next.request(`${ORIGIN}/spielen/`)).toBe('v2:/spielen/');
  });

  it('wartet ohne skipWaiting auf das Ende der alten Seiten', () => {
    const source = serviceWorkerSource({ version: 'v', files: [], scope: '/s/', prefix: 'p-' });
    expect(source).not.toContain('skipWaiting');
  });
});
