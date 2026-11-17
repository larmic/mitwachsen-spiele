import { describe, expect, it } from 'vitest';
import { HOME_TITLE, SITE, homeLd } from './site';

describe('Daten für Suchmaschinen', () => {
  it('Titel der Startseite nennt Name und Alter und passt ins Suchergebnis', () => {
    expect(HOME_TITLE).toContain(SITE.title);
    expect(HOME_TITLE).toContain('ab 3');
    expect(HOME_TITLE.length).toBeLessThanOrEqual(60);
  });

  it('strukturierte Daten beschreiben Website und Spiel, kostenlos, ab 3, auf dieser Domain', () => {
    const ld = homeLd('Beschreibung');
    const [site, game] = ld['@graph'];
    expect(site?.['@type']).toBe('WebSite');
    expect(game).toMatchObject({
      '@type': 'VideoGame',
      description: 'Beschreibung',
      isAccessibleForFree: true,
      audience: { suggestedMinAge: 3 },
      offers: { price: 0 },
    });
    for (const url of JSON.stringify(ld).match(/https:\/\/[^"]+/g) ?? [])
      expect(url.startsWith(SITE.url) || url === 'https://schema.org' || url === 'https://larmic.de/').toBe(true);
  });
});
