import { describe, expect, it } from 'vitest';
import {
  APPLY_GAP,
  ARM_MS,
  LONG_PAUSE,
  RITUAL_MS,
  longPause,
  registrationOptions,
  safeMoment,
  shouldApply,
  shouldReload,
  type Chance,
  type Takeover,
  type Moment,
} from './pwa-update';

const asleep: Moment = {
  sleeping: true,
  sleepingFor: RITUAL_MS,
  menuOpen: false,
  infoOpen: false,
  firstInfo: false,
  persistent: true,
  fullscreen: false,
  visible: true,
};

describe('App-Update: sicherer Moment', () => {
  it('schlafend nach dem Gute-Nacht-Ritual ist sicher, vorher nicht', () => {
    expect(safeMoment(asleep)).toBe(true);
    expect(safeMoment({ ...asleep, sleepingFor: RITUAL_MS - 1 })).toBe(false);
  });

  it('mitten im Spiel nie', () => {
    expect(safeMoment({ ...asleep, sleeping: false })).toBe(false);
    expect(safeMoment({ ...asleep, sleeping: false, sleepingFor: 0 })).toBe(false);
  });

  it('nie, solange Eltern im Menü oder im wieder geöffneten Hinweis sind', () => {
    expect(safeMoment({ ...asleep, menuOpen: true })).toBe(false);
    expect(safeMoment({ ...asleep, infoOpen: true })).toBe(false);
  });

  it('der Hinweis beim allerersten Öffnen ist sicher, auch ohne Schlaf: Er kommt nach dem Laden wieder', () => {
    expect(safeMoment({ ...asleep, infoOpen: true, firstInfo: true, sleepingFor: 0 })).toBe(true);
    expect(safeMoment({ ...asleep, infoOpen: true, firstInfo: true, menuOpen: true })).toBe(false);
  });

  it('nie ohne dauerhaften Speicher, im Vollbild oder bei verborgener Seite', () => {
    expect(safeMoment({ ...asleep, persistent: false })).toBe(false);
    expect(safeMoment({ ...asleep, fullscreen: true })).toBe(false);
    expect(safeMoment({ ...asleep, visible: false })).toBe(false);
  });
});

describe('App-Update: lange Pause', () => {
  it('zählt erst ab der Schwelle und nur, wenn die Seite verborgen war', () => {
    const t = 1_000_000_000;
    expect(longPause(t, t + LONG_PAUSE)).toBe(true);
    expect(longPause(t, t + LONG_PAUSE - 1)).toBe(false);
    expect(longPause(0, t)).toBe(false);
  });
});

describe('App-Update: übernehmen', () => {
  const now = 2_000_000_000;
  const chance: Chance = { waiting: true, armedAt: now - 1000, lastApplied: 0, now, safe: true };

  it('übernimmt eine wartende Version kurz nach einem Auslöser im sicheren Moment', () => {
    expect(shouldApply(chance)).toBe(true);
    expect(shouldApply({ ...chance, armedAt: now - ARM_MS })).toBe(true);
  });

  it('nicht ohne wartende Version, ohne sicheren Moment oder ohne Auslöser', () => {
    expect(shouldApply({ ...chance, waiting: false })).toBe(false);
    expect(shouldApply({ ...chance, safe: false })).toBe(false);
    expect(shouldApply({ ...chance, armedAt: 0 })).toBe(false);
  });

  it('nicht lange nach dem Auslöser (eine Version, die erst mitten im nächsten Spiel fertig wird)', () => {
    expect(shouldApply({ ...chance, armedAt: now - ARM_MS - 1 })).toBe(false);
    expect(shouldApply({ ...chance, armedAt: now + 1 })).toBe(false);
  });

  it('lädt nicht in einer Schleife neu', () => {
    expect(shouldApply({ ...chance, lastApplied: now - 5000 })).toBe(false);
    expect(shouldApply({ ...chance, lastApplied: now - APPLY_GAP })).toBe(true);
    expect(shouldApply({ ...chance, lastApplied: now + 5000 })).toBe(true); // Uhr zurückgestellt
  });
});

describe('App-Update: neu laden nach der Übernahme', () => {
  const now = 2_000_000_000;
  const takeover: Takeover = { taken: true, safe: true, armedAt: now - 1000, now };

  it('lädt neu, wenn die neue Version übernommen hat und der Moment noch sicher ist', () => {
    expect(shouldReload(takeover)).toBe(true);
    expect(shouldReload({ ...takeover, armedAt: now - ARM_MS })).toBe(true);
  });

  it('nicht, wenn das Kind die Figur zwischen Bitte und Übernahme geweckt hat – dann beim nächsten Auslöser', () => {
    expect(shouldReload({ ...takeover, safe: false })).toBe(false);
    // Später: wieder im Bett, neuer Auslöser
    expect(shouldReload({ ...takeover, armedAt: now + 600_000, now: now + 601_000 })).toBe(true);
  });

  it('nie ohne eigene Bitte, ohne Auslöser oder lange danach', () => {
    expect(shouldReload({ ...takeover, taken: false })).toBe(false);
    expect(shouldReload({ ...takeover, armedAt: 0 })).toBe(false);
    expect(shouldReload({ ...takeover, armedAt: now - ARM_MS - 1 })).toBe(false);
    expect(shouldReload({ ...takeover, armedAt: now + 1 })).toBe(false);
  });
});

describe('Anmeldung', () => {
  it('fragt am HTTP-Cache vorbei nach einer neuen Version, nie über den Cache', () => {
    const opts = registrationOptions('/spielen/');
    expect(opts).toEqual({ scope: '/spielen/', updateViaCache: 'none' });
    expect(opts.updateViaCache).not.toBe('all');
  });
});
