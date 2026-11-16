// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import serviceWorker from './src/integrations/service-worker.ts';

// Das Spiel selbst (/spielen/) ist noindex und gehört nicht in die Sitemap
const notInSitemap = /^\/spielen\/$/;

export default defineConfig({
  site: 'https://www.mitwachsen-spiele.de',
  trailingSlash: 'ignore',
  // Bilder (auch in Markdown) mit Breite/Höhe, lazy und in passenden Größen (srcset), höchstens so breit wie der Text
  image: { layout: 'constrained' },
  integrations: [
    sitemap({ filter: (page) => !notInSitemap.test(new URL(page).pathname) }),
    // Service Worker des Spiels (dist/spielen/sw.js), nach dem Build aus der fertigen Seite erzeugt
    serviceWorker(),
  ],
});
