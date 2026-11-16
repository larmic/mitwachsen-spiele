// Inhalts-Sammlungen mit Schema: Fehlt ein Pflichtfeld, bricht der Build ab (Guard-Gate für Inhalte).
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
// Spiele: Beschreibung für Eltern (Startseite), das Spiel selbst liegt unter /spielen/
const games = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/games' }),
  schema: z.object({
    title: z.string(),
    short: z.string(),
    teaser: z.string(),
    claim: z.string().optional(),
    order: z.number().int(),
    age: z.string(), // ab welchem Alter, z. B. „ab 3 Jahren“
    together: z.string(), // wer mitspielt
    controls: z.string(),
    device: z.string(),
  }),
});

export const collections = { games };
