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
    const palette = [...GROTTE_COLORS.heaven, GROTTE_COLORS.floor, ...GROTTE_COLORS.patches].map((c) =>
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

// Das Gleis der Höhlenbahn per Entwickler-Schalter: Die Figur wacht im Bett der Lichtung auf, der Schalter spielt den
// Ausbau 2 vor, das Gleis liegt von Bahnhof Bär bis vor das Tor und wird gezeichnet (2D: Schienen und Schwellen im Bild,
// 3D: aus dem 3D-Teil der Bahn); gespeichert wird nichts. Ohne Schalter in einer neuen Welt (Eistor zu) kommt das Paket
// der Bahn nicht
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
      open: ['hoehle'], // Ausbau 2 kommt erst nach dem Hau-ruck: das Höhlentor ist offen
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
    // ohne Schalter, eine neue Welt (vor der Eis-Welt): kein Paket der Bahn, kein Gleis
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

// Kleine Lichtgeister per Entwickler-Schalter mit der Laterne in der Hand (2D, `&laterne=1`): Ohne Licht sieht man sie
// nicht; steht die Figur mit Laterne nah genug, blendet der Geist am Versteck ein; tritt sie auf 2 Felder heran, schwebt
// er zum nächsten Versteck im Lichtkreis
test('Spiel: kleine Lichtgeister per Entwickler-Schalter mit Laterne, im Licht zu sehen, schweben weiter, ohne Fehler', async ({
  page,
}) => {
  const errors = watchErrors(page);
  const game = await openGame(page, { clock: true, dev: 'hoehle&laterne=1' });
  type Spot = { x: number; y: number };
  type Game = {
    world: { cell(x: number, y: number): { solid?: boolean; ground: string } };
    state: { player: { x: number; y: number; dir: string }; lamp?: string; wokeAt: number };
    renderer: {
      views: Map<
        string,
        { fx?: { ghost?: { places: Spot[]; ghosts: { list: { at: number; from?: number; alpha: number }[] } } } }
      >;
    };
    apply(cmd: { type: 'move'; dir: string }): void;
  };
  await game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 's' })); // aufwachen
  await ticks(page, 10);
  await render(page, 2);
  expect(await game.evaluate((node) => (node as unknown as Game).state.lamp ?? null)).toBe('hoehle');
  /** Die Figur auf ein freies Feld stellen, dessen Mitte `from` bis `to` Felder vom ersten Versteck liegt */
  const stand = (from: number, to: number) =>
    game.evaluate(
      (node, [a, b]) => {
        const el = node as unknown as Game;
        const h = el.renderer.views.get('hoehle')!.fx!.ghost!.places[0]!;
        for (let r = 0; r <= 5; r++)
          for (let dy = -r; dy <= r; dy++)
            for (let dx = -r; dx <= r; dx++) {
              const [x, y] = [Math.floor(h.x) + dx, Math.floor(h.y) + dy];
              const c = el.world.cell(x, y);
              const d = Math.hypot(h.x - x - 0.5, h.y - y - 0.5);
              if (c.solid || c.ground === 'water' || d <= a || d > b) continue;
              el.state = { ...el.state, wokeAt: -1e6, player: { x, y, dir: 's' } };
              return true;
            }
        return false;
      },
      [from, to] as const,
    );
  const first = () =>
    game.evaluate((node) => {
      const g = (node as unknown as Game).renderer.views.get('hoehle')!.fx!.ghost!.ghosts.list[0]!;
      return { at: g.at, moving: g.from !== undefined, alpha: g.alpha };
    });
  expect(await first()).toEqual({ at: 0, moving: false, alpha: 0 }); // fern der Halle: nicht zu sehen
  expect(await stand(GROTTE.ghost.near + 0.5, GROTTE.circle.lantern - 0.5)).toBe(true); // im Licht, nicht zu nah
  await arrive(page);
  await render(page, Math.ceil(GROTTE.ghost.fade / 50) + 1);
  expect(await first()).toEqual({ at: 0, moving: false, alpha: 1 });
  expect(await stand(-1, GROTTE.ghost.near - 0.3)).toBe(true); // ganz nah heran
  await render(page, 1);
  const fled = await first();
  expect(fled.moving).toBe(true);
  expect(fled.at).not.toBe(0);
  await render(page, Math.ceil(GROTTE.ghost.float / 50) + 1);
  expect(await first()).toMatchObject({ at: fled.at, moving: false });
  expect(errors).toEqual([]);
});

// Tupfspinne am Netz per Entwickler-Schalter (2D): Die Figur steht neben einem Netz und läuft hinein: Sie bleibt stehen,
// die Spinne seilt sich ab, winkt und hängt danach wieder still an ihrem Platz
test('Spiel: Tupfspinne per Entwickler-Schalter, Netz klingt, die Spinne grüßt und bleibt an ihrem Platz, ohne Fehler', async ({
  page,
}) => {
  const errors = watchErrors(page);
  const game = await openGame(page, { clock: true, dev: 'hoehle' });
  type Body = { id: string; key: string; x: number; y: number };
  type Game = {
    world: { cell(x: number, y: number): { solid?: boolean; ground: string; deco: string | null } };
    state: { player: { x: number; y: number; dir: string }; wokeAt: number };
    rides: Body[];
    apply(cmd: { type: 'move'; dir: string }): void;
  };
  await game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 's' })); // aufwachen
  await ticks(page, 10);
  await render(page, 2);
  const spiders = () =>
    game.evaluate((node) => (node as unknown as Game).rides.filter((b) => b.id.startsWith('spider:')));
  const all = await spiders();
  expect(all.length).toBeGreaterThanOrEqual(GROTTE.web.least);
  expect(all.every((b) => b.key === `spider-rest-${GROTTE.web.rest}`)).toBe(true);
  // die Figur neben das erste Netz stellen, Blick zu ihm hin
  const dir = await game.evaluate(
    (node, [x, y]) => {
      const el = node as unknown as Game;
      const sides = [
        ['n', 0, 1],
        ['s', 0, -1],
        ['e', -1, 0],
        ['w', 1, 0],
      ] as const;
      for (const [d, dx, dy] of sides) {
        const c = el.world.cell(x + dx, y + dy);
        if (c.solid || c.ground === 'water') continue;
        el.state = { ...el.state, wokeAt: -1e6, player: { x: x + dx, y: y + dy, dir: d } };
        return d;
      }
      return null;
    },
    [all[0]!.x, all[0]!.y] as const,
  );
  expect(dir).not.toBeNull();
  await arrive(page);
  const before = await game.evaluate((node) => ({ ...(node as unknown as Game).state.player }));
  await game.evaluate((node, d) => (node as unknown as Game).apply({ type: 'move', dir: d }), dir!);
  await ticks(page, 1);
  const keys = new Set<string>();
  for (let i = 0; i < 50; i++) {
    await render(page, 1);
    keys.add((await spiders())[0]!.key);
  }
  expect([...keys].some((k) => k.includes('wave'))).toBe(true); // sie winkt
  expect([...keys].some((k) => k !== `spider-rest-${GROTTE.web.rest}` && k.startsWith('spider-rest'))).toBe(true); // abgeseilt
  const after = await spiders();
  expect(after.map((b) => [b.x, b.y])).toEqual(all.map((b) => [b.x, b.y])); // keine Spinne läuft weg oder heran
  expect(after[0]!.key).toBe(`spider-rest-${GROTTE.web.rest}`); // wieder still oben
  const player = await game.evaluate((node) => (node as unknown as Game).state.player);
  expect([player.x, player.y]).toEqual([before.x, before.y]); // das Netz hält sie nicht fest, sie läuft nicht hinein
  expect(errors).toEqual([]);
});

// Dunkelmaske der Grotte (Pixelprobe am fertigen Bild, als Bildschirmfoto: in 2D und in 3D mit der Ebene über WebGL;
// @3d, damit der beleuchtete Boden in 3D mitgeprüft wird): mitten in der Grotte, fern von Bett und Schächten, liegt um
// die Figur ein Lichtloch (nie dunkler als die Dämmerung, fast so hell wie mit „Höhle hell“), außerhalb ist es
// deutlich dunkler als mit „Höhle hell“, aber nie unter Helligkeit 0,08; der Nebel daneben ist unter der Maske nie
// heller als der Boden und nie unter 0,08
test(
  'Spiel: Dunkelmaske in der Grotte per Entwickler-Schalter, Lichtloch um die Figur, nie schwarz, Nebel nicht heller, ohne Fehler',
  { tag: '@3d' },
  async ({ page }) => {
    const errors = watchErrors(page);
    // eine feste Welt (Seed 1, der schlimmste Fall beim ersten Spielen), sonst zöge jeder Lauf einen neuen Seed
    await page.addInitScript(() => {
      const real = crypto.getRandomValues.bind(crypto);
      const fixed = (a: ArrayBufferView<ArrayBuffer>) =>
        a instanceof Uint32Array && a.length === 1 ? a.fill(1) : real(a);
      Object.defineProperty(crypto, 'getRandomValues', { value: fixed });
    });
    // gespeichert „Höhle hell“ (Elternschalter aus, wie nach einem früheren Spielen), das Menü bleibt zu
    await page.addInitScript(() => localStorage.setItem('larmic.games.cave', '1'));
    const game = await openGame(page, { clock: true, dev: 'hoehle' });
    const webgl = await expectView(page);
    await view3d(page, 'hoehle');
    type Spot = { cx: number; cy: number; r: number };
    type Game = {
      world: {
        homes: Record<string, { bed: [number, number] }>;
        portals: Map<string, { gate: [number, number] }>;
        realm(x: number, y: number): string;
        cell(x: number, y: number): { h: number; solid?: boolean };
      };
      state: { player: { x: number; y: number; dir: string }; wokeAt: number; animals: unknown[] };
      renderer: {
        views: Map<
          string,
          {
            fx?: {
              mask?: { bright?: boolean; brightAt?: boolean; drawn?: { strength: number; spots: Spot[] } | null };
            };
          }
        >;
      };
      seen(x: number, y: number): boolean;
      apply(cmd: { type: 'move'; dir: string }): void;
    };
    await game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 's' })); // aufwachen
    await ticks(page, 10);
    // auf den Weg durch die Mitte, 42 Felder hinter dem Bett (fern von Bett, Schächten und Bahnhof), ohne Tiere
    await game.evaluate((node) => {
      const el = node as unknown as Game;
      const [bx, by] = el.world.homes.hoehle!.bed;
      const [gx, gy] = el.world.portals.get('hoehlensee')!.gate;
      const k = 42 / 106;
      const player = { x: Math.round(bx + (gx - bx) * k), y: Math.round(by + (gy - by) * k), dir: 's' };
      el.state = { ...el.state, wokeAt: -1e6, animals: [], player };
      el.apply({ type: 'move', dir: 's' }); // ein Schritt: der Nebel lichtet sich
    });
    await arrive(page);
    await render(page, 60); // die Luft der Grotte in 3D ist ganz da (blendet je Bild weich ein)
    // ohne Menü: Die Maske liest den Schalter beim ersten Bild aus dem Speicher, die Spielfläche weiß noch nichts
    await expect(game).not.toHaveAttribute('data-cave');
    const saved = await game.evaluate((node) => {
      const mask = (node as unknown as Game).renderer.views.get('hoehle')!.fx!.mask!;
      return { brightAt: mask.brightAt, strength: mask.drawn?.strength };
    });
    expect(saved).toEqual({ brightAt: true, strength: GROTTE.dark.bright });
    const canvas = await page.locator('canvas.mw-canvas').boundingBox();
    /** Helligkeit (relative Luminanz) des fertigen Bilds an Punkten der Ansicht (Pixel der Ansicht) */
    const lums = async (points: [number, number][]) => {
      const shot = await page.screenshot({ scale: 'css', clip: canvas! });
      return page.evaluate(
        async ([b64, pts]) => {
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const img = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
          const cv = new OffscreenCanvas(img.width, img.height);
          const ctx = cv.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
          return pts.map(([x, y]) => {
            const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
            return 0.2126 * lin(d[0]! / 255) + 0.7152 * lin(d[1]! / 255) + 0.0722 * lin(d[2]! / 255);
          });
        },
        [shot.toString('base64'), points] as const,
      );
    };
    // Felder im Nebel in der Reihe der Figur (Grottenboden auf ihrer Höhe, nichts Hohes davor): so viele Felder seitlich
    const fogs = await game.evaluate((node) => {
      const el = node as unknown as Game;
      const { x, y } = el.state.player;
      const h = el.world.cell(x, y).h;
      const free = (fx: number) =>
        el.world.realm(fx, y) === 'hoehle' &&
        [0, Math.sign(fx - x)].every((d) => !el.seen(fx + d, y)) &&
        [0, 1, 2].every((d) => el.world.cell(fx, y + d).h <= h && !el.world.cell(fx, y + d).solid);
      return [8, 9, 10, 11, 12].flatMap((k) => [-k, k].filter((d) => free(x + d)));
    });
    /** Stärke, Loch und Helligkeit: Mitte links neben der Figur, ein Ring außerhalb des Lochs, das Feld im Nebel */
    const probe = async (bright: boolean) => {
      // wie das Menü den Elternschalter „Höhle dunkel“ an der Spielfläche setzt
      await game.evaluate((node, pale) => ((node as HTMLElement).dataset.cave = pale ? '1' : '0'), bright);
      // die Stärke gleitet in `fade` ms hinüber: so viele Bilder der Test-Uhr, dann eins mit dieser Stärke
      await render(page, Math.ceil(GROTTE.dark.fade / FRAME_MS) + 1);
      const { strength, spots } = await game.evaluate(
        (node) => (node as unknown as Game).renderer.views.get('hoehle')!.fx!.mask!.drawn!,
      );
      const { cx, cy, r } = spots[0]!;
      // das am weitesten draußen, das noch im Bild liegt (in 3D verläuft der Nebel über 2 bis 3 Felder)
      const fogAt = fogs.filter((k) => (Math.abs(k) * r) / GROTTE.dark.hole < cx - 10).sort((a, b) => b * b - a * a)[0];
      expect(fogAt).toBeDefined();
      const ring = [0, 1, 2, 3, 4, 5].map((i): [number, number] => [
        cx + 1.5 * r * Math.cos(i),
        cy + 1.5 * r * Math.sin(i),
      ]);
      const [near, fog, ...around] = await lums([
        [cx - 0.35 * r, cy],
        [cx + (fogAt! * r) / GROTTE.dark.hole, cy],
        ...ring,
      ]);
      return { strength, r, near: near!, fog: fog!, ring: around };
    };
    const dark = await probe(false);
    const pale = await probe(true);
    expect(dark.strength).toBeCloseTo(GROTTE.dark.mask);
    expect(pale.strength).toBe(GROTTE.dark.bright);
    expect(
      await game.evaluate((node) => (node as unknown as Game).renderer.views.get('hoehle')!.fx!.mask!.bright),
    ).toBe(true);
    expect(dark.r).toBeGreaterThan(40); // 3 Felder
    // im Loch: fast so hell wie mit „Höhle hell“, nie dunkler als die Dämmerung
    expect(dark.near).toBeGreaterThan(0.75 * pale.near);
    expect(dark.near).toBeGreaterThanOrEqual(GROTTE.dark.dusk);
    // außerhalb: deutlich dunkler als „Höhle hell“, aber nirgends schwarz. „Deutlich“ zählt über der Untergrenze 0,08,
    // unter die die Maske nie drückt: Von der Helligkeit darüber bleibt höchstens gut ein Drittel (gemessen in 3D ein
    // Viertel, 0,095 gegen 0,147 mit dem Boden #d6d2e6; in 2D ein Sechstel). Das bloße Verhältnis beider (früher unter
    // 0,6) stieg mit jedem dunkleren Boden, obwohl es dunkler wurde: „Höhle hell“ wird mit dunkler, das Dunkel bleibt an
    // der Untergrenze (mit #e6e2f2 lag es in 3D schon bei 0,597). Dazu unter der Dämmerung (3D 0,095, 2D 0,127 von 0,16)
    const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
    const above = (v: number) => v - GROTTE.dark.floor;
    expect(above(mean(dark.ring))).toBeLessThan(0.35 * above(mean(pale.ring)));
    expect(mean(dark.ring)).toBeLessThan(0.85 * GROTTE.dark.dusk);
    expect(Math.min(...dark.ring)).toBeGreaterThanOrEqual(GROTTE.dark.floor);
    expect(mean(dark.ring)).toBeLessThan(dark.near / 2);
    // der Nebel: nie unter 0,08; in 2D nie heller als der Boden unter der Maske. In 3D ist der beleuchtete Boden dunkler
    // als in 2D und der Nebel schon ohne Maske etwas heller als er (siehe „Höhle hell“): dort höchstens ein Viertel heller
    // (ohne Maske über dem Nebel war er fast viermal so hell; nachzusehen am Gerät, Schritt 18)
    expect(dark.fog).toBeGreaterThanOrEqual(GROTTE.dark.floor);
    const median = (v: number[]) => [...v].sort((a, b) => a - b)[v.length >> 1]!;
    expect(dark.fog).toBeLessThanOrEqual((webgl ? 1.25 : 1) * median(dark.ring));
    expect(errors).toEqual([]);
  },
);

// Tok erscheint per Entwickler-Schalter (`?entwickler=bahn&bau=0`, 2D): Der Schalter spielt den Stand vor, in dem er
// kommt (Eistor offen, Eis-Leiste voll, erste Heimfahrt mit dem Schlitten); beim Aufwachen im Bett der Lichtung hüpft
// er neben der Figur heraus, wird gezeichnet und hat einen Gast-Platz; am Abend (`&abend=1`) liegt er schlafend neben
// dem Bett. Gespeichert wird nichts. Für das Kind ohne Schalter: „Bahn und Höhle für das Kind …“
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
  expect(errors).toEqual([]);
});

// Hau-ruck am Höhlentor per Entwickler-Schalter (`?entwickler=bahn&bau=1&bucht=1`, 2D): Die erste Fahrt ist gemacht,
// Tok wartet neben der Torplatte; steht die Figur still auf der Platte, beginnen die Hände auf dem Stein zu leuchten,
// ohne Druck stößt Tok allein, nach drei Stößen ist das Höhlentor offen (Stufe `offen`). Gespeichert wird im Blick
// hinein nichts; für das Kind: „Bahn und Höhle für das Kind …“
test('Spiel: Hau-ruck am Höhlentor per Entwickler-Schalter, Tok stößt allein, das Tor geht auf, ohne Fehler', async ({
  page,
}) => {
  const errors = watchErrors(page);
  type Game = {
    world: {
      gates: Map<string, { mid: [number, number]; out: [number, number] }>;
      cell(x: number, y: number): { plate?: string };
    };
    state: {
      tick: number;
      player: { x: number; y: number; dir: string };
      openGates: string[];
      animals: { id: string; x: number; y: number }[];
      packs: Record<string, unknown>;
      heave?: { n: number };
    };
    rides: { id: string }[];
    fog: { reveal(x: number, y: number, r: number): void };
    apply(cmd: { type: 'move'; dir: string }): void;
  };
  const game = await openGame(page, { clock: true, dev: 'bahn&bau=1&bucht=1' });
  await game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 's' })); // aufwachen
  await ticks(page, 2);
  // Figur auf die Mitte der Torplatte, Tok auf seinen Platz daneben (u +2), wie nach dem Weg in die Bucht
  await game.evaluate((node) => {
    const el = node as unknown as Game;
    const { mid, out } = el.world.gates.get('hoehle')!;
    const row = (u: number): [number, number] => [mid[0] - out[0] * 2 - out[1] * u, mid[1] - out[1] * 2 + out[0] * u];
    const [px, py] = row(0);
    const [tx, ty] = row(2);
    const animals = el.state.animals.map((a) => (a.id === 'hoehle:tok' ? { ...a, x: tx, y: ty } : a));
    el.state = { ...el.state, animals, player: { x: px, y: py, dir: 'n' } };
    el.fog.reveal(px, py, 10);
  });
  await ticks(page, 4 + 40); // Stehen, Vorspiel (höchstens 3,5 s), dann rollt der Stein
  await render(page, 2);
  const pushing = await game.evaluate((node) => {
    const el = node as unknown as Game;
    return {
      plate: el.world.cell(el.state.player.x, el.state.player.y).plate,
      heave: !!el.state.heave,
      hands: el.rides.some((r) => r.id === 'heave:hands'),
    };
  });
  expect(pushing).toEqual({ plate: 'hoehle', heave: true, hands: true });
  await ticks(page, 3 * 15 + 31); // drei Stöße von Tok, dann 3 s bis zum Ende
  await render(page, 2);
  const open = await game.evaluate((node) => {
    const el = node as unknown as Game;
    return { open: el.state.openGates, heave: !!el.state.heave, fahrt: el.state.packs.fahrt };
  });
  expect(open).toEqual({ open: ['hoehle'], heave: false, fahrt: { hoehle: { stage: 'offen', gefahren: true } } });
  await page.evaluate(() => dispatchEvent(new Event('pagehide')));
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('larmic.games.')))).toEqual([]);
  expect(errors).toEqual([]);
});

// „Gute Nacht, Bahn“ per Entwickler-Schalter (`?entwickler=bahn&bau=1`, 2D): Schläft die Figur im Bett der Lichtung und
// steht der Zug an Bahnhof Bär, pfeift er nach dem Schlaflied leise gute Nacht und macht sein Licht aus (nur das kleine
// Nachtlicht bleibt, Schlüssel des Bilds `…:n`); eine Taste (auch die Leertaste, die so kurz nach dem Einschlafen nicht
// weckt) beendet es sofort. Über die Test-Uhr und den Zustand, nie über Wartezeit
test('Spiel: Gute Nacht, Bahn per Entwickler-Schalter, Licht aus nach dem Pfiff, eine Taste beendet es, ohne Fehler', async ({
  page,
}) => {
  const errors = watchErrors(page);
  type Game = {
    world: { homes: Record<string, { bed: [number, number] }> };
    state: { player: { x: number; y: number; dir: string }; sleeping: boolean; wokeAt: number };
    rides: { id: string; key: string }[];
    apply(cmd: { type: 'move'; dir: string } | { type: 'action' }): void;
  };
  const game = await openGame(page, { clock: true, dev: 'bahn&bau=1' });
  await game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 's' })); // aufwachen
  await ticks(page, 2);
  const night = () =>
    game.evaluate((node) => {
      const el = node as unknown as Game;
      const loco = el.rides.find((r) => r.id === 'ride:hoehle:loco');
      return { sleeping: el.state.sleeping, loco: !!loco, out: !!loco?.key.endsWith(':n') };
    });
  const toBed = () =>
    game.evaluate((node) => {
      const el = node as unknown as Game;
      const [bx, by] = el.world.homes.lichtung!.bed;
      el.state = { ...el.state, sleeping: false, wokeAt: -1e6, player: { x: bx, y: by + 1, dir: 'n' } };
      el.apply({ type: 'move', dir: 'n' });
    });
  await render(page, 2);
  expect(await night()).toEqual({ sleeping: false, loco: true, out: false });
  await toBed();
  await render(page, 2);
  expect(await night()).toEqual({ sleeping: true, loco: true, out: false }); // erst das Schlaflied
  await render(page, 40, 200); // 8 s: Pfiff nach dem Schlaflied, danach Licht aus
  expect(await night()).toEqual({ sleeping: true, loco: true, out: true });
  // noch einmal ins Bett; diesmal beendet die Leertaste die gute Nacht gleich nach dem Schlaflied
  await toBed();
  await render(page, 11, 200); // gut 2 s: der Pfiff hat begonnen, das Licht brennt noch
  expect(await night()).toEqual({ sleeping: true, loco: true, out: false });
  await game.evaluate((node) => (node as unknown as Game).apply({ type: 'action' }));
  await render(page, 1);
  expect(await night()).toEqual({ sleeping: true, loco: true, out: true });
  expect(errors).toEqual([]);
});

// Bau 1 per Entwickler-Schalter (`?entwickler=bahn&bau=0`; @3d, weil die Welt dabei neu gebaut wird und 3D ihre Stücke
// austauscht): Läuft die Figur in den wachen Tok, baut er 8 s lang (Pfeile lassen sie nur hüpfen), die Welt wird mit dem
// Gleis neu gebaut, danach stehen Bahnhof Bär und der Zug da, Tok sitzt im hinteren Wagen. Gespeichert wird im Blick
// hinein nichts; für das Kind: „Bahn und Höhle für das Kind …“
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
    // zöge jeder Lauf einen neuen Seed (`randomSeed`), und in den wenigen Welten ohne Platz für Bahnhof Bär baut Tok nicht
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

// Antippen von Tok und Zug per Entwickler-Schalter (`?entwickler=bahn&bau=0`, fester Seed 1; @3d, weil der Finger über
// die Projektion der 3D-Kamera trifft, im Projekt `game` dieselbe Prüfung in 2D): Ein Klick auf Tok an seinem Platz, drei
// Felder von der Figur, beginnt Bau 1 wie Hineinlaufen, die Figur geht keinen Schritt; nach dem Bau steigt ein Klick auf
// den mittleren Wagen ein. Gespeichert wird im Blick hinein nichts
test(
  'Spiel: Antippen per Entwickler-Schalter: Tok beginnt Bau 1, der Zug steigt ein, ohne Schritt, speichert nichts, ohne Fehler',
  { tag: '@3d' },
  async ({ page }) => {
    const errors = watchErrors(page);
    type Game = {
      world: {
        seed: number;
        cell(x: number, y: number): { solid: boolean; ground: string; stop?: string };
        realm(x: number, y: number): string;
      };
      state: {
        player: { x: number; y: number; dir: string };
        animals: { id: string; x: number; y: number }[];
        packs: Record<string, unknown>;
        work?: { from: number; to: number };
        ride?: { id: string };
        heraldDue: number;
      };
      bodies: Map<string, { x: number; y: number; z: number }>;
      rides: { id: string; x: number; y: number; z: number }[];
      project(x: number, y: number, z: number): [number, number];
      apply(cmd: { type: 'move'; dir: string }): void;
    };
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
    // die Figur drei Felder von ihm (frei, auf der Lichtung), dann wird gezeichnet: Tok hat seinen Körper
    const from = await game.evaluate((node) => {
      const el = node as unknown as Game;
      const t = el.state.animals.find((a) => a.id === 'hoehle:tok')!;
      const spots: [number, number][] = [];
      for (let dx = -3; dx <= 3; dx++)
        for (let dy = -3; dy <= 3; dy++)
          if (Math.max(Math.abs(dx), Math.abs(dy)) === 3) spots.push([t.x + dx, t.y + dy]);
      const [x, y] = spots.find(([x, y]) => {
        const c = el.world.cell(x, y);
        const free = !el.state.animals.some((a) => a.x === x && a.y === y);
        return free && !c.solid && c.ground !== 'water' && el.world.realm(x, y) === 'lichtung';
      })!;
      el.state = { ...el.state, player: { x, y, dir: 's' } };
      return [x, y];
    });
    await render(page, 4);
    const at = (id: string) =>
      game.evaluate((node, id) => {
        const el = node as unknown as Game;
        const b = el.bodies.get(id) ?? el.rides.find((r) => r.id === id);
        return b ? el.project(b.x + 0.5, b.y + 0.5, b.z + 0.4) : null;
      }, id);
    const canvas = page.locator('canvas.mw-canvas');
    const tok = await at('hoehle:tok');
    expect(tok).not.toBeNull();
    await canvas.click({ position: { x: tok![0], y: tok![1] } });
    const started = await game.evaluate((node) => {
      const el = node as unknown as Game;
      return { work: !!el.state.work, bahn: el.state.packs.bahn, at: [el.state.player.x, el.state.player.y] };
    });
    expect(started).toEqual({ work: true, bahn: { built: 1 }, at: from });
    // nach dem Bau: auf den Bahnsteig neben den mittleren Wagen, ein Klick auf ihn steigt ein
    await ticks(page, 85);
    await render(page, 2);
    await game.evaluate((node) => {
      const el = node as unknown as Game;
      const mid = el.rides.find((r) => r.id === 'ride:hoehle:mid')!;
      const [mx, my] = [Math.round(mid.x), Math.round(mid.y)];
      const near: [number, number][] = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      const [dx, dy] = near.find(([dx, dy]) => el.world.cell(mx - dx, my - dy).stop === 'hoehle')!;
      el.state = { ...el.state, animals: [], player: { x: mx - dx, y: my - dy, dir: 's' } };
    });
    await render(page, 4);
    const mid = await at('ride:hoehle:mid');
    expect(mid).not.toBeNull();
    await canvas.click({ position: { x: mid![0], y: mid![1] } });
    expect(await game.evaluate((node) => (node as unknown as Game).state.ride?.id)).toBe('hoehle');
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
// Gespeichert wird im Blick hinein nichts; für das Kind: „Bahn und Höhle für das Kind …“
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

// Schlitten und Zug in einem Spiel per Entwickler-Schalter (`?entwickler=bahn&bau=1&eis=1`, fester Seed 1, 2D): wie der
// echte Spielstand mit offener Eis-Welt und gefahrenem Schlitten. Fehler vom 24.11.2026: Beim Einsteigen in den Zug kam
// das Bild des Schlittens (er sprang auf seine Strecke, die Figur saß in ihm). Jetzt sitzt die Figur nur im mittleren
// Wagen, der Schlitten steht still an seinem Halt auf der Lichtung, ohne Sitz und ohne Figur
test('Spiel: Zug mit offener Eis-Welt per Entwickler-Schalter: die Figur sitzt im Zug, der Schlitten bleibt stehen, ohne Fehler', async ({
  page,
}) => {
  const errors = watchErrors(page);
  type Body = { id: string; key: string; x: number; y: number; seat?: true };
  type Game = {
    world: { seed: number; cell(x: number, y: number): { stop?: string } };
    state: {
      player: { x: number; y: number; dir: string };
      animals: unknown[];
      ride?: { id: string; phase: string };
      openGates: string[];
    };
    rides: Body[];
    apply(cmd: { type: 'move'; dir: string; fresh?: boolean }): void;
  };
  await page.addInitScript(() => {
    const real = crypto.getRandomValues.bind(crypto);
    const fixed = (a: ArrayBufferView<ArrayBuffer>) =>
      a instanceof Uint32Array && a.length === 1 ? a.fill(1) : real(a);
    Object.defineProperty(crypto, 'getRandomValues', { value: fixed });
  });
  const game = await openGame(page, { clock: true, dev: 'bahn&bau=1&eis=1' });
  expect(await game.evaluate((node) => (node as unknown as Game).world.seed)).toBe(1);
  await game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 's' })); // aufwachen
  // der Schlitten steht da, sobald das Paket der Eis-Welt angekommen ist
  const sled = () =>
    game.evaluate((node) => {
      const b = (node as unknown as Game).rides.find((r) => r.id === 'ride:schlitten');
      // Schlüssel `ride:schlitten:<Rahmen><Wimpel><Laterne><Figur><offen>` (mitwachsen-sled-look.ts): die Figur darin?
      return b ? { x: b.x, y: b.y, seat: !!b.seat, rider: b.key.at(-2) === '1' } : null;
    });
  await expect
    .poll(async () => {
      await render(page);
      return !!(await sled());
    })
    .toBe(true);
  expect(await game.evaluate((node) => (node as unknown as Game).state.openGates)).toContain('eis');
  const before = (await sled())!;
  expect(before).toMatchObject({ seat: false, rider: false });
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
  const seats = () =>
    game.evaluate((node) => {
      const el = node as unknown as Game;
      return { phase: el.state.ride?.phase, seats: el.rides.filter((r) => r.seat).map((r) => r.id) };
    });
  await render(page, 2); // eingestiegen
  expect(await seats()).toEqual({ phase: 'seated', seats: ['ride:hoehle:mid'] });
  expect(await sled()).toEqual(before);
  await ticks(page, 30); // unterwegs
  await render(page, 2);
  expect(await seats()).toEqual({ phase: 'go', seats: ['ride:hoehle:mid'] });
  expect(await sled()).toEqual(before); // derselbe Platz, ohne Sitz und ohne Figur, nicht unterwegs
  expect(errors).toEqual([]);
});

// Bau 2 per Entwickler-Schalter (`?entwickler=bahn&bau=1&tor=1`, fester Seed 1; @3d, weil die Welt am Prellbock neu
// gebaut wird und 3D ihre Stücke tauscht): Das Hau-ruck ist gemacht, Tok wartet in der Bucht. Ein neuer Druck zum Zug an
// Bahnhof Bär steigt ein; beim Abfahren steht Ausbau 2 im Spielstand, am Prellbock klopft Tok, der Prellbock versinkt,
// der Zug fährt bis Bahnhof Fledermaus in der Grotte; dort zieht der Maulwurf ins Gehege, Tok wohnt auf seinem Platz daneben (kein Lokschuppen).
// Gespeichert wird im Blick hinein nichts; für das Kind: „Bahn und Höhle für das Kind …“
test(
  'Spiel: Bau 2 per Entwickler-Schalter: Prellbock versinkt, Fahrt bis Bahnhof Fledermaus, Maulwurf zieht ein, speichert nichts, ohne Fehler',
  { tag: '@3d' },
  async ({ page }) => {
    const errors = watchErrors(page);
    type Game = {
      world: { seed: number; cell(x: number, y: number): { stop?: string }; realm(x: number, y: number): string };
      state: {
        player: { x: number; y: number; dir: string };
        animals: { id: string; solo?: true }[];
        garden: { id: string }[];
        ride?: { id: string };
        packs: { bahn?: { built?: number } };
      };
      rides: { id: string; x: number; y: number }[];
      apply(cmd: { type: 'move'; dir: string; fresh?: boolean }): void;
    };
    await page.addInitScript(() => {
      const real = crypto.getRandomValues.bind(crypto);
      const fixed = (a: ArrayBufferView<ArrayBuffer>) =>
        a instanceof Uint32Array && a.length === 1 ? a.fill(1) : real(a);
      Object.defineProperty(crypto, 'getRandomValues', { value: fixed });
    });
    const game = await openGame(page, { clock: true, dev: 'bahn&bau=1&tor=1' });
    await expectView(page);
    expect(await game.evaluate((node) => (node as unknown as Game).world.seed)).toBe(1);
    await game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 's' })); // aufwachen
    await render(page);
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
      el.state = { ...el.state, player: { x: mx - dx, y: my - dy, dir: 's' } };
      el.apply({ type: 'move', dir, fresh: true });
      return el.state.ride?.id;
    });
    expect(boarded).toBe('hoehle');
    await ticks(page, 30);
    expect(await game.evaluate((node) => (node as unknown as Game).state.packs.bahn?.built)).toBe(2);
    // 15 bis 20 s Fahrt, dazu 3 s am Prellbock, dann steigt die Figur nach 1 s aus
    for (let i = 0; i < 40; i++) {
      if (!(await game.evaluate((node) => !!(node as unknown as Game).state.ride))) break;
      await ticks(page, 10);
      await render(page);
    }
    await render(page, 2);
    const done = await game.evaluate((node) => {
      const el = node as unknown as Game;
      const { x, y } = el.state.player;
      return {
        ride: !!el.state.ride,
        realm: el.world.realm(x, y),
        mole: el.state.garden.some((a) => a.id === 'hoehle:maulwurf'),
        tok: el.state.animals.find((a) => a.id === 'hoehle:tok')?.solo ?? false,
        shed: el.rides.some((r) => r.id === 'bahn:schuppen'),
        station: el.rides.some((r) => r.id === 'bahn:felsdach'),
      };
    });
    expect(done).toEqual({ ride: false, realm: 'hoehle', mole: true, tok: true, shed: false, station: true });
    await page.evaluate(() => dispatchEvent(new Event('pagehide')));
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('larmic.games.')))).toEqual(
      [],
    );
    expect(errors).toEqual([]);
  },
);

// Nach dem Hau-ruck direkt in die Höhle (Rückmeldung zur Höhle, Punkt 3), per Entwickler-Schalter
// (`?entwickler=bahn&bau=1&bucht=1`, fester Seed 1; @3d, weil die Welt am Prellbock neu gebaut wird und 3D ihre Stücke
// tauscht): Die erste Fahrt ist gemacht, der Zug steht in der Bucht (`docked`, wie nach dem Aussteigen dort), Tok wartet
// neben der Torplatte. Das Hau-ruck öffnet das Höhlentor; wer jetzt in der Bucht einsteigt, fährt nicht zurück nach
// Bahnhof Bär: Tok klopft gleich am Prellbock (Ausbau 2), dann fährt der Zug bis Bahnhof Fledermaus, die Figur steigt
// auf den Bahnsteig, der Maulwurf zieht ein. Gewartet wird nur auf Zustände (Test-Uhr); gespeichert wird nichts
test(
  'Spiel: nach dem Hau-ruck in der Bucht eingestiegen, direkt bis Bahnhof Fledermaus, speichert nichts, ohne Fehler',
  { tag: '@3d' },
  async ({ page }) => {
    const errors = watchErrors(page);
    type Game = {
      world: {
        seed: number;
        gates: Map<string, { mid: [number, number]; out: [number, number] }>;
        cell(x: number, y: number): { solid: boolean; ground: string; stop?: string; plate?: string; ride?: string };
        realm(x: number, y: number): string;
      };
      state: {
        player: { x: number; y: number; dir: string };
        openGates: string[];
        animals: { id: string; x: number; y: number; solo?: true }[];
        garden: { id: string }[];
        ride?: { id: string; to: string };
        docked?: Record<string, string>;
        work?: unknown;
        heave?: unknown;
        packs: { bahn?: { built?: number } };
      };
      packs: { loaded: { id: string }[] };
      rides: { id: string; x: number; y: number }[];
      fog: { reveal(x: number, y: number, r: number): void };
      apply(cmd: { type: 'move'; dir: string; fresh?: boolean }): void;
    };
    await page.addInitScript(() => {
      const real = crypto.getRandomValues.bind(crypto);
      const fixed = (a: ArrayBufferView<ArrayBuffer>) =>
        a instanceof Uint32Array && a.length === 1 ? a.fill(1) : real(a);
      Object.defineProperty(crypto, 'getRandomValues', { value: fixed });
    });
    const game = await openGame(page, { clock: true, dev: 'bahn&bau=1&bucht=1' });
    await expectView(page);
    expect(await game.evaluate((node) => (node as unknown as Game).world.seed)).toBe(1);
    await game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 's' })); // aufwachen
    await ticks(page, 2);
    // der Zug steht in der Bucht, die Figur auf der Torplatte, Tok auf seinem Platz daneben (u +2)
    await game.evaluate((node) => {
      const el = node as unknown as Game;
      const { mid, out } = el.world.gates.get('hoehle')!;
      const row = (u: number): [number, number] => [mid[0] - out[0] * 2 - out[1] * u, mid[1] - out[1] * 2 + out[0] * u];
      const [px, py] = row(0);
      const [tx, ty] = row(2);
      const animals = el.state.animals.map((a) => (a.id === 'hoehle:tok' ? { ...a, x: tx, y: ty } : a));
      el.state = { ...el.state, animals, docked: { hoehle: 'home' }, player: { x: px, y: py, dir: 'n' } };
      el.fog.reveal(px, py, 10);
    });
    // die Grotte kommt vor dem Hau-ruck (Vorladen am Halt in der Bucht)
    await expect
      .poll(async () => {
        await ticks(page, 1);
        return game.evaluate((node) => (node as unknown as Game).packs.loaded.some((p) => p.id === 'hoehle'));
      })
      .toBe(true);
    // Hau-ruck: still auf der Platte, Tok stößt allein, nach drei Stößen ist das Höhlentor offen
    for (let i = 0; i < 40; i++) {
      if (await game.evaluate((node) => (node as unknown as Game).state.openGates.includes('hoehle'))) break;
      await ticks(page, 10);
    }
    await ticks(page, 31); // 3 s Nische, Lampen, „Ju-hu“
    await render(page, 2);
    // in der Bucht einsteigen: von einem freien Feld neben dem mittleren Wagen ein neuer Druck zu ihm hin
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
      const ok = (x: number, y: number) => {
        const c = el.world.cell(x, y);
        return (
          !c.solid &&
          !c.ride &&
          !c.plate &&
          c.ground !== 'water' &&
          !el.state.animals.some((a) => a.x === x && a.y === y)
        );
      };
      const [dir, dx, dy] = dirs.find(([, dx, dy]) => ok(mx - dx, my - dy))!;
      el.state = { ...el.state, player: { x: mx - dx, y: my - dy, dir: 's' } };
      const before = { open: el.state.openGates.includes('hoehle'), heave: !!el.state.heave };
      el.apply({ type: 'move', dir, fresh: true });
      return { ...before, realm: el.world.realm(mx, my), ride: el.state.ride?.to };
    });
    expect(boarded).toEqual({ open: true, heave: false, realm: 'lichtung', ride: 'home' }); // zur Höhle, nicht nach Bär
    // nach 2 s mit geschlossenen Türen: Ausbau 2 gespeichert, Tok hüpft heran und klopft gleich am Prellbock
    await ticks(page, 22);
    await render(page, 2);
    const knock = await game.evaluate((node) => {
      const el = node as unknown as Game;
      return { built: el.state.packs.bahn?.built, work: !!el.state.work, ride: !!el.state.ride };
    });
    expect(knock).toEqual({ built: 2, work: true, ride: true });
    // 15 bis 20 s Restfahrt, dazu 3 s am Prellbock, dann steigt die Figur nach 1 s aus
    for (let i = 0; i < 40; i++) {
      if (!(await game.evaluate((node) => !!(node as unknown as Game).state.ride))) break;
      await ticks(page, 10);
      await render(page);
    }
    await render(page, 2);
    const done = await game.evaluate((node) => {
      const el = node as unknown as Game;
      const { x, y } = el.state.player;
      return {
        ride: !!el.state.ride,
        realm: el.world.realm(x, y),
        platform: el.world.cell(x, y).stop,
        mole: el.state.garden.some((a) => a.id === 'hoehle:maulwurf'),
        tok: el.state.animals.find((a) => a.id === 'hoehle:tok')?.solo ?? false,
        station: el.rides.some((r) => r.id === 'bahn:felsdach'),
      };
    });
    expect(done).toEqual({ ride: false, realm: 'hoehle', platform: 'hoehle', mole: true, tok: true, station: true });
    await page.evaluate(() => dispatchEvent(new Event('pagehide')));
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('larmic.games.')))).toEqual(
      [],
    );
    expect(errors).toEqual([]);
  },
);

// Bahn und Höhle für das Kind, der ganze Weg ohne Entwickler-Schalter, mit echtem Spielstand (fester Seed 1, 2D, Test-Uhr):
// Ein Spielstand nach der Eis-Welt (Eistor offen, Eis-Leiste voll, erste Heimfahrt mit dem Schlitten), wie ihn das Spiel
// vor dem Freischalten schrieb. Beim Aufwachen im Bett der Lichtung kommt Tok (gespeichert: `faellig`); in ihn
// hineingelaufen baut er Bahnhof Bär, Gleis und Zug (Bau 1); die erste Fahrt endet am Prellbock in der Bucht, Tok wartet
// neben der Torplatte; still auf der Platte öffnet das Hau-ruck das Höhlentor. Nach dem Neuladen steht alles im
// Spielstand, der Zug an Bahnhof Bär; die nächste Fahrt spielt Bau 2 und endet am Bahnhof Fledermaus in der Grotte, der
// Maulwurf zieht ein. Die Figur wird nur an den Ort jedes Schritts gestellt (der Weg zu Fuß ist anderswo geprüft);
// gewartet wird nur auf Zustände
test('Spiel: Bahn und Höhle für das Kind – Tok, Bau 1, erste Fahrt, Hau-ruck, Bau 2 bis in die Grotte, gespeichert, ohne Fehler', async ({
  page,
}) => {
  const errors = watchErrors(page);
  type Animal = { id: string; mode: string; x: number; y: number; solo?: true };
  type Game = {
    world: {
      seed: number;
      homes: Record<string, { bed: [number, number] }>;
      gates: Map<string, { mid: [number, number]; out: [number, number] }>;
      cell(
        x: number,
        y: number,
      ): { solid: boolean; ground: string; stop?: string; plate?: string; lane?: { at?: number }; garden?: boolean };
      realm(x: number, y: number): string;
    };
    state: {
      player: { x: number; y: number; dir: string };
      sleeping: boolean;
      openGates: string[];
      animals: Animal[];
      garden: { id: string }[];
      packs: { bahn?: { built?: number }; fahrt?: Record<string, unknown> };
      work?: unknown;
      dig?: unknown;
      ride?: { id: string };
      heave?: unknown;
      heraldDue: number;
    };
    packs: { loaded: { id: string }[] };
    rides: { id: string; x: number; y: number }[];
    fog: { reveal(x: number, y: number, r: number): void };
    apply(cmd: { type: 'move'; dir: string; fresh?: boolean }): void;
    save(): void;
  };
  await page.addInitScript(() => {
    const real = crypto.getRandomValues.bind(crypto);
    const fixed = (a: ArrayBufferView<ArrayBuffer>) =>
      a instanceof Uint32Array && a.length === 1 ? a.fill(1) : real(a);
    Object.defineProperty(crypto, 'getRandomValues', { value: fixed });
  });
  const game = await openGame(page, { clock: true });
  const ice = (REGIONS.find((r) => r.id === 'eis')?.animals ?? []).map(({ species }) => ({
    id: animalId('eis', species),
    species,
  }));
  await game.evaluate((node, garden) => {
    const el = node as unknown as Game & { state: { garden: unknown[] } };
    const packs = { ...el.state.packs, fahrt: { schlitten: { stage: 'fest' } } };
    el.state = { ...el.state, openGates: ['eis'], garden: [...el.state.garden, ...garden], packs };
    el.save();
  }, ice);
  await reloadGame(page);
  const loaded = () => game.evaluate((node) => (node as unknown as Game).packs.loaded.map((p) => p.id).sort());
  expect(await game.evaluate((node) => (node as unknown as Game).world.seed)).toBe(1);
  expect(await loaded()).toEqual(['bahn', 'eis', 'fahrt']);
  const look = () =>
    game.evaluate((node) => {
      const el = node as unknown as Game;
      const tok = el.state.animals.find((a) => a.id === 'hoehle:tok');
      const { x, y } = el.state.player;
      return {
        tok: tok ? tok.mode + (tok.solo ? ':solo' : '') : null,
        fahrt: el.state.packs.fahrt?.hoehle ?? null,
        built: el.state.packs.bahn?.built ?? 0,
        open: el.state.openGates,
        realm: el.world.realm(x, y),
        ride: !!el.state.ride,
      };
    });
  /** Auf ein freies Feld neben dem mittleren Wagen auf dem Bahnsteig stellen, ein neuer Druck zu ihm hin: einsteigen */
  const board = () =>
    game.evaluate((node) => {
      const el = node as unknown as Game;
      const mid = el.rides.find((r) => r.id === 'ride:hoehle:mid')!;
      const [mx, my] = [Math.round(mid.x), Math.round(mid.y)];
      const dirs: [string, number, number][] = [
        ['e', 1, 0],
        ['w', -1, 0],
        ['s', 0, 1],
        ['n', 0, -1],
      ];
      const free = (x: number, y: number) => !el.state.animals.some((a) => a.x === x && a.y === y);
      const [dir, dx, dy] = dirs.find(
        ([, dx, dy]) => el.world.cell(mx - dx, my - dy).stop === 'hoehle' && free(mx - dx, my - dy),
      )!;
      el.state = { ...el.state, player: { x: mx - dx, y: my - dy, dir: 's' } };
      el.apply({ type: 'move', dir, fresh: true });
      return el.state.ride?.id;
    });
  /** Fahren, bis die Figur ausgestiegen ist (jede Fahrt 15 bis 20 s, Bau 2 dazu 3 s am Prellbock) */
  const rideOut = async () => {
    for (let i = 0; i < 40 && (await look()).ride; i++) {
      await ticks(page, 10);
      await render(page);
    }
    await render(page, 2);
  };
  const wake = () => game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 's' }));

  // 1. Aufwachen im Bett der Lichtung: Tok kommt
  expect(await game.evaluate((node) => (node as unknown as Game).state.sleeping)).toBe(true);
  await wake();
  await ticks(page, 5);
  expect(await look()).toMatchObject({ tok: 'herald', fahrt: { stage: 'faellig' }, built: 0, open: ['eis'] });

  // 2. Bau 1: Tok hüpft an seinen Platz am künftigen Bahnsteig; dort in ihn hineingelaufen
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
  const building = await game.evaluate((node) => {
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
    return !!el.state.work;
  });
  expect(building).toBe(true);
  await ticks(page, 85);
  await render(page, 2);
  expect(await look()).toMatchObject({ tok: null, fahrt: { stage: 'bereit' }, built: 1 }); // Tok sitzt im Zug

  // 3. Die erste Fahrt bis zum Prellbock in der Bucht; Tok hüpft an seinen Platz neben der Torplatte
  expect(await board()).toBe('hoehle');
  await rideOut();
  expect(await look()).toMatchObject({ ride: false, tok: 'herald', fahrt: { stage: 'bereit', gefahren: true } });
  // die Grotte kommt vor dem Hau-ruck (Vorladen am Halt, nah am Höhlentor), mit ihr die Grubenbahn
  await expect
    .poll(async () => {
      await ticks(page, 1);
      const now = await loaded();
      return now.includes('hoehle') && now.includes('grube');
    })
    .toBe(true);

  // 4. Hau-ruck: still auf der Torplatte, Tok stößt allein, nach drei Stößen ist das Höhlentor offen
  await game.evaluate((node) => {
    const el = node as unknown as Game;
    const { mid, out } = el.world.gates.get('hoehle')!;
    const [px, py] = [mid[0] - out[0] * 2, mid[1] - out[1] * 2];
    el.state = { ...el.state, player: { x: px, y: py, dir: 'n' } };
    el.fog.reveal(px, py, 10);
  });
  const plate = await game.evaluate((node) => {
    const el = node as unknown as Game;
    return el.world.cell(el.state.player.x, el.state.player.y).plate;
  });
  expect(plate).toBe('hoehle');
  for (let i = 0; i < 40 && !(await look()).open.includes('hoehle'); i++) await ticks(page, 10);
  await ticks(page, 31); // 3 s Nische, Lampen, „Ju-hu“
  await render(page, 2);
  expect(await look()).toMatchObject({ open: ['eis', 'hoehle'], fahrt: { stage: 'offen', gefahren: true } });

  // 5. Neu laden: alles steht im Spielstand, die Figur wacht im Bett der Lichtung auf, der Zug steht an Bahnhof Bär
  await page.evaluate(() => dispatchEvent(new Event('pagehide')));
  await reloadGame(page);
  expect(await loaded()).toEqual(['bahn', 'eis', 'fahrt', 'grube', 'hoehle']);
  expect(await look()).toMatchObject({ open: ['eis', 'hoehle'], built: 1, realm: 'lichtung', ride: false });
  await wake();
  await render(page);

  // 6. Bau 2: die nächste Fahrt von Bahnhof Bär, der Prellbock versinkt, bis Bahnhof Fledermaus in der Grotte
  expect(await board()).toBe('hoehle');
  await ticks(page, 30);
  expect((await look()).built).toBe(2);
  await rideOut();
  const end = await game.evaluate((node) => {
    const el = node as unknown as Game;
    return {
      mole: el.state.garden.some((a) => a.id === 'hoehle:maulwurf'),
      shed: el.rides.some((r) => r.id === 'bahn:schuppen'),
      station: el.rides.some((r) => r.id === 'bahn:felsdach'),
    };
  });
  expect(await look()).toMatchObject({ ride: false, realm: 'hoehle', tok: 'herald:solo', built: 2 });
  expect(end).toEqual({ mole: true, shed: false, station: true }); // kein Lokschuppen (Issue 25)

  // 7. Gespeichert: Höhlentor offen, Ausbau 2, Stufe `offen`, der Maulwurf zu Hause
  await page.evaluate(() => dispatchEvent(new Event('pagehide')));
  const saved = await page.evaluate(() => {
    const index = JSON.parse(localStorage.getItem('larmic.games.index') ?? '{}') as { current?: string };
    const w = JSON.parse(localStorage.getItem(`larmic.games.world.${index.current}`) ?? '{}') as {
      openGates?: string[];
      homeAnimals?: { id: string }[];
      packs?: { bahn?: unknown; fahrt?: { hoehle?: { stage?: string } } };
    };
    return {
      open: w.openGates,
      bahn: w.packs?.bahn,
      stage: w.packs?.fahrt?.hoehle?.stage,
      mole: !!w.homeAnimals?.some((a) => a.id === 'hoehle:maulwurf'),
    };
  });
  expect(saved).toEqual({ open: ['eis', 'hoehle'], bahn: { built: 2 }, stage: 'offen', mole: true });

  // 8. Ohne Wartezeit (Issue 14): Am Bahnhof Fledermaus gräbt noch niemand. Die Figur geht an den Grubenhalt; sobald der
  // Maulwurf auf seiner Wiese angekommen ist, klopft er dort, ohne neuen Spieltag, ohne Neuladen, ohne `graben=1`
  expect(await game.evaluate((node) => !!(node as unknown as Game).state.dig)).toBe(false);
  const halt = await game.evaluate((node) => {
    const el = node as unknown as Game;
    const [bx, by] = el.world.homes.hoehle!.bed;
    let seat: [number, number] | undefined;
    for (let y = by - 30; y <= by + 30 && !seat; y++)
      for (let x = bx - 30; x <= bx + 30 && !seat; x++) if (el.world.cell(x, y).lane?.at === 5) seat = [x, y];
    const dirs: [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    const [dx, dy] = dirs.find(([dx, dy]) => el.world.cell(seat![0] - dx, seat![1] - dy).stop === 'grube')!;
    el.state = { ...el.state, player: { x: seat![0] - dx, y: seat![1] - dy, dir: 's' } };
    el.fog.reveal(seat![0], seat![1], 10);
    return { grube: el.state.packs.fahrt?.grube ?? null, funkel: el.rides.some((r) => r.id.startsWith('ride:grube:')) };
  });
  expect(halt).toEqual({ grube: null, funkel: false }); // noch Fels, kein Eintrag im Spielstand
  const digging = () => game.evaluate((node) => !!(node as unknown as Game).state.dig);
  for (let i = 0; i < 60 && !(await digging()); i++) await ticks(page, 5); // der Maulwurf läuft erst zu seiner Wiese
  expect(await digging()).toBe(true);
  const settled = await game.evaluate((node) => {
    const el = node as unknown as Game;
    return el.state.animals.filter((a) => a.id === 'hoehle:maulwurf').length;
  });
  expect(settled).toBe(1);
  for (let i = 0; i < 30 && (await digging()); i++) {
    await ticks(page, 5);
    await render(page);
  }
  expect(await digging()).toBe(false);
  await render(page, 2);
  const funkel = await game.evaluate((node) => {
    const el = node as unknown as Game;
    return { grube: el.state.packs.fahrt?.grube, seat: el.rides.some((r) => r.id === 'ride:grube:seat') };
  });
  expect(funkel).toEqual({ grube: { stage: 'bereit' }, seat: true });
  await page.evaluate(() => dispatchEvent(new Event('pagehide')));
  const kept = await page.evaluate(() => {
    const index = JSON.parse(localStorage.getItem('larmic.games.index') ?? '{}') as { current?: string };
    const w = JSON.parse(localStorage.getItem(`larmic.games.world.${index.current}`) ?? '{}') as {
      packs?: { fahrt?: { grube?: unknown } };
    };
    return w.packs?.fahrt?.grube;
  });
  expect(kept).toEqual({ stage: 'bereit' }); // der Gang bleibt nach dem Neuladen
  expect(errors).toEqual([]);
});

// Ohne Service Worker: Er holte die Pakete sonst aus seinem Speicher, am Netz vorbei, das der Test hier anhält
test.describe('Vorladen am Halt', () => {
  test.use({ serviceWorkers: 'block' });

  test(
    'Spiel: Vorladen am Halt per Entwickler-Schalter: erst 6 Felder vor dem Zug kommt die Grotte, bis dahin schläft er, dann steigt man ein',
    { tag: '@3d' },
    async ({ page }) => {
      const errors = watchErrors(page);
      type Game = {
        world: { cell(x: number, y: number): { stop?: string } };
        state: {
          player: { x: number; y: number; dir: string };
          animals: unknown[];
          ride?: { id: string };
          dozing?: string[];
        };
        rides: { id: string; x: number; y: number }[];
        apply(cmd: { type: 'move' | 'tick'; dir?: string; fresh?: boolean; held?: unknown }): void;
      };
      await page.addInitScript(() => {
        const real = crypto.getRandomValues.bind(crypto);
        const fixed = (a: ArrayBufferView<ArrayBuffer>) =>
          a instanceof Uint32Array && a.length === 1 ? a.fill(1) : real(a);
        Object.defineProperty(crypto, 'getRandomValues', { value: fixed });
      });
      // Das Paket der Grotte hängt im Netz, bis der Test es freigibt; gezählt wird, ob es überhaupt angefragt wurde
      let asked = false;
      let release = () => {};
      const held = new Promise<void>((done) => (release = done));
      await page.route(/\/welt-hoehle\.[\w-]+\.js$/, async (route) => {
        asked = true;
        await held;
        await route.continue();
      });
      const game = await openGame(page, { clock: true, dev: 'bahn&vorladen=1' }); // Ausbau 2: ohne Grotte schläft er
      await expectView(page);
      await game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 's' })); // aufwachen
      await render(page);
      // weit weg vom Zug (20 Felder neben dem mittleren Wagen, mehr als 6 vor jedem Halt): nichts wird vorgeladen
      await game.evaluate((node) => {
        const el = node as unknown as Game;
        const mid = el.rides.find((r) => r.id === 'ride:hoehle:mid')!;
        el.state = { ...el.state, animals: [], player: { x: Math.round(mid.x) + 20, y: Math.round(mid.y), dir: 's' } };
      });
      await ticks(page, 3);
      expect(asked).toBe(false);
      // auf den Bahnsteig neben den mittleren Wagen: Die Grotte wird angefragt, bis sie da ist, schläft der Zug
      const dir = await game.evaluate((node) => {
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
        return dir;
      });
      await ticks(page, 1);
      await expect.poll(() => asked).toBe(true);
      const sleepy = await game.evaluate((node, d) => {
        const el = node as unknown as Game;
        const before = { ...el.state.player };
        el.apply({ type: 'move', dir: d, fresh: true });
        const { x, y } = el.state.player;
        return { dozing: el.state.dozing, ride: el.state.ride?.id, stayed: x === before.x && y === before.y };
      }, dir);
      expect(sleepy).toEqual({ dozing: ['hoehle'], ride: undefined, stayed: true });
      await render(page, 2);
      // die Grotte kommt an: Er wacht auf, ein neuer Druck steigt ein
      release();
      await expect
        .poll(async () => {
          await ticks(page, 1);
          return game.evaluate((node) => (node as unknown as Game).state.dozing ?? null);
        })
        .toBeNull();
      await render(page, 2);
      const boarded = await game.evaluate((node, d) => {
        const el = node as unknown as Game;
        el.apply({ type: 'move', dir: d, fresh: true });
        return el.state.ride?.id;
      }, dir);
      expect(boarded).toBe('hoehle');
      await render(page, 2);
      await page.evaluate(() => dispatchEvent(new Event('pagehide')));
      expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('larmic.games.')))).toEqual(
        [],
      );
      expect(errors).toEqual([]);
    },
  );
});

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
      // Wer keinen Platz auf der Wiese bekommt, geht zurück an seinen eigenen Platz und ruht nicht mehr: Die Reihe zum
      // Zeichnen (oben, `rest: 999`) stünde sonst bei manchen Seeds als Wand vor dem Iglu, keiner käme mehr hinein
      const animals = el.state.animals.map((a) => {
        const i = ice.indexOf(a);
        const at = free[i * 3];
        if (i < 0) return a;
        if (!at) {
          const [x, y] = (a as typeof a & { spawn: [number, number] }).spawn;
          return { ...a, x, y, rest: 0 };
        }
        return { ...a, x: at[0], y: at[1], spawn: at, mode: 'home', home: { kind: 'garden' } };
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
    // genau die Töne der Zapfen; nach dem allerersten zwitschert einmal der Funkelfreund: Das Glockenspiel ist gefunden
    // (Hinführen, Issue 28) und lockt nie wieder. Beim zweiten Mal unten klingt nur noch die Tonleiter
    const FOUND_CHIRP = 1318.5;
    expect(await walkRow()).toEqual([SCALE[0], FOUND_CHIRP, ...SCALE.slice(1, row.length)]);
    expect(await game.evaluate((node) => (node as unknown as { state: { found: string[] } }).state.found)).toEqual([
      'eis:glockenspiel',
    ]);
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

test('Menü für Eltern: Schalter „Höhle dunkel“ ist an und lässt sich umlegen, ohne neues Format des Spielstands', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await openGame(page, { clock: true });
  const menu = await openMenu(page);
  const cave = menu.getByRole('button', { name: /^Höhle dunkel/ });
  const motion = menu.getByRole('button', { name: /^Kamera bewegen/ });
  // Ohne Eintrag im Speicher ist die Höhle dunkel, neben „Kamera bewegen“; die Spielfläche weiß es für die Maske
  await expect(cave).toHaveText('Höhle dunkel: an');
  await expect(cave).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('larmic-mitwachsen')).toHaveAttribute('data-cave', '0');
  await cave.click();
  await expect(cave).toHaveText('Höhle dunkel: aus');
  await expect(cave).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('larmic-mitwachsen')).toHaveAttribute('data-cave', '1');
  await expect(motion).toHaveAttribute('aria-pressed', 'true'); // die Kamera bleibt, wie sie war
  // Gespeichert unter eigenem Schlüssel, kein neues Format des Spielstands: Die Welt speichert ihn nicht
  const stored = await page.evaluate(() => ({
    cave: localStorage.getItem('larmic.games.cave'),
    calm: localStorage.getItem('larmic.games.calm'),
    worlds: Object.keys(localStorage)
      .filter((k) => k.startsWith('larmic.games.world.'))
      .map((k) => localStorage.getItem(k) ?? ''),
  }));
  expect(stored.cave).toBe('1');
  expect(stored.calm).toBeNull();
  expect(stored.worlds.some((w) => w.includes('cave'))).toBe(false);
  expect(errors).toEqual([]);
});

test('Menü für Eltern: Schalter „Höhle dunkel“ bleibt nach dem Neuladen aus und lässt sich wieder anlegen', async ({
  page,
}) => {
  const errors = watchErrors(page);
  // Wie nach dem Umlegen im Test davor und neu geladen: Der Speicher sagt „Höhle hell“
  await page.addInitScript(() => localStorage.setItem('larmic.games.cave', '1'));
  await openGame(page, { clock: true });
  const menu = await openMenu(page);
  const cave = menu.getByRole('button', { name: /^Höhle dunkel/ });
  await expect(cave).toHaveText('Höhle dunkel: aus');
  await expect(cave).toHaveAttribute('aria-pressed', 'false');
  await cave.click(); // wieder dunkel
  await expect(cave).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('larmic-mitwachsen')).toHaveAttribute('data-cave', '0');
  expect(await page.evaluate(() => localStorage.getItem('larmic.games.cave'))).toBe('0');
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
 * Die Figur wach `gap` Felder neben den Sitz des Schlittens stellen (zuerst quer zur Strecke, sonst hinter ihn auf den
 * freien Platz; nie aufs Zugtier), auf freie, begehbare Felder, von denen sie Schritt für Schritt zum Sitz kommt. In
 * etwa einer von hundert Welten stehen auf beiden Seiten Kristalle oder Tannen (gemessen über 400 Seeds am 26.11.2026):
 * Seit dort kein Schuppen mehr steht (Issue 25), ist das Feld dahinter frei. Liefert die Pfeiltaste zum Sitz und die
 * zurück (null: kein Platz, dann scheitert der Test mit dem Seed)
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
        const behind = ([dx, dy]: readonly [number, number]) => +(sx - dx === px && sy - dy === py);
        const around = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const;
        for (const [dx, dy] of [...around].sort((a, b) => behind(a) - behind(b))) {
          if (sx + dx === px && sy + dy === py) continue; // dort steht das Zugtier
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
  'Spiel: Schlitten wird gezeichnet (Laternenpfahl, Schlitten, Rentier; die Figur sitzt darin), ohne Fehler',
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
        const ids = [id, `${id}:rentier`, `${id}:laterne`];
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

// Das Grubenbähnchen Funkel per Entwickler-Schalter (`?entwickler=grube`, fester Seed 1; @3d, weil sein schmales Gleis
// und seine Wagen auch in 3D gezeichnet werden): Die Figur wacht im Höhlenbett auf, Funkel steht an seinem Halt; vom
// Bahnsteig aus eingestiegen fährt es eine ganze Runde (immer vorwärts, durch den Glitzergang) und hält wieder am selben
// Halt, die Figur steigt auf den Bahnsteig aus, die erste Fahrt ist gemerkt. Gespeichert wird im Blick hinein nichts
test(
  'Spiel: Grubenbähnchen Funkel per Entwickler-Schalter: eine ganze Runde vom Bahnsteig zum Bahnsteig, speichert nichts, ohne Fehler',
  { tag: '@3d' },
  async ({ page }) => {
    const errors = watchErrors(page);
    type Cell = { ride?: string; stop?: string; lane?: { at?: number } };
    type Game = {
      world: { seed: number; homes: Record<string, { bed: [number, number] }>; cell(x: number, y: number): Cell };
      state: {
        player: { x: number; y: number; dir: string };
        animals: { x: number; y: number }[];
        packs: Record<string, unknown>;
        ride?: { id: string; pos: number };
      };
      rides: { id: string; seat?: true }[];
      apply(cmd: { type: 'move'; dir: string; fresh?: boolean }): void;
    };
    await page.addInitScript(() => {
      const real = crypto.getRandomValues.bind(crypto);
      const fixed = (a: ArrayBufferView<ArrayBuffer>) =>
        a instanceof Uint32Array && a.length === 1 ? a.fill(1) : real(a);
      Object.defineProperty(crypto, 'getRandomValues', { value: fixed });
    });
    const game = await openGame(page, { clock: true, dev: 'grube' });
    await expectView(page);
    await game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 's' })); // aufwachen
    await ticks(page, 5);
    await render(page, 2);
    const boarded = await game.evaluate((node) => {
      const el = node as unknown as Game;
      const [bx, by] = el.world.homes.hoehle!.bed;
      let seat: [number, number] | undefined;
      for (let y = by - 30; y <= by + 30 && !seat; y++)
        for (let x = bx - 30; x <= bx + 30 && !seat; x++) {
          const c = el.world.cell(x, y);
          if (c.ride === 'grube' && c.lane?.at === 5) seat = [x, y];
        }
      const dirs: [string, number, number][] = [
        ['e', 1, 0],
        ['w', -1, 0],
        ['s', 0, 1],
        ['n', 0, -1],
      ];
      const [dir, dx, dy] = dirs.find(([, dx, dy]) => el.world.cell(seat![0] - dx, seat![1] - dy).stop === 'grube')!;
      el.state = { ...el.state, animals: [], player: { x: seat![0] - dx, y: seat![1] - dy, dir: 's' } };
      const parked = el.rides.filter((r) => r.id.startsWith('ride:grube:')).map((r) => r.id);
      el.apply({ type: 'move', dir, fresh: true });
      return { ride: el.state.ride?.id, parked };
    });
    expect(boarded.ride).toBe('grube');
    await ticks(page, 60);
    await render(page, 2);
    const riding = await game.evaluate((node) => {
      const el = node as unknown as Game;
      return { pos: el.state.ride?.pos ?? -1, seat: el.rides.filter((r) => r.seat).map((r) => r.id) };
    });
    expect(riding.pos).toBeGreaterThan(10);
    expect(riding.seat).toEqual(['ride:grube:seat']);
    for (let i = 0; i < 30; i++) {
      if (!(await game.evaluate((node) => !!(node as unknown as Game).state.ride))) break;
      await ticks(page, 10);
      await render(page, 1);
    }
    const done = await game.evaluate((node) => {
      const el = node as unknown as Game;
      return {
        ride: el.state.ride?.id ?? null,
        stop: el.world.cell(el.state.player.x, el.state.player.y).stop ?? null,
        grube: (el.state.packs.fahrt as { grube?: unknown }).grube,
      };
    });
    expect(done).toEqual({ ride: null, stop: 'grube', grube: { stage: 'bereit', gefahren: true } });
    expect(boarded.parked).toEqual(['ride:grube:loco', 'ride:grube:seat', 'ride:grube:rear']);
    await page.evaluate(() => dispatchEvent(new Event('pagehide')));
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('larmic.games.')))).toEqual(
      [],
    );
    expect(errors).toEqual([]);
  },
);

// Der Maulwurf gräbt den Glitzergang (Schritt 17, `?entwickler=grube&graben=1`, fester Seed 1; @3d, weil die Welt mitten
// im Spiel neu gebaut wird und Erdwelle, Gang und Bähnchen auch in 3D gezeichnet werden): Der erste Maulwurf wohnt zu
// Hause, das Graben ist fällig (hier über die alte Stufe `faellig`), der Gang ist noch Fels und Funkel nicht da. Die Figur geht an den Grubenhalt: Der Maulwurf
// hüpft neben den Halt, die Erdwelle läuft, die Figur hüpft dabei nur; dann sind Gang, Gleis und der Klangstein `grube`
// da (Stufe `bereit`), und Funkel steht an seinem Halt. Danach eine ganze Runde vom Bahnsteig zum Bahnsteig, alles über
// die Test-Uhr. Gespeichert wird im Blick hinein nichts
test(
  'Spiel: Der Maulwurf gräbt den Glitzergang: Erdwelle, Gang und Klangstein, Funkel rollt an den Halt, dann eine ganze Runde, ohne Fehler',
  { tag: '@3d' },
  async ({ page }) => {
    const errors = watchErrors(page);
    type Cell = { ride?: string; stop?: string; deco?: string; story?: string; lane?: { at?: number } };
    type Game = {
      world: {
        homes: Record<string, { bed: [number, number] }>;
        stones: Map<string, [number, number]>;
        cell(x: number, y: number): Cell;
      };
      state: {
        tick: number;
        player: { x: number; y: number; dir: string };
        animals: { id: string; species: string; mode: string; x: number; y: number }[];
        packs: Record<string, unknown>;
        ride?: { id: string; pos: number };
        dig?: { from: number; to: number; laid?: true };
      };
      rides: { id: string; x: number; y: number }[];
      apply(cmd: { type: 'move'; dir: string; fresh?: boolean }): void;
    };
    await page.addInitScript(() => {
      const real = crypto.getRandomValues.bind(crypto);
      const fixed = (a: ArrayBufferView<ArrayBuffer>) =>
        a instanceof Uint32Array && a.length === 1 ? a.fill(1) : real(a);
      Object.defineProperty(crypto, 'getRandomValues', { value: fixed });
    });
    const game = await openGame(page, { clock: true, dev: 'grube&graben=1' });
    await expectView(page);
    await game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 's' })); // aufwachen
    await ticks(page, 5);
    await render(page, 2);
    // an den Bahnsteig neben dem künftigen Sitz (der Gang ist noch Fels, das Gleis fehlt), nur der Maulwurf bleibt
    const before = await game.evaluate((node) => {
      const el = node as unknown as Game;
      const [bx, by] = el.world.homes.hoehle!.bed;
      let seat: [number, number] | undefined;
      for (let y = by - 30; y <= by + 30 && !seat; y++)
        for (let x = bx - 30; x <= bx + 30 && !seat; x++) if (el.world.cell(x, y).lane?.at === 5) seat = [x, y];
      const dirs: [string, number, number][] = [
        ['e', 1, 0],
        ['w', -1, 0],
        ['s', 0, 1],
        ['n', 0, -1],
      ];
      const [, dx, dy] = dirs.find(([, dx, dy]) => el.world.cell(seat![0] - dx, seat![1] - dy).stop === 'grube')!;
      const mole = el.state.animals.filter((a) => a.species === 'maulwurf' && a.mode === 'home');
      el.state = { ...el.state, animals: mole, player: { x: seat![0] - dx, y: seat![1] - dy, dir: 's' } };
      return {
        seat,
        mole: mole.length,
        ride: el.world.cell(...seat!).ride ?? null,
        grube: (el.state.packs.fahrt as { grube?: unknown }).grube,
        funkel: el.rides.filter((r) => r.id.startsWith('ride:grube:')).length,
      };
    });
    expect(before).toMatchObject({ mole: 1, ride: null, grube: { stage: 'faellig' }, funkel: 0 });
    // der nächste Takt: Es klopft, der Maulwurf hüpft neben den Halt, die Erdwelle läuft
    await ticks(page, 1);
    const started = await game.evaluate((node) => {
      const el = node as unknown as Game;
      const mole = el.state.animals.find((a) => a.species === 'maulwurf')!;
      const at = [el.state.player.x, el.state.player.y];
      el.apply({ type: 'move', dir: 'n', fresh: true }); // die Figur hüpft nur
      return {
        dig: !!el.state.dig,
        mole: [mole.x, mole.y],
        moved: at.join() !== `${el.state.player.x},${el.state.player.y}`,
      };
    });
    expect(started.dig).toBe(true);
    expect(started.moved).toBe(false);
    expect(
      Math.max(Math.abs(started.mole[0]! - before.seat![0]), Math.abs(started.mole[1]! - before.seat![1])),
    ).toBeLessThanOrEqual(3);
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      await ticks(page, 5);
      await render(page, 1);
      const now = await game.evaluate((node) => {
        const el = node as unknown as Game;
        return { dig: !!el.state.dig, ids: el.rides.map((r) => r.id) };
      });
      now.ids.forEach((id) => seen.add(id));
      if (!now.dig) break;
    }
    expect(seen.has('grube-erde')).toBe(true); // die Erdwelle war zu sehen
    expect([...seen].some((id) => id.startsWith('grube-bau:'))).toBe(true); // hinter ihr wuchs das Gleis mit
    const dug = await game.evaluate((node) => {
      const el = node as unknown as Game;
      const stone = el.world.stones.get('grube');
      const seat = el.rides.find((r) => r.id === 'ride:grube:seat');
      return {
        dig: el.state.dig ?? null,
        grube: (el.state.packs.fahrt as { grube?: unknown }).grube,
        stone: stone ? [el.world.cell(...stone).deco, el.world.cell(...stone).story] : null,
        seat: seat ? [Math.round(seat.x), Math.round(seat.y)] : null,
      };
    });
    expect(dug).toEqual({
      dig: null,
      grube: { stage: 'bereit' },
      stone: ['klangstein', 'grube'],
      seat: before.seat,
    });
    // eine ganze Runde vom Bahnsteig aus
    const boarded = await game.evaluate((node) => {
      const el = node as unknown as Game;
      const dirs: [string, number, number][] = [
        ['e', 1, 0],
        ['w', -1, 0],
        ['s', 0, 1],
        ['n', 0, -1],
      ];
      const [sx, sy] = [el.state.player.x, el.state.player.y];
      const seat = el.rides.find((r) => r.id === 'ride:grube:seat')!;
      const [dir] = dirs.find(([, dx, dy]) => sx + dx === Math.round(seat.x) && sy + dy === Math.round(seat.y))!;
      el.state = { ...el.state, animals: [] };
      el.apply({ type: 'move', dir, fresh: true });
      return el.state.ride?.id;
    });
    expect(boarded).toBe('grube');
    for (let i = 0; i < 30; i++) {
      if (!(await game.evaluate((node) => !!(node as unknown as Game).state.ride))) break;
      await ticks(page, 10);
      await render(page, 1);
    }
    const done = await game.evaluate((node) => {
      const el = node as unknown as Game;
      return {
        ride: el.state.ride?.id ?? null,
        stop: el.world.cell(el.state.player.x, el.state.player.y).stop ?? null,
        grube: (el.state.packs.fahrt as { grube?: unknown }).grube,
      };
    });
    expect(done).toEqual({ ride: null, stop: 'grube', grube: { stage: 'bereit', gefahren: true } });
    await page.evaluate(() => dispatchEvent(new Event('pagehide')));
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('larmic.games.')))).toEqual(
      [],
    );
    expect(errors).toEqual([]);
  },
);

// Klingeltore und Glitzergang der Grubenbahn (Schritt 16, `?entwickler=grube`, fester Seed 1, in 2D): Zu Fuß gegen das
// Tor am Ausgang gelaufen klingt es, die Figur bleibt davor stehen, und Funkel am Halt blinkt; danach eine ganze Runde
// durch den Glitzergang: Die Tore heben ihre Scheibe, die Röhren singen, in der Mitte tutet Funkel mit Echo. Gezählt
// werden alle Töne, die die Seite spielt (Oszillatoren mit Beginn und Ende auf der Uhr des Spiels): nie mehr als sechs
// zugleich (sfx.ts begrenzt nur sofortige Töne, eingeplante nicht)
test('Spiel: Funkel durch den Glitzergang: Klingeltor zu Fuß, Tore und Echo beim Durchfahren, höchstens sechs Stimmen, ohne Fehler', async ({
  page,
}) => {
  const errors = watchErrors(page);
  type Cell = { ride?: string; stop?: string; chimeGate?: string; lane?: { at?: number; part?: string } };
  type Body = { id: string; z: number; glow?: true };
  type Game = {
    world: { homes: Record<string, { bed: [number, number] }>; cell(x: number, y: number): Cell };
    state: {
      player: { x: number; y: number; dir: string };
      animals: unknown[];
      ride?: { id: string; pos: number };
      sleeping: boolean;
    };
    rides: Body[];
    apply(cmd: { type: 'move'; dir: string; fresh?: boolean }): void;
  };
  await page.addInitScript(() => {
    const real = crypto.getRandomValues.bind(crypto);
    const fixed = (a: ArrayBufferView<ArrayBuffer>) =>
      a instanceof Uint32Array && a.length === 1 ? a.fill(1) : real(a);
    Object.defineProperty(crypto, 'getRandomValues', { value: fixed });
    // jeder Ton der Seite: Beginn und Ende in Sekunden auf der Uhr des Spiels (Test-Uhr), aus start/stop des Oszillators
    const log: [number, number][] = [];
    (window as unknown as { __mwVoices: typeof log }).__mwVoices = log;
    const on = (node: OscillatorNode, when: number) => performance.now() / 1000 + (when - node.context.currentTime);
    // start und stop erbt der Oszillator von AudioScheduledSourceNode: eigene davor, die weiterreichen
    const base = AudioScheduledSourceNode.prototype;
    const index = new WeakMap<OscillatorNode, number>();
    OscillatorNode.prototype.start = function (this: OscillatorNode, when = 0) {
      index.set(this, log.push([on(this, when), Infinity]) - 1);
      base.start.call(this, when);
    };
    OscillatorNode.prototype.stop = function (this: OscillatorNode, when = 0) {
      const i = index.get(this);
      if (i !== undefined) log[i]![1] = on(this, when);
      base.stop.call(this, when);
    };
  });
  const game = await openGame(page, { clock: true, dev: 'grube' });
  await page.keyboard.press('ArrowDown'); // weckt die Figur und gibt den Ton frei (eine Geste)
  await ticks(page, 5);
  await render(page, 2);
  const voices = () =>
    page.evaluate(() => {
      const log = (window as unknown as { __mwVoices: [number, number][] }).__mwVoices;
      const most = Math.max(0, ...log.map(([a]) => log.filter(([b, e]) => b <= a && a < e).length));
      return { notes: log.length, most };
    });
  // zu Fuß vor das Tor am Ausgang (auf das offene Gleis davor) und hineinlaufen
  const rung = await game.evaluate((node) => {
    const el = node as unknown as Game;
    const [bx, by] = el.world.homes.hoehle!.bed;
    const dirs: [string, number, number][] = [
      ['e', 1, 0],
      ['w', -1, 0],
      ['s', 0, 1],
      ['n', 0, -1],
    ];
    for (let y = by - 30; y <= by + 30; y++)
      for (let x = bx - 30; x <= bx + 30; x++) {
        if (el.world.cell(x, y).chimeGate !== 'out') continue;
        const [dir, dx, dy] = dirs.find(([, dx, dy]) => el.world.cell(x - dx, y - dy).lane?.part === 'open')!;
        el.state = { ...el.state, animals: [], player: { x: x - dx, y: y - dy, dir: 's' } };
        el.apply({ type: 'move', dir, fresh: true });
        return { gate: [x, y], at: [el.state.player.x, el.state.player.y], from: [x - dx, y - dy] };
      }
    return undefined;
  });
  expect(rung).toBeDefined();
  expect(rung!.at).toEqual(rung!.from); // vor dem Tor stehen geblieben
  await render(page, 1);
  const blink = await game.evaluate(
    (node) => !!(node as unknown as Game).rides.find((r) => r.id === 'ride:grube:loco')?.glow,
  );
  expect(blink).toBe(true); // Funkel am Halt antwortet: die Lampe blinkt
  const foot = await voices();
  expect(foot.notes).toBeGreaterThanOrEqual(5); // drei Töne des Tors und das Signal von Funkel
  // einsteigen vom Bahnsteig neben dem Sitz und eine ganze Runde fahren
  const boarded = await game.evaluate((node) => {
    const el = node as unknown as Game;
    const [bx, by] = el.world.homes.hoehle!.bed;
    let seat: [number, number] | undefined;
    for (let y = by - 30; y <= by + 30 && !seat; y++)
      for (let x = bx - 30; x <= bx + 30 && !seat; x++) {
        const c = el.world.cell(x, y);
        if (c.ride === 'grube' && c.lane?.at === 5) seat = [x, y];
      }
    const dirs: [string, number, number][] = [
      ['e', 1, 0],
      ['w', -1, 0],
      ['s', 0, 1],
      ['n', 0, -1],
    ];
    const [dir, dx, dy] = dirs.find(([, dx, dy]) => el.world.cell(seat![0] - dx, seat![1] - dy).stop === 'grube')!;
    el.state = { ...el.state, animals: [], player: { x: seat![0] - dx, y: seat![1] - dy, dir: 's' } };
    el.apply({ type: 'move', dir, fresh: true });
    return el.state.ride?.id;
  });
  expect(boarded).toBe('grube');
  const seen = new Set<string>();
  let lifted = false;
  for (let i = 0; i < 60; i++) {
    const now = await game.evaluate((node) => {
      const el = node as unknown as Game;
      return { riding: !!el.state.ride, ids: el.rides.map((r) => r.id) };
    });
    now.ids.forEach((id) => seen.add(id));
    if (!now.riding) break;
    await play(page, 500);
    lifted ||= await game.evaluate((node) => {
      const rides = (node as unknown as Game).rides;
      const z = (id: string) => rides.find((r) => r.id === id)?.z ?? 0;
      return z('grube-tor:in:scheibe') - z('grube-tor:out:scheibe') > 0.1;
    });
  }
  expect(await game.evaluate((node) => (node as unknown as Game).state.ride ?? null)).toBeNull();
  expect([...seen].filter((id) => id.startsWith('grube-tor:') || id === 'grube-fall').sort()).toEqual([
    'grube-fall',
    'grube-tor:in',
    'grube-tor:in:scheibe',
    'grube-tor:out',
    'grube-tor:out:scheibe',
  ]);
  expect(lifted).toBe(true); // durch das Tor am Eingang: die Scheibe hebt sich
  const ride = await voices();
  // beim Durchfahren: Röhren aufwärts, Tuten mit zwei Echos, Röhren abwärts (je 6) und die Töne von Funkel
  expect(ride.notes - foot.notes).toBeGreaterThanOrEqual(18);
  expect(ride.most).toBeLessThanOrEqual(6);
  expect(errors).toEqual([]);
});

// Hinführen zu Sehenswürdigkeiten (Issue 28, in 2D): In einer neuen Welt ruft nach den ersten 20 s der Klangstein am
// Bett, und der Funkelfreund erscheint als kleiner Körper zwischen Figur und Stein. Läuft die Figur in den Stein, erklingt
// seine Geschichte, und der Freund ist fort: Der Stein lockt nie wieder. Regeln je Fall: mitwachsen-sight.test.ts
test('Spiel: Hinführen – der Funkelfreund zeigt zum Klangstein am Bett und verschwindet, wenn er gehört ist, ohne Fehler', async ({
  page,
}) => {
  const errors = watchErrors(page);
  type Game = {
    state: {
      player: { x: number; y: number; dir: string };
      heard: string[];
      lure?: { goal?: { id: string }; friend?: { id: string; x: number; y: number; at: [number, number] } };
    };
    rides: { id: string; x: number; y: number }[];
    world: { stones: Map<string, [number, number]> };
    apply(cmd: { type: 'move'; dir: string }): void;
  };
  const game = await openGame(page, { clock: true });
  await expectView(page);
  await game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 's' })); // aufwachen
  const friend = () =>
    game.evaluate((node) => {
      const el = node as unknown as Game;
      return { lure: el.state.lure?.friend, body: el.rides.find((r) => r.id === 'freund') };
    });
  await ticks(page, 150);
  await render(page);
  expect((await friend()).body).toBeUndefined(); // in den ersten 20 s lockt nichts
  await ticks(page, 80);
  await render(page);
  const shown = await friend();
  expect(shown.lure?.id).toBe('klangstein');
  const stone = await game.evaluate((node) => (node as unknown as Game).world.stones.get('bett')!);
  expect(shown.lure!.at).toEqual(stone);
  expect(shown.body).toBeDefined(); // im Bild, als Körper wie die Fahrzeuge
  // neben den Stein und hinein: Die Geschichte erklingt, der Stein ist gehört
  await game.evaluate((node, [x, y]) => {
    const el = node as unknown as Game;
    el.state = { ...el.state, player: { x: x + 1, y, dir: 'w' } };
    el.apply({ type: 'move', dir: 'w' });
  }, stone);
  expect(await game.evaluate((node) => (node as unknown as Game).state.heard)).toContain('bett');
  await ticks(page, 10);
  await render(page);
  expect(await friend()).toEqual({ lure: undefined, body: undefined });
  expect(errors).toEqual([]);
});
