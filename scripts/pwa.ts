// Prüflogik für das App-Gate (npm run verify:pwa) – rein, ohne Dateisystem, damit testbar; das Einlesen macht
// verify-pwa.ts. Prüft die fertige Seite: Manifest, Icons und den erzeugten Service Worker des Spiels.
// – Der Service Worker speichert genau, was die Spielseite braucht (neu gesammelt), dazu jede JavaScript-Datei der
//   Seite – auch das nachträglich geladene Three.js. Nur Pfade der eigenen Seite, und jede Datei gibt es.
// – Seine Version passt zum Inhalt: Sonst bekämen Geräte eine neue Fassung nie.
// – Das Manifest startet im Spiel, hat Icons in den Größen, die es angibt, und legt die Drehung nicht fest.
// – Jede Seite verweist auf das Manifest.
// – Was vorab gespeichert wird, bleibt im Budget: Jedes Gerät lädt es bei jeder neuen Version ganz (am HTTP-Cache
//   vorbei), auch über das Mobilfunknetz. Gezählt wird ohne Three.js, das hat im Bundle-Gate eine eigene, an seine
//   Version gebundene Grenze. Die Ausgabe zeigt die Teile getrennt: Kern, Three.js und je Welt-Paket (samt 3D-Teil).
import { cacheVersion, distFile, htmlRefs, precacheList, type ReadFile } from '../src/lib/pwa/precache.ts';

export type PwaOptions = {
  origin: string;
  manifest: string; // z. B. "/manifest.webmanifest"
  sw: { url: string; scope: string; entry: string; prefix: string };
};

/** Breite und Höhe eines PNG (aus dem IHDR-Block), sonst null */
export function pngSize(bytes: Uint8Array): [number, number] | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || sig.some((b, i) => bytes[i] !== b)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [view.getUint32(16), view.getUint32(20)];
}

/** Liste und Cache-Name aus dem Quelltext des Service Workers */
export function parseServiceWorker(source: string): { files: string[]; cache: string } | null {
  const files = source.match(/const FILES = (\[[\s\S]*?\]);/)?.[1];
  const prefix = source.match(/const PREFIX = ("[^"]*");/)?.[1];
  const version = source.match(/const CACHE = PREFIX \+ ("[^"]*");/)?.[1];
  if (!files || !prefix || !version) return null;
  try {
    return {
      files: JSON.parse(files) as string[],
      cache: (JSON.parse(prefix) as string) + (JSON.parse(version) as string),
    };
  } catch {
    return null;
  }
}

const text = (b: Uint8Array | null) => (b ? new TextDecoder().decode(b) : null);

/** Verstöße des Service Workers (leer = alles gut). `scripts`: alle JavaScript-Dateien der Seite */
export function checkServiceWorker(read: ReadFile, scripts: string[], opts: PwaOptions): string[] {
  const source = text(read(distFile(opts.sw.url)));
  if (source === null) return [`${opts.sw.url} fehlt`];
  if (!opts.sw.url.startsWith(opts.sw.scope)) return [`${opts.sw.url} liegt nicht in ${opts.sw.scope}`];
  const sw = parseServiceWorker(source);
  if (!sw) return [`${opts.sw.url}: Liste oder Version nicht lesbar`];
  const problems: string[] = [];
  const listed = new Set(sw.files);
  if (listed.has(opts.sw.url)) problems.push(`${opts.sw.url}: speichert sich selbst`);
  for (const f of sw.files) {
    if (!/^\/(?!\/)/.test(f)) problems.push(`${opts.sw.url}: ${f} ist kein Pfad der eigenen Seite`);
    else if (!read(distFile(f))) problems.push(`${opts.sw.url}: ${f} fehlt in dist`);
  }
  const need = precacheList(opts.sw.entry, read, opts.origin, [opts.sw.url]);
  for (const f of need.missing) problems.push(`${opts.sw.entry} verweist auf ${f}, das fehlt in dist`);
  for (const f of need.files) if (!listed.has(f)) problems.push(`${opts.sw.url}: ${f} fehlt in der Liste`);
  for (const f of scripts) if (!listed.has(f)) problems.push(`${opts.sw.url}: JavaScript ${f} fehlt in der Liste`);
  if (!listed.has(opts.sw.entry)) problems.push(`${opts.sw.url}: die Spielseite ${opts.sw.entry} fehlt`);
  if (!listed.has(opts.manifest)) problems.push(`${opts.sw.url}: das Manifest fehlt`);
  const expected = opts.sw.prefix + cacheVersion(sw.files, read);
  if (sw.cache !== expected) problems.push(`${opts.sw.url}: Version ${sw.cache} passt nicht zum Inhalt (${expected})`);
  return problems;
}

/** Gesamtgröße der vorab gespeicherten Dateien in Bytes; fehlende Dateien zählen nicht (meldet checkServiceWorker) */
export function precacheBytes(files: string[], read: ReadFile): number {
  return files.reduce((sum, f) => sum + (read(distFile(f))?.byteLength ?? 0), 0);
}

/** Teil des vorab Gespeicherten, für die Ausgabe des Gates: Name und Bytes */
export type PrecachePart = { name: string; bytes: number };

/**
 * Zu welchem Teil eine Datei gehört: die 3D-Ansicht (`mitwachsen-3d`, nachgeladen), Three.js, ein Welt-Paket
 * (`welt-<welt>`, sein 3D-Teil `welt-<welt>-3d`) oder Kern (auch Teile, die Kern, 3D-Ansicht und Pakete teilen)
 */
export function partOf(file: string): string {
  if (/\/mitwachsen-3d\.[\w-]+\.js$/.test(file)) return '3D-Ansicht';
  if (/\/three\.[\w-]+\.js$/.test(file)) return 'Three.js';
  const world = /\/welt-([a-z]+)(-3d)?\.[\w-]+\.js$/.exec(file);
  if (world) return `Welt-Paket ${world[1]}${world[2] ? ' (3D)' : ''}`;
  return 'Kern';
}

/**
 * Vorab Gespeichertes nach Teilen: Kern (Spielseite, Skripte, Schriften, Bilder, Töne), 3D-Ansicht, Three.js und je
 * Welt-Paket getrennt (sein 3D-Teil für sich), in dieser Reihenfolge; fehlende Dateien zählen nicht
 */
export function precacheParts(files: string[], read: ReadFile): PrecachePart[] {
  const parts = new Map<string, number>([
    ['Kern', 0],
    ['3D-Ansicht', 0],
    ['Three.js', 0],
  ]);
  for (const f of files) {
    const name = partOf(f);
    parts.set(name, (parts.get(name) ?? 0) + (read(distFile(f))?.byteLength ?? 0));
  }
  const rank = (n: string) => ['Kern', '3D-Ansicht', 'Three.js'].indexOf(n) >>> 0; // Pakete (-1) zuletzt
  return [...parts]
    .map(([name, bytes]) => ({ name, bytes }))
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
}

/**
 * Verstoß, wenn die vorab gespeicherten Dateien zusammen größer sind als `budget` Bytes; Dateien der Teile in `without`
 * (Namen wie bei `partOf`, z. B. 'Three.js') zählen nicht
 */
export function checkPrecacheSize(files: string[], read: ReadFile, budget: number, without: string[] = []): string[] {
  const bytes = precacheBytes(
    files.filter((f) => !without.includes(partOf(f))),
    read,
  );
  const what = without.length ? ` ohne ${without.join(', ')}` : '';
  return bytes > budget
    ? [
        `Service Worker speichert${what} ${bytes} Bytes vorab, erlaubt sind ${budget} (PRECACHE_BUDGET in scripts/verify-pwa.ts)`,
      ]
    : [];
}

type Manifest = {
  name?: string;
  short_name?: string;
  start_url?: string;
  scope?: string;
  display?: string;
  orientation?: string;
  icons?: { src?: string; sizes?: string; purpose?: string }[];
};

/** Verstöße des Manifests (leer = alles gut) */
export function checkManifest(read: ReadFile, opts: PwaOptions): string[] {
  const where = opts.manifest;
  let m: Manifest;
  try {
    m = JSON.parse(text(read(distFile(where))) ?? '') as Manifest;
  } catch {
    return [`${where} fehlt oder ist kein JSON`];
  }
  const problems: string[] = [];
  if (!m.name || !m.short_name) problems.push(`${where}: name oder short_name fehlt`);
  if (m.start_url !== opts.sw.entry) problems.push(`${where}: start_url ist ${m.start_url}, nicht ${opts.sw.entry}`);
  if (!m.scope || !m.start_url?.startsWith(m.scope)) problems.push(`${where}: start_url liegt nicht in scope`);
  if (!['standalone', 'fullscreen'].includes(m.display ?? '')) problems.push(`${where}: display ${m.display}`);
  if (m.orientation && m.orientation !== 'any') problems.push(`${where}: orientation legt die Drehung fest`);
  return [...problems, ...checkIcons(m.icons ?? [], read, where)];
}

/** Icons: 192 und 512, je ohne und mit Maske, und jedes PNG so groß, wie das Manifest sagt */
function checkIcons(icons: NonNullable<Manifest['icons']>, read: ReadFile, where: string): string[] {
  const problems: string[] = [];
  for (const purpose of ['any', 'maskable'])
    for (const size of [192, 512])
      if (!icons.some((i) => i.sizes === `${size}x${size}` && (i.purpose ?? 'any').split(' ').includes(purpose)))
        problems.push(`${where}: Icon ${size}×${size} (${purpose}) fehlt`);
  for (const i of icons) {
    const bytes = i.src?.startsWith('/') ? read(distFile(i.src)) : null;
    const size = bytes && pngSize(bytes);
    if (!size) problems.push(`${where}: Icon ${i.src} fehlt oder ist kein PNG`);
    else if (`${size[0]}x${size[1]}` !== i.sizes)
      problems.push(`${where}: ${i.src} ist ${size.join('×')}, nicht ${i.sizes}`);
  }
  return problems;
}

/** Seiten ohne Verweis auf das Manifest */
export function checkManifestLinks(pages: [string, string][], manifest: string): string[] {
  return pages
    .filter(([, html]) => !/<meta http-equiv="refresh"/i.test(html))
    .filter(([, html]) => !/<link\b[^>]*\brel="manifest"/i.test(html) || !htmlRefs(html).includes(manifest))
    .map(([page]) => `${page}: kein <link rel="manifest" href="${manifest}">`);
}
