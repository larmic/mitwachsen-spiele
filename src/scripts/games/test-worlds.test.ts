// Der Helfer der Tests selbst: Welten je Seed einmal gebaut, im tiefen Lauf nach jeder Datei bis auf die zuletzt
// gebrauchten vergessen (test-deep-setup.ts)
import { describe, expect, it } from 'vitest';
import { bareOf, forgetWorlds } from './test-worlds';

describe('test-worlds: forgetWorlds', () => {
  it('behält die `keep` zuletzt gebrauchten Welten, vergisst die anderen; ohne `keep` alle', () => {
    forgetWorlds();
    const [one, two] = [bareOf(1), bareOf(2)];
    expect(bareOf(1)).toBe(one); // gebraucht: jetzt die jüngste
    forgetWorlds(1);
    expect(bareOf(1)).toBe(one);
    expect(bareOf(2)).not.toBe(two); // vergessen, neu gebaut
    forgetWorlds();
    expect(bareOf(1)).not.toBe(one);
  });
});
