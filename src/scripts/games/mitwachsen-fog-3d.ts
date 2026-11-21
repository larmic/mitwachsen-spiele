// Nebel-Maske der 3D-Ansicht (mitwachsen-3d.ts): erkundete Felder um die Figur als weiche Maske für den Shader. Rein,
// ohne Three.js; gehört zur 3D-Ansicht und wird nur mit ihr nachgeladen.
// Spezifikation: docs/specs/mitwachsen.md (Nebel)

/**
 * Maske `n` × `n` Felder ab (ox, oy): erkundet = 255, sonst 0, zweimal weich verwischt (sanfter Übergang über 2–3
 * Felder). Zeile j, Spalte i liegt bei Feld (ox + i, oy + j)
 */
export function fogMask(explored: (x: number, y: number) => boolean, ox: number, oy: number, n: number): Uint8Array {
  const a = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) a[j * n + i] = explored(ox + i, oy + j) ? 1 : 0;
  return Uint8Array.from(blur(blur(a, n), n), (v) => Math.round(v * 255));
}

/** Jeder Wert wird zum Mittel seiner Nachbarn im 3 × 3-Feld (am Rand nur der vorhandenen) */
function blur(a: Float32Array, n: number): Float32Array {
  const b = new Float32Array(n * n);
  const lo = (k: number) => Math.max(0, k - 1);
  const hi = (k: number) => Math.min(n - 1, k + 1);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let jj = lo(j); jj <= hi(j); jj++) for (let ii = lo(i); ii <= hi(i); ii++) sum += a[jj * n + ii] ?? 0;
      b[j * n + i] = sum / ((hi(j) - lo(j) + 1) * (hi(i) - lo(i) + 1));
    }
  return b;
}
