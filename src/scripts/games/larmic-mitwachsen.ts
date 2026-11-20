// <larmic-mitwachsen>: das Spiel Mitwachsen (Stufe ab 3). Verbindet die reinen Teile (Welt, Regeln, Speichern) mit dem
// Browser: Tastatur, Takt, Kamera, Töne, Menü und Canvas. Alle Regeln stecken getestet in mitwachsen-state.ts.
// Listener auf document/window hängen an einem AbortController und verschwinden mit der Komponente; so stört das
// Spiel nach einem Seitenwechsel (View Transitions) niemanden.
// Konzept: docs/games/mitwachsen.md · Spec: docs/specs/mitwachsen.md

import { chunkOf } from '../../lib/games/chunks';
import { projection, type Dir } from '../../lib/games/front';
import type { World3D as World3DType } from './mitwachsen-3d';
import { GAME_COLORS, LOOK, SPECIES, THEME_COLORS, TIRED_TALK } from '../../data/games/mitwachsen';
import { Renderer, type Body, type Float, type Particle, type Scene } from './mitwachsen-render';
import { sparks } from './mitwachsen-glyphs';
import { Sfx } from './sfx';
import { NOTE_COLORS, StoryPlayer } from './mitwachsen-story';
import {
  DEFAULT_FIGURE,
  cleanName,
  deleteWorld,
  loadIndex,
  loadWorld,
  newWorld,
  progressFrom,
  saveWorld,
  withProgress,
  worldCode,
  type SavedWorld,
  type Store,
} from './mitwachsen-save';
import { ENCOUNTERS, FREE_KEYS, InputPace, KEYS, STEP_MS } from './input-pace';
import { drawMap } from './mitwachsen-map';
import { Fog, REVEAL, START_REVEAL } from './mitwachsen-fog';
import { initialState, progressOf, step, type Cmd, type GameEvent, type State } from './mitwachsen-state';
import type { ChoreEvent } from './mitwachsen-chores';
import { createWorld, standHeight, type World } from './mitwachsen-world';
import { platformLift } from './mitwachsen-portal';
import { SNAP_DELAY, hopOf, snaps } from './mitwachsen-gait';
import { FISH_SPARKS } from '../../data/games/mitwachsen-eis';
import { windAt } from './mitwachsen-weather';
import { Air, postures, stepSound } from './mitwachsen-air';
import { idlePose, type Pose } from './mitwachsen-tired';
import { advance, evening, freshDay, loadTired, saveTired, type Tired, type TiredEvent } from './mitwachsen-tired';
import { SLEEP_EVENT, type GameMoment } from './pwa-update';
import { browserStore } from './browser-store';

const TICK_MS = 100; // Takt der Regeln
const SAVE_EVERY_MS = 10_000; // Position regelmäßig sichern
const SIT_MS = 2500; // so lange setzt sich die müde Figur hin (Laufen geht in der Zeit nicht)
const INFO_KEY = 'larmic.games.mitwachsen.info'; // Hinweis für Eltern schon gesehen
const SPEED = (1000 / STEP_MS) * 1.1; // Felder pro Sekunde beim Gleiten: etwas schneller als der Takt, also weich

/** Funken der Handgriffe: an Busch, Fischkiste und Wasser, dann an Futtertrog, Eisschale und Wassertrog */
const SPARKS = {
  pick: ['#c8323a', '#ef5b5b', '#3f9a3c'],
  catch: FISH_SPARKS.catch,
  fill: ['#3f8fd8', '#7fc0f0', '#ffffff'],
  berries: ['#c8323a', '#ef5b5b', '#ffd47e'],
  fish: FISH_SPARKS.feed,
  pour: ['#3f8fd8', '#7fc0f0', '#ffd47e'],
} as const;
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]!;
const randomId = () => randomSeed().toString(36) + Date.now().toString(36);

class LarmicMitwachsen extends HTMLElement {
  private store!: Store;
  private saved!: SavedWorld;
  private world!: World;
  private state!: State;
  private renderer!: Renderer;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private menu!: HTMLDialogElement;
  private info!: HTMLDialogElement; // Hinweis für Eltern zur Bildschirmzeit
  private bubble!: HTMLElement; // Sprechblase der müden Figur
  private bubbleTimer: number | undefined;
  private tired!: Tired;
  private lastTiredSave = 0;
  private sitUntil = 0; // bis dahin sitzt die müde Figur
  private lastInput = 0; // letzte Eingabe: Spielt lange niemand, setzt sich die Figur und liest
  private pose: Pose = 'stand';
  private sfx = new Sfx();
  private story = new StoryPlayer(this.sfx); // Klangsteine
  private air = new Air(this.sfx); // Wetter, wo die Figur ist: Rauschen und Windspiel des Pustewinds
  private listening = false; // die Figur sitzt am Klangstein und hört zu, bis sie losgeht
  private globals: AbortController | null = null;
  private timer: number | undefined;
  private raf = 0;
  private lastFrame = 0;
  private lastSave = 0;
  private pace = new InputPace(); // ruhiger Takt: Tippen ist nicht schneller als Halten
  private size = { w: 0, h: 0, zoom: 1, dpr: 1 };
  private bodies = new Map<string, Body>();
  private hops = new Map<string, number>(); // Zeitpunkt des letzten Sing-Hüpfers je Wesen
  private gates = new Map<string, number>(); // Zeitpunkt, an dem ein Tor aufging (0 = schon offen)
  private floats: (Float & { born: number; who?: string })[] = [];
  private particles: Particle[] = [];
  private nightSince = 0; // seit wann die Figur schläft (performance.now): für die Überblendung und App-Updates
  private dayAt = 0;
  private resize: ResizeObserver | null = null;
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private fog = new Fog(); // erkundete Felder; der Rest liegt im Nebel
  private seenAt = '';
  private map!: HTMLCanvasElement;
  private mapCtx!: CanvasRenderingContext2D;
  private lastMap = 0;
  private touchUi!: HTMLElement;
  private r3d: World3DType | null = null; // 3D-Ansicht, solange sie zeichnen kann
  private gl3d: World3DType | null = null; // die geladene 3D-Ansicht, auch wenn ihr Kontext gerade fehlt

  connectedCallback() {
    this.canvas = this.querySelector('canvas.mw-canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.menu = this.querySelector('dialog.mw-settings')!;
    this.info = this.querySelector('dialog.mw-info')!;
    this.bubble = this.querySelector('.mw-bubble')!;
    this.map = this.querySelector('canvas.mw-map')!;
    this.mapCtx = this.map.getContext('2d')!;
    this.touchUi = this.querySelector('.mw-touch')!;
    this.renderer = new Renderer(this.ctx);
    this.store = browserStore().store;
    this.sfx.muted = this.store.getItem('larmic.games.muted') === '1';
    this.tired = loadTired(this.store, Date.now());
    this.openWorld(loadIndex(this.store).current);
    this.listen();
    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(this.canvas);
    this.measure();
    this.classList.add('ready');
    this.start();
    void this.load3d();
    // Beim ersten Öffnen: erst der Hinweis für Eltern, dann geht es los
    if (this.store.getItem(INFO_KEY) !== '1') this.openInfo();
  }

  /**
   * 3D-Ansicht nachladen: Three.js kommt erst jetzt (import()), nie mit der Startseite. Ohne WebGL oder wenn das Laden
   * scheitert, bleibt die 2D-Ansicht. Bis die 3D-Ansicht bereit ist, läuft das Spiel schon in 2D.
   */
  private async load3d() {
    // Three.js braucht WebGL2; ohne gar nicht erst laden. Den Prüf-Kontext sofort wieder freigeben.
    const probe = document.createElement('canvas').getContext('webgl2');
    if (!probe) return;
    probe.getExtension('WEBGL_lose_context')?.loseContext();
    try {
      const { World3D } = await import('./mitwachsen-3d');
      if (!this.isConnected || !this.globals) return;
      const canvas = this.querySelector<HTMLCanvasElement>('canvas.mw-canvas3d')!;
      this.gl3d = this.r3d = new World3D(canvas, LOOK);
      this.classList.add('three');
      this.measure();
      // Verliert das Gerät den Kontext (App-Wechsel, Speicherdruck), springt die 2D-Ansicht ein, bis er zurück ist
      const signal = this.globals.signal;
      canvas.addEventListener(
        'webglcontextlost',
        () => {
          this.r3d = null;
          this.classList.remove('three');
        },
        { signal },
      );
      canvas.addEventListener(
        'webglcontextrestored',
        () => {
          this.r3d = this.gl3d;
          this.classList.add('three');
          this.measure();
        },
        { signal },
      );
    } catch {
      this.r3d = null; // 2D reicht
    }
  }

  disconnectedCallback() {
    this.save();
    this.stop();
    this.globals?.abort();
    this.globals = null;
    this.resize?.disconnect();
    this.story.stop();
    this.sfx.close();
    clearTimeout(this.bubbleTimer);
    this.gl3d?.dispose();
    this.gl3d = this.r3d = null;
  }

  // ---------- Welten ----------

  /** Welt laden (oder eine neue anlegen) und das Spiel darauf starten */
  private openWorld(id: string | null) {
    const loaded = id ? loadWorld(this.store, id) : null;
    // Fehlt eine Welt aus dem Index (gelöscht, kaputt), entsteht sie neu unter derselben Kennung und mit ihren Namen
    const entry = id ? loadIndex(this.store).worlds.find((w) => w.id === id) : undefined;
    this.saved =
      loaded ??
      newWorld(id ?? randomId(), randomSeed(), entry?.worldName ?? 'Meine Welt', entry?.figureName ?? DEFAULT_FIGURE);
    this.saved = { ...this.saved, visits: this.saved.visits + 1 };
    saveWorld(this.store, this.saved);
    this.world = createWorld(this.saved.seed);
    this.seenAt = '';
    this.state = initialState(this.world, progressFrom(this.saved), this.saved.seed ^ this.saved.visits);
    // Nebel: Am Anfang ist nur ein kleines Stück um das Bett zu sehen (die Figur liegt darin)
    this.fog = Fog.from(this.saved.explored);
    if (this.fog.size === 0) this.fog.reveal(this.state.player.x, this.state.player.y, START_REVEAL);
    this.bodies.clear();
    this.floats = [];
    this.particles = [];
    this.gates = new Map(this.state.openGates.map((g) => [g, 0]));
    // Eine Welt öffnet nachts (die Figur schläft im Bett): gleich dunkel, ohne Überblendung beim Laden
    this.nightSince = -Infinity;
    this.dayAt = 0;
    this.renderName();
    this.renderMenu();
  }

  private save() {
    if (!this.saved) return;
    this.saved = { ...withProgress(this.saved, progressOf(this.state)), explored: this.fog.serialize() };
    saveWorld(this.store, this.saved);
    saveTired(this.store, this.tired);
    this.lastSave = performance.now();
  }

  /** Für Updates der App (pwa-register.ts): Was im Spiel gerade los ist; entschieden wird in pwa-update.ts */
  updateMoment(): GameMoment {
    return {
      sleeping: this.state.sleeping,
      sleepingFor: performance.now() - this.nightSince, // eine Welt öffnet schlafend: dann unendlich
      menuOpen: this.menu.open,
      infoOpen: this.info.open,
      firstInfo: this.info.open && this.store.getItem(INFO_KEY) !== '1',
    };
  }

  /** Menü oder Hinweis offen: Das Spiel ruht */
  private paused() {
    return this.menu.open || this.info.open;
  }

  // ---------- Takt und Eingabe ----------

  private start() {
    this.lastInput = performance.now(); // nach Menü, Hinweis oder Tab-Wechsel: frisch, die Figur steht
    if (this.timer === undefined && !this.paused() && document.visibilityState === 'visible')
      this.timer = window.setInterval(() => this.apply({ type: 'tick' }), TICK_MS);
    if (!this.raf) this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private stop() {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private apply(cmd: Cmd) {
    if (cmd.type !== 'tick') this.lastInput = performance.now(); // jemand spielt
    if (cmd.type === 'move' && performance.now() < this.sitUntil) return; // die müde Figur sitzt kurz
    const { state, events } = step(this.state, this.world, cmd, (x, y) => this.fog.has(x, y));
    this.state = state;
    this.lift();
    if (events.length) this.react(events);
    if (cmd.type === 'tick') this.ageTired();
    if (performance.now() - this.lastSave > SAVE_EVERY_MS) this.save();
  }

  // ---------- Müde werden ----------

  /** Spielzeit fortschreiben (läuft im Takt, also nur bei sichtbarer Seite und geschlossenem Menü) */
  private ageTired() {
    // Liest oder döst die Figur, spielt gerade niemand: Die Uhr fürs Müdewerden läuft dann nicht
    const { tired, event } = advance(this.tired, Date.now(), !this.state.sleeping && this.pose === 'stand');
    this.tired = tired;
    if (event) this.getTired(event);
    if (performance.now() - this.lastTiredSave > 5000) {
      saveTired(this.store, this.tired);
      this.lastTiredSave = performance.now();
    }
  }

  /** Die Figur setzt sich kurz hin, gähnt und sagt es in einer Sprechblase */
  private getTired(kind: TiredEvent) {
    this.sitUntil = performance.now() + SIT_MS;
    this.pace.clear();
    this.sfx.yawn();
    this.bubble.dataset.kind = kind;
    this.bubble.querySelector('.mw-bubble-text')!.textContent = TIRED_TALK[kind];
    this.bubble.hidden = false;
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = window.setTimeout(() => (this.bubble.hidden = true), kind === 'bed' ? 12_000 : 7_000);
  }

  private openInfo() {
    this.pace.clear();
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    (document.activeElement as HTMLElement | null)?.blur();
    this.info.showModal();
  }

  /** Nebel um die Figur lichten; geänderte Stücke baut die 3D-Ansicht neu */
  private lift() {
    const { x, y } = this.state.player;
    const at = `${x},${y}`;
    if (at === this.seenAt) return;
    this.seenAt = at;
    const changed = this.fog.reveal(x, y, REVEAL);
    // Blick durchs Tor: Steht die Figur vor einem großen Tor, lichtet sich der Nebel auch im Gang dahinter
    for (const g of this.world.gates.values()) {
      const [mx, my] = g.mid;
      if (Math.max(Math.abs(x - mx), Math.abs(y - my)) > 8) continue;
      for (const k of [4, 9, 14]) changed.push(...this.fog.reveal(mx + g.out[0] * k, my + g.out[1] * k, 4));
    }
    if (changed.length) this.gl3d?.invalidate(changed);
  }

  private listen() {
    this.globals = new AbortController();
    const signal = this.globals.signal;
    document.addEventListener(
      'keydown',
      (e) => {
        if (this.paused() || e.metaKey || e.ctrlKey || e.altKey || FREE_KEYS.has(e.key) || /^F\d+$/.test(e.key)) return;
        const t = e.target as HTMLElement | null;
        if (t?.closest('input, textarea, select')) return;
        // Buttons bleiben bedienbar (Enter, im Menü auch die Leertaste). Zahnrad oben: Die Leertaste drückt es nicht,
        // sonst öffnet das Kind nach einem Mausklick von Papa das Menü.
        if (t?.closest('button, a') && (e.key === 'Enter' || (e.key === ' ' && !t.closest('.mw-top, .mw-touch'))))
          return;
        const dir = KEYS[e.key];
        // Ab 3 gibt es keine Aktionstaste: Tiere und Bett gehen durch Hineinlaufen. Die Leertaste tut nichts
        // (sie scrollt auch nicht und drückt keinen Button); andere Tasten bleiben frei.
        if (!dir) {
          if (e.key === ' ') e.preventDefault();
          return;
        }
        e.preventDefault();
        if (e.repeat) return; // gehaltene Pfeile laufen über den eigenen Takt (poll im Bild), nicht über das System
        this.sfx.unlock();
        const go = this.pace.press(dir, performance.now());
        if (go) this.apply({ type: 'move', dir: go });
      },
      { signal },
    );
    document.addEventListener(
      'keyup',
      (e) => {
        const dir = KEYS[e.key];
        if (dir) this.pace.release(dir);
      },
      { signal },
    );
    // Losgelassene Tasten kommen nicht an, wenn das Fenster den Fokus verliert: dann nichts weiterlaufen lassen
    window.addEventListener('blur', () => this.pace.clear(), { signal });
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.visibilityState === 'hidden') {
          this.pace.clear();
          this.save();
          this.stop();
          this.story.stop();
          this.sfx.suspend();
        } else this.start();
      },
      { signal },
    );
    window.addEventListener('pagehide', () => this.save(), { signal });

    this.querySelector('.mw-gear')!.addEventListener('click', () => this.openMenu(), { signal });
    this.listenTouch(signal);
    // Beim Schließen gibt der Dialog den Fokus ans Zahnrad zurück; die Leertaste öffnete dann sofort wieder das Menü
    this.menu.addEventListener(
      'close',
      () => {
        (document.activeElement as HTMLElement | null)?.blur();
        this.start();
      },
      { signal },
    );
    this.menu.addEventListener('click', (e) => this.menuClick(e), { signal });
    this.info.addEventListener(
      'close',
      () => {
        try {
          this.store.setItem(INFO_KEY, '1');
        } catch {
          /* dann kommt der Hinweis beim nächsten Mal wieder */
        }
        (document.activeElement as HTMLElement | null)?.blur();
        this.start();
      },
      { signal },
    );
    this.info.addEventListener(
      'click',
      (e) => {
        if ((e.target as HTMLElement).closest('[data-act="info-close"]')) this.info.close();
      },
      { signal },
    );
    this.bubble.addEventListener(
      'click',
      (e) => {
        if ((e.target as HTMLElement).closest('[data-act="info"]')) this.openInfo();
      },
      { signal },
    );
    this.menu.addEventListener('change', (e) => this.menuChange(e), { signal });
  }

  /**
   * Touch-Steuerung: Das Steuerkreuz läuft über denselben ruhigen Takt wie die Tastatur.
   * Nach der ersten Berührung erscheint die Steuerung auch auf Geräten mit Maus (z. B. Laptop mit Touchscreen).
   */
  private listenTouch(signal: AbortSignal) {
    document.addEventListener('touchstart', () => this.classList.add('touch'), { signal, passive: true, once: true });
    // iPad/iPhone erlauben Ton erst bei einer aktivierenden Geste (Loslassen), nicht schon beim Antippen
    const unlock = () => this.sfx.unlock();
    document.addEventListener('pointerup', unlock, { signal });
    document.addEventListener('touchend', unlock, { signal, passive: true });
    // iPad/iPhone: Langes Drücken öffnet sonst Lupe, Textauswahl oder ein Menü. Pointer-Ereignisse kommen trotzdem an.
    const quiet = (e: Event) => e.preventDefault();
    for (const el of this.querySelectorAll<HTMLElement>('.mw-touch, .mw-canvas')) {
      el.addEventListener('touchstart', quiet, { signal, passive: false });
      el.addEventListener('contextmenu', quiet, { signal });
    }
    for (const key of this.querySelectorAll<HTMLElement>('.mw-key')) {
      const dir = key.dataset.dir as Dir;
      const held = new Set<number>(); // mehrere Finger auf derselben Taste: erst der letzte lässt los
      const up = (e: Event) => {
        held.delete((e as PointerEvent).pointerId);
        if (held.size) return;
        key.classList.remove('down');
        this.pace.release(dir);
      };
      key.addEventListener(
        'pointerdown',
        (e) => {
          e.preventDefault();
          key.setPointerCapture(e.pointerId);
          held.add(e.pointerId);
          key.classList.add('down');
          this.sfx.unlock();
          const go = this.pace.press(dir, performance.now());
          if (go) this.apply({ type: 'move', dir: go });
        },
        { signal },
      );
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
        key.addEventListener(type, up, { signal });
    }
  }

  /** Ereignisse der Regeln: Töne, Herzen, Noten, Tore, Nacht – und sofort speichern, was zählt */
  private react(events: GameEvent[]) {
    const now = performance.now();
    let persist = false;
    // Begegnung (Tier gefunden oder getroffen, Beeren, Fische, Füttern, Portal): Die Figur bleibt stehen, bis der Pfeil
    // neu gedrückt wird. Sonst liefe sie mit gehaltenem Pfeil gleich weiter und tauschte den Platz mit dem neuen Tier.
    if (events.some((e) => ENCOUNTERS.has(e.type))) this.pace.clear();
    for (const e of events) {
      switch (e.type) {
        case 'step':
        case 'swap': // im Kessel knirscht es auf Schnee und Eis
          this.sfx[stepSound(this.world, this.state.player.x, this.state.player.y)](e.type === 'step' ? e.climb : 0);
          this.listening = false;
          break;
        case 'story':
          this.story.toggle(e.id);
          this.listening = true;
          persist ||= e.first;
          break;
        case 'bump':
          this.sfx.bump();
          this.hops.set('bump', now);
          break;
        case 'sing':
          this.sfx.play(SPECIES[e.species].tone);
          this.hops.set(e.id, now);
          this.float('note', e.id, GAME_COLORS.note, now);
          if (e.first) {
            this.sfx.friend();
            this.float('heart', e.id, GAME_COLORS.heart, now + 250);
            this.burst(e.id, [GAME_COLORS.heart, '#ffffff', '#e77fb3'], 16);
            persist = true;
          }
          break;
        case 'follow':
          this.float('heart', e.id, GAME_COLORS.heart, now + 150);
          break;
        case 'aside':
        case 'wait':
        case 'rejoin':
          // Ein Tier der Wiese hüpft zur Seite und ruft kurz – die Figur geht weiter, ohne anzuhalten. An der Weltgrenze
          // setzt sich ein Tier mit seinem Ton und einem Herz auf seinen Warteplatz bzw. hüpft vor Freude und reiht sich ein
          this.sfx.play(SPECIES[e.species].tone);
          this.hops.set(e.id, now);
          if (e.type !== 'aside') {
            this.float('heart', e.id, GAME_COLORS.heart, now + 150);
            this.hops.set(`seat:${e.id}`, now); // gleitet zum Warteplatz bzw. zurück in die Kette, bis es dort ist
          }
          break;
        case 'realm': // Weltwechsel an der Gangmitte: hoher Glockenton in die Eis-Welt, tiefer zurück
          this.sfx.bell(e.to === 'eis');
          break;
        case 'home':
          // Zu Hause angekommen: Das Tier ruft seinen eigenen Ton, dazu ein heller Klang und ein Herz
          this.sfx.play(SPECIES[e.species].tone);
          this.sfx.home();
          this.hops.set(e.id, now);
          this.float('heart', e.id, GAME_COLORS.heart, now + 150);
          this.burst(e.id, ['#ffd47e', '#ffffff', '#6cc46f'], 14);
          persist = true;
          break;
        case 'portal': // Plattform erwacht bzw. gereist
        case 'teleport':
          this.sfx[e.type === 'portal' ? 'gate' : 'portal']();
          this.burst('player', [THEME_COLORS[e.id].portal, '#ffffff'], e.type === 'portal' ? 24 : 18);
          persist = true;
          break;
        case 'ready':
          this.sfx.pling();
          break;
        case 'gate':
          this.sfx.gate();
          this.gates.set(e.id, now);
          persist = true;
          break;
        case 'call':
          this.sfx.call();
          this.hops.set('player', now);
          this.float('note', 'player', GAME_COLORS.note, now);
          break;
        case 'sleep':
          this.goodNight(now);
          persist = true;
          break;
        case 'wake':
          this.sfx.wake();
          this.dayAt = now;
          this.hops.set('player', now);
          break;
        default: // Handgriffe: pflücken, fangen, nachwachsen, schöpfen, füttern, tränken
          this.chore(e, now);
      }
    }
    if (persist) this.save();
  }

  /** Ins Bett gebracht: Schlaflied, Nacht; der Tag ist zu Ende, morgen ist die Figur wieder ausgeschlafen */
  private goodNight(now: number) {
    this.story.stop();
    this.sfx.lullaby();
    this.nightSince = now;
    this.tired = freshDay(Date.now());
    this.sitUntil = 0;
    this.bubble.hidden = true;
    // Gute Nacht: eine sichere Stelle, um eine neue Version der App zu übernehmen (pwa-register.ts)
    this.dispatchEvent(new CustomEvent(SLEEP_EVENT, { bubbles: true }));
  }

  private float(kind: Float['kind'], who: string, color: string, born: number) {
    if (this.reduced.matches && kind !== 'heart') return;
    this.floats.push({ kind, who, color, born, x: 0, y: 0, z: 0, age: 0 });
  }

  private burst(who: string, colors: readonly string[], n: number) {
    const b = this.bodies.get(who);
    if (this.reduced.matches || !b) return;
    this.particles.push(...sparks(this.project(b.x + 0.5, b.y + 0.5, b.z + 0.8), colors, n, this.size.zoom));
  }

  // ---------- Bild ----------

  private measure() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth,
      h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    // Etwa 18 Felder breit, auf großen Schirmen nicht riesig, auf kleinen nicht winzig
    this.size = { w, h, dpr, zoom: Math.min(1.25, Math.max(0.5, w / (18 * 64))) };
    this.gl3d?.resize(w, h, dpr);
    const m = this.map.clientWidth;
    this.map.width = Math.round(m * dpr);
    this.map.height = Math.round(m * dpr);
  }

  /** Bildschirmpunkt eines Weltpunkts – aus der 3D-Kamera, sonst aus der Ansicht von vorn */
  private project(x: number, y: number, z: number): [number, number] {
    if (this.r3d) return this.r3d.project(x, y, z);
    const cam = this.camera();
    const { w, h, zoom } = this.size;
    return projection(cam.x + 0.5, cam.y + 0.5, w / 2, h / 2 + 30 * zoom, zoom)(x, y, z);
  }

  private camera() {
    return this.bodies.get('player') ?? { x: this.state.player.x, y: this.state.player.y };
  }

  /** Wesen gleiten zu ihrem Feld; große Sprünge (Aufwachen, Heimkehr) springen direkt */
  private glide(dt: number, now: number) {
    const snap = this.reduced.matches;
    const targets = new Map<string, { x: number; y: number }>();
    targets.set('player', this.state.player);
    for (const a of this.state.animals) targets.set(a.id, a);
    for (const id of this.bodies.keys()) if (!targets.has(id)) this.bodies.delete(id);
    const poses = postures(this.world, this.state); // Pustewind: zusammenrücken, aufplustern; Eule auf dem Iglu
    for (const [id, t] of targets) {
      const pose = poses.get(id);
      const c = this.world.cell(t.x, t.y); // auf einer Portal-Plattform etwas höher (Sockel bzw. Mittelfeld)
      const ground = (standHeight(this.world, this.state.openGates, t.x, t.y) ?? c.h) + platformLift(c);
      const sits =
        id === 'player' && (now < this.sitUntil || this.pose !== 'stand' || (this.listening && !!this.story.playing)); // müde, lesend, zuhörend
      const z = pose?.z ?? (sits ? ground - 0.35 : ground); // sitzt im Gras
      const [tx, ty] = [t.x + (pose?.dx ?? 0), t.y + (pose?.dy ?? 0)];
      let b = this.bodies.get(id);
      // An der Weltgrenze gleiten Tiere auch weitere Wege: zum Warteplatz und zurück in die Kette, bis sie angekommen sind
      const far = this.hops.has(`seat:${id}`) ? 12 : 2.5;
      if (!b || snap || Math.abs(b.x - tx) + Math.abs(b.y - ty) > far) b = { x: tx, y: ty, z, hop: 0 };
      const dx = tx - b.x,
        dy = ty - b.y,
        d = Math.hypot(dx, dy);
      const stepLen = SPEED * dt;
      if (d <= stepLen) {
        [b.x, b.y] = [tx, ty];
        this.hops.delete(`seat:${id}`);
      } else {
        b.x += (dx / d) * stepLen;
        b.y += (dy / d) * stepLen;
      }
      b.z += (z - b.z) * Math.min(1, dt * 14);
      const moving = Math.min(1, Math.hypot(tx - b.x, ty - b.y));
      const sung = now - (this.hops.get(id) ?? -1e9);
      const snapped = now - (this.hops.get(`snap:${id}`) ?? -1e9); // Schnapp-Hüpfer der Fischfresser beim Füttern
      b.hop = snap ? 0 : hopOf(id, moving, sung, snapped); // je Gangart der Art (watscheln, robben, hüpfen …)
      b.puff = pose?.puff ?? 1;
      this.bodies.set(id, b);
    }
  }

  /** Beeren gepflückt, Fische gefangen, nachgewachsen, Eimer geschöpft; Beeren, Fische oder Wasser in den Trog */
  private chore(e: ChoreEvent, now: number) {
    if (e.type === 'pick' || e.type === 'catch' || e.type === 'regrow')
      this.gl3d?.rebuild([chunkOf(e.x, e.y).join(',')]); // Busch oder Fischkiste ist jetzt leer bzw. wieder voll
    if (e.type === 'regrow') return;
    if (e.type === 'pick' || e.type === 'catch' || e.type === 'fill') {
      // Die Figur hüpft vor Freude: Beeren springen heraus, Fische platschen, beim Schöpfen spritzen Tropfen
      this.sfx[e.type]();
      this.hops.set('player', now);
      this.burst('player', SPARKS[e.type], 12);
      return;
    }
    // Alle Tiere der Wiese hüpfen und bekommen ein Herz
    if (e.type === 'feed') this.sfx.feed();
    else this.sfx.pour();
    const fish = e.type === 'feed' && e.food === 'fish'; // silberne und goldgelbe Funken, Fischfresser schnappen zu
    this.burst('player', SPARKS[e.type === 'feed' ? e.food : 'pour'], 16);
    e.ids.forEach((id, i) => {
      this.hops.set(id, now);
      if (fish && snaps(id)) this.hops.set(`snap:${id}`, now + SNAP_DELAY);
      this.float('heart', id, GAME_COLORS.heart, now + 100 + i * 60);
    });
  }

  /** Am Klangstein: Noten steigen auf, solange die Figur zuhört; Menü oder Hinweis halten die Geschichte an */
  private storyFrame(t: number) {
    if (this.paused()) this.story.stop();
    const fresh = this.floats.some((f) => f.kind === 'note' && f.who === 'player' && t - f.born < 900);
    if (this.listening && this.story.playing && !fresh && !this.reduced.matches)
      this.float('note', 'player', NOTE_COLORS.top, t);
  }

  private frame(t: number) {
    this.raf = requestAnimationFrame((n) => this.frame(n));
    const dt = Math.min(0.05, (t - (this.lastFrame || t)) / 1000);
    this.lastFrame = t;
    if (!this.size.w) this.measure();
    if (!this.size.w) return;
    // Gehaltener Pfeil oder gemerkter Tipp: im ruhigen Takt weiterlaufen
    const next = this.paused() ? null : this.pace.poll(t);
    if (next) this.apply({ type: 'move', dir: next });
    this.glide(dt, t);
    this.storyFrame(t);

    const bump = t - (this.hops.get('bump') ?? -1e9);
    const shake = !this.reduced.matches && bump < 200 ? Math.sin(bump / 18) * 0.06 * (1 - bump / 200) : 0;
    const player = this.bodies.get('player')!;
    const cam = { x: player.x + shake, y: player.y };

    // Nacht blendet ein und aus (ohne Überblendung bei reduzierter Bewegung)
    const fade = (since: number, ms: number) => (this.reduced.matches ? 1 : Math.min(1, (t - since) / ms));
    const night = this.state.sleeping ? fade(this.nightSince, 1500) : 1 - fade(this.dayAt, 900);

    this.pose = this.state.sleeping || this.paused() ? 'stand' : idlePose(t - this.lastInput);
    const dozing = this.state.sleeping || this.pose === 'doze'; // im Bett oder eingenickt über dem Buch
    if (dozing && !this.floats.some((f) => f.kind === 'zzz' && t - f.born < 1000) && !this.reduced.matches)
      this.floats.push({
        kind: 'zzz',
        who: this.state.sleeping ? 'bed' : 'player',
        color: GAME_COLORS.star,
        born: t,
        x: this.state.player.x, // im Schlaf liegt die Figur im Bett ihrer Gegend: Dort steigt das Zzz auf
        y: this.state.player.y,
        z: 0,
        age: 0,
      });

    // Schwebende Herzen und Noten folgen ihrem Wesen
    this.floats = this.floats.filter((f) => t - f.born < 1300);
    const floats: Float[] = [];
    for (const f of this.floats) {
      if (t < f.born) continue;
      const b = f.who === 'bed' ? { x: f.x, y: f.y, z: 1.3, hop: 0 } : this.bodies.get(f.who!);
      if (!b) continue;
      floats.push({ ...f, x: b.x, y: b.y, z: b.z + (f.who === 'player' ? 1.5 : 0.9), age: t - f.born });
    }
    const k = dt * 60; // Partikel laufen in Zeit, nicht in Bildern (120-Hz-Schirme)
    for (const p of this.particles) {
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.vy += 0.22 * k;
      p.life -= k;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    const gates = new Map<string, number>();
    for (const [id, since] of this.gates) gates.set(id, since === 0 ? 1 : fade(since, 900));

    const { dpr, w, h, zoom } = this.size;
    const mood = this.world.climate(Math.round(player.x), Math.round(player.y));
    const { weather, glance, aurora } = this.air.frame(this.world, this.state, this.paused(), this.reduced.matches);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    const scene: Scene = {
      width: w,
      height: h,
      zoom,
      cam,
      bodies: this.bodies,
      gates: gates as Scene['gates'],
      night,
      evening: this.state.sleeping ? 0 : evening(this.tired),
      weather,
      aurora: aurora * night,
      glance,
      pose: this.pose,
      mood,
      lit3d: !!this.r3d,
      wind: this.reduced.matches ? 0 : windAt(mood, weather),
      floats,
      particles: this.particles,
      now: t,
      look: LOOK,
      reduced: this.reduced.matches,
      bottomInset: this.touchUi.offsetParent ? this.touchUi.offsetHeight + 16 : 0,
      explored: (x, y) => this.fog.has(x, y),
    };
    if (this.r3d) {
      // 3D-Welt, darüber die durchsichtige 2D-Ebene mit Zeichen, Pfeil, Nacht und Leiste
      this.r3d.render(this.world, this.state, scene);
      this.ctx.clearRect(0, 0, w, h);
      this.renderer.overlay(this.world, this.state, scene, this.r3d.project);
    } else this.renderer.draw(this.world, this.state, scene);
    // Karte etwa zehnmal pro Sekunde
    if (t - this.lastMap > 100) {
      this.lastMap = t;
      const m = this.map.clientWidth;
      this.mapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.mapCtx.imageSmoothingEnabled = false;
      drawMap(
        this.mapCtx,
        this.world,
        this.state,
        player.x,
        player.y,
        m,
        (x, y) => this.fog.has(x, y),
        this.reduced.matches ? 0 : t,
      );
    }
  }

  // ---------- Kopf und Menü ----------

  private renderName() {
    const tag = this.querySelector('.mw-name');
    if (!tag) return;
    tag.replaceChildren(
      ...[...this.saved.figureName.toUpperCase()]
        .filter((ch) => ch.trim())
        .map((ch) => {
          const s = document.createElement('span');
          s.textContent = ch;
          return s;
        }),
    );
    tag.setAttribute('aria-label', this.saved.figureName);
  }

  private openMenu() {
    this.pace.clear();
    this.save();
    this.renderMenu();
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    // Ohne Fokus auf dem Zahnrad gibt der Dialog beim Schließen keinen Fokus dorthin zurück
    (document.activeElement as HTMLElement | null)?.blur();
    this.menu.showModal();
  }

  private renderMenu() {
    const list = this.menu.querySelector('.mw-worlds')!;
    list.replaceChildren(
      ...loadIndex(this.store).worlds.map((w) => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mw-world';
        b.dataset.world = w.id;
        if (w.id === this.saved.id) b.setAttribute('aria-current', 'true');
        const name = document.createElement('strong');
        name.textContent = w.worldName;
        const fig = document.createElement('span');
        fig.textContent = w.figureName;
        b.append(name, fig);
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'mw-link mw-delete';
        del.dataset.delete = w.id;
        del.textContent = 'Löschen';
        del.setAttribute('aria-label', `Welt „${w.worldName}“ löschen`);
        li.append(b, del);
        return li;
      }),
    );
    (this.menu.querySelector('#mw-world-name') as HTMLInputElement).value = this.saved.worldName;
    (this.menu.querySelector('#mw-figure-name') as HTMLInputElement).value = this.saved.figureName;
    this.menu.querySelector('.mw-code')!.textContent = worldCode(this.saved.seed);
    const sound = this.menu.querySelector('[data-act="sound"]')!;
    sound.setAttribute('aria-pressed', String(!this.sfx.muted));
    sound.textContent = this.sfx.muted ? 'Ton ist aus' : 'Ton ist an';
  }

  /** Welt löschen mit Rückfrage im Menü: erster Klick fragt, zweiter löscht (innerhalb von 4 Sekunden) */
  private removeWorld(button: HTMLElement, id: string) {
    if (button.dataset.armed !== '1') {
      button.dataset.armed = '1';
      button.textContent = 'Wirklich löschen?';
      // auch für Screenreader: Das Etikett sagt, dass der nächste Druck löscht
      button.setAttribute(
        'aria-label',
        `${button.getAttribute('aria-label')?.replace(/ löschen$/, '') ?? 'Welt'} wirklich löschen?`,
      );
      setTimeout(() => {
        if (!button.isConnected) return;
        button.dataset.armed = '';
        button.textContent = 'Löschen';
        button.setAttribute(
          'aria-label',
          button.getAttribute('aria-label')!.replace(/ wirklich löschen\?$/, ' löschen'),
        );
      }, 4000);
      return;
    }
    const index = deleteWorld(this.store, id);
    // Die gespielte Welt ist weg: zur nächsten wechseln oder eine neue anlegen
    if (id === this.saved.id) this.openWorld(index.current);
    else this.renderMenu();
  }

  private menuClick(e: Event) {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-world], [data-act], [data-delete]');
    if (!t) return;
    if (t.dataset.delete) {
      this.removeWorld(t, t.dataset.delete);
      return;
    }
    if (t.dataset.world && t.dataset.world !== this.saved.id) {
      this.save();
      this.openWorld(t.dataset.world);
      return;
    }
    switch (t.dataset.act) {
      case 'new':
        this.save();
        this.saved = newWorld(
          randomId(),
          randomSeed(),
          `Welt ${loadIndex(this.store).worlds.length + 1}`,
          this.saved.figureName,
        );
        saveWorld(this.store, this.saved);
        this.openWorld(this.saved.id);
        break;
      case 'copy':
        void this.copyCode(t);
        break;
      case 'sound':
        this.sfx.muted = !this.sfx.muted;
        try {
          this.store.setItem('larmic.games.muted', this.sfx.muted ? '1' : '0');
        } catch {
          /* egal */
        }
        if (this.sfx.muted) this.sfx.suspend();
        else this.sfx.unlock();
        this.renderMenu();
        break;
      case 'fullscreen':
        this.menu.close();
        this.requestFullscreen?.().catch(() => {});
        break;
      case 'close':
        this.menu.close();
        break;
      case 'info':
        this.menu.close();
        this.openInfo();
        break;
    }
  }

  private menuChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.id === 'mw-world-name') this.saved = { ...this.saved, worldName: cleanName(input.value, 'Meine Welt') };
    else if (input.id === 'mw-figure-name')
      this.saved = { ...this.saved, figureName: cleanName(input.value, DEFAULT_FIGURE) };
    else return;
    this.save();
    this.renderName();
    this.renderMenu();
  }

  private async copyCode(button: HTMLElement) {
    const code = worldCode(this.saved.seed);
    const done = (text: string) => {
      button.textContent = text;
      setTimeout(() => (button.textContent = 'Kopieren'), 1600);
    };
    try {
      await navigator.clipboard.writeText(code);
      done('Kopiert');
    } catch {
      const range = document.createRange();
      range.selectNodeContents(this.menu.querySelector('.mw-code')!);
      getSelection()?.removeAllRanges();
      getSelection()?.addRange(range);
      done('Markiert');
    }
  }
}

if (!customElements.get('larmic-mitwachsen')) customElements.define('larmic-mitwachsen', LarmicMitwachsen);
