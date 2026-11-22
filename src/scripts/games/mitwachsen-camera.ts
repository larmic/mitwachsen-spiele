// Kamera der 3D-Ansicht – rein, ohne DOM und ohne Three.js: wo sie steht und wohin sie schaut, aus dem Blick (Winkel,
// Neigung, Abstand, Blickhöhe, Rücken zum Tor). In Ruhe (`CAM_REST`) schräg von oben aus Süden auf die Figur, wie immer;
// steht die Figur auf einer Torplatte, liefert der Drehregler (mitwachsen-turn.ts, nachgeladen) den Blick zur Torfront.
// Spezifikation: docs/specs/mitwachsen.md („Was angezeigt wird“: Kamera, Torplatte: Drehung)

/**
 * Heranrücken mit p (mitwachsen-turn.ts): Neigung 55° → 45°, Abstand 18 → 16 Felder, Blickhöhe 0,6 → 2,7 (damit das
 * ganze Tor samt Spitze ins Bild passt und die Figur im unteren Drittel bleibt), Blickpunkt bis 1,5 Felder zum Tor
 */
export const TILT_DEG = [55, 45] as const;
export const DIST = [18, 16] as const;
export const LOOK_Y = [0.6, 2.7] as const;
export const LOOK_SHIFT = 1.5;

/** Blick der Kamera: Winkel um die Hochachse (Grad, 0 im Süden), Neigung (Grad), Abstand, Blickhöhe, Rücken zum Tor */
export type CamView = { yaw: number; tilt: number; dist: number; lookY: number; shift: number };
/** Blick in Ruhe: aus Süden, 55° von oben, 18 Felder weit */
export const CAM_REST: CamView = Object.freeze({
  yaw: 0,
  tilt: TILT_DEG[0],
  dist: DIST[0],
  lookY: LOOK_Y[0],
  shift: 0,
});

type V3 = [number, number, number];
const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Augpunkt und Blickpunkt der Kamera (x, Höhe, z wie in der 3D-Ansicht): `t` die Figur, `v` der Blick, `k` der
 * Abstandsfaktor im Hochformat (1 … 1,8), `to` die Richtung zum Tor (x, z, Länge 1), in die der Blickpunkt rückt. Bei
 * ψ ≠ 0 steht sie in Richtung (sin ψ, cos ψ) vom Blickpunkt (Kamerakonvention von `TARGET_DEG` in mitwachsen-turn-pace.ts).
 * Mit `CAM_REST` genau wie vor der Drehung: schräg von oben (55°) aus Süden auf die Figur
 */
export function camPose(t: readonly [number, number, number], v: CamView, k: number, to: readonly [number, number]) {
  const look: V3 = [t[0] + to[0] * v.shift, t[1] + (v.lookY - LOOK_Y[0]), t[2] + to[1] * v.shift];
  const [d, tilt, yaw] = [v.dist * k, rad(v.tilt), rad(v.yaw)];
  const flat = d * Math.cos(tilt);
  const eye: V3 = [look[0] + Math.sin(yaw) * flat, look[1] + d * Math.sin(tilt), look[2] + Math.cos(yaw) * flat];
  return { eye, look, dist: d };
}
