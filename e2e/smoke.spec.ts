// Smoke-Test der fertigen Seite: Startseite (Weg ins Spiel, Aufbau, Handy-Breite), Rechtliches, 404 und das Spiel.
// Jede Seite muss ohne Fehler in der Konsole laden (pageerror und console.error).
import { expect, test, type Page } from '@playwright/test';

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
    renderer: { ice: { iceWeather?: unknown } | null };
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
  expect(shown.count).toBe(29); // das Tor ist nur im Test offen: Der verlaufene Pinguin wohnt noch nicht im Kessel
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
      return { sheltered: sheltered > 5, loaded: typeof el.renderer.ice?.iceWeather === 'function' };
    }),
  ).toEqual({ sheltered: true, loaded: true });
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
    renderer: { ice: { waitArrow?: unknown } | null; album: { turn: { shown?: string } } };
  };
  const frames = (n: number) => waitFrames(page, n);
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
  expect(await game.evaluate((el) => typeof (el as unknown as Game).renderer.ice?.waitArrow)).toBe('function');
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
      animals: (Animal & { home: { kind: string } })[];
      garden: { id: string; species: string }[];
    };
    saved: { id: string };
    apply(cmd: { type: 'move'; dir: string } | { type: 'tick' }): void;
    lift(): void;
    save(): void;
    openWorld(id: string): void;
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
    el.openWorld(el.saved.id);
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
  // Figur und Pinguin in die Bucht vor dem Eistor (über die Komponente): Im nächsten Takt geht das Tor auf
  await game.evaluate((node) => {
    const el = node as unknown as Game;
    const { mid, out } = el.world.gates.get('eis')!;
    const at = (k: number) => [mid[0] - out[0] * k, mid[1] - out[1] * k] as const;
    const animals = el.state.animals.map((a) => (a.id === 'eis:pinguin' ? { ...a, x: at(1)[0], y: at(1)[1] } : a));
    el.state = { ...el.state, animals, guideDue: -1, player: { x: at(2)[0], y: at(2)[1], dir: 'n' } };
    el.lift();
    el.apply({ type: 'tick' });
  });
  const open = () => game.evaluate((el) => (el as unknown as Game).state.openGates);
  expect(await open()).toEqual(['eis']);
  // sofort gespeichert
  const stored = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith('larmic.games.world.'))
      .map((k) => (JSON.parse(localStorage.getItem(k)!) as { openGates: string[] }).openGates),
  );
  expect(stored).toEqual([['eis']]);
  // Während des Rituals hüpft die Figur nur
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
