// Smoke-Test der fertigen Seite: Startseite (Weg ins Spiel, Aufbau, Handy-Breite), Rechtliches, 404 und das Spiel.
// Jede Seite muss ohne Fehler in der Konsole laden (pageerror und console.error).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { SCALE } from '../src/scripts/games/worlds/eis/mitwachsen-chime-look';

/** Sammelt Fehler der Seite; am Ende des Tests muss die Liste leer sein */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

/**
 * Zeichnen abwarten: so lange, wie `n` Bilder bei 60 Hz dauern, und mindestens zwei Bilder. Nicht `n` Bilder: Die
 * CI-Rechner zeichnen WebGL ohne Grafikkarte, ein Bild braucht dort leicht eine halbe Sekunde, und `n` Bilder sprengten
 * jede Zeitgrenze. Die Spielzeit (Takt, Animationen) läuft nach der Uhr, also reicht die Zeit.
 */
const waitFrames = (page: Page, n: number) =>
  page.evaluate(
    (ms) =>
      new Promise<void>((done) => {
        const end = performance.now() + ms;
        let drawn = 0;
        const next = () => (++drawn >= 2 && performance.now() >= end ? done() : requestAnimationFrame(next));
        requestAnimationFrame(next);
      }),
    (n * 1000) / 60,
  );

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

for (const path of ['/', '/datenschutz/'])
  test(`Seite ${path} lädt ohne Fehler`, async ({ page }) => {
    const errors = watchErrors(page);
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

test('Startseite führt ins Spiel, oben und am Ende', async ({ page }) => {
  await page.goto('/');
  const cta = page.getByRole('link', { name: 'Spiel starten' });
  await expect(cta).toHaveCount(2);
  for (const n of [0, 1]) await expect(cta.nth(n)).toHaveAttribute('href', '/spielen/');
  await cta.first().click();
  await expect(page).toHaveURL(/\/spielen\/$/);
  await expect(page.locator('larmic-mitwachsen')).toBeVisible();
});

test('Startseite: Aufbau, Bild, Footer mit Impressum und Datenschutz', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  expect(await page.getByRole('heading', { level: 2 }).count()).toBeGreaterThanOrEqual(5);
  const shot = page.locator('.shot img');
  await shot.scrollIntoViewIfNeeded();
  await expect.poll(() => shot.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  const footer = page.locator('footer.site-footer');
  // Impressum und Kontakt liegen auf larmic.de, das Impressum dort gilt auch für diese Seite
  await expect(footer.getByRole('link', { name: 'Impressum und Kontakt' })).toHaveAttribute(
    'href',
    'https://larmic.de/impressum/',
  );
  await expect(footer.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute('href', '/datenschutz/');
  // „Mehr für Eltern“ springt zum ersten Abschnitt
  await page.getByRole('link', { name: 'Mehr für Eltern' }).click();
  await expect(page).toHaveURL(/#eltern$/);
});

for (const width of [320, 390, 1280])
  test(`Startseite bei ${width} px ohne seitliches Scrollen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.getByRole('link', { name: 'Spiel starten' }).first()).toBeInViewport();
  });

test('Unbekannte Adresse zeigt die 404-Seite', async ({ page }) => {
  const res = await page.goto('/gibt-es-nicht/');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: /404/ })).toBeVisible();
});

test('Spiel: Hinweis für Eltern beim ersten Mal, eine Pfeiltaste weckt die Figur', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/spielen/');
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
  expect(errors).toEqual([]);
});

test('Spiel: Portal-Plattform erwacht beim Herangehen, die Mitte bringt zum Bett, runter und wieder rauf zurück', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto('/spielen/');
  await page.getByRole('button', { name: /Verstanden/ }).click();
  const game = page.locator('larmic-mitwachsen');
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

test('Spiel: Gletscherkessel hinter dem Eistor wird gezeichnet (Tor im Test offen), alle zehn Eis-Tiere, Pustewind, ohne Fehler', async ({
  page,
}) => {
  // Auf den CI-Rechnern zeichnet WebGL ohne Grafikkarte: Jedes Bild und jeder Aufruf in die Seite dauert dort lange
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await page.goto('/spielen/');
  await page.getByRole('button', { name: /Verstanden/ }).click();
  const game = page.locator('larmic-mitwachsen');
  await expect(game).toHaveClass(/ready/);
  const webgl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
  if (webgl) await expect(game).toHaveClass(/three/); // gezeichnet wird in 3D
  await withIce(game);
  type Game = {
    world: { homes: { eis: { bed: [number, number]; wake: [number, number][] } }; realm(x: number, y: number): string };
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
    renderer: { view: { sky: { weather?: unknown } } | null };
  };
  const frames = (n: number) => waitFrames(page, n);
  // Über die Komponente (wie die Regeln es sehen): Tor offen, die Figur steht wach neben dem Schneebett
  const realm = await game.evaluate((node) => {
    const el = node as unknown as Game;
    const [x, y] = el.world.homes.eis.wake[0]!;
    el.state = { ...el.state, openGates: ['eis'], sleeping: false, wokeAt: -100, player: { x, y, dir: 'n' } };
    el.lift();
    return el.world.realm(x, y);
  });
  expect(realm).toBe('eis');
  await frames(30);
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
  await frames(30);
  expect(
    await game.evaluate((node, { ids, at }) => {
      const el = node as unknown as Game;
      // In 3D steht für jedes gezeichnete Tier ein Modell in der Szene; in 2D zeichnet die Karte jedes Tier im Erkundeten
      return ids.every((id, i) =>
        el.r3d ? el.r3d.bodies.has(id) : el.bodies.has(id) && el.fog.has(at[i]![0], at[i]![1]),
      );
    }, shown),
  ).toBe(true);
  // Pustewind: Die Eis-Tiere wohnen auf der Schneewiese (mit dem Pinguin), ein Abschnitt mit Wind läuft – die Tiere
  // gehen ins Iglu, Flocken, Wirbel, Fahnen und Wimpel werden gezeichnet (das Eis-Wetter ist nachgeladen), ohne Fehler
  const windy = await game.evaluate((node) => {
    const el = node as unknown as Game & WindGame;
    const [bx, by] = el.world.homes.eis.bed;
    const free: [number, number][] = [];
    for (let y = by - 6; y <= by + 6; y++)
      for (let x = bx - 6; x <= bx + 6; x++) {
        const c = el.world.cell(x, y);
        if (c.garden && !c.solid && !c.roof && (x !== el.state.player.x || y !== el.state.player.y)) free.push([x, y]);
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
  await frames(60);
  expect(
    await game.evaluate((node) => {
      const el = node as unknown as Game & WindGame;
      const sheltered = el.state.animals.filter((a) => a.realm === 'eis' && el.world.cell(a.x, a.y).roof).length;
      return { sheltered: sheltered > 5, loaded: typeof el.renderer.view?.sky.weather === 'function' };
    }),
  ).toEqual({ sheltered: true, loaded: true });
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
  await frames(30);
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
  await frames(30);
  // ein paar Schritte durch den Kessel, dann ins Schneebett (der Schläfer liegt jetzt dort, darüber das Polarlicht)
  await game.evaluate((node) => {
    const el = node as unknown as Game;
    for (const dir of ['s', 's', 'e', 'n', 'n', 'w']) el.apply({ type: 'move', dir });
    const [bx, by] = el.world.homes.eis.bed;
    el.state = { ...el.state, player: { x: bx + 1, y: by, dir: 'w' }, wokeAt: -100 };
    el.apply({ type: 'move', dir: 'w' });
  });
  await frames(30);
  expect(await game.evaluate((el) => (el as unknown as Game).state.sleeping)).toBe(true);
  expect(errors).toEqual([]);
});

test('Spiel: Schneemann bauen im Gletschertal (Tor im Test offen): dreimal hinein, er steht und übersteht Neuladen, ohne Fehler', async ({
  page,
}) => {
  // Auf den CI-Rechnern zeichnet WebGL ohne Grafikkarte: Jedes Bild und jeder Aufruf in die Seite dauert dort lange
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await page.goto('/spielen/');
  await page.getByRole('button', { name: /Verstanden/ }).click();
  const game = page.locator('larmic-mitwachsen');
  await expect(game).toHaveClass(/ready/);
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
      el.state = { ...el.state, openGates: ['eis'], sleeping: false, wokeAt: -100, player: { x, y: y + 1, dir: 'n' } };
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
  await waitFrames(page, 30);
  // Jedes Hineinlaufen lässt eine Kugel wachsen, beim dritten Mal steht der Schneemann (gezeichnet nach jedem Schritt)
  for (let i = 1; i <= 3; i++) {
    await game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 'n' }));
    expect(await stage(heap!)).toBe(i);
    await waitFrames(page, 20);
  }
  // Noch einmal hinein: Er bleibt, wie er ist
  await game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 'n' }));
  expect(await stage(heap!)).toBe(3);
  // Neu laden: Der Schneemann steht noch da (gespeichert, sobald er gewachsen ist) und wird gezeichnet
  await page.reload();
  await expect(game).toHaveClass(/ready/);
  expect(await stage(heap!)).toBe(3);
  await stand(heap!);
  await waitFrames(page, 30);
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
      .poll(() =>
        game.evaluate((node, [x, y]) => {
          const el = node as unknown as Views;
          const draw = el.gl3d!.views.decos?.decos.snowheap; // Zeichnungen der geladenen 3D-Teile
          return (draw?.(el.world, el.world.cell(x, y), x, y, el.gl3d!.at) ?? []).map((b) => b[6]);
        }, heap!),
      )
      .toContain(carrot);
  // In 2D steht er ebenso da: Die Quader des Schneemanns liegen im gezeichneten Bild
  await game.evaluate((node) => {
    (node as unknown as Views).r3d = null; // ohne 3D: so zeichnet die 2D-Ansicht von vorn
  });
  await stand(heap!);
  await waitFrames(page, 20);
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
  await waitFrames(page, 10);
  await game.evaluate((node) => (node as unknown as Game).apply({ type: 'move', dir: 'n' }));
  expect(await stage(next!)).toBe(1);
  await waitFrames(page, 20);
  expect(errors).toEqual([]);
});

test('Spiel: Eiszapfen-Glockenspiel im Gletschertal (Tor im Test offen): die Reihe entlang klingt eine Tonleiter, ohne Fehler', async ({
  page,
}) => {
  // Auf den CI-Rechnern zeichnet WebGL ohne Grafikkarte: Jedes Bild und jeder Aufruf in die Seite dauert dort lange
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await page.goto('/spielen/');
  await page.getByRole('button', { name: /Verstanden/ }).click();
  const game = page.locator('larmic-mitwachsen');
  await expect(game).toHaveClass(/ready/);
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
      await waitFrames(page, 8);
    }
    return game.evaluate((node) => (node as unknown as Game & { heard: number[] }).heard);
  };
  await stand();
  await waitFrames(page, 30);
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
      .poll(() =>
        game.evaluate((node, [x, y]) => {
          const el = node as unknown as Game;
          const draw = el.gl3d!.views.decos?.decos.icicle; // Zeichnungen der geladenen 3D-Teile
          return (draw?.(el.world, el.world.cell(x, y), x, y, el.gl3d!.at) ?? []).length;
        }, row[0]),
      )
      .toBeGreaterThan(1);
  // In 2D ebenso: Die Zapfen liegen im gezeichneten Bild, und sie schwingen beim Anschlagen
  await game.evaluate((node) => {
    (node as unknown as Game).r3d = null; // ohne 3D: so zeichnet die 2D-Ansicht von vorn
  });
  await stand();
  await waitFrames(page, 20);
  const drawn = await game.evaluate(
    (node, [x, y]) => (node as unknown as Game).renderer.later.filter((b) => b[1] === y && b[0] === x).length,
    row[0],
  );
  expect(drawn).toBeGreaterThan(0); // die Eiskante liegt genau im Feld
  expect(await walkRow()).toEqual(SCALE.slice(0, row.length));
  await waitFrames(page, 30);
  expect(errors).toEqual([]);
});

test('Spiel: Weltgrenze am Eistor (Tor im Test offen): Tiere der Lichtung warten in der Bucht, die Leiste klappt um, ohne Fehler', async ({
  page,
}) => {
  // Auf den CI-Rechnern zeichnet WebGL ohne Grafikkarte: Jedes Bild und jeder Aufruf in die Seite dauert dort lange
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await page.goto('/spielen/');
  await page.getByRole('button', { name: /Verstanden/ }).click();
  const game = page.locator('larmic-mitwachsen');
  await expect(game).toHaveClass(/ready/);
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
    renderer: { view: { sky: { waitArrow?: unknown } } | null; album: { turn: { shown?: string } } };
  };
  const frames = (n: number) => waitFrames(page, n);
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
  await frames(30);
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
  await frames(60);
  expect(await game.evaluate((el) => typeof (el as unknown as Game).renderer.view?.sky.waitArrow)).toBe('function');
  // Durch den Gang bis in den Kessel: Die Leiste zeigt die Eis-Welt
  expect((await inward(80, 'eis')).realm).toBe('eis'); // in einem Aufruf: Jeder Aufruf wartet ohne Grafikkarte lange
  await frames(60);
  expect(await game.evaluate((el) => (el as unknown as Game).renderer.album.turn.shown)).toBe('eis');
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
  await frames(30);
  expect(await game.evaluate((el) => (el as unknown as Game).renderer.album.turn.shown)).toBe('lichtung');
  expect(errors).toEqual([]);
});

test('Spiel: Der Pinguin holt die Figur ab, das Eistor geht auf, er zieht im Kessel ein; nach dem Neuladen offen, ohne Fehler', async ({
  page,
}) => {
  // Auf den CI-Rechnern zeichnet WebGL ohne Grafikkarte: Jedes Bild und jeder Aufruf in die Seite dauert dort lange
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await page.goto('/spielen/');
  await page.getByRole('button', { name: /Verstanden/ }).click();
  const game = page.locator('larmic-mitwachsen');
  await expect(game).toHaveClass(/ready/);
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
  };
  const frames = (n: number) => waitFrames(page, n);
  const penguin = () =>
    game.evaluate((el) => (el as unknown as Game).state.animals.find((a) => a.id === 'eis:pinguin')?.mode ?? 'fehlt');
  /** Takte der Regeln gleich hier abspielen (unabhängig davon, wie schnell der Takt der Seite unter Last läuft) */
  const ticks = (n: number) =>
    game.evaluate((node, count) => {
      for (let i = 0; i < count; i++) (node as unknown as Game).apply({ type: 'tick' });
    }, n);
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
    .poll(
      async () => {
        await ticks(10);
        return penguin();
      },
      { timeout: 30_000 }, // ohne Grafikkarte dauert jeder Takt lange
    )
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
  await frames(10);
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
  await frames(30); // Türflügel, Eiszapfen, Umriss werden gezeichnet
  // Nach 2,4 s rutscht er durch den Gang hinter die Mündung (in der Eis-Welt) und wartet dort; nach 3 s ist es vorbei
  await ticks(30);
  expect(
    await game.evaluate((node) => {
      const el = node as unknown as Game;
      const g = el.state.animals.find((a) => a.id === 'eis:pinguin')!;
      return el.world.realm(g.x, g.y);
    }),
  ).toBe('eis');
  await frames(30);
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
  await ticks(200);
  expect(await penguin()).toBe('home');
  // Am Schneebett erwacht das Eis-Portal; die Leiste zeigt die Eis-Welt
  await game.evaluate((node) => {
    const el = node as unknown as Game;
    const [x, y] = el.world.homes.eis.wake[0]!;
    el.state = { ...el.state, player: { x, y, dir: 's' } };
    el.lift();
    el.apply({ type: 'tick' });
  });
  await expect.poll(() => game.evaluate((el) => (el as unknown as Game).state.portals)).toContain('eiskessel');
  await frames(60);
  expect(await game.evaluate((el) => (el as unknown as Game).renderer.album.turn.shown)).toBe('eis');
  // Nach dem Neuladen ist das Tor offen, der Pinguin wohnt auf der Schneewiese, die Figur wacht am Schneebett auf
  await page.reload();
  await expect(game).toHaveClass(/ready/);
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
  await frames(30);
  expect(errors).toEqual([]);
});

test.describe('ohne Welt-Paket', () => {
  // Der Service Worker käme sonst am Abfangen vorbei (er hätte das Paket im Speicher)
  test.use({ serviceWorkers: 'block' });
  test('Spiel: Ohne das Paket der Eis-Welt startet es auf der Lichtung, ohne Loch und ohne Fehler; der Spielstand bleibt', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await page.goto('/spielen/');
    await page.getByRole('button', { name: /Verstanden/ }).click();
    const game = page.locator('larmic-mitwachsen');
    await expect(game).toHaveClass(/ready/);
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
    await page.reload();
    await expect(game).toHaveClass(/ready/);
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
    await waitFrames(page, 30);
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
  });
});

test.describe('Welt-Paket nur bei Bedarf', () => {
  // Der Service Worker holte beim Einrichten alles vorab, auch das Paket: Hier zählt, was die Seite selbst lädt
  test.use({ serviceWorkers: 'block' });
  test('Spiel: Mit geschlossenem Eistor startet es ohne das Paket der Eis-Welt, nah am Tor kommt es nach; mit offenem Eistor gleich beim Start', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    const fetched: string[] = [];
    page.on('request', (r) => {
      if (/\/welt-eis\.[\w-]+\.js$/.test(r.url())) fetched.push(r.url());
    });
    await page.goto('/spielen/');
    await page.getByRole('button', { name: /Verstanden/ }).click();
    const game = page.locator('larmic-mitwachsen');
    await expect(game).toHaveClass(/ready/);
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
    await waitFrames(page, 30);
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
    await waitFrames(page, 30);
    // Spielstand mit offenem Eistor: Das Paket kommt gleich beim Start, die Welt entsteht mit ihm
    await game.evaluate((node) => {
      const el = node as unknown as Game;
      el.state = { ...el.state, openGates: ['eis'] };
      el.save();
    });
    fetched.length = 0;
    await page.reload();
    await expect(game).toHaveClass(/ready/);
    expect(fetched).toHaveLength(1);
    expect(await ice()).toEqual({ pack: true, kessel: true, portal: true, animals: 50 });
    await waitFrames(page, 30);
    expect(errors).toEqual([]);
  });

  test('Spiel: 2D mit reduzierter Bewegung zeigt Kessel, Iglu und Fischkisten aus dem Welt-Paket, ohne Fehler', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors = watchErrors(page);
    await page.goto('/spielen/');
    await page.getByRole('button', { name: /Verstanden/ }).click();
    const game = page.locator('larmic-mitwachsen');
    await expect(game).toHaveClass(/ready/);
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
    await waitFrames(page, 20);
    expect((await boxes()).see).toBeGreaterThan(20); // das Iglu aus Schneeblöcken, nicht nur ein Block
    await look('fishcrate');
    await waitFrames(page, 20);
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
      await page.waitForTimeout(550);
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
    await waitFrames(page, 20);
    expect(await gold()).toBe(false);
    await valleyEnd(true);
    await waitFrames(page, 20);
    expect(await gold()).toBe(true);
    expect(errors).toEqual([]);
  });

  test('Spiel: Eine gelöschte Welt kommt nicht zurück, während die nächste auf ihr Welt-Paket wartet', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    // Das Paket der Eis-Welt hängt im Netz, bis der Test es freigibt
    let release = () => {};
    const held = new Promise<void>((done) => (release = done));
    await page.route(/\/welt-eis\.[\w-]+\.js$/, async (route) => {
      await held;
      await route.continue();
    });
    await page.goto('/spielen/');
    await page.getByRole('button', { name: /Verstanden/ }).click();
    const game = page.locator('larmic-mitwachsen');
    await expect(game).toHaveClass(/ready/);
    type Game = {
      saved: { id: string };
      state: { openGates: string[] };
      opening: string;
      live: string;
      packs: { get(id: string): unknown };
      world: { spotsOf(realm: string): unknown[] };
      save(): void;
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
    // B löschen (bestätigt): A öffnet und wartet auf das hängende Paket, B ruht
    await game.evaluate((node, id) => {
      const el = node as unknown as Game;
      const button = document.createElement('button');
      button.dataset.armed = '1'; // zweiter Klick der Rückfrage
      void el.removeWorld(button, id);
    }, b);
    await expect.poll(() => game.evaluate((el) => (el as unknown as Game).opening)).toBe(a);
    // Speichern in dieser Zeit (Seite verlassen, Takt, Menü) bringt B nicht zurück
    await game.evaluate((node) => {
      (node as unknown as Game).save();
      window.dispatchEvent(new Event('pagehide'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFrames(page, 10); // ein paar Takte, aber kürzer als PACK_WAIT_MS
    expect(await game.evaluate((el) => (el as unknown as Game).live)).toBe(b); // A wartet noch
    expect(await index()).toMatchObject({ current: a, worlds: [{ id: a }] });
    // Das Paket kommt an: A steht mit Kessel, B bleibt weg
    release();
    await expect.poll(() => game.evaluate((el) => (el as unknown as Game).live)).toBe(a);
    await expect.poll(() => game.evaluate((el) => (el as unknown as Game).world.spotsOf('eis').length > 0)).toBe(true);
    await waitFrames(page, 30);
    expect((await index()).worlds.map((w) => w.id)).toEqual([a]);
    expect(await game.evaluate((el) => (el as unknown as Game).state.openGates)).toEqual(['eis']);
    expect(errors).toEqual([]);
  });
});

test('Menü für Eltern: Schalter „Kamera bewegen“ ist an, lässt sich umlegen und bleibt nach dem Neuladen', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto('/spielen/');
  await page.getByRole('button', { name: /Verstanden/ }).click();
  const game = page.locator('larmic-mitwachsen');
  await expect(game).toHaveClass(/ready/);
  const menu = page.locator('dialog.mw-settings');
  const motion = menu.getByRole('button', { name: /^Kamera bewegen/ });
  const sound = menu.getByRole('button', { name: /^Ton ist/ });
  await page.getByRole('button', { name: 'Menü für Eltern' }).click();
  await expect(menu).toHaveJSProperty('open', true);
  // Ohne Eintrag im Speicher ist er an, neben dem Ton
  await expect(motion).toHaveText('Kamera bewegen: an');
  await expect(motion).toHaveAttribute('aria-pressed', 'true');
  await motion.click();
  await expect(motion).toHaveText('Kamera bewegen: aus');
  await expect(motion).toHaveAttribute('aria-pressed', 'false');
  await expect(sound).toHaveAttribute('aria-pressed', 'true'); // der Ton bleibt, wie er war
  expect(await page.evaluate(() => localStorage.getItem('larmic.games.calm'))).toBe('1');
  // Kein neues Format des Spielstands: Die Welt speichert ihn nicht
  const worlds = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith('larmic.games.world.'))
      .map((k) => localStorage.getItem(k) ?? ''),
  );
  expect(worlds.some((w) => w.includes('calm'))).toBe(false);
  await page.reload();
  await expect(game).toHaveClass(/ready/);
  await page.getByRole('button', { name: 'Menü für Eltern' }).click();
  await expect(menu).toHaveJSProperty('open', true);
  await expect(motion).toHaveText('Kamera bewegen: aus');
  await expect(motion).toHaveAttribute('aria-pressed', 'false');
  await motion.click(); // wieder an
  await expect(motion).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('larmic.games.calm'))).toBe('0');
  expect(errors).toEqual([]);
});

for (const mode of ['3D mit „Kamera bewegen: aus“', '2D mit reduzierter Bewegung'] as const)
  test(`Postkarte der Torfront (${mode}): nach 1 s auf der Torplatte oben die Front, herunter blendet sie aus`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const three = mode.startsWith('3D');
    if (three)
      await page.addInitScript(() => localStorage.setItem('larmic.games.calm', '1')); // Elternschalter aus
    else await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors = watchErrors(page);
    await page.goto('/spielen/');
    await page.getByRole('button', { name: /Verstanden/ }).click();
    const game = page.locator('larmic-mitwachsen');
    await expect(game).toHaveClass(/ready/);
    type Game = {
      world: { gates: Map<string, { mid: [number, number]; out: [number, number] }> };
      state: { player: { x: number; y: number; dir: string }; sleeping: boolean; wokeAt: number };
      r3d: unknown;
      lift(): void;
    };
    const webgl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
    if (three && webgl) await expect(game).toHaveClass(/three/);
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
    await stand(4);
    await waitFrames(page, 10);
    await expect(card).not.toHaveClass(/on/);
    await stand(2);
    await expect(card).toHaveClass(/on/, { timeout: 15_000 });
    // Die Front ist gezeichnet: viele verschiedene Farben, nicht leer
    await expect
      .poll(() =>
        card.evaluate((c) => {
          const cv = c as HTMLCanvasElement;
          const data = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data;
          const colors = new Set<number>();
          for (let i = 0; i < data.length; i += 16)
            if (data[i + 3]! > 0) colors.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
          return colors.size;
        }),
      )
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
        const [c, m] = [(await card.boundingBox())!, (await page.locator('canvas.mw-map').boundingBox())!];
        return c.y >= m.y + m.height || c.x + c.width <= m.x;
      })
      .toBe(true);
    await page.setViewportSize(view);
    await stand(3); // eine Reihe herunter in die Bucht
    await expect(card).not.toHaveClass(/on/, { timeout: 15_000 });
    await expect(card).toHaveCSS('opacity', '0');
    if (north) {
      await stand(2, north); // auf der Platte eines Tors im Norden: keine Postkarte über dem echten Tor
      await waitFrames(page, 120); // länger als die Sekunde, nach der sie sonst käme
      await expect(card).not.toHaveClass(/on/);
    }
    expect(errors).toEqual([]);
  });

test('Drehung zur Torfront (3D): Stehen auf der Platte schwenkt zur Front, Fächer auf der Karte, ein Pfeil blinzelt zurück', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await page.goto('/spielen/');
  await page.getByRole('button', { name: /Verstanden/ }).click();
  const game = page.locator('larmic-mitwachsen');
  await expect(game).toHaveClass(/ready/);
  const webgl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
  test.skip(!webgl, 'ohne WebGL gibt es keine 3D-Ansicht (dort kommt die Postkarte, Test oben)');
  await expect(game).toHaveClass(/three/);
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
  // nachgeladen, zur Front gebaut, dann weich hin: im Schnitt 40°/s, also gut 4 s bis −155°
  await expect
    .poll(() => game.evaluate((node) => (node as unknown as Game).gl3d.turn?.front), { timeout: 20_000 })
    .toBe(south.id);
  await expect.poll(yaw, { timeout: 30_000 }).toBeLessThan(-140);
  await expect(page.locator('canvas.mw-card')).not.toHaveClass(/on/); // mit Bewegung keine Postkarte
  expect(await css('--mw-fan')).toBe('1'); // die genordete Karte zeigt, wohin die Kamera schaut
  expect(Number.parseFloat(await css('--mw-look'))).toBeGreaterThan(140);
  // Schatten flimmern beim Pendeln nicht: Die Sonne pendelt nicht mit, und das Ziel der Schattenkamera liegt in jedem
  // Bild auf dem Raster der Schattenkarte, quer zum Licht in ganzen Pixeln (snapToShadowTexel im Lichtraum der
  // gedrehten Sonne); so verschiebt ein kleiner Kameraschritt die Schatten nur um ganze Pixel, also gleiche Pixel.
  // Erst wenn sie angekommen ist (bis dahin dreht die Sonne mit): Fortschritt 1, Winkel ohne Pendeln am Ziel
  const settled = () =>
    game.evaluate((node) => {
      const st = (node as unknown as { gl3d: { turn: { st: { p: number; yaw: number } } | null } }).gl3d.turn?.st;
      return !!st && st.p === 1 && Math.abs(st.yaw + 155) < 0.05;
    });
  await expect.poll(settled, { timeout: 20_000 }).toBe(true);
  const sway = await game.evaluate(
    (node) =>
      new Promise<{ yaws: number[]; dirs: string[]; off: number }>((done) => {
        type V = { x: number; y: number; z: number };
        type Sun = { position: V; target: { position: V } };
        const el = node as unknown as Game & { gl3d: { sun: Sun } };
        const texel = 36 / 2048; // SHADOW_TEXEL in mitwachsen-3d.ts
        const [yaws, dirs] = [[] as number[], [] as string[]];
        let off = 0;
        const look = () => {
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
          if (yaws.length < 60) requestAnimationFrame(look);
          else done({ yaws, dirs, off });
        };
        requestAnimationFrame(look);
      }),
  );
  expect(Math.max(...sway.yaws) - Math.min(...sway.yaws)).toBeGreaterThan(0.05); // die Kamera bewegt sich
  expect(new Set(sway.dirs).size).toBe(1); // die Sonne nicht
  expect(sway.off).toBeLessThan(1e-3); // ganze Pixel der Schattenkarte
  // erster Pfeil: erst blinzeln (abdunkeln), dann läuft die Figur, die Pfeile bleiben, wie sie sind (↑ ist Norden)
  const waited = await game.evaluate(
    (node, y) =>
      new Promise<number>((done) => {
        const el = node as unknown as Game;
        const t0 = performance.now();
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp', bubbles: true }));
        const look = () => (el.state.player.y !== y ? done(performance.now() - t0) : requestAnimationFrame(look));
        requestAnimationFrame(look);
      }),
    south.y,
  );
  expect(waited).toBeGreaterThanOrEqual(290); // der Schritt wartet aufs Blinzeln (300 ms), er geht nicht verloren
  await expect.poll(() => game.evaluate((node) => (node as unknown as Game).state.player.y)).toBe(south.y - 1);
  expect(Math.abs(await yaw())).toBeLessThan(5);
  await expect.poll(() => css('--mw-fan')).toBe('0');
  expect(errors).toEqual([]);
});

test.describe('ohne JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('Inhalte bleiben lesbar, das Spiel erklärt sich Eltern', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Mitwachsen' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Spiel starten' }).first()).toHaveAttribute('href', '/spielen/');
    // Der Text für Eltern steht im <noscript>-Block des Spiels (die Prüfung über textContent, weil Playwright
    // <noscript> nicht wie ein Browser ohne JavaScript als sichtbaren Text behandelt)
    await page.goto('/spielen/');
    const text = await page.locator('larmic-mitwachsen noscript').textContent();
    expect(text).toContain('Dieses Spiel für Dreijährige braucht JavaScript');
    expect(text).toContain('Wie viel Bildschirm?');
  });
});
