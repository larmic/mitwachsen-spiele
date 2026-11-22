import { describe, expect, it } from 'vitest';
import { Matrix4, Vector3 } from 'three';
import { snapToShadowTexel } from './mitwachsen-geo';

describe('Schatten rasten ein', () => {
  const offset = new Vector3(-9, 22, 7);
  const texel = 36 / 2048;
  const basis = new Matrix4().lookAt(offset, new Vector3(), new Vector3(0, 1, 0));
  const axis = (i: number) => new Vector3().setFromMatrixColumn(basis, i);

  it('legt das Ziel quer zum Licht auf ganze Pixel der Schattenkarte, entlang des Lichts bleibt es', () => {
    for (const t of [new Vector3(0.3, 1, 0.7), new Vector3(-41.23, 2, 17.9), new Vector3(5.004, 1.5, -3.33)]) {
      const s = snapToShadowTexel(t, offset, texel);
      for (const i of [0, 1]) {
        const k = s.dot(axis(i)) / texel;
        expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-6);
      }
      expect(s.dot(axis(2))).toBeCloseTo(t.dot(axis(2)), 9);
      expect(s.distanceTo(t)).toBeLessThan(texel); // höchstens ein Pixel daneben
    }
  });

  it('bleibt bei kleinen Bewegungen der Figur quer zum Licht stehen und springt dann um ein Pixel', () => {
    // quer zum Licht zählt (entlang des Lichts verschiebt sich das Raster nicht)
    const across = (v: Vector3) => new Vector3(v.dot(axis(0)), v.dot(axis(1)), 0);
    const steps = Array.from({ length: 200 }, (_, i) =>
      across(snapToShadowTexel(new Vector3(i * 0.0005, 1, 0), offset, texel)),
    );
    const jumps = steps.slice(1).filter((s, i) => s.distanceTo(steps[i]!) > 1e-9);
    expect(jumps.length).toBeLessThan(10);
    expect(jumps.length).toBeGreaterThan(0);
  });

  it('mit der Kamera gedrehte Sonne: eingerastet im Lichtraum der gedrehten Sonne, gleiche Pixel bei kleinem Schritt', () => {
    for (const deg of [25, -65, 65, -155]) {
      const turned = offset.clone().applyAxisAngle(new Vector3(0, 1, 0), (deg * Math.PI) / 180);
      const b = new Matrix4().lookAt(turned, new Vector3(), new Vector3(0, 1, 0)); // so schaut die Schattenkamera
      const ax = (i: number) => new Vector3().setFromMatrixColumn(b, i);
      const s = snapToShadowTexel(new Vector3(12.34, 1, -7.89), turned, texel);
      for (const i of [0, 1]) {
        const k = s.dot(ax(i)) / texel;
        expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-6);
      }
      // ein kleiner Schritt der Kamera (ein Zehntel Pixel quer zum Licht, von der Mitte eines Pixels aus): dieselben
      // Pixel, das Raster steht
      const near = snapToShadowTexel(s.clone().addScaledVector(ax(0), texel / 10), turned, texel);
      const across = (v: Vector3) => [v.dot(ax(0)), v.dot(ax(1))].map((c) => Math.round(c / texel));
      expect(across(near)).toEqual(across(s));
    }
  });
});
