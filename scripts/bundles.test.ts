import { describe, expect, it } from 'vitest';
import { check, inlineScriptsOf, loaded, scriptsOf, staticImports, type Rule } from './bundles.ts';

const files: Record<string, string> = {
  '/_astro/home.js': 'import{a as b}from"./shared.js";console.log(b)',
  '/_astro/shared.js': 'export const a=1;',
  '/_astro/game.js': 'import"./shared.js";const t=()=>import("./three.module.js");',
  '/_astro/three.module.js': 'class WebGLRenderer{}',
};
const read = (p: string) => files[p] ?? null;
const RULES: Rule[] = [
  { name: 'Startseite', pages: /^(?!spielen\/)/, budget: 100, forbidden: /game|WebGLRenderer/ },
  { name: 'Spiel', pages: /^spielen\//, budget: 1000, forbidden: /WebGLRenderer/ },
];
const page = (...srcs: string[]) => srcs.map((s) => `<script type="module" src="${s}"></script>`).join('');

describe('Bundle-Gate', () => {
  it('findet Skripte und Modulvorladungen im HTML', () => {
    const html = '<script type="module" src="/_astro/a.js"></script><link rel="modulepreload" href="/_astro/b.js">';
    expect(scriptsOf(html)).toEqual(['/_astro/a.js', '/_astro/b.js']);
  });

  it('folgt statischen Importen, aber nicht dynamischen', () => {
    expect(staticImports(files['/_astro/game.js']!)).toEqual(['./shared.js']);
    expect(loaded(page('/_astro/game.js'), read).sort()).toEqual(['/_astro/game.js', '/_astro/shared.js']);
  });

  it('lässt eine schlanke Startseite durch', () => {
    expect(check('index.html', page('/_astro/home.js'), read, RULES)).toEqual([]);
  });

  it('meldet Spielcode auf der Startseite', () => {
    const problems = check('index.html', page('/_astro/home.js', '/_astro/game.js'), read, RULES);
    expect(problems.some((p) => p.includes('/_astro/game.js'))).toBe(true);
  });

  it('meldet ein überschrittenes Budget', () => {
    const tight: Rule[] = [{ ...RULES[0]!, budget: 10 }];
    expect(check('index.html', page('/_astro/home.js'), read, tight)[0]).toMatch(/Bytes JavaScript/);
  });

  it('erlaubt dem Spiel Three.js nur als nachträglichen Import', () => {
    expect(check('spielen/index.html', page('/_astro/game.js'), read, RULES)).toEqual([]);
    const eager = check('spielen/index.html', page('/_astro/game.js', '/_astro/three.module.js'), read, RULES);
    expect(eager.length).toBeGreaterThan(0);
  });

  it('findet eingebettete Skripte, aber keine Dateien und keine Daten', () => {
    const html =
      '<script>a()</script><script type="module" src="/_astro/a.js"></script>' +
      '<script type="application/ld+json">{"game":1}</script><script type="module">\n  b()\n</script><script></script>';
    expect(inlineScriptsOf(html)).toEqual(['a()', '\n  b()\n']);
  });

  it('meldet Verbotenes in einem eingebetteten Skript', () => {
    const html = '<script>navigator.game.register("/x.js")</script>';
    const problems = check('index.html', html, read, RULES);
    expect(problems.some((p) => p.includes('eingebettetes Skript 1'))).toBe(true);
  });

  it('rechnet eingebettete Skripte ins Budget', () => {
    const none: Rule[] = [{ name: 'ohne JavaScript', pages: /^index\.html$/, budget: 0, forbidden: /game/ }];
    expect(check('index.html', '<script>x()</script>', read, none)[0]).toMatch(/3 Bytes JavaScript/);
    expect(check('index.html', '<p>ohne Skript</p>', read, none)).toEqual([]);
  });

  it('meldet fehlende Dateien', () => {
    expect(check('index.html', page('/_astro/weg.js'), read, RULES)[0]).toMatch(/fehlt/);
  });
});
