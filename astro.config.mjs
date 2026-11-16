// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Das Spiel selbst (/spielen/) ist noindex und gehört nicht in die Sitemap
const notInSitemap = /^\/spielen\/$/;

export default defineConfig({
  site: 'https://www.mitwachsen-spiele.de',
  trailingSlash: 'ignore',
  // Bilder (auch in Markdown) mit Breite/Höhe, lazy und in passenden Größen (srcset), höchstens so breit wie der Text
  image: { layout: 'constrained' },
  integrations: [sitemap({ filter: (page) => !notInSitemap.test(new URL(page).pathname) })],
});
