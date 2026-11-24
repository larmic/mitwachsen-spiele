// Smoke-Test des Spiels (Projekte `game` und `3d` in playwright.config.ts): Die Spielseite läuft, ohne Fehler in der
// Konsole (pageerror und console.error). Die Seiten ohne Spiel: e2e/site.spec.ts.
// Alle Tests bis auf einen laufen mit Test-Uhr (`openGame(page, { clock: true })`, e2e/helpers.ts): Takte (`ticks`)
// und Bilder (`render`) spielt der Test selbst ab, so weit es um sie geht. Nur „Spiel läuft live …“ lässt Takt und
// Bildschleife der Seite laufen. Im Projekt `game` zeichnet das Spiel in 2D (ohne WebGL); Tests mit Tag @3d laufen dazu
// im Projekt `3d` mit WebGL: Tests, die das Zeichnen in 3D prüfen, dazu der Live-Test (Bildschleife mit 3D) und die
// Tests rund um Welt-Pakete (fehlt, kommt spät, Welt wechselt), damit ein Fehler nur in der 3D-Ansicht auffällt.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { SCALE } from '../src/scripts/games/worlds/eis/mitwachsen-chime-look';
import { needsBlink } from '../src/scripts/games/mitwachsen-turn';
import { GROTTE, GROTTE_COLORS } from '../src/data/games/worlds/hoehle/mitwachsen-grotte';
import { REGIONS, animalId } from '../src/data/games/mitwachsen';
import {
  FRAME_MS,
  arrive,
  drawEvery,
  expectView,
  gotoGame,
  openGame,
  openMenu,
  play,
  reloadGame,
  render,
  settled,
  ticks,
  view3d,
  watchErrors,
} from './helpers';

/**
 * Das Welt-Paket der Eis-Welt holen und einbauen, wie im Spiel, sobald das Eistor eine Rolle spielt (die Tests öffnen das
 * Tor von Hand über den Zustand, das Paket käme sonst erst im nächsten Takt)
 */
const withIce = (game: Locator) =>
  game.evaluate((node) => {
    const el = node as unknown as {
      packs: { want(need: unknown, gates: unknown): Promise<void> };
      world: { gates: unknown };
    };
    return el.packs.want({ openGates: ['eis'], garden: [], at: [] }, el.world.gates);
  });

/** Welche Welt die Leiste unten zeigt, ein Bild weiter (sie klappt im Bild um) */
const albumShows = async (page: Page, game: Locator) => {
  await render(page);
  return game.evaluate(
    (el) => (el as unknown as { renderer: { album: { turn: { shown?: string } } } }).renderer.album.turn.shown,
  );
};

// Der einzige Test ohne Test-Uhr: Takt und Bildschleife der Seite laufen wie beim Kind, im Projekt `3d` mit 3D
test(
  'Spiel läuft live: Hinweis für Eltern beim ersten Mal, eine Pfeiltaste weckt die Figur, gehalten läuft sie, ohne Fehler',
  { tag: '@3d' },
  async ({ page }) => {
    const errors = watchErrors(page);
    await gotoGame(page);
    await settled(page);
    await expectView(page);
    const info = page.locator('dialog.mw-info');
    await expect(info).toHaveJSProperty('open', true);
    await page.getByRole('button', { name: /Verstanden/ }).click();
    await expect(info).toHaveJSProperty('open', false);
    const game = page.locator('larmic-mitwachsen');
    await expect(game).toHaveClass(/ready/);
    const sleeping = () => game.evaluate((el) => (el as unknown as { state: { sleeping: boolean } }).state.sleeping);
    expect(await sleeping()).toBe(true);
    await page.keyboard.press('ArrowDown');
    await expect.poll(sleeping).toBe(false);
    // Gehalten läuft sie: Der Takt der Seite zählt, die Bildschleife lässt sie Schritt für Schritt gehen und ihr Körper
    // gleitet hinterher. Gegangen wird in die Richtung mit den meisten freien Feldern vor ihr
    type Live = {
      state: { tick: number; player: { x: number; y: number } };
      world: { cell(x: number, y: number): { solid: boolean } };
      bodies: Map<string, { x: number; y: number }>;
    };
    const where = () =>
      game.evaluate((node) => {
        const el = node as unknown as Live;
        const body = el.bodies.get('player');
        return { tick: el.state.tick, x: el.state.player.x, y: el.state.player.y, body: body && [body.x, body.y] };
      });
    const key = await game.evaluate((node) => {
      const el = node as unknown as Live;
      const { x, y } = el.state.player;
      const free = (dx: number, dy: number) => {
        let n = 0;
        while (n < 6 && !el.world.cell(x + dx * (n + 1), y + dy * (n + 1)).solid) n++;
        return n;
      };
      const ways = [
        ['ArrowDown', free(0, 1)],
        ['ArrowUp', free(0, -1)],
        ['ArrowLeft', free(-1, 0)],
        ['ArrowRight', free(1, 0)],
      ] as const;
      return [...ways].sort((a, b) => b[1] - a[1])[0]![0];
    });
    const from = await where();
    await page.keyboard.down(key);
    await expect
      .poll(async () => {
        const now = await where();
        return Math.abs(now.x - from.x) + Math.abs(now.y - from.y);
      })
      .toBeGreaterThanOrEqual(2);
    await page.keyboard.up(key);
    const to = await where();
    expect(to.tick).toBeGreaterThan(from.tick);
    expect(to.body).not.toEqual(from.body);
    expect(errors).toEqual([]);
  },
);

test('Spiel: Portal-Plattform erwacht beim Herangehen, die Mitte bringt zum Bett, runter und wieder rauf zurück', async ({
  page,
}) => {
  const errors = watchErrors(page);
  const game = await openGame(page, { clock: true });
  await page.keyboard.press('ArrowDown');
  await expect
    .poll(() => game.evaluate((el) => (el as unknown as { state: { sleeping: boolean } }).state.sleeping))
    .toBe(false);
  // Über die Felder der Komponente (wie die Regeln sie sehen): Figur auf den freien Ring vor die Plattform am
  // Tor stellen (dort erwacht sie im nächsten Takt), dann Schritt für Schritt wie mit den Pfeiltasten
  type Game = {
    world: {
      portals: Map<string, { gate: [number, number]; home: [number, number] }>;
      gates: Map<string, { out: [number, number] }>;
    };
    state: { player: { x: number; y: number; dir: string }; portals: string[]; arrived: [number, number] | null };
    apply(cmd: { type: 'move'; dir: string } | { type: 'tick' }): void;
    lift(): void; // Nebel um die Figur lichten
  };
  const r = await game.evaluate((node) => {
    const el = node as unknown as Game;
    const [id, p] = [...el.world.portals][0]!;
    const out = el.world.gates.get(id)!.out;
    const dir = (v: readonly number[]) => (v[0]! > 0 ? 'e' : v[0]! < 0 ? 'w' : v[1]! > 0 ? 's' : 'n');
    const [gx, gy] = p.gate;
    el.state = { ...el.state, player: { x: gx - out[0] * 2, y: gy - out[1] * 2, dir: 's' }, portals: [] };
    const walk = (n: number) => {
      for (let i = 0; i < n; i++) el.apply({ type: 'move', dir: dir(out) });
    };
    el.lift(); // wie nach jedem Schritt: Um die Figur lichtet sich der Nebel
    el.apply({ type: 'tick' }); // die Figur ist nah: Die Plattform erwacht
    const woke = el.state.portals.includes(id);
    walk(2); // über den Rand auf die Mitte: Reise zum Bett
    const home = [el.state.player.x, el.state.player.y].join() === p.home.join();
    const arrived = el.state.arrived?.join() === p.home.join();
    // erst runter (zurück in Richtung Tor), dann wieder rauf: zurück zum Tor
    el.apply({ type: 'move', dir: dir(out) });
    el.apply({ type: 'move', dir: dir([-out[0], -out[1]]) });
    return { woke, home, arrived, back: [el.state.player.x, el.state.player.y].join() === p.gate.join() };
  });
  expect(r).toEqual({ woke: true, home: true, arrived: true, back: true });
  expect(errors).toEqual([]);
});

// Die Grotte sieht vorerst nur der Entwickler-Schalter: Die Figur wacht im Höhlenbett auf, die Höhlen-Tiere sind da,
// gezeichnet wird die Grotte (in 3D mit ihrem 3D-Teil und dem lila Höhlenhimmel), gespeichert wird nichts; ohne
// Schalter wieder auf der Lichtung
test(
  'Spiel: Welt hoehle wird per Entwickler-Schalter gezeichnet, speichert nichts, ohne Fehler',
  { tag: '@3d' },
  async ({ page }) => {
    const errors = watchErrors(page);
    const game = await openGame(page, { clock: true, dev: 'hoehle' });
    const webgl = await expectView(page);
    type Game = {
      world: {
        homes: Record<string, { bed: [number, number] }>;
        realm(x: number, y: number): string;
        cell(x: number, y: number): { perch?: number };
      };
      state: {
        player: { x: number; y: number };
        openGates: string[];
        sleeping: boolean;
        animals: { species: string; realm: string; x: number; y: number }[];
      };
      r3d: unknown;
      gl3d: { views: { look(gate: string): unknown; air(realm: string): unknown } } | null;
      apply(cmd: { type: 'move'; dir: string }): void;
      saved: { id: string };
      live: string;
    };
    const first = await game.evaluate((el) => (el as unknown as Game).live);
    const at = await game.evaluate((node) => {
      const el = node as unknown as Game;
      const { x, y } = el.state.player;
      const bed = el.world.homes.hoehle!.bed;
      return { realm: el.world.realm(x, y), inBed: x === bed[0] && y === bed[1], open: el.state.openGates };
    });
    expect(at).toEqual({ realm: 'hoehle', inBed: true, open: [] }); // das Höhlentor bleibt zu
    // die acht Höhlen-Tiere wohnen in der Grotte (je vier), drei Fledermäuse hängen unter dem Kristallbogen
    const cave = await game.evaluate((node) => {
      const el = node as unknown as Game;
      const animals = el.state.animals.filter((a) => a.realm === 'hoehle');
      const hanging = animals.filter((a) => a.species === 'fledermaus' && el.world.cell(a.x, a.y).perch !== undefined);
      return { animals: animals.length, species: new Set(animals.map((a) => a.species)).size, hanging: hanging.length };
    });
    expect(cave).toEqual({ animals: 32, species: 8, hanging: 3 });
    await game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 's' })); // aufwachen
    await ticks(page, 10);
    await render(page, 10);
    // gezeichnet: in 3D mit dem 3D-Teil der Grotte und ihrer Luft, in 2D mit lila Höhlenhimmel und Grottenboden (leicht
    // getönt von der Stimmung der Richtung, daher mit Spielraum)
    const palette = [...GROTTE_COLORS.heaven, ...GROTTE_COLORS.floor].map((c) =>
      [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)),
    );
    await expect
      .poll(async () => {
        await render(page);
        return game.evaluate((node, palette) => {
          const el = node as unknown as Game;
          if (el.r3d) return !!el.gl3d?.views.look('hoehle') && !!el.gl3d.views.air('hoehle');
          const cv = node.querySelector<HTMLCanvasElement>('canvas.mw-canvas')!;
          const data = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data;
          let grotto = 0;
          for (let i = 0; i < data.length; i += 64)
            if (palette.some((c) => c.every((v, j) => Math.abs(v - data[i + j]!) <= 12))) grotto++;
          return grotto > 50;
        }, palette);
      })
      .toBe(true);
    expect(await game.evaluate((el) => !!(el as unknown as Game).r3d)).toBe(webgl);
    // nichts gespeichert, auch nicht beim Verlassen der Seite und über das Menü (neue Welt): Ohne Schalter wacht die
    // Figur wieder auf der Lichtung auf
    await page.evaluate(() => dispatchEvent(new Event('pagehide')));
    await page.locator('.mw-settings [data-act="new"]').evaluate((b) => (b as HTMLElement).click());
    await expect.poll(() => game.evaluate((el) => (el as unknown as Game).live)).not.toBe(first); // die neue Welt ist offen
    const saved = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('larmic.games.')));
    expect(saved).toEqual([]);
    expect(errors).toEqual([]);
  },
);

// Das Gleis der Höhlenbahn sieht bis zum Freischalten (`BAHN_LIVE`) nur der Entwickler-Schalter: Die Figur wacht im Bett
// der Lichtung auf, das Höhlentor bleibt zu, der Schalter spielt den Ausbau 2 vor, das Gleis liegt von Bahnhof Bär bis vor
// das Tor und wird gezeichnet (2D: Schienen und Schwellen im Bild, 3D: aus dem 3D-Teil der Bahn); gespeichert wird
// nichts. Ohne Schalter kommt das Paket der Bahn nicht
test(
  'Spiel: Gleis der Höhlenbahn per Entwickler-Schalter, nur dort, speichert nichts, ohne Fehler',
  { tag: '@3d' },
  async ({ page }) => {
    const errors = watchErrors(page);
    const game = await openGame(page, { clock: true, dev: 'bahn' });
    const webgl = await expectView(page);
    type Rail = { to: string; part?: string };
    type Game = {
      world: {
        homes: Record<string, { bed: [number, number] }>;
        gates: Map<string, { mid: [number, number]; out: [number, number] }>;
        cell(x: number, y: number): { rail?: Rail; region: string };
      };
      state: { player: { x: number; y: number; dir: string }; openGates: string[]; packs: Record<string, unknown> };
      packs: { get(id: string): unknown };
      renderer: { views: Map<string, unknown> };
      r3d: unknown;
      gl3d: { views: { rails(c: unknown, x: number, y: number, at: unknown): unknown[] | null } } | null;
      fog: { reveal(x: number, y: number, r: number): void };
      apply(cmd: { type: 'move'; dir: string }): void;
    };
    // vom Prellbock vor der Tür (Spur u −2, Reihe −1) zurück bis an das Ende bei Bahnhof Bär
    const line = await game.evaluate((node) => {
      const el = node as unknown as Game;
      const { mid, out } = el.world.gates.get('hoehle')!;
      const steps: Record<string, [number, number]> = { e: [1, 0], s: [0, 1], w: [-1, 0], n: [0, -1] };
      let p: [number, number] = [mid[0] + 2 * out[1] - out[0], mid[1] - 2 * out[0] - out[1]];
      const buffer = el.world.cell(...p).rail ?? null;
      let n = 0;
      for (; n < 300; n++) {
        const r = el.world.cell(...p).rail;
        if (!r || (n > 0 && r.to.length < 2)) break;
        const [dx, dy] = steps[r.to[0]!]!;
        p = [p[0] + dx, p[1] + dy];
      }
      const [bx, by] = el.world.homes.lichtung!.bed;
      return {
        buffer: buffer?.part ?? null,
        cells: n + 1,
        end: el.world.cell(...p).rail?.part ?? null,
        start: p,
        inBed: el.state.player.x === bx && el.state.player.y === by,
        open: el.state.openGates,
        built: el.state.packs.bahn,
        bahn: !!el.packs.get('bahn') && el.renderer.views.has('bahn'),
      };
    });
    expect(line).toMatchObject({
      buffer: 'buffer',
      end: 'end',
      inBed: true,
      open: [],
      built: { built: 2 },
      bahn: true,
    });
    expect(line.cells).toBeGreaterThan(20);
    // an Bahnhof Bär stellen (der Nebel dort gelichtet) und zeichnen: mit Ausbau 2 Schienen und Schwellen von oben (2D),
    // mit Ausbau 0 nicht; in 3D das Gleis aus dem 3D-Teil der Bahn, nur mit Ausbau
    await game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 's' })); // aufwachen
    await ticks(page, 10);
    await game.evaluate((node, [x, y]) => {
      const el = node as unknown as Game;
      el.state = { ...el.state, player: { x, y, dir: 's' } };
      el.fog.reveal(x, y, 10);
    }, line.start);
    await arrive(page);
    // je Ausbau: in 2D das Bild (jedes vierte Pixel), in 3D die Quader des Gleises am Bahnhof
    const drawn = async (built: number) => {
      await game.evaluate((node, b) => {
        const el = node as unknown as Game;
        el.state = { ...el.state, packs: { ...el.state.packs, bahn: { built: b } } };
      }, built);
      await render(page, 2);
      return game.evaluate((node, start) => {
        const el = node as unknown as Game;
        if (el.r3d) return [el.gl3d?.views.rails(el.world.cell(...start), ...start, el.state)?.length ?? 0];
        const cv = node.querySelector<HTMLCanvasElement>('canvas.mw-canvas')!;
        const data = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data;
        return Array.from({ length: data.length >> 4 }, (_, i) => data[i * 16]! + data[i * 16 + 1]! * 256);
      }, line.start);
    };
    const [before, after] = [await drawn(0), await drawn(2)];
    if (webgl) expect([before[0], after[0]! > 0]).toEqual([0, true]);
    else expect(after.filter((v, i) => v !== before[i]).length).toBeGreaterThan(200); // Gleis im Bild
    expect(await game.evaluate((el) => !!(el as unknown as Game).r3d)).toBe(webgl);
    await page.evaluate(() => dispatchEvent(new Event('pagehide')));
    const saved = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('larmic.games.')));
    expect(saved).toEqual([]);
    // ohne Schalter: kein Paket der Bahn, kein Gleis
    const plain = await openGame(page, { clock: true, info: false });
    const child = await plain.evaluate((node, [x, y]) => {
      const el = node as unknown as Game;
      return { bahn: !!el.packs.get('bahn'), rail: !!el.world.cell(x, y).rail };
    }, line.start);
    expect(child).toEqual({ bahn: false, rail: false });
    expect(errors).toEqual([]);
  },
);

// Licht der Grotte per Entwickler-Schalter (2D): Um die wache Figur liegt ein Lichtkreis; läuft sie in den Sockel am
// Höhlenbett, trägt sie die Kristall-Laterne, und der Kreis wächst; im Bett steht die Laterne wieder auf dem Sockel
test('Spiel: Kristall-Laterne in der Grotte per Entwickler-Schalter, Lichtkreis wächst, über Nacht zurück, ohne Fehler', async ({
  page,
}) => {
  const errors = watchErrors(page);
  const game = await openGame(page, { clock: true, dev: 'hoehle' });
  type Game = {
    world: { homes: Record<string, { bed: [number, number] }> };
    state: { player: { x: number; y: number; dir: string }; sleeping: boolean; wokeAt: number; lamp?: string };
    renderer: { views: Map<string, { fx?: { light: { drawn?: { r: number; alpha: number } | null } } }> };
    rides: { id: string }[];
    apply(cmd: { type: 'move'; dir: string }): void;
  };
  await game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 's' })); // aufwachen
  await ticks(page, 10);
  await render(page, 2);
  const look = () =>
    game.evaluate((node) => {
      const el = node as unknown as Game;
      return {
        circle: el.renderer.views.get('hoehle')?.fx?.light.drawn ?? null,
        lamp: el.state.lamp ?? null,
        onPost: el.rides.some((r) => r.id === 'lantern'),
        sleeping: el.state.sleeping,
      };
    });
  const { r, alpha, lantern, lanternAlpha, grow } = GROTTE.circle;
  expect(await look()).toEqual({ circle: { r, alpha }, lamp: null, onPost: true, sleeping: false });
  // links neben den Sockel stellen und hineinlaufen
  await game.evaluate((node, [dx, dy]) => {
    const el = node as unknown as Game;
    const [bx, by] = el.world.homes.hoehle!.bed;
    el.state = { ...el.state, wokeAt: -1e6, player: { x: bx + dx - 1, y: by + dy, dir: 'e' } };
  }, GROTTE.lantern);
  await arrive(page);
  await game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 'e' }));
  await play(page, grow + 200);
  expect(await look()).toEqual({
    circle: { r: lantern, alpha: lanternAlpha },
    lamp: 'hoehle',
    onPost: false,
    sleeping: false,
  });
  // ins Bett: Die Laterne steht wieder auf dem Sockel, im Schlaf kein Lichtkreis
  await game.evaluate((node) => {
    const el = node as unknown as Game;
    const [bx, by] = el.world.homes.hoehle!.bed;
    el.state = { ...el.state, player: { x: bx, y: by + 1, dir: 'n' } };
    el.apply({ type: 'move', dir: 'n' });
  });
  await render(page, 2);
  expect(await look()).toEqual({ circle: null, lamp: null, onPost: true, sleeping: true });
  expect(errors).toEqual([]);
});

// Tok erscheint per Entwickler-Schalter (`?entwickler=bahn&bau=0`, 2D): Der Schalter spielt den Stand vor, in dem er
// kommt (Eistor offen, Eis-Leiste voll, erste Heimfahrt mit dem Schlitten); beim Aufwachen im Bett der Lichtung hüpft
// er neben der Figur heraus, wird gezeichnet und hat einen Gast-Platz; am Abend (`&abend=1`) liegt er schlafend neben
// dem Bett. Gespeichert wird nichts; ohne Schalter gibt es ihn nicht (Freigabe `BAHN_LIVE` aus), auch nicht in einem
// Spielstand, in dem alles für ihn gilt: Das Paket der Bahn wird nie geholt
test('Spiel: Tok erscheint per Entwickler-Schalter, am Abend schlafend, speichert nichts, ohne Fehler', async ({
  page,
}) => {
  const errors = watchErrors(page);
  type Game = {
    world: { homes: Record<string, { bed: [number, number] }> };
    state: {
      openGates: string[];
      animals: { id: string; mode: string; x: number; y: number; nap?: true }[];
      packs: Record<string, unknown>;
    };
    bodies: Map<string, unknown>;
    apply(cmd: { type: 'move'; dir: string }): void;
  };
  const tok = (game: Locator) =>
    game.evaluate((node) => {
      const el = node as unknown as Game;
      const t = el.state.animals.find((a) => a.id === 'hoehle:tok');
      const [bx, by] = el.world.homes.lichtung!.bed;
      return {
        mode: t?.mode ?? null,
        nap: !!t?.nap,
        near: !!t && Math.max(Math.abs(t.x - bx), Math.abs(t.y - by)) <= 12,
        drawn: el.bodies.has('hoehle:tok'),
        open: el.state.openGates,
        fahrt: el.state.packs.fahrt,
      };
    });
  const wake = (game: Locator) => game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 's' }));
  const game = await openGame(page, { clock: true, dev: 'bahn&bau=0' });
  await wake(game);
  await ticks(page, 5);
  await render(page, 2);
  expect(await tok(game)).toEqual({
    mode: 'herald',
    nap: false,
    near: true,
    drawn: true,
    open: ['eis'],
    fahrt: { schlitten: { stage: 'fest' }, hoehle: { stage: 'faellig' } },
  });
  await play(page, 3000); // er hüpft zur Figur und an seinen Platz, ruft dort
  await page.evaluate(() => dispatchEvent(new Event('pagehide')));
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('larmic.games.')))).toEqual([]);
  // am Abend: schlafend neben dem Bett
  const evening = await openGame(page, { clock: true, dev: 'bahn&bau=0&abend=1', info: false });
  await wake(evening);
  await ticks(page, 5);
  await render(page, 2);
  expect(await tok(evening)).toMatchObject({ mode: 'herald', nap: true, near: true, drawn: true });
  // ohne Schalter, im Spielstand des Kindes alles, was Tok braucht (Eistor offen, Eis-Leiste voll, erste Heimfahrt mit
  // dem Schlitten): Freigabe aus, also kein Paket der Bahn und kein Tok
  const ice = (REGIONS.find((r) => r.id === 'eis')?.animals ?? []).map(({ species }) => ({
    id: animalId('eis', species),
    species,
  }));
  const plain = await openGame(page, { clock: true, info: false });
  await plain.evaluate((node, garden) => {
    const el = node as unknown as Game & { state: { garden: unknown[] }; save(): void };
    const packs = { ...el.state.packs, fahrt: { schlitten: { stage: 'fest' } } };
    el.state = { ...el.state, openGates: ['eis'], garden: [...el.state.garden, ...garden], packs };
    el.save();
  }, ice);
  const fetched: string[] = [];
  page.on('request', (r) => {
    if (/\/welt-bahn/.test(new URL(r.url()).pathname)) fetched.push(r.url());
  });
  await reloadGame(page);
  await wake(plain);
  await ticks(page, 30);
  expect(await tok(plain)).toMatchObject({ mode: null, open: ['eis'], fahrt: { schlitten: { stage: 'fest' } } });
  const loaded = await plain.evaluate((node) =>
    (node as unknown as { packs: { loaded: { id: string }[] } }).packs.loaded.map((p) => p.id),
  );
  expect(loaded).toContain('eis');
  expect(loaded).not.toContain('bahn');
  expect(fetched).toEqual([]);
  expect(errors).toEqual([]);
});

// Bau 1 per Entwickler-Schalter (`?entwickler=bahn&bau=0`; @3d, weil die Welt dabei neu gebaut wird und 3D ihre Stücke
// austauscht): Läuft die Figur in den wachen Tok, baut er 8 s lang (Pfeile lassen sie nur hüpfen), die Welt wird mit dem
// Gleis neu gebaut, danach stehen Bahnhof Bär und der Zug da, Tok sitzt im hinteren Wagen. Gespeichert wird im Blick
// hinein nichts; ohne Schalter gibt es den Bau nicht (Freigabe aus, geprüft in „Tok erscheint per Entwickler-Schalter …“)
test(
  'Spiel: Bau 1 per Entwickler-Schalter: in Tok gelaufen, Bahnhof, Gleis und Zug, speichert nichts, ohne Fehler',
  {
    tag: '@3d',
  },
  async ({ page }) => {
    const errors = watchErrors(page);
    type Game = {
      world: {
        seed: number;
        cell(x: number, y: number): { solid: boolean; ground: string; rail?: unknown; stop?: string };
      };
      state: {
        tick: number;
        player: { x: number; y: number; dir: string };
        animals: { id: string; x: number; y: number }[];
        packs: Record<string, unknown>;
        work?: { from: number; to: number };
        heraldDue: number;
      };
      rides: { id: string; x: number; y: number }[];
      apply(cmd: { type: 'move'; dir: string; fresh?: boolean }): void;
    };
    // eine feste Welt (Seed 1, wie in mitwachsen-build.test.ts): Bahnhof Bär hat Platz, Tok kommt an seinen Platz; sonst
    // zöge jeder Lauf einen neuen Seed (`randomSeed`), und in den elf Welten ohne Platz für Bahnhof Bär baut Tok nicht
    await page.addInitScript(() => {
      const real = crypto.getRandomValues.bind(crypto);
      const fixed = (a: ArrayBufferView<ArrayBuffer>) =>
        a instanceof Uint32Array && a.length === 1 ? a.fill(1) : real(a);
      Object.defineProperty(crypto, 'getRandomValues', { value: fixed });
    });
    const game = await openGame(page, { clock: true, dev: 'bahn&bau=0' });
    await expectView(page);
    expect(await game.evaluate((node) => (node as unknown as Game).world.seed)).toBe(1);
    await game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 's' })); // aufwachen
    // Tok hüpft zur Figur und an seinen Platz; dort steht er still (nur dort beginnt er zu bauen)
    const tokAt = () =>
      game.evaluate((node) => {
        const el = node as unknown as Game;
        const t = el.state.animals.find((a) => a.id === 'hoehle:tok');
        return t && el.state.heraldDue < 0 ? `${t.x},${t.y}` : '';
      });
    let [last, posted] = ['', false];
    for (let i = 0; i < 30 && !posted; i++) {
      await ticks(page, 10);
      const now = await tokAt();
      [posted, last] = [now !== '' && now === last, now];
    }
    expect(posted).toBe(true);
    const started = await game.evaluate((node) => {
      const el = node as unknown as Game;
      const t = el.state.animals.find((a) => a.id === 'hoehle:tok')!;
      const dirs: [string, number, number][] = [
        ['e', 1, 0],
        ['w', -1, 0],
        ['s', 0, 1],
        ['n', 0, -1],
      ];
      const [dir, dx, dy] = dirs.find(([, dx, dy]) => {
        const c = el.world.cell(t.x - dx, t.y - dy);
        return !c.solid && c.ground !== 'water' && !el.state.animals.some((a) => a.x === t.x - dx && a.y === t.y - dy);
      })!;
      el.state = { ...el.state, player: { x: t.x - dx, y: t.y - dy, dir: 's' } };
      el.apply({ type: 'move', dir, fresh: true });
      return { work: !!el.state.work, bahn: el.state.packs.bahn, at: [el.state.player.x, el.state.player.y] };
    });
    expect(started).toMatchObject({ work: true, bahn: { built: 1 } });
    await ticks(page, 40);
    // mitten im Bau: Ein Pfeil lässt die Figur nur hüpfen
    const still = await game.evaluate((node) => {
      const el = node as unknown as Game;
      el.apply({ type: 'move', dir: 'n', fresh: true });
      return [el.state.player.x, el.state.player.y];
    });
    expect(still).toEqual(started.at);
    await ticks(page, 45);
    await render(page, 2);
    const done = await game.evaluate((node) => {
      const el = node as unknown as Game;
      const loco = el.rides.find((r) => r.id === 'ride:hoehle:loco');
      return {
        work: !!el.state.work,
        tok: el.state.animals.some((a) => a.id === 'hoehle:tok'),
        fahrt: (el.state.packs.fahrt as { hoehle?: unknown }).hoehle,
        bodies: ['ride:hoehle:loco', 'ride:hoehle:mid', 'ride:hoehle:rear', 'bahn:dach', 'bahn:schild'].filter((id) =>
          el.rides.some((r) => r.id === id),
        ),
        rail: !!loco && !!el.world.cell(Math.round(loco.x), Math.round(loco.y)).rail,
      };
    });
    expect(done).toEqual({
      work: false,
      tok: false,
      fahrt: { stage: 'bereit' },
      bodies: ['ride:hoehle:loco', 'ride:hoehle:mid', 'ride:hoehle:rear', 'bahn:dach', 'bahn:schild'],
      rail: true,
    });
    await page.evaluate(() => dispatchEvent(new Event('pagehide')));
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('larmic.games.')))).toEqual(
      [],
    );
    expect(errors).toEqual([]);
  },
);

// Fahren mit der Höhlenbahn per Entwickler-Schalter (`?entwickler=bahn&bau=1`, fester Seed 1; @3d, weil die Kamera dem
// Zug folgt und 3D die Figur im Wagen zeichnet): Ein neuer Druck zum Zug steigt ein, die Figur sitzt im mittleren Wagen,
// die erste Fahrt endet am Prellbock in der Bucht, die Figur steigt aus, Tok hüpft an seinen Platz neben der Torplatte.
// Gespeichert wird im Blick hinein nichts; ohne Schalter gibt es den Zug nicht (Freigabe aus, „Tok erscheint …“)
test(
  'Spiel: Zug per Entwickler-Schalter: einsteigen, erste Fahrt bis zum Prellbock, Tok steigt aus, speichert nichts, ohne Fehler',
  { tag: '@3d' },
  async ({ page }) => {
    const errors = watchErrors(page);
    type Game = {
      world: { seed: number; cell(x: number, y: number): { stop?: string; ride?: string; plate?: string } };
      state: {
        player: { x: number; y: number; dir: string };
        animals: { id: string; x: number; y: number }[];
        ride?: { id: string; phase: string };
        packs: Record<string, unknown>;
      };
      rides: { id: string; x: number; y: number; seat?: true }[];
      apply(cmd: { type: 'move'; dir: string; fresh?: boolean }): void;
    };
    await page.addInitScript(() => {
      const real = crypto.getRandomValues.bind(crypto);
      const fixed = (a: ArrayBufferView<ArrayBuffer>) =>
        a instanceof Uint32Array && a.length === 1 ? a.fill(1) : real(a);
      Object.defineProperty(crypto, 'getRandomValues', { value: fixed });
    });
    const game = await openGame(page, { clock: true, dev: 'bahn&bau=1' });
    await expectView(page);
    expect(await game.evaluate((node) => (node as unknown as Game).world.seed)).toBe(1);
    await game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 's' })); // aufwachen
    await render(page);
    // auf den Bahnsteig neben den mittleren Wagen, ein neuer Druck zu ihm hin
    const boarded = await game.evaluate((node) => {
      const el = node as unknown as Game;
      const mid = el.rides.find((r) => r.id === 'ride:hoehle:mid')!;
      const [mx, my] = [Math.round(mid.x), Math.round(mid.y)];
      const dirs: [string, number, number][] = [
        ['e', 1, 0],
        ['w', -1, 0],
        ['s', 0, 1],
        ['n', 0, -1],
      ];
      const [dir, dx, dy] = dirs.find(([, dx, dy]) => el.world.cell(mx - dx, my - dy).stop === 'hoehle')!;
      el.state = { ...el.state, animals: [], player: { x: mx - dx, y: my - dy, dir: 's' } };
      el.apply({ type: 'move', dir, fresh: true });
      return el.state.ride?.id;
    });
    expect(boarded).toBe('hoehle');
    await ticks(page, 30);
    await render(page, 2);
    const riding = await game.evaluate((node) => {
      const el = node as unknown as Game;
      return { phase: el.state.ride?.phase, seat: el.rides.find((r) => r.seat)?.id };
    });
    expect(riding).toEqual({ phase: 'go', seat: 'ride:hoehle:mid' });
    // 15 bis 20 s Fahrt (bis zum Prellbock 15 s), dann steigt die Figur nach 1 s aus
    for (let i = 0; i < 25; i++) {
      if (!(await game.evaluate((node) => !!(node as unknown as Game).state.ride))) break;
      await ticks(page, 10);
    }
    await render(page, 2);
    const done = await game.evaluate((node) => {
      const el = node as unknown as Game;
      const { x, y } = el.state.player;
      const tok = el.state.animals.find((a) => a.id === 'hoehle:tok');
      return {
        ride: !!el.state.ride,
        onTrack: !!el.world.cell(x, y).ride,
        onPlate: !!el.world.cell(x, y).plate,
        tok: !!tok,
        seat: el.rides.some((r) => r.seat),
      };
    });
    expect(done).toEqual({ ride: false, onTrack: false, onPlate: false, tok: true, seat: false });
    await page.evaluate(() => dispatchEvent(new Event('pagehide')));
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('larmic.games.')))).toEqual(
      [],
    );
    expect(errors).toEqual([]);
  },
);

// Je Welt ein Test, dass sie gezeichnet wird: im Projekt `game` in 2D, im Projekt `3d` mit WebGL samt dem 3D-Teil ihres
// Welt-Pakets (Schmuck ihres Tors). Neue Welten kommen in die Liste
for (const realm of ['lichtung', 'eis'] as const)
  test(`Spiel: Welt ${realm} wird gezeichnet, ohne Fehler`, { tag: '@3d' }, async ({ page }) => {
    const errors = watchErrors(page);
    const game = await openGame(page, { clock: true });
    const webgl = await expectView(page);
    type Game = {
      world: { homes: Record<string, { wake: [number, number][] }>; realm(x: number, y: number): string };
      state: { player: { x: number; y: number; dir: string }; openGates: string[]; sleeping: boolean; wokeAt: number };
      lift(): void;
      r3d: unknown;
      gl3d: { views: { look(gate: string): unknown } } | null;
    };
    if (realm !== 'lichtung') await withIce(game);
    // Die Figur steht wach neben dem Bett ihrer Welt (das Tor ist im Test offen) und geht ein paar Takte
    const at = await game.evaluate((node, r) => {
      const el = node as unknown as Game;
      const [x, y] = el.world.homes[r]!.wake[0]!;
      const openGates = r === 'lichtung' ? [] : [r];
      el.state = { ...el.state, openGates, sleeping: false, wokeAt: -100, player: { x, y, dir: 's' } };
      el.lift();
      return el.world.realm(x, y);
    }, realm);
    expect(at).toBe(realm);
    await ticks(page, 10);
    await render(page, 10);
    // In 3D zeichnet die 3D-Ansicht, für eine Welt hinter einem Tor mit dem Schmuck aus ihrem 3D-Teil; in 2D ist das Bild
    // gezeichnet: viele verschiedene Farben, nicht leer
    await expect
      .poll(async () => {
        await render(page);
        return game.evaluate((node, r) => {
          const el = node as unknown as Game;
          if (el.r3d) return r === 'lichtung' || !!el.gl3d?.views.look(r);
          const cv = node.querySelector<HTMLCanvasElement>('canvas.mw-canvas')!;
          const data = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data;
          const colors = new Set<number>();
          for (let i = 0; i < data.length; i += 64) colors.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
          return colors.size > 8;
        }, realm);
      })
      .toBe(true);
    expect(await game.evaluate((el) => !!(el as unknown as Game).r3d)).toBe(webgl);
    expect(errors).toEqual([]);
  });

test(
  'Spiel: Gletscherkessel hinter dem Eistor wird gezeichnet (Tor im Test offen), alle zehn Eis-Tiere, Pustewind, ohne Fehler',
  { tag: '@3d' },
  async ({ page }) => {
    const errors = watchErrors(page);
    const game = await openGame(page, { clock: true });
    const webgl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
    if (webgl) await expect(game).toHaveClass(/three/); // gezeichnet wird in 3D
    await withIce(game);
    type Game = {
      world: {
        homes: { eis: { bed: [number, number]; wake: [number, number][] } };
        realm(x: number, y: number): string;
      };
      state: {
        player: { x: number; y: number; dir: string };
        openGates: string[];
        sleeping: boolean;
        wokeAt: number;
        animals: { id: string; species: string; realm: string; x: number; y: number; rest: number }[];
      };
      apply(cmd: { type: 'move'; dir: string } | { type: 'tick' }): void;
      lift(): void;
      bodies: Map<string, unknown>;
      fog: { has(x: number, y: number): boolean };
      r3d: { bodies: Map<string, unknown> } | null; // in 3D: Modelle in der Szene nach Kennung
    };
    /** Was der Wind-Teil zusätzlich braucht: Felder, Takt, Wetter dort, wo die Figur ist, und das nachgeladene Eis-Wetter */
    type WindGame = {
      world: { cell(x: number, y: number): { garden?: boolean; solid: boolean; roof?: boolean } };
      state: { dayStart: number; tick: number };
      air: { frame(world: unknown, state: unknown, quiet: boolean, reduced: boolean): { weather: { wind: number } } };
      renderer: { views: Map<string, { sky: { weather?: unknown } }> };
    };
    // Über die Komponente (wie die Regeln es sehen): Tor offen, die Figur steht wach neben dem Schneebett
    const realm = await game.evaluate((node) => {
      const el = node as unknown as Game;
      const [x, y] = el.world.homes.eis.wake[0]!;
      el.state = { ...el.state, openGates: ['eis'], sleeping: false, wokeAt: -100, player: { x, y, dir: 'n' } };
      el.lift();
      return el.world.realm(x, y);
    });
    expect(realm).toBe('eis');
    await render(page);
    // Je Art ein Eis-Tier in einer Reihe hinter das Schneebett (im Erkundeten), dann zeichnen: alle zehn Modelle ohne Fehler
    const shown = await game.evaluate((node) => {
      const el = node as unknown as Game;
      const [bx, by] = el.world.homes.eis.bed;
      const ice = el.state.animals.filter((a) => a.realm === 'eis');
      const first = [...new Map(ice.map((a) => [a.species, a.id])).values()];
      const animals = el.state.animals.map((a) => {
        const i = first.indexOf(a.id);
        return i < 0 ? a : { ...a, x: bx - 5 + i, y: by - 2, rest: 999 };
      });
      el.state = { ...el.state, animals };
      return { ids: first, count: ice.length, at: first.map((_, i) => [bx - 5 + i, by - 2] as const) };
    });
    expect(shown.count).toBe(49); // das Tor ist nur im Test offen: Der verlaufene Pinguin wohnt noch nicht im Kessel
    expect(shown.ids).toHaveLength(10);
    await expect
      .poll(async () => {
        await render(page);
        return game.evaluate((node, { ids, at }) => {
          const el = node as unknown as Game;
          // In 3D steht für jedes gezeichnete Tier ein Modell in der Szene; in 2D zeichnet die Karte jedes Tier im Erkundeten
          return ids.every((id, i) =>
            el.r3d ? el.r3d.bodies.has(id) : el.bodies.has(id) && el.fog.has(at[i]![0], at[i]![1]),
          );
        }, shown);
      })
      .toBe(true);
    // Pustewind: Die Eis-Tiere wohnen auf der Schneewiese (mit dem Pinguin), ein Abschnitt mit Wind läuft – die Tiere
    // gehen ins Iglu, Flocken, Wirbel, Fahnen und Wimpel werden gezeichnet (das Eis-Wetter ist nachgeladen), ohne Fehler
    const windy = await game.evaluate((node) => {
      const el = node as unknown as Game & WindGame;
      const [bx, by] = el.world.homes.eis.bed;
      const free: [number, number][] = [];
      for (let y = by - 6; y <= by + 6; y++)
        for (let x = bx - 6; x <= bx + 6; x++) {
          const c = el.world.cell(x, y);
          if (c.garden && !c.solid && !c.roof && (x !== el.state.player.x || y !== el.state.player.y))
            free.push([x, y]);
        }
      const ice = el.state.animals.filter((a) => a.realm === 'eis');
      const animals = el.state.animals.map((a) => {
        const i = ice.indexOf(a);
        const at = free[i * 3];
        return i < 0 || !at ? a : { ...a, x: at[0], y: at[1], spawn: at, mode: 'home', home: { kind: 'garden' } };
      });
      // mit dem Pinguin, der heimgefunden hat: erst dann weht Pustewind (nicht am Tag seines Einzugs)
      const garden = [...ice, { id: 'eis:pinguin', species: 'pinguin' }].map((a) => ({ id: a.id, species: a.species }));
      const met = garden.map((a) => a.id);
      let b = 1;
      const at = (k: number) => ({
        ...el.state,
        animals,
        garden,
        met,
        calm: -1,
        tick: el.state.dayStart + k * 3000 + 400,
      });
      while (b < 80 && el.air.frame(el.world, at(b), true, false).weather.wind < 1) b++;
      el.state = at(b);
      for (let i = 0; i < 300; i++) el.apply({ type: 'tick' });
      return b < 80;
    });
    expect(windy).toBe(true);
    // gezeichnet, bis das Eis-Wetter nachgeladen ist
    await expect
      .poll(async () => {
        await render(page);
        return game.evaluate((node) => {
          const el = node as unknown as Game & WindGame;
          const sheltered = el.state.animals.filter((a) => a.realm === 'eis' && el.world.cell(a.x, a.y).roof).length;
          return { sheltered: sheltered > 5, loaded: typeof el.renderer.views.get('eis')?.sky.weather === 'function' };
        });
      })
      .toEqual({ sheltered: true, loaded: true });
    // Das Tal ist lang: Ganz hinten am Talende steht die Plattform des Eis-Portals (wach), dort gezeichnet ohne Fehler;
    // auf ihrer Mitte geht es mit einem Glitzern zurück ans Schneebett
    type PortalGame = {
      world: {
        homes: { eis: { bed: [number, number] } };
        gates: Map<string, { out: [number, number] }>;
        portals: Map<string, { gate: [number, number]; home: [number, number] }>;
        realm(x: number, y: number): string;
      };
      state: { player: { x: number; y: number; dir: string }; portals: string[]; animals: unknown[] };
      apply(cmd: { type: 'move'; dir: string } | { type: 'tick' }): void;
      lift(): void;
    };
    await game.evaluate((node) => {
      const el = node as unknown as PortalGame;
      const [gx, gy] = el.world.portals.get('eiskessel')!.gate;
      const out = el.world.gates.get('eis')!.out;
      const dir = out[0] > 0 ? 'e' : out[0] < 0 ? 'w' : out[1] > 0 ? 's' : 'n';
      // vor die Plattform am Talende (auf der Seite zum Bett), das Portal ist wach
      el.state = {
        ...el.state,
        player: { x: gx - out[0] * 2, y: gy - out[1] * 2, dir },
        portals: [...new Set([...el.state.portals, 'eiskessel'])],
      };
      el.lift();
    });
    await render(page);
    const trip = await game.evaluate((node) => {
      const el = node as unknown as PortalGame;
      const p = el.world.portals.get('eiskessel')!;
      const out = el.world.gates.get('eis')!.out;
      const dir = out[0] > 0 ? 'e' : out[0] < 0 ? 'w' : out[1] > 0 ? 's' : 'n';
      const [bx, by] = el.world.homes.eis.bed;
      const [gx, gy] = p.gate;
      const far = Math.hypot(gx - bx, gy - by);
      el.apply({ type: 'move', dir });
      el.apply({ type: 'move', dir });
      const [x, y] = [el.state.player.x, el.state.player.y];
      return { far: far > 100, home: [x, y].join() === p.home.join(), realm: el.world.realm(x, y) };
    });
    expect(trip).toEqual({ far: true, home: true, realm: 'eis' });
    await render(page);
    // ein paar Schritte durch den Kessel, dann ins Schneebett (der Schläfer liegt jetzt dort, darüber das Polarlicht)
    await game.evaluate((node) => {
      const el = node as unknown as Game;
      for (const dir of ['s', 's', 'e', 'n', 'n', 'w']) el.apply({ type: 'move', dir });
      const [bx, by] = el.world.homes.eis.bed;
      el.state = { ...el.state, player: { x: bx + 1, y: by, dir: 'w' }, wokeAt: -100 };
      el.apply({ type: 'move', dir: 'w' });
    });
    await render(page);
    expect(await game.evaluate((el) => (el as unknown as Game).state.sleeping)).toBe(true);
    expect(errors).toEqual([]);
  },
);

test(
  'Spiel: Schneemann bauen im Gletschertal (Tor im Test offen): dreimal hinein, er steht und übersteht Neuladen, ohne Fehler',
  { tag: '@3d' },
  async ({ page }) => {
    const errors = watchErrors(page);
    const game = await openGame(page, { clock: true });
    await withIce(game);
    type Game = {
      world: { homes: { eis: { bed: [number, number] } }; cell(x: number, y: number): { deco: string | null } };
      state: {
        player: { x: number; y: number; dir: string };
        openGates: string[];
        sleeping: boolean;
        wokeAt: number;
        packs: Record<string, { snow?: Record<string, number> } | undefined>;
      };
      apply(cmd: { type: 'move'; dir: string }): void;
      lift(): void;
    };
    /** Die Figur steht wach vor dem Schneehaufen (südlich davon, schaut zu ihm), das Tor ist offen */
    const stand = (heap: readonly [number, number]) =>
      game.evaluate((node, [x, y]) => {
        const el = node as unknown as Game;
        el.state = {
          ...el.state,
          openGates: ['eis'],
          sleeping: false,
          wokeAt: -100,
          player: { x, y: y + 1, dir: 'n' },
        };
        el.lift();
      }, heap);
    const stage = (heap: readonly [number, number]) =>
      game.evaluate((node, [x, y]) => (node as unknown as Game).state.packs.eis?.snow?.[`${x},${y}`] ?? 0, heap);
    // der Schneehaufen, der dem Schneebett am nächsten liegt
    const heap = await game.evaluate((node) => {
      const el = node as unknown as Game;
      const [bx, by] = el.world.homes.eis.bed;
      for (let r = 1; r < 200; r++)
        for (let y = by - r; y <= by + r; y++)
          for (let x = bx - r; x <= bx + r; x++)
            if (Math.max(Math.abs(x - bx), Math.abs(y - by)) === r && el.world.cell(x, y).deco === 'snowheap')
              return [x, y] as const;
      return null;
    });
    expect(heap).not.toBeNull();
    await stand(heap!);
    await render(page);
    // Jedes Hineinlaufen lässt eine Kugel wachsen, beim dritten Mal steht der Schneemann (gezeichnet nach jedem Schritt)
    for (let i = 1; i <= 3; i++) {
      await game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 'n' }));
      expect(await stage(heap!)).toBe(i);
      await render(page);
    }
    // Noch einmal hinein: Er bleibt, wie er ist
    await game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 'n' }));
    expect(await stage(heap!)).toBe(3);
    // Neu laden: Der Schneemann steht noch da (gespeichert, sobald er gewachsen ist) und wird gezeichnet
    await reloadGame(page);
    expect(await stage(heap!)).toBe(3);
    await stand(heap!);
    await render(page);
    /** Farben der Quader, die eine Ansicht für den Schneehaufen zeichnet (3D: aus dem 3D-Teil des Pakets) */
    type Drawn = { decos: Record<string, ((...a: unknown[]) => unknown[][] | null) | undefined> } | null | undefined;
    type Views = Game & {
      gl3d: { views: { decos: Drawn }; at: unknown } | null;
      renderer: { later: unknown[][] };
      r3d: unknown;
    };
    const carrot = '#e8892a'; // Möhrennase (SNOWMAN_COLORS.carrot)
    // In 3D baut das Stück des Felds den Schneemann mit Möhrennase (sobald der 3D-Teil des Pakets da ist)
    const in3d = await game.evaluate((node) => !!(node as unknown as Views).gl3d);
    if (in3d)
      await expect
        .poll(async () => {
          await render(page);
          return game.evaluate((node, [x, y]) => {
            const el = node as unknown as Views;
            const draw = el.gl3d!.views.decos?.decos.snowheap; // Zeichnungen der geladenen 3D-Teile
            return (draw?.(el.world, el.world.cell(x, y), x, y, el.gl3d!.at) ?? []).map((b) => b[6]);
          }, heap!);
        })
        .toContain(carrot);
    // In 2D steht er ebenso da: Die Quader des Schneemanns liegen im gezeichneten Bild
    await game.evaluate((node) => {
      (node as unknown as Views).r3d = null; // ohne 3D: so zeichnet die 2D-Ansicht von vorn
    });
    await stand(heap!);
    await render(page);
    const later = () => game.evaluate((node) => (node as unknown as Views).renderer.later.map((b) => b[6] as string));
    expect(await later()).toContain(carrot);
    // Auch in 2D wächst ein Haufen (dort wackelt die frische Kugel kurz): der nächste Haufen, eine Kugel
    const next = await game.evaluate((node, [hx, hy]) => {
      const el = node as unknown as Game;
      for (let r = 1; r < 200; r++)
        for (let y = hy - r; y <= hy + r; y++)
          for (let x = hx - r; x <= hx + r; x++)
            if (Math.max(Math.abs(x - hx), Math.abs(y - hy)) === r && el.world.cell(x, y).deco === 'snowheap')
              return [x, y] as const;
      return null;
    }, heap!);
    expect(next).not.toBeNull();
    await stand(next!);
    await render(page);
    await game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 'n' }));
    expect(await stage(next!)).toBe(1);
    await render(page);
    expect(errors).toEqual([]);
  },
);

test(
  'Spiel: Eiszapfen-Glockenspiel im Gletschertal (Tor im Test offen): die Reihe entlang klingt eine Tonleiter, ohne Fehler',
  { tag: '@3d' },
  async ({ page }) => {
    const errors = watchErrors(page);
    const game = await openGame(page, { clock: true });
    await withIce(game);
    type Drawn = { decos: Record<string, ((...a: unknown[]) => unknown[][] | null) | undefined> } | null | undefined;
    type Game = {
      world: {
        homes: { eis: { bed: [number, number] } };
        cell(x: number, y: number): { deco: string | null; note?: number };
      };
      state: {
        player: { x: number; y: number; dir: string };
        openGates: string[];
        sleeping: boolean;
        wokeAt: number;
        animals: { id: string; x: number; y: number }[];
        followers: string[];
      };
      apply(cmd: { type: 'move'; dir: string }): void;
      lift(): void;
      sfx: { score(notes: [number, ...unknown[]][]): void };
      gl3d: { views: { decos: Drawn }; at: unknown } | null;
      renderer: { later: unknown[][] };
      r3d: unknown;
    };
    // die Reihe der Eiszapfen (von West nach Ost), gesucht vom Schneebett aus
    const row = await game.evaluate((node) => {
      const el = node as unknown as Game;
      const [bx, by] = el.world.homes.eis.bed;
      const icicle = (x: number, y: number) => el.world.cell(x, y).deco === 'icicle';
      let hit: [number, number] | null = null;
      for (let r = 1; r < 200 && !hit; r++)
        for (let y = by - r; y <= by + r && !hit; y++)
          for (let x = bx - r; x <= bx + r; x++) if (icicle(x, y)) hit = [x, y];
      if (!hit) return [];
      let [w] = hit;
      const y = hit[1];
      while (icicle(w - 1, y)) w--;
      const out: [number, number][] = [];
      while (icicle(w + out.length, y)) out.push([w + out.length, y]);
      return out;
    });
    expect(row.length).toBeGreaterThanOrEqual(5);
    /** Die Figur steht wach vor dem ersten Zapfen (südlich davon), das Tor ist offen; die Töne werden mitgeschrieben */
    const stand = () =>
      game.evaluate((node, [x, y]) => {
        const el = node as unknown as Game & { heard?: number[] };
        // kein Tier in der Nähe der Reihe, das im Weg stünde
        const near = (a: { id: string; x: number; y: number }) =>
          !el.state.followers.includes(a.id) && Math.abs(a.y - y) <= 4 && a.x >= x - 4 && a.x <= x + 12;
        const animals = el.state.animals.filter((a) => !near(a));
        el.state = {
          ...el.state,
          animals,
          openGates: ['eis'],
          sleeping: false,
          wokeAt: -100,
          player: { x, y: y + 1, dir: 'n' },
        };
        if (!el.heard) {
          const score = el.sfx.score.bind(el.sfx);
          el.sfx.score = (notes) => {
            if (notes[0]) el.heard!.push(notes[0][0]);
            score(notes);
          };
        }
        el.heard = [];
        el.lift();
      }, row[0]);
    /**
     * Zum ersten Zapfen hin, dann die Reihe entlang nach Osten, Schritt für Schritt mit gezeichneten Bildern dazwischen;
     * liefert die gehörten Töne
     */
    const walkRow = async () => {
      for (const [i, [x, y]] of row.entries()) {
        await game.evaluate((node, dir) => (node as unknown as Game).apply({ type: 'move', dir }), i ? 'e' : 'n');
        expect(
          await game.evaluate((node) => [
            (node as unknown as Game).state.player.x,
            (node as unknown as Game).state.player.y,
          ]),
        ).toEqual([x, y]);
        await render(page);
      }
      return game.evaluate((node) => (node as unknown as Game & { heard: number[] }).heard);
    };
    await stand();
    await render(page);
    // Jeder Zapfen klingt beim Hinlaufen, die Figur läuft ohne Halt weiter: eine Tonleiter von tief nach hoch
    expect(await walkRow()).toEqual(SCALE.slice(0, row.length)); // genau die Töne der Zapfen, kein anderer
    // gegen die Wand gedrückt klingt der letzte Zapfen noch einmal, die Figur bleibt
    await game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 'n' }));
    expect(await game.evaluate((node) => (node as unknown as Game & { heard: number[] }).heard.at(-1))).toBe(
      SCALE[row.length - 1],
    );
    // In 3D baut das Stück des Felds den Zapfen (sobald der 3D-Teil des Pakets da ist)
    const in3d = await game.evaluate((node) => !!(node as unknown as Game).gl3d);
    if (in3d)
      await expect
        .poll(async () => {
          await render(page);
          return game.evaluate((node, [x, y]) => {
            const el = node as unknown as Game;
            const draw = el.gl3d!.views.decos?.decos.icicle; // Zeichnungen der geladenen 3D-Teile
            return (draw?.(el.world, el.world.cell(x, y), x, y, el.gl3d!.at) ?? []).length;
          }, row[0]);
        })
        .toBeGreaterThan(1);
    // In 2D ebenso: Die Zapfen liegen im gezeichneten Bild, und sie schwingen beim Anschlagen
    await game.evaluate((node) => {
      (node as unknown as Game).r3d = null; // ohne 3D: so zeichnet die 2D-Ansicht von vorn
    });
    await stand();
    await render(page);
    const drawn = await game.evaluate(
      (node, [x, y]) => (node as unknown as Game).renderer.later.filter((b) => b[1] === y && b[0] === x).length,
      row[0],
    );
    expect(drawn).toBeGreaterThan(0); // die Eiskante liegt genau im Feld
    expect(await walkRow()).toEqual(SCALE.slice(0, row.length));
    await render(page);
    expect(errors).toEqual([]);
  },
);

test('Spiel: Weltgrenze am Eistor (Tor im Test offen): Tiere der Lichtung warten in der Bucht, die Leiste klappt um, ohne Fehler', async ({
  page,
}) => {
  const errors = watchErrors(page);
  const game = await openGame(page, { clock: true });
  type Game = {
    world: {
      gates: Map<string, { mid: [number, number]; out: [number, number] }>;
      realm(x: number, y: number): string;
    };
    state: {
      player: { x: number; y: number; dir: string };
      openGates: string[];
      sleeping: boolean;
      followers: string[];
      animals: { id: string; realm: string; mode: string; x: number; y: number; home: { kind: string } }[];
    };
    apply(cmd: { type: 'move'; dir: string }): void;
    lift(): void;
    renderer: { views: Map<string, { sky: { waitArrow?: unknown } }>; album: { turn: { shown?: string } } };
  };
  await withIce(game);
  // Über die Komponente: Tor offen, die Figur steht wach in der Bucht vor dem Eistor, drei Tiere der Lichtung folgen ihr
  const ids = await game.evaluate((node) => {
    const el = node as unknown as Game;
    const { mid, out } = el.world.gates.get('eis')!;
    const at = (k: number) => [mid[0] - out[0] * k, mid[1] - out[1] * k] as const;
    const chain = el.state.animals.filter((a) => a.realm === 'lichtung' && a.home.kind === 'region').slice(0, 3);
    const animals = el.state.animals.map((a) => {
      const i = chain.indexOf(a);
      return i < 0 ? a : { ...a, mode: 'follow', x: at(i + 2)[0], y: at(i + 2)[1] };
    });
    const [x, y] = at(1);
    el.state = {
      ...el.state,
      openGates: ['eis'],
      sleeping: false,
      animals,
      followers: chain.map((a) => a.id),
      player: { x, y, dir: 'n' },
    };
    el.lift();
    return chain.map((a) => a.id);
  });
  await render(page);
  /** Schritte zum Kessel hin: `n` Schritte, mit `until` so viele, bis die Figur in dieser Gegend steht (höchstens 80) */
  const inward = (n: number, until = '') =>
    game.evaluate(
      (node, [steps, goal]) => {
        const el = node as unknown as Game;
        const { out } = el.world.gates.get('eis')!;
        const dir = out[0] > 0 ? 'e' : out[0] < 0 ? 'w' : out[1] > 0 ? 's' : 'n';
        const there = () => el.world.realm(el.state.player.x, el.state.player.y) === goal;
        for (let i = 0; i < steps && !there(); i++) el.apply({ type: 'move', dir });
        return {
          waiting: el.state.animals.filter((a) => a.mode === 'wait').map((a) => a.id),
          realm: el.world.realm(el.state.player.x, el.state.player.y),
        };
      },
      [n, until] as const,
    );
  // In die Torreihe: Die drei setzen sich in die Bucht; das Bild der Weltgrenze ist nachgeladen (Pfeil, Zeichen)
  expect((await inward(1)).waiting.sort()).toEqual([...ids].sort());
  await expect
    .poll(async () => {
      await render(page);
      return game.evaluate((el) => typeof (el as unknown as Game).renderer.views.get('eis')?.sky.waitArrow);
    })
    .toBe('function');
  // Durch den Gang bis in den Kessel: Die Leiste zeigt die Eis-Welt
  expect((await inward(80, 'eis')).realm).toBe('eis');
  await expect.poll(() => albumShows(page, game)).toBe('eis');
  // Zurück in die Bucht: Die Wartenden reihen sich wieder ein
  const back = await game.evaluate((node) => {
    const el = node as unknown as Game;
    const { out } = el.world.gates.get('eis')!;
    const dir = out[0] > 0 ? 'w' : out[0] < 0 ? 'e' : out[1] > 0 ? 'n' : 's';
    for (let i = 0; i < 100 && el.state.followers.length < 3; i++) el.apply({ type: 'move', dir });
    return { followers: el.state.followers, realm: el.world.realm(el.state.player.x, el.state.player.y) };
  });
  expect(back.realm).toBe('lichtung');
  expect([...back.followers].sort()).toEqual([...ids].sort());
  await expect.poll(() => albumShows(page, game)).toBe('lichtung');
  expect(errors).toEqual([]);
});

test(
  'Spiel: Der Pinguin holt die Figur ab, das Eistor geht auf, er zieht im Kessel ein; nach dem Neuladen offen, ohne Fehler',
  { tag: '@3d' },
  async ({ page }) => {
    const errors = watchErrors(page);
    const game = await openGame(page, { clock: true });
    type Animal = { id: string; species: string; realm: string; mode: string; x: number; y: number };
    type Game = {
      world: {
        gates: Map<string, { mid: [number, number]; out: [number, number] }>;
        homes: { eis: { bed: [number, number]; wake: [number, number][] } };
        realm(x: number, y: number): string;
      };
      state: {
        player: { x: number; y: number; dir: string };
        openGates: string[];
        portals: string[];
        sleeping: boolean;
        guideDue: number;
        still: number;
        tick: number;
        ritual: number;
        animals: (Animal & { home: { kind: string } })[];
        garden: { id: string; species: string }[];
      };
      saved: { id: string };
      apply(cmd: { type: 'move'; dir: string } | { type: 'tick' }): void;
      lift(): void;
      save(): void;
      openWorld(id: string): Promise<void>;
      renderer: { album: { turn: { shown?: string } } };
      r3d: { turn?: { view: { yaw: number } } | null } | null; // Drehung zur Torfront, nachgeladen
    };
    const penguin = () =>
      game.evaluate((el) => (el as unknown as Game).state.animals.find((a) => a.id === 'eis:pinguin')?.mode ?? 'fehlt');
    // Alle Tiere der Lichtung wohnen auf der Wiese (gespeichert, wie nach vielen Abenden), die Welt öffnet neu
    await game.evaluate((node) => {
      const el = node as unknown as Game;
      const lichtung = el.state.animals.filter((a) => a.realm === 'lichtung' && a.home.kind === 'region');
      el.state = { ...el.state, garden: lichtung.map((a) => ({ id: a.id, species: a.species })) };
      el.save();
      return el.openWorld(el.saved.id); // die Leiste ist voll: Der Pinguin ist fällig, die Welt wartet auf sein Paket
    });
    expect(await penguin()).toBe('fehlt'); // verlaufen: Er wohnt nicht im Kessel
    // Aufwachen: Die Regeln des Pinguins (Welt-Paket Eis) greifen, gut 2 s später taucht er neben ihr auf und führt
    await page.keyboard.press('ArrowDown');
    await expect
      .poll(async () => {
        await ticks(page, 10);
        return penguin();
      })
      .toBe('lead');
    // Pinguin in die Bucht vor dem Eistor, die Figur mitten auf die Torplatte (über die Komponente, in einem Zug, damit
    // kein Takt der Seite dazwischenkommt): Nach 0,4 s Stehen (vier Takte, die Stehzeit beginnt neu) geht das Tor auf
    const standing = await game.evaluate((node) => {
      const el = node as unknown as Game;
      const { mid, out } = el.world.gates.get('eis')!;
      const at = (k: number) => [mid[0] - out[0] * k, mid[1] - out[1] * k] as const;
      const animals = el.state.animals.map((a) => (a.id === 'eis:pinguin' ? { ...a, x: at(1)[0], y: at(1)[1] } : a));
      el.state = { ...el.state, animals, guideDue: -1, still: 0, player: { x: at(2)[0], y: at(2)[1], dir: 'n' } };
      el.lift();
      const seen: string[][] = [];
      for (let i = 0; i < 4; i++) {
        el.apply({ type: 'tick' });
        seen.push([...el.state.openGates]);
      }
      return seen;
    });
    expect(standing).toEqual([[], [], [], ['eis']]);
    const open = () => game.evaluate((el) => (el as unknown as Game).state.openGates);
    expect(await open()).toEqual(['eis']);
    // sofort gespeichert
    const stored = await page.evaluate(() =>
      Object.keys(localStorage)
        .filter((k) => k.startsWith('larmic.games.world.'))
        .map((k) => (JSON.parse(localStorage.getItem(k)!) as { openGates: string[] }).openGates),
    );
    expect(stored).toEqual([['eis']]);
    // Erst das Vorspiel (ohne Sperre, die Kamera dreht zur Front), dann das Ritual: Während es läuft, hüpft die Figur nur
    await render(page);
    await game.evaluate((node) => {
      const el = node as unknown as Game;
      while (el.state.tick < el.state.ritual) el.apply({ type: 'tick' });
    });
    const before = await game.evaluate((el) => ({ ...(el as unknown as Game).state.player }));
    await page.keyboard.press('ArrowUp');
    expect(await game.evaluate((el) => ({ ...(el as unknown as Game).state.player }))).toMatchObject({
      x: before.x,
      y: before.y,
    });
    // Türflügel, Eiszapfen, Umriss werden gezeichnet (die Flügel schwingen im Takt der Regeln)
    await ticks(page, 5);
    await render(page);
    // Nach 2,4 s rutscht er durch den Gang hinter die Mündung (in der Eis-Welt) und wartet dort; nach 3 s ist es vorbei
    await ticks(page, 30);
    expect(
      await game.evaluate((node) => {
        const el = node as unknown as Game;
        const g = el.state.animals.find((a) => a.id === 'eis:pinguin')!;
        return el.world.realm(g.x, g.y);
      }),
    ).toBe('eis');
    // In 3D fährt die Kamera nach dem Ritual je Bild zurück (höchstens 50 ms Drehung je Bild). Steht sie noch weit zur
    // Front gedreht, wartet der erste Schritt aufs Blinzeln (300 ms) und die übrigen Pfeile im selben Zug verfallen: erst
    // gehen, wenn kein Blinzeln mehr nötig ist
    const yaw = () => game.evaluate((el) => (el as unknown as Game).r3d?.turn?.view.yaw ?? 0);
    await expect
      .poll(async () => {
        await render(page, 4);
        return needsBlink(await yaw());
      })
      .toBe(false);
    // Durch den Gang in den Kessel: Er rutscht voraus zum Schneebett und zieht als erstes Tier ein
    const realm = await game.evaluate((node) => {
      const el = node as unknown as Game;
      const { out } = el.world.gates.get('eis')!;
      const dir = out[0] > 0 ? 'e' : out[0] < 0 ? 'w' : out[1] > 0 ? 's' : 'n';
      for (let i = 0; i < 80 && el.world.realm(el.state.player.x, el.state.player.y) !== 'eis'; i++)
        el.apply({ type: 'move', dir });
      return el.world.realm(el.state.player.x, el.state.player.y);
    });
    expect(realm).toBe('eis');
    await ticks(page, 200);
    expect(await penguin()).toBe('home');
    // Am Schneebett erwacht das Eis-Portal im nächsten Takt; die Leiste zeigt die Eis-Welt
    await game.evaluate((node) => {
      const el = node as unknown as Game;
      const [x, y] = el.world.homes.eis.wake[0]!;
      el.state = { ...el.state, player: { x, y, dir: 's' } };
      el.lift();
    });
    await ticks(page, 1);
    expect(await game.evaluate((el) => (el as unknown as Game).state.portals)).toContain('eiskessel');
    await expect.poll(() => albumShows(page, game)).toBe('eis');
    // Nach dem Neuladen ist das Tor offen, der Pinguin wohnt auf der Schneewiese, die Figur wacht am Schneebett auf
    await reloadGame(page);
    const after = await game.evaluate((node) => {
      const el = node as unknown as Game;
      return {
        open: el.state.openGates,
        home: el.state.garden.some((p) => p.id === 'eis:pinguin'),
        realm: el.world.realm(el.state.player.x, el.state.player.y),
      };
    });
    expect(after).toEqual({ open: ['eis'], home: true, realm: 'eis' });
    await page.keyboard.press('ArrowDown');
    await render(page);
    expect(errors).toEqual([]);
  },
);

test.describe('ohne Welt-Paket', () => {
  // Der Service Worker käme sonst am Abfangen vorbei (er hätte das Paket im Speicher)
  test.use({ serviceWorkers: 'block' });
  test(
    'Spiel: Ohne das Paket der Eis-Welt startet es auf der Lichtung, ohne Loch und ohne Fehler; der Spielstand bleibt',
    { tag: '@3d' },
    async ({ page }) => {
      const errors = watchErrors(page);
      const game = await openGame(page, { clock: true });
      await expectView(page);
      type Game = {
        world: {
          homes: { eis: { wake: [number, number][] }; lichtung: { bed: [number, number] } };
          portals: Map<string, unknown>;
          spotsOf(realm: string): unknown[];
        };
        state: {
          player: { x: number; y: number; dir: string };
          openGates: string[];
          portals: string[];
          sleeping: boolean;
          animals: { realm: string }[];
          garden: { id: string; species: string }[];
        };
        save(): void;
      };
      await withIce(game); // für die Lage des Kessels
      // Alter Spielstand: Eistor offen, Eis-Portal wach, zwei Eis-Tiere zu Hause, die Figur schläft im Kessel
      const kessel = await game.evaluate((node) => {
        const el = node as unknown as Game;
        const [x, y] = el.world.homes.eis.wake[0]!;
        const garden = [
          ...el.state.garden,
          { id: 'eis:pinguin', species: 'pinguin' },
          { id: 'eis:robbe:2', species: 'robbe' },
        ];
        el.state = { ...el.state, openGates: ['eis'], portals: ['eiskessel'], garden, player: { x, y, dir: 's' } };
        el.save();
        return [x, y];
      });
      // Das Paket lädt nicht (Netz kaputt): Das Spiel startet trotzdem, ohne Kessel
      await page.route(/\/welt-eis\.[\w-]+\.js$/, (r) => r.abort());
      await reloadGame(page);
      await expectView(page); // in 3D auch ohne das Paket
      const bare = await game.evaluate((node) => {
        const el = node as unknown as Game;
        return {
          player: [el.state.player.x, el.state.player.y],
          bed: el.world.homes.lichtung.bed,
          kessel: el.world.spotsOf('eis').length,
          portal: el.world.portals.has('eiskessel'),
          iceAnimals: el.state.animals.filter((a) => a.realm === 'eis').length,
          open: el.state.openGates,
        };
      });
      expect(bare).toEqual({ player: bare.bed, bed: bare.bed, kessel: 0, portal: false, iceAnimals: 0, open: ['eis'] });
      const sleeping = () => game.evaluate((el) => (el as unknown as Game).state.sleeping);
      await page.keyboard.press('ArrowDown');
      await expect.poll(sleeping).toBe(false);
      await render(page, 5);
      // Gespeichert wird weiter die Position im Kessel, dazu alles andere aus dem alten Stand
      await game.evaluate((el) => (el as unknown as Game).save());
      const stored = await page.evaluate(() =>
        Object.keys(localStorage)
          .filter((k) => k.startsWith('larmic.games.world.'))
          .map(
            (k) =>
              JSON.parse(localStorage.getItem(k)!) as {
                position: number[];
                portals: string[];
                homeAnimals: { id: string }[];
              },
          ),
      );
      expect(stored).toHaveLength(1);
      expect(stored[0]!.position).toEqual(kessel);
      expect(stored[0]!.portals).toContain('eiskessel');
      expect(stored[0]!.homeAnimals.map((a) => a.id)).toEqual(expect.arrayContaining(['eis:pinguin', 'eis:robbe:2']));
      // Nur das abgebrochene Laden selbst meldet der Browser; sonst keine Fehler
      expect(errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
    },
  );
});

test.describe('Welt-Paket nur bei Bedarf', () => {
  // Der Service Worker holte beim Einrichten alles vorab, auch das Paket: Hier zählt, was die Seite selbst lädt
  test.use({ serviceWorkers: 'block' });
  test(
    'Spiel: Mit geschlossenem Eistor startet es ohne das Paket der Eis-Welt, nah am Tor kommt es nach; mit offenem Eistor gleich beim Start',
    { tag: '@3d' },
    async ({ page }) => {
      const errors = watchErrors(page);
      const fetched: string[] = [];
      page.on('request', (r) => {
        if (/\/welt-eis\.[\w-]+\.js$/.test(r.url())) fetched.push(r.url());
      });
      const game = await openGame(page, { clock: true });
      await expectView(page);
      type Game = {
        world: {
          gates: Map<string, { mid: [number, number]; out: [number, number] }>;
          portals: Map<string, unknown>;
          spotsOf(realm: string): unknown[];
        };
        state: { player: { x: number; y: number; dir: string }; openGates: string[]; animals: { realm: string }[] };
        packs: { get(id: string): unknown };
        apply(cmd: { type: 'tick' }): void;
        save(): void;
      };
      const ice = () =>
        game.evaluate((node) => {
          const el = node as unknown as Game;
          return {
            pack: !!el.packs.get('eis'),
            kessel: el.world.spotsOf('eis').length > 0,
            portal: el.world.portals.has('eiskessel'),
            animals: el.state.animals.filter((a) => a.realm === 'eis').length,
          };
        });
      const sleeping = () => game.evaluate((el) => (el as unknown as { state: { sleeping: boolean } }).state.sleeping);
      await page.keyboard.press('ArrowDown');
      await expect.poll(sleeping).toBe(false);
      await render(page);
      // Neue Welt, Eistor zu, die Figur am Bett: kein Paket, kein Kessel, kein Eis-Tier
      expect(fetched).toEqual([]);
      expect(await ice()).toEqual({ pack: false, kessel: false, portal: false, animals: 0 });
      // Die Figur kommt nah ans Eistor (über die Komponente): Im nächsten Takt kommt das Paket und wird eingebaut
      await game.evaluate((node) => {
        const el = node as unknown as Game;
        const { mid, out } = el.world.gates.get('eis')!;
        el.state = { ...el.state, player: { x: mid[0] - out[0] * 12, y: mid[1] - out[1] * 12, dir: 'n' } };
        el.apply({ type: 'tick' });
      });
      await expect.poll(ice).toEqual({ pack: true, kessel: true, portal: true, animals: 49 }); // der Pinguin ist verlaufen
      expect(fetched).toHaveLength(1);
      await view3d(page, 'eis'); // in 3D kommt sein 3D-Teil nach, die laufende Ansicht baut ihn ein
      // Spielstand mit offenem Eistor: Das Paket kommt gleich beim Start, die Welt entsteht mit ihm
      await game.evaluate((node) => {
        const el = node as unknown as Game;
        el.state = { ...el.state, openGates: ['eis'] };
        el.save();
      });
      fetched.length = 0;
      await reloadGame(page);
      await expectView(page);
      expect(fetched).toHaveLength(1);
      expect(await ice()).toEqual({ pack: true, kessel: true, portal: true, animals: 50 });
      await view3d(page, 'eis');
      expect(errors).toEqual([]);
    },
  );

  test('Spiel: 2D mit reduzierter Bewegung zeigt Kessel, Iglu und Fischkisten aus dem Welt-Paket, ohne Fehler', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors = watchErrors(page);
    const game = await openGame(page, { clock: true });
    await withIce(game);
    type Game = {
      world: {
        homes: { eis: { bed: [number, number]; wake: [number, number][] } };
        cell(x: number, y: number): { deco: string | null };
      };
      state: { player: { x: number; y: number; dir: string }; openGates: string[]; sleeping: boolean; wokeAt: number };
      r3d: unknown;
      lift(): void;
      renderer: { later: unknown[][] };
    };
    /** Die Figur wach an einen Platz im Kessel, nur die 2D-Ansicht zeichnet; danach die Quader der Eis-Dinge im Bild */
    const look = (where: 'bed' | 'fishcrate') =>
      game.evaluate((node, w) => {
        const el = node as unknown as Game;
        const [bx, by] = el.world.homes.eis.bed;
        let at = el.world.homes.eis.wake[0]!;
        for (let y = by - 25; y <= by + 25 && w === 'fishcrate'; y++)
          for (let x = bx - 25; x <= bx + 25; x++) if (el.world.cell(x, y).deco === 'fishcrate') at = [x, y + 1];
        el.r3d = null; // ohne 3D: so zeichnet die 2D-Ansicht von vorn
        el.state = {
          ...el.state,
          openGates: ['eis'],
          sleeping: false,
          wokeAt: -100,
          player: { x: at[0], y: at[1], dir: 's' },
        };
        el.lift();
      }, where);
    const boxes = () =>
      game.evaluate((node) => {
        const later = (node as unknown as Game).renderer.later;
        return {
          see: later.filter((b) => b[8] === 'see').length,
          crate: later.filter((b) => b[6] === '#7d6a55').length,
        };
      });
    await look('bed');
    await render(page);
    expect((await boxes()).see).toBeGreaterThan(20); // das Iglu aus Schneeblöcken, nicht nur ein Block
    await look('fishcrate');
    await render(page);
    expect((await boxes()).crate).toBeGreaterThan(4); // Fischkiste aus Treibholz
    // Bei reduzierter Bewegung zuckt keine Flosse: Über gut 4 s (länger als der Abstand zweier Zuckungen) steht jede
    // Schwanzflosse genau 0,3 über dem Boden ihrer Kiste
    const fins = () =>
      game.evaluate((node) =>
        (node as unknown as Game).renderer.later
          .filter((b) => b[3] === 0.06 && b[4] === 0.1 && b[5] === 0.24)
          .map((b) => Math.round(((b[2] as number) % 1) * 1000)),
      );
    for (let i = 0; i < 8; i++) {
      const lifts = await fins();
      expect(lifts.length).toBeGreaterThan(0);
      expect(new Set(lifts)).toEqual(new Set([300]));
      await render(page, 550 / FRAME_MS);
    }
    // Ganz hinten am Talende, gut 100 Felder hinter dem Schneebett, zeichnet auch die 2D-Ansicht die Plattform des
    // Eis-Portals: schlafend ohne Gold, wach mit Gold-Rahmen (die Plattform im Ring am Bett ist weit außer Sicht)
    await page.evaluate(() => {
      const proto = CanvasRenderingContext2D.prototype;
      const fill = Object.getOwnPropertyDescriptor(proto, 'fillStyle')!;
      const seen = new Set<string>();
      (window as unknown as { fills: Set<string> }).fills = seen;
      Object.defineProperty(proto, 'fillStyle', {
        ...fill,
        set(v: string | CanvasGradient | CanvasPattern) {
          if (typeof v === 'string') seen.add(v.toLowerCase());
          fill.set!.call(this, v);
        },
      });
    });
    const valleyEnd = (awake: boolean) =>
      game.evaluate((node, awake) => {
        type EndGame = Game & {
          world: {
            gates: Map<string, { out: [number, number] }>;
            portals: Map<string, { gate: [number, number] }>;
          };
          state: { portals: string[] };
        };
        const el = node as unknown as EndGame;
        const [gx, gy] = el.world.portals.get('eiskessel')!.gate;
        const [bx, by] = el.world.homes.eis.bed;
        const out = el.world.gates.get('eis')!.out;
        el.state = {
          ...el.state,
          player: { x: gx - out[0] * 3, y: gy - out[1] * 3, dir: 's' },
          portals: awake ? ['eiskessel'] : [],
        };
        el.lift();
        (window as unknown as { fills: Set<string> }).fills.clear();
        return Math.hypot(gx - bx, gy - by);
      }, awake);
    const gold = () =>
      page.evaluate(() => {
        const seen = (window as unknown as { fills: Set<string> }).fills;
        return seen.has('#f0a531') || seen.has('#b46a0c'); // GOLD.top, GOLD.side (mitwachsen-portals.ts)
      });
    expect(await valleyEnd(false)).toBeGreaterThan(100);
    await render(page);
    expect(await gold()).toBe(false);
    await valleyEnd(true);
    await render(page);
    expect(await gold()).toBe(true);
    expect(errors).toEqual([]);
  });

  test(
    'Spiel: Eine gelöschte Welt kommt nicht zurück, während die nächste auf ihr Welt-Paket wartet',
    { tag: '@3d' },
    async ({ page }) => {
      const errors = watchErrors(page);
      // Das Paket der Eis-Welt hängt im Netz, bis der Test es freigibt
      let release = () => {};
      const held = new Promise<void>((done) => (release = done));
      await page.route(/\/welt-eis\.[\w-]+\.js$/, async (route) => {
        await held;
        await route.continue();
      });
      const game = await openGame(page, { clock: true });
      await expectView(page);
      type Game = {
        saved: { id: string };
        state: { openGates: string[] };
        opening: string;
        live: string;
        packs: { get(id: string): unknown; waitMs: number };
        world: { spotsOf(realm: string): unknown[] };
        save(): void;
        apply(cmd: { type: 'tick' }): void;
        removeWorld(button: HTMLElement, id: string): Promise<void>;
      };
      const index = () =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('larmic.games.index') ?? '{}') as {
              current: string;
              worlds: { id: string }[];
            },
        );
      // Welt A mit offenem Eistor (braucht das Paket), dann eine neue Welt B anlegen: Sie braucht es nicht und öffnet sofort
      const a = await game.evaluate((node) => {
        const el = node as unknown as Game;
        el.state = { ...el.state, openGates: ['eis'] };
        el.save();
        return el.saved.id;
      });
      await page.locator('.mw-settings [data-act="new"]').evaluate((b) => (b as HTMLElement).click());
      await expect.poll(() => game.evaluate((el) => (el as unknown as Game).live)).not.toBe(a);
      const b = await game.evaluate((el) => (el as unknown as Game).saved.id);
      expect((await index()).worlds.map((w) => w.id).sort()).toEqual([a, b].sort());
      // B löschen (bestätigt): A öffnet und wartet auf das hängende Paket, B ruht. Der Start wartet sonst höchstens
      // PACK_WAIT_MS und öffnete A ohne Paket; hier wartet er, bis der Test das Paket freigibt, auch auf langsamen Rechnern
      await game.evaluate((node, id) => {
        const el = node as unknown as Game;
        el.packs.waitMs = 10 * 60_000;
        const button = document.createElement('button');
        button.dataset.armed = '1'; // zweiter Klick der Rückfrage
        void el.removeWorld(button, id);
      }, b);
      await expect.poll(() => game.evaluate((el) => (el as unknown as Game).opening)).toBe(a);
      // Speichern in dieser Zeit (Seite verlassen, Takt, Menü) bringt B nicht zurück; in einem Zug geprüft
      const waiting = await game.evaluate((node) => {
        const el = node as unknown as Game;
        el.save();
        window.dispatchEvent(new Event('pagehide'));
        document.dispatchEvent(new Event('visibilitychange'));
        for (let i = 0; i < 10; i++) el.apply({ type: 'tick' });
        const index = JSON.parse(localStorage.getItem('larmic.games.index') ?? '{}') as unknown;
        return { live: el.live, index };
      });
      // A wartet noch, B ist weg
      expect(waiting).toMatchObject({ live: b, index: { current: a, worlds: [{ id: a }] } });
      // Das Paket kommt an: A steht mit Kessel, B bleibt weg
      release();
      await expect.poll(() => game.evaluate((el) => (el as unknown as Game).live)).toBe(a);
      await expect
        .poll(() => game.evaluate((el) => (el as unknown as Game).world.spotsOf('eis').length > 0))
        .toBe(true);
      await view3d(page, 'eis'); // in 3D zeichnet die gewechselte Welt samt dem 3D-Teil des Pakets
      expect((await index()).worlds.map((w) => w.id)).toEqual([a]);
      expect(await game.evaluate((el) => (el as unknown as Game).state.openGates)).toEqual(['eis']);
      expect(errors).toEqual([]);
    },
  );
});

// Zwei Tests mit je einem Laden statt einem mit zweien: Jeder Schritt in der Seite wartet auf Bilder, und die zeichnet
// die Pipeline ohne Grafikkarte; zwei Ladevorgänge samt Menü sprengten dort die 30 s eines Tests
test('Menü für Eltern: Schalter „Kamera bewegen“ ist an und lässt sich umlegen, ohne neues Format des Spielstands', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await openGame(page, { clock: true });
  const menu = await openMenu(page);
  const motion = menu.getByRole('button', { name: /^Kamera bewegen/ });
  const sound = menu.getByRole('button', { name: /^Ton ist/ });
  // Ohne Eintrag im Speicher ist er an, neben dem Ton
  await expect(motion).toHaveText('Kamera bewegen: an');
  await expect(motion).toHaveAttribute('aria-pressed', 'true');
  await motion.click();
  await expect(motion).toHaveText('Kamera bewegen: aus');
  await expect(motion).toHaveAttribute('aria-pressed', 'false');
  await expect(sound).toHaveAttribute('aria-pressed', 'true'); // der Ton bleibt, wie er war
  // Gespeichert unter eigenem Schlüssel, kein neues Format des Spielstands: Die Welt speichert ihn nicht
  const stored = await page.evaluate(() => ({
    calm: localStorage.getItem('larmic.games.calm'),
    worlds: Object.keys(localStorage)
      .filter((k) => k.startsWith('larmic.games.world.'))
      .map((k) => localStorage.getItem(k) ?? ''),
  }));
  expect(stored.calm).toBe('1');
  expect(stored.worlds.some((w) => w.includes('calm'))).toBe(false);
  expect(errors).toEqual([]);
});

test('Menü für Eltern: Schalter „Kamera bewegen“ bleibt nach dem Neuladen aus und lässt sich wieder anlegen', async ({
  page,
}) => {
  const errors = watchErrors(page);
  // Wie nach dem Umlegen im Test davor und neu geladen: Der Speicher sagt „aus“
  await page.addInitScript(() => localStorage.setItem('larmic.games.calm', '1'));
  await openGame(page, { clock: true });
  const menu = await openMenu(page);
  const motion = menu.getByRole('button', { name: /^Kamera bewegen/ });
  await expect(motion).toHaveText('Kamera bewegen: aus');
  await expect(motion).toHaveAttribute('aria-pressed', 'false');
  await motion.click(); // wieder an
  await expect(motion).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('larmic.games.calm'))).toBe('0');
  expect(errors).toEqual([]);
});

for (const mode of ['3D mit „Kamera bewegen: aus“', '2D mit reduzierter Bewegung'] as const)
  test(
    `Postkarte der Torfront (${mode}): nach 1 s auf der Torplatte oben die Front, herunter blendet sie aus`,
    {
      tag: mode.startsWith('3D') ? '@3d' : [],
    },
    async ({ page }) => {
      const three = mode.startsWith('3D');
      if (three)
        await page.addInitScript(() => localStorage.setItem('larmic.games.calm', '1')); // Elternschalter aus
      else await page.emulateMedia({ reducedMotion: 'reduce' });
      const errors = watchErrors(page);
      const game = await openGame(page, { clock: true });
      type Game = {
        world: { gates: Map<string, { mid: [number, number]; out: [number, number] }> };
        state: { player: { x: number; y: number; dir: string }; sleeping: boolean; wokeAt: number };
        r3d: unknown;
        lift(): void;
      };
      const webgl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
      test.skip(three && !webgl, 'ohne WebGL keine 3D-Ansicht (2D: der Fall mit reduzierter Bewegung)');
      if (three) await expect(game).toHaveClass(/three/);
      // Tore im Norden zeigt die Kamera von Süden ohnehin von vorn: dort keine Postkarte
      const [front, north] = await game.evaluate((node) => {
        const gates = [...(node as unknown as Game).world.gates.entries()];
        return [gates.find(([, g]) => g.out[1] !== -1)![0], gates.find(([, g]) => g.out[1] === -1)?.[0]];
      });
      /** Die Figur wach vor das Tor `id`: `row` Reihen vor der Tür (2: mitten auf der Torplatte) */
      const stand = (row: number, id = front) =>
        game.evaluate(
          (node, [r, flat, gate]) => {
            const el = node as unknown as Game;
            if (flat) el.r3d = null; // ohne 3D: Die 2D-Ansicht zeichnet, auch die Postkarte
            const { mid, out } = el.world.gates.get(gate)!;
            const player = { x: mid[0] - r * out[0], y: mid[1] - r * out[1], dir: 'n' };
            el.state = { ...el.state, player, sleeping: false, wokeAt: -100 };
            el.lift();
          },
          [row, !three, id] as const,
        );
      const card = page.locator('canvas.mw-card');
      await expect(card).toHaveAttribute('aria-hidden', 'true');
      /** Ist die Postkarte an? Je Frage ein Bild weiter (die Postkarte lädt mit der ersten nach) */
      const on = async () => {
        await render(page);
        return card.evaluate((c) => c.classList.contains('on'));
      };
      /** Gut eine Sekunde dort stehen: Der Körper kommt an, dann zwei Bilder in großem Abstand (nur die Uhr zählt) */
      const linger = async () => {
        expect(await arrive(page)).toBe(true);
        await render(page, 2, 600);
      };
      await stand(4);
      await linger(); // länger als die Sekunde, nach der sie auf der Platte käme
      await expect(card).not.toHaveClass(/on/);
      await stand(2);
      await linger(); // gut 1 s auf der Torplatte
      await expect.poll(on).toBe(true);
      // Die Front ist gezeichnet: viele verschiedene Farben, nicht leer
      await expect
        .poll(async () => {
          await render(page);
          return card.evaluate((c) => {
            const cv = c as HTMLCanvasElement;
            const data = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data;
            const colors = new Set<number>();
            for (let i = 0; i < data.length; i += 16)
              if (data[i + 3]! > 0) colors.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
            return colors.size;
          });
        })
        .toBeGreaterThan(8);
      // oben mittig, klein, nicht über dem Steuerkreuz
      const box = (await card.boundingBox())!;
      const view = page.viewportSize()!;
      expect(Math.abs(box.x + box.width / 2 - view.width / 2)).toBeLessThan(2);
      expect(box.width).toBeLessThanOrEqual(0.3 * view.width + 1);
      expect(box.y + box.height).toBeLessThan(view.height / 2);
      await expect(card).toHaveCSS('opacity', '1');
      // Auf dem schmalen Handy rückt sie unter die Karte oben rechts, nie darunter versteckt
      await page.setViewportSize({ width: 320, height: 640 });
      await expect
        .poll(async () => {
          await render(page);
          const [c, m] = [(await card.boundingBox())!, (await page.locator('canvas.mw-map').boundingBox())!];
          return c.y >= m.y + m.height || c.x + c.width <= m.x;
        })
        .toBe(true);
      await page.setViewportSize(view);
      await stand(3); // eine Reihe herunter in die Bucht
      await expect.poll(on).toBe(false);
      await expect(card).toHaveCSS('opacity', '0');
      if (north) {
        await stand(2, north); // auf der Platte eines Tors im Norden: keine Postkarte über dem echten Tor
        await linger(); // länger als die Sekunde, nach der sie sonst käme
        await expect(card).not.toHaveClass(/on/);
      }
      expect(errors).toEqual([]);
    },
  );

test(
  'Drehung zur Torfront (3D): Stehen auf der Platte schwenkt zur Front, Fächer auf der Karte, ein Pfeil blinzelt zurück',
  {
    tag: '@3d',
  },
  async ({ page }) => {
    const errors = watchErrors(page);
    const game = await openGame(page, { clock: true });
    const webgl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
    test.skip(!webgl, 'ohne WebGL gibt es keine 3D-Ansicht (dort kommt die Postkarte, Test oben)');
    await expect(game).toHaveClass(/three/);
    // Gut 200 Bilder bis zum Ende, geprüft werden Kamera, Karte, Sonne und Schritt, nicht die Pixel: Gezeichnet wird
    // jedes zehnte (alle 0,5 s der Test-Uhr) und zum Schluss wieder jedes, sonst kostet allein das Software-WebGL 25–30 s
    await drawEvery(page, 10);
    type Game = {
      world: { gates: Map<string, { mid: [number, number]; out: [number, number] }> };
      state: { player: { x: number; y: number; dir: string }; sleeping: boolean; wokeAt: number };
      gl3d: { turn: { view: { yaw: number }; front: string | null } | null };
      lift(): void;
    };
    // ein Tor im Süden: Dort ist der Weg am weitesten (−155°), also blinzelt der erste Pfeil zurück
    const south = await game.evaluate((node) => {
      const el = node as unknown as Game;
      const [id, g] = [...el.world.gates.entries()].find(([, gate]) => gate.out[1] === 1)!;
      const player = { x: g.mid[0], y: g.mid[1] - 2, dir: 's' }; // mitten auf der Torplatte
      el.state = { ...el.state, player, sleeping: false, wokeAt: -100 };
      el.lift();
      return { id, y: player.y };
    });
    const yaw = () => game.evaluate((node) => (node as unknown as Game).gl3d.turn?.view.yaw ?? 0);
    const css = (name: string) => game.evaluate((node, n) => (node as HTMLElement).style.getPropertyValue(n), name);
    // nachgeladen, zur Front gebaut, dann weich hin: im Schnitt 40°/s, also gut 4 s bis −155° (Takte zählen die
    // Stehzeit, die Bilder drehen)
    await expect
      .poll(async () => {
        await render(page);
        return game.evaluate((node) => (node as unknown as Game).gl3d.turn?.front);
      })
      .toBe(south.id);
    await play(page, 5000);
    expect(await yaw()).toBeLessThan(-140);
    await expect(page.locator('canvas.mw-card')).not.toHaveClass(/on/); // mit Bewegung keine Postkarte
    expect(await css('--mw-fan')).toBe('1'); // die genordete Karte zeigt, wohin die Kamera schaut
    expect(Number.parseFloat(await css('--mw-look'))).toBeGreaterThan(140);
    // Schatten flimmern beim Pendeln nicht: Die Sonne pendelt nicht mit, und das Ziel der Schattenkamera liegt in jedem
    // Bild auf dem Raster der Schattenkarte, quer zum Licht in ganzen Pixeln (snapToShadowTexel im Lichtraum der
    // gedrehten Sonne); so verschiebt ein kleiner Kameraschritt die Schatten nur um ganze Pixel, also gleiche Pixel.
    // Erst wenn sie angekommen ist (bis dahin dreht die Sonne mit): Fortschritt 1, Winkel ohne Pendeln am Ziel
    const arrived = async () => {
      await play(page, 500);
      return game.evaluate((node) => {
        const st = (node as unknown as { gl3d: { turn: { st: { p: number; yaw: number } } | null } }).gl3d.turn?.st;
        return !!st && st.p === 1 && Math.abs(st.yaw + 155) < 0.05;
      });
    };
    await expect.poll(arrived).toBe(true);
    // 60 Bilder der Test-Uhr: Die Kamera pendelt, Sonne und Schatten bleiben
    const sway = await game.evaluate((node, ms) => {
      type V = { x: number; y: number; z: number };
      type Sun = { position: V; target: { position: V } };
      const el = node as unknown as Game & { gl3d: { sun: Sun }; frame(t: number): void };
      const clock = (window as unknown as { __MW_TEST: { ms: number } }).__MW_TEST;
      const texel = 36 / 2048; // SHADOW_TEXEL in mitwachsen-3d.ts
      const [yaws, dirs] = [[] as number[], [] as string[]];
      let off = 0;
      for (let i = 0; i < 60; i++) {
        clock.ms += ms;
        el.frame(performance.now());
        const { position: p, target } = el.gl3d.sun;
        const t = target.position;
        // Lichtraum wie Matrix4.lookAt(offset, 0, oben): z zur Sonne, x = oben × z, y = z × x
        const o = [p.x - t.x, p.y - t.y, p.z - t.z];
        const n = Math.hypot(...o);
        const z = o.map((c) => c / n) as [number, number, number];
        const xl = Math.hypot(z[2], z[0]);
        const x = [z[2] / xl, 0, -z[0] / xl];
        const y = [z[1] * x[2]! - z[2] * x[1]!, z[2] * x[0]! - z[0] * x[2]!, z[0] * x[1]! - z[1] * x[0]!];
        for (const a of [x, y]) {
          const v = (t.x * a[0]! + t.y * a[1]! + t.z * a[2]!) / texel;
          off = Math.max(off, Math.abs(v - Math.round(v)));
        }
        dirs.push(z.map((c) => c.toFixed(4)).join());
        yaws.push(el.gl3d.turn?.view.yaw ?? 0);
      }
      return { yaws, dirs, off };
    }, FRAME_MS);
    expect(Math.max(...sway.yaws) - Math.min(...sway.yaws)).toBeGreaterThan(0.05); // die Kamera bewegt sich
    expect(new Set(sway.dirs).size).toBe(1); // die Sonne nicht
    expect(sway.off).toBeLessThan(1e-3); // ganze Pixel der Schattenkarte
    // erster Pfeil: erst blinzeln (abdunkeln), dann läuft die Figur, die Pfeile bleiben, wie sie sind (↑ ist Norden).
    // Bild für Bild auf der Test-Uhr, bis sie gegangen ist (höchstens 2 s); zwischen den Bildern läuft der Schritt, den das
    // Blinzeln freigibt (queueMicrotask in mitwachsen-turn-3d.ts)
    const waited = await game.evaluate(
      async (node, [y, ms]) => {
        const el = node as unknown as Game & { frame(t: number): void };
        const clock = (window as unknown as { __MW_TEST: { ms: number } }).__MW_TEST;
        const t0 = performance.now();
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp', bubbles: true }));
        for (let i = 0; i < 2000 / ms && el.state.player.y === y; i++) {
          clock.ms += ms;
          el.frame(performance.now());
          await Promise.resolve();
        }
        return el.state.player.y === y ? -1 : performance.now() - t0;
      },
      [south.y, FRAME_MS] as const,
    );
    expect(waited).toBeGreaterThanOrEqual(290); // der Schritt wartet aufs Blinzeln (300 ms), er geht nicht verloren
    expect(await game.evaluate((node) => (node as unknown as Game).state.player.y)).toBe(south.y - 1);
    expect(Math.abs(await yaw())).toBeLessThan(5);
    await drawEvery(page, 1);
    await render(page);
    expect(await css('--mw-fan')).toBe('0');
    expect(errors).toEqual([]);
  },
);

// ---------- Der Schlitten (Welt-Paket der Eis-Welt, Spec „Der Schlitten“) ----------

/** Körper eines Fahrzeugs in diesem Bild (`rides` der Komponente, aus `View2D.bodies`) */
type RideBody = { id: string; x: number; y: number; z: number };
/** Was die Schlitten-Tests an der Komponente nutzen */
type SledGame = {
  world: {
    homes: { eis: { bed: [number, number]; wake: [number, number][] } };
    cell(x: number, y: number): { solid: boolean; ground: string; h: number; gate?: string };
    realm(x: number, y: number): string;
  };
  state: {
    player: { x: number; y: number; dir: string };
    openGates: string[];
    portals: string[];
    sleeping: boolean;
    wokeAt: number;
    tick: number;
    rideDue: number;
    ride?: { phase: string };
    packs: Record<string, unknown> & { fahrt?: { schlitten?: { stage: string } } };
    animals: { id: string; species: string; realm: string; x: number; y: number }[];
    garden: { id: string; species: string }[];
  };
  saved: { id: string };
  rides: readonly RideBody[];
  r3d: { bodies: Map<string, unknown> } | null;
  save(): void;
  lift(): void;
  openWorld(id: string): Promise<void>;
  project(x: number, y: number, z: number): [number, number];
};
const SLED = 'ride:schlitten';

/**
 * Eistor offen, Eis-Portal wach, die Leiste der Eis-Welt voll (je Eis-Art ein Tier auf der Schneewiese), die Figur wach
 * neben dem Schneebett. `stage`: Der Schlitten ist schon da (sonst erscheint er erst, `DUE` Takte später)
 */
const iceAtHome = (game: Locator, stage?: 'bereit' | 'fest') =>
  game.evaluate((node, st) => {
    const el = node as unknown as SledGame;
    const species = [...new Set(el.state.animals.filter((a) => a.realm === 'eis').map((a) => a.species)), 'pinguin'];
    const garden = [...el.state.garden, ...species.map((s) => ({ id: `eis:${s}`, species: s }))];
    const [x, y] = el.world.homes.eis.wake.find(([wx, wy]) => !el.state.animals.some((a) => a.x === wx && a.y === wy))!;
    const packs = st ? { ...el.state.packs, fahrt: { schlitten: { stage: st } } } : el.state.packs;
    el.state = {
      ...el.state,
      openGates: ['eis'],
      portals: [...new Set([...el.state.portals, 'eiskessel'])],
      garden,
      packs,
      sleeping: false,
      wokeAt: -100,
      player: { x, y, dir: 's' },
    };
    el.lift();
  }, stage);

/** Stufe des Schlittens im Spielstand der Komponente */
const sledStage = (game: Locator) =>
  game.evaluate((el) => (el as unknown as SledGame).state.packs.fahrt?.schlitten?.stage ?? 'fehlt');

/**
 * Die Figur wach `gap` Felder neben den Sitz des Schlittens stellen (quer zur Strecke, nicht aufs Zugtier und nicht in
 * den Schuppen dahinter), auf freie, begehbare Felder, von denen sie Schritt für Schritt zum Sitz kommt. Liefert die
 * Pfeiltaste zum Sitz und die zurück (null: kein Platz, dann scheitert der Test mit dem Seed)
 */
const besideSeat = (page: Page, game: Locator, gap: 1 | 2) =>
  render(page).then(() =>
    game.evaluate(
      (node, [n, id]) => {
        const el = node as unknown as SledGame;
        const seat = el.rides.find((r) => r.id === id);
        const pull = el.rides.find((r) => r.id === `${id}:rentier`);
        if (!seat || !pull) return null;
        const [sx, sy, px, py] = [seat.x, seat.y, pull.x, pull.y].map(Math.round) as [number, number, number, number];
        const stand = (x: number, y: number) => {
          const c = el.world.cell(x, y);
          if (c.gate) return el.state.openGates.includes(c.gate) ? 1 : null;
          return c.solid || ['water', 'lava', 'sky'].includes(c.ground) ? null : c.h;
        };
        const free = (x: number, y: number) =>
          stand(x, y) !== null && !el.state.animals.some((a) => a.x === x && a.y === y);
        const step = (fx: number, fy: number, tx: number, ty: number) => {
          const [a, b] = [stand(fx, fy), stand(tx, ty)];
          return a !== null && b !== null && b - a <= 1;
        };
        const keys: Record<string, string> = {
          '0,-1': 'ArrowUp',
          '0,1': 'ArrowDown',
          '-1,0': 'ArrowLeft',
          '1,0': 'ArrowRight',
        };
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          if ((sx + dx === px && sy + dy === py) || (sx - dx === px && sy - dy === py)) continue; // längs der Strecke
          const cells = Array.from({ length: n }, (_, i) => [sx + dx * (i + 1), sy + dy * (i + 1)] as const);
          if (!cells.every(([x, y]) => free(x, y))) continue;
          const chain = [...cells].reverse().concat([[sx, sy] as const]);
          if (!chain.every((c, i) => i === 0 || step(...chain[i - 1]!, ...c))) continue;
          const [x, y] = cells.at(-1)!;
          el.state = { ...el.state, sleeping: false, wokeAt: -100, player: { x, y, dir: 's' } };
          el.lift();
          return { to: keys[`${-dx},${-dy}`]!, back: keys[`${dx},${dy}`]! };
        }
        return null;
      },
      [gap, SLED] as const,
    ),
  );

/**
 * Test-Uhr: fahren lassen, bis die Figur am Ziel ausgestiegen ist (eine Fahrt dauert 15–20 s, dazu 2 s bis zur Abfahrt
 * und 1 s Aussteigen). Abfahrt und erste Strecke wie die Seite (Takt und Bild), danach Takte mit wenigen Bildern: Die
 * Fahrt läuft im Takt der Regeln, jedes Bild kostet in der Pipeline ohne Grafikkarte ein Vielfaches
 */
const rideToEnd = async (page: Page, game: Locator) => {
  await play(page, 3000);
  await expect
    .poll(async () => {
      await ticks(page, 50);
      await render(page, 2);
      return game.evaluate((el) => !!(el as unknown as SledGame).state.ride);
    })
    .toBe(false);
};

/** Wo die Figur steht: Gegend und Abstand (Schachbrett) zum Sitz des Schlittens */
const whereRider = (page: Page, game: Locator) =>
  render(page).then(() =>
    game.evaluate((node, id) => {
      const el = node as unknown as SledGame;
      const { x, y } = el.state.player;
      const seat = el.rides.find((r) => r.id === id);
      const near = seat ? Math.max(Math.abs(Math.round(seat.x) - x), Math.abs(Math.round(seat.y) - y)) : -1;
      return { realm: el.world.realm(x, y), near };
    }, SLED),
  );

test('Spiel: Schlitten bringt heim – erscheint am Schneebett, Fest bei der ersten Fahrt, zurück und mit Antippen, ohne Fehler', async ({
  page,
}) => {
  const errors = watchErrors(page);
  const game = await openGame(page, { clock: true });
  await withIce(game);
  // Gespeichert wie nach vielen Abenden: Eistor offen, alle Eis-Tiere zu Hause, die Figur am Schneebett; die Welt öffnet neu
  await iceAtHome(game);
  await game.evaluate((node) => {
    const el = node as unknown as SledGame;
    el.save();
    return el.openWorld(el.saved.id);
  });
  expect(await sledStage(game)).toBe('fehlt');
  await page.keyboard.press('ArrowDown'); // aufwachen neben dem Schneebett
  // gut 2 s später trabt er herbei: Stufe `bereit`
  await expect
    .poll(async () => {
      await ticks(page, 10);
      return sledStage(game);
    })
    .toBe('bereit');
  await ticks(page, 20); // herbeigetrabt
  // Ein neuer Druck zum Sitz steigt ein; die Fahrt geht von selbst durch den Gang über die Lichtung (Festfahrt)
  const keys = await besideSeat(page, game, 1);
  expect(keys).not.toBeNull();
  await page.keyboard.press(keys!.to);
  expect(await game.evaluate((el) => (el as unknown as SledGame).state.ride?.phase)).toBe('seated');
  await rideToEnd(page, game);
  // am Halt auf der Lichtung ausgestiegen, Fest gefeiert und sofort gespeichert
  const out = await whereRider(page, game);
  expect(out.realm).toBe('lichtung');
  expect(out.near).toBeGreaterThanOrEqual(0); // der Schlitten steht jetzt auch auf der Lichtung
  expect(out.near).toBeLessThanOrEqual(2);
  expect(await sledStage(game)).toBe('fest');
  const stored = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith('larmic.games.world.'))
      .map(
        (k) =>
          (JSON.parse(localStorage.getItem(k)!) as { packs?: { fahrt?: { schlitten?: { stage: string } } } }).packs
            ?.fahrt?.schlitten?.stage,
      ),
  );
  expect(stored).toEqual(['fest']);
  // zurück in die Eis-Welt
  const back = await besideSeat(page, game, 1);
  expect(back).not.toBeNull();
  await page.keyboard.press(back!.to);
  expect(await game.evaluate((el) => !!(el as unknown as SledGame).state.ride)).toBe(true);
  await rideToEnd(page, game);
  const home = await whereRider(page, game);
  expect(home.realm).toBe('eis');
  expect(home.near).toBeLessThanOrEqual(2);
  // Antippen des Schlittens (ein Finger, wie auf dem Tablet) steigt ein
  await render(page, 4);
  const spot = await game.evaluate((node, id) => {
    const el = node as unknown as SledGame;
    const seat = el.rides.find((r) => r.id === id)!;
    return el.project(seat.x + 0.5, seat.y + 0.5, seat.z + 0.4);
  }, SLED);
  await page.locator('canvas.mw-canvas').click({ position: { x: spot[0], y: spot[1] } });
  expect(await game.evaluate((el) => (el as unknown as SledGame).state.ride?.phase)).toBe('seated');
  expect(errors).toEqual([]);
});

test('Spiel: Schlitten – ein gehaltener Pfeil stößt nur an, ein neuer Druck steigt ein, ein Pfeil weg steigt wieder aus', async ({
  page,
}) => {
  const errors = watchErrors(page);
  const game = await openGame(page, { clock: true });
  await withIce(game);
  await iceAtHome(game, 'bereit');
  const keys = await besideSeat(page, game, 2);
  expect(keys).not.toBeNull();
  const before = await game.evaluate((el) => (el as unknown as SledGame).state.tick);
  // gehalten: erst ein Schritt neben den Sitz, nach der Wartezeit drückt der Pfeil gegen ihn – kein Einsteigen
  await page.keyboard.down(keys!.to);
  await play(page, 1500);
  const held = await game.evaluate((node) => {
    const el = node as unknown as SledGame;
    return { ride: !!el.state.ride, nudged: el.state.rideDue };
  });
  await page.keyboard.up(keys!.to);
  expect(held.ride).toBe(false);
  expect(held.nudged).toBeGreaterThan(before); // angestoßen (Tür geht auf, Tuten), gedrosselt über `rideDue`
  // ein neuer Druck steigt ein
  await render(page, 6); // ein Schritt-Takt (260 ms) seit dem letzten Schritt
  await page.keyboard.press(keys!.to);
  await render(page, 6);
  expect(await game.evaluate((el) => (el as unknown as SledGame).state.ride?.phase)).toBe('seated');
  // in den 2 s vor der Abfahrt: ein Pfeil weg steigt wieder aus
  await page.keyboard.press(keys!.back);
  await render(page, 6);
  expect(await game.evaluate((el) => !!(el as unknown as SledGame).state.ride)).toBe(false);
  expect(errors).toEqual([]);
});

test(
  'Spiel: Schlitten wird gezeichnet (Schuppen, Schlitten, Rentier; die Figur sitzt darin), ohne Fehler',
  { tag: '@3d' },
  async ({ page }) => {
    const errors = watchErrors(page);
    const game = await openGame(page, { clock: true });
    const webgl = await expectView(page);
    await withIce(game);
    await view3d(page, 'eis');
    await iceAtHome(game, 'bereit');
    const keys = await besideSeat(page, game, 1);
    expect(keys).not.toBeNull();
    // Geprüft wird die Szene, nicht die Pixel: in 3D nur jedes fünfte Bild an WebGL
    if (webgl) await drawEvery(page, 5);
    const shown = () =>
      game.evaluate((node, id) => {
        const el = node as unknown as SledGame;
        const ids = [id, `${id}:rentier`, `${id}:schuppen`];
        const has = (k: string) => (el.r3d ? el.r3d.bodies.has(k) : el.rides.some((r) => r.id === k));
        return { sled: ids.every(has), player: el.r3d ? el.r3d.bodies.has('player') : true };
      }, SLED);
    await expect
      .poll(async () => {
        await render(page);
        return shown();
      })
      .toEqual({ sled: true, player: true });
    await page.keyboard.press(keys!.to); // eingestiegen: Die Figur sitzt im Modell des Schlittens, kein eigener Körper
    await play(page, 3000); // los
    expect(await game.evaluate((el) => (el as unknown as SledGame).state.ride?.phase)).toMatch(/^(go|stop)$/);
    await render(page);
    expect(await shown()).toEqual({ sled: true, player: !webgl });
    if (webgl) await drawEvery(page, 1);
    await render(page);
    expect(errors).toEqual([]);
  },
);
