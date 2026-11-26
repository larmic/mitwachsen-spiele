// Kleinster Haufen über Zahlen – generisch, für Wegsuchen (Gleis der Höhlenbahn in worlds/bahn/mitwachsen-trace.ts,
// Fußwege im Kern in mitwachsen-footpath.ts): `push` legt eine Zahl hinein, `pop` holt die kleinste heraus.

/** Kleinster Haufen über Zahlen */
export class Heap {
  private a: number[] = [];
  get size() {
    return this.a.length;
  }
  push(v: number) {
    const a = this.a;
    a.push(v);
    for (let i = a.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (a[p]! <= v) break;
      a[i] = a[p]!;
      a[p] = v;
      i = p;
    }
  }
  pop(): number {
    const a = this.a;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1,
          r = l + 1;
        let m = i;
        if (l < a.length && a[l]! < a[m]!) m = l;
        if (r < a.length && a[r]! < a[m]!) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m]!, a[i]!];
        i = m;
      }
    }
    return top;
  }
}
