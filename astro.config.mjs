// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import serviceWorker from './src/integrations/service-worker.ts';

// Das Spiel selbst (/spielen/) ist noindex und gehört nicht in die Sitemap
const notInSitemap = /^\/spielen\/$/;

// Welt-Pakete (src/scripts/games/worlds/<welt>/index.ts, per import() nachgeladen) heißen im Build
// _astro/welt-<welt>.<hash>.js: So erkennt das Bundle-Gate sie (scripts/verify-bundles.ts). Alle anderen Dateien wie
// bei Astro (Name ohne unsichere Zeichen, dazu der Hash).
const WORLD_PACK = /\/scripts\/games\/worlds\/([a-z]+)\/index\.ts$/;
const chunkFileNames = (/** @type {{ name: string; facadeModuleId: string | null }} */ chunk) => {
  const world = WORLD_PACK.exec(chunk.facadeModuleId ?? '');
  return `_astro/${world ? `welt-${world[1]}` : chunk.name.replace(/[^\w.\-/]/g, '_')}.[hash].js`;
};

export default defineConfig({
  site: 'https://www.mitwachsen-spiele.de',
  trailingSlash: 'ignore',
  // Bilder (auch in Markdown) mit Breite/Höhe, lazy und in passenden Größen (srcset), höchstens so breit wie der Text
  image: { layout: 'constrained' },
  vite: { environments: { client: { build: { rolldownOptions: { output: { chunkFileNames } } } } } },
  integrations: [
    sitemap({ filter: (page) => !notInSitemap.test(new URL(page).pathname) }),
    // Service Worker des Spiels (dist/spielen/sw.js), nach dem Build aus der fertigen Seite erzeugt
    serviceWorker(),
  ],
});
