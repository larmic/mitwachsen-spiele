import { describe, expect, it } from 'vitest';
import {
  checkManifest,
  checkManifestLinks,
  checkPrecacheSize,
  checkServiceWorker,
  parseServiceWorker,
  partOf,
  precacheParts,
  pngSize,
  precacheBytes,
  type PwaOptions,
} from './pwa.ts';
import { cacheVersion } from '../src/lib/pwa/precache.ts';
import { serviceWorkerSource } from '../src/lib/pwa/sw.ts';

const OPTS: PwaOptions = {
  origin: 'https://www.example.de',
  manifest: '/manifest.webmanifest',
  sw: { url: '/spielen/sw.js', scope: '/spielen/', entry: '/spielen/', prefix: 'mw-' },
};
const enc = (s: string) => new TextEncoder().encode(s);

/** PNG-Kopf mit Breite und Höhe */
function png(w: number, h: number) {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const v = new DataView(b.buffer);
  v.setUint32(16, w);
  v.setUint32(20, h);
  return b;
}

const ICONS = [192, 512].flatMap((s) => [
  { src: `/icon-${s}.png`, sizes: `${s}x${s}`, purpose: 'any' },
  { src: `/icon-m-${s}.png`, sizes: `${s}x${s}`, purpose: 'maskable' },
]);
const MANIFEST = {
  name: 'M',
  short_name: 'M',
  start_url: '/spielen/',
  scope: '/',
  display: 'standalone',
  icons: ICONS,
};

function site(overrides: Record<string, Uint8Array | null> = {}, manifest: object = MANIFEST) {
  const files: Record<string, Uint8Array | null> = {
    'spielen/index.html': enc('<link rel="manifest" href="/manifest.webmanifest"><script src="/_astro/g.js"></script>'),
    '_astro/g.js': enc('const t=()=>import("./three.js");"/spielen/sw.js"'),
    '_astro/three.js': enc('three'),
    'manifest.webmanifest': enc(JSON.stringify(manifest)),
    ...Object.fromEntries(ICONS.map((i) => [i.src.slice(1), png(+i.sizes.split('x')[0]!, +i.sizes.split('x')[0]!)])),
  };
  const list = ['/_astro/g.js', '/_astro/three.js', '/manifest.webmanifest', '/spielen/', ...ICONS.map((i) => i.src)];
  const read0 = (p: string) => files[p] ?? null;
  files['spielen/sw.js'] = enc(
    serviceWorkerSource({ version: cacheVersion(list, read0), files: list, scope: '/spielen/', prefix: 'mw-' }),
  );
  Object.assign(files, overrides);
  return (p: string) => files[p] ?? null;
}

describe('App-Gate: Service Worker', () => {
  it('lässt einen vollständigen, aktuellen Service Worker durch', () => {
    expect(checkServiceWorker(site(), ['/_astro/g.js', '/_astro/three.js'], OPTS)).toEqual([]);
  });

  it('liest Liste und Cache-Namen', () => {
    const sw = parseServiceWorker(serviceWorkerSource({ version: 'v1', files: ['/a'], scope: '/', prefix: 'p-' }));
    expect(sw).toEqual({ files: ['/a'], cache: 'p-v1' });
    expect(parseServiceWorker('nichts')).toBeNull();
    expect(parseServiceWorker('const PREFIX = "x";const CACHE = PREFIX + "y";const FILES = [kaputt];')).toBeNull();
  });

  it('meldet fehlenden Service Worker, unlesbare Liste und falschen Ort', () => {
    expect(checkServiceWorker(site({ 'spielen/sw.js': null }), [], OPTS)).toEqual(['/spielen/sw.js fehlt']);
    expect(checkServiceWorker(site({ 'spielen/sw.js': enc('x') }), [], OPTS)[0]).toMatch(/nicht lesbar/);
    const elsewhere = { ...OPTS, sw: { ...OPTS.sw, url: '/sw.js' } };
    expect(checkServiceWorker(site({ 'sw.js': enc('x') }), [], elsewhere)[0]).toMatch(/liegt nicht in/);
  });

  it('meldet fehlende Dateien, fremde Pfade, nachgeladenes JavaScript ohne Eintrag und eine veraltete Version', () => {
    const swWith = (files: string[], version = 'alt') =>
      enc(serviceWorkerSource({ version, files, scope: '/spielen/', prefix: 'mw-' }));
    const problems = checkServiceWorker(
      site({ 'spielen/sw.js': swWith(['//cdn.example.com/x.js', '/weg.js', '/spielen/sw.js']) }),
      ['/_astro/lazy.js'],
      OPTS,
    );
    const expected = [
      /speichert sich selbst/,
      /cdn.example.com\/x.js ist kein Pfad/,
      /\/weg.js fehlt in dist/,
      /\/_astro\/three.js fehlt in der Liste/,
      /JavaScript \/_astro\/lazy.js fehlt/,
      /die Spielseite \/spielen\/ fehlt/,
      /das Manifest fehlt/,
      /Version mw-alt passt nicht/,
    ];
    for (const re of expected)
      expect(
        problems.some((p) => re.test(p)),
        String(re),
      ).toBe(true);
  });

  it('meldet Verweise der Spielseite ins Leere', () => {
    const problems = checkServiceWorker(site({ '_astro/three.js': null }), [], OPTS);
    expect(problems.some((p) => /verweist auf \/_astro\/three.js/.test(p))).toBe(true);
  });
});

describe('App-Gate: Manifest', () => {
  it('lässt ein gültiges Manifest durch', () => {
    expect(checkManifest(site(), OPTS)).toEqual([]);
  });

  it('meldet fehlendes Manifest, falschen Start, festgelegte Drehung und fehlende oder falsche Icons', () => {
    expect(checkManifest(site({ 'manifest.webmanifest': null }), OPTS)[0]).toMatch(/kein JSON/);
    const bad = {
      start_url: '/anders/',
      scope: '/spielen/',
      display: 'browser',
      orientation: 'landscape',
      icons: [{ src: '/icon-192.png', sizes: '512x512' }, { src: '/weg.png', sizes: '192x192' }, {}],
    };
    const problems = checkManifest(site({}, bad), OPTS);
    const expected = [
      /name oder short_name fehlt/,
      /start_url ist \/anders\//,
      /start_url liegt nicht in scope/,
      /display browser/,
      /orientation/,
      /Icon 192×192 \(maskable\) fehlt/,
      /Icon 512×512 \(maskable\) fehlt/,
      /icon-192.png ist 192×192, nicht 512x512/,
      /Icon \/weg.png fehlt/,
      /Icon undefined fehlt/,
    ];
    for (const re of expected)
      expect(
        problems.some((p) => re.test(p)),
        String(re),
      ).toBe(true);
  });

  it('liest die Größe eines PNG', () => {
    expect(pngSize(png(3, 4))).toEqual([3, 4]);
    expect(pngSize(enc('kein png, aber lang genug!'))).toBeNull();
  });
});

describe('App-Gate: Verweis aufs Manifest', () => {
  it('verlangt ihn auf jeder Seite außer Weiterleitungen', () => {
    const pages: [string, string][] = [
      ['index.html', '<link rel="manifest" href="/manifest.webmanifest">'],
      ['alt/index.html', '<meta http-equiv="refresh" content="0;url=/">'],
      ['spielen/index.html', '<link rel="icon" href="/favicon.svg">'],
      ['x.html', '<link rel="manifest" href="/anderes.json">'],
    ];
    expect(checkManifestLinks(pages, '/manifest.webmanifest')).toEqual([
      'spielen/index.html: kein <link rel="manifest" href="/manifest.webmanifest">',
      'x.html: kein <link rel="manifest" href="/manifest.webmanifest">',
    ]);
  });
});

describe('App-Gate: Budget für vorab Gespeichertes', () => {
  const sizes: Record<string, number> = { 'spielen/index.html': 300, '_astro/a.js': 600, '_astro/b.css': 100 };
  const read = (path: string) => (path in sizes ? new Uint8Array(sizes[path]!) : null);
  const files = ['/spielen/', '/_astro/a.js', '/_astro/b.css'];

  it('zählt alle Dateien der Liste zusammen, die Spielseite als index.html', () => {
    expect(precacheBytes(files, read)).toBe(1000);
    expect(precacheBytes([...files, '/fehlt.js'], read)).toBe(1000);
    expect(precacheBytes([], read)).toBe(0);
  });

  it('zeigt die Teile getrennt: Kern, 3D-Ansicht, Three.js, je Welt-Paket und sein 3D-Teil', () => {
    expect(partOf('/_astro/three.BfBt_9-z.js')).toBe('Three.js');
    expect(partOf('/_astro/welt-eis.Cdn6.js')).toBe('Welt-Paket eis');
    expect(partOf('/_astro/welt-eis-3d.Cmi3.js')).toBe('Welt-Paket eis (3D)');
    expect(partOf('/_astro/mitwachsen-3d.Bbfb.js')).toBe('3D-Ansicht');
    expect(partOf('/_astro/mitwachsen-gatehouse.Dssf.js')).toBe('Kern'); // geteilt von Kern, 3D-Ansicht und Paket
    expect(partOf('/spielen/')).toBe('Kern');
    const more: Record<string, number> = {
      ...sizes,
      '_astro/three.x.js': 5000,
      '_astro/welt-eis.x.js': 70,
      '_astro/welt-eis-3d.x.js': 30,
      '_astro/welt-wald.x.js': 40,
      '_astro/mitwachsen-3d.x.js': 900,
    };
    const readMore = (path: string) => (path in more ? new Uint8Array(more[path]!) : null);
    const all = [
      ...files,
      '/_astro/welt-wald.x.js',
      '/_astro/welt-eis-3d.x.js',
      '/_astro/three.x.js',
      '/_astro/mitwachsen-3d.x.js',
    ];
    expect(precacheParts([...all, '/_astro/welt-eis.x.js', '/fehlt.js'], readMore)).toEqual([
      { name: 'Kern', bytes: 1000 },
      { name: '3D-Ansicht', bytes: 900 },
      { name: 'Three.js', bytes: 5000 },
      { name: 'Welt-Paket eis', bytes: 70 },
      { name: 'Welt-Paket eis (3D)', bytes: 30 },
      { name: 'Welt-Paket wald', bytes: 40 },
    ]);
    // ohne 3D-Ansicht, Three.js und Pakete: Kern, 3D-Ansicht und Three.js stehen trotzdem da
    expect(precacheParts(files, read)).toEqual([
      { name: 'Kern', bytes: 1000 },
      { name: '3D-Ansicht', bytes: 0 },
      { name: 'Three.js', bytes: 0 },
    ]);
  });

  it('lässt genau das Budget durch und meldet jedes Byte darüber', () => {
    expect(checkPrecacheSize(files, read, 1000)).toEqual([]);
    expect(checkPrecacheSize(files, read, 999)).toEqual([
      'Service Worker speichert 1000 Bytes vorab, erlaubt sind 999 (PRECACHE_BUDGET in scripts/verify-pwa.ts)',
    ]);
  });

  it('zählt Three.js nicht, wenn es ausgenommen ist (eigene Grenze im Bundle-Gate), alles andere schon', () => {
    const withThree: Record<string, number> = { ...sizes, '_astro/three.x.js': 5000, '_astro/welt-eis.x.js': 70 };
    const readThree = (path: string) => (path in withThree ? new Uint8Array(withThree[path]!) : null);
    const all = [...files, '/_astro/three.x.js', '/_astro/welt-eis.x.js'];
    expect(checkPrecacheSize(all, readThree, 1070, ['Three.js'])).toEqual([]);
    expect(checkPrecacheSize(all, readThree, 1069, ['Three.js'])).toEqual([
      'Service Worker speichert ohne Three.js 1070 Bytes vorab, erlaubt sind 1069 (PRECACHE_BUDGET in scripts/verify-pwa.ts)',
    ]);
    expect(checkPrecacheSize(all, readThree, 1070)).toHaveLength(1);
  });
});
