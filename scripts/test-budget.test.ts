import { describe, expect, it } from 'vitest';
import { BUDGET_RANGE, COVERAGE_FACTOR, REF, budgetMs, calibrate } from './test-budget.ts';

describe('Zeitbudget der Unit-Tests', () => {
  it('auf dem Bezugsrechner mit Abdeckung genau das Bezugsbudget, ohne Abdeckung entsprechend weniger', () => {
    expect(budgetMs(REF.calibMs, true)).toBe(REF.budgetMs);
    expect(budgetMs(REF.calibMs, false)).toBe(Math.round(REF.budgetMs / COVERAGE_FACTOR));
  });

  it('wächst mit der Kalibrierung: ein anderthalbmal so langsamer Rechner bekommt das anderthalbfache Budget', () => {
    expect(budgetMs(REF.calibMs * 1.5, true)).toBe(REF.budgetMs * 1.5);
    expect(budgetMs(REF.calibMs * 0.75, true)).toBe(REF.budgetMs * 0.75);
  });

  it('bleibt in seinen Grenzen, auch bei sehr schnellen oder sehr langsamen Rechnern', () => {
    expect(budgetMs(REF.calibMs / 100, false)).toBe(BUDGET_RANGE[0]);
    expect(budgetMs(REF.calibMs * 100, true)).toBe(BUDGET_RANGE[1]);
  });

  it('die Kalibrierung misst eine Zeit (wie lange, hängt vom Rechner ab)', () => {
    const ms = calibrate(1);
    expect(ms).toBeGreaterThan(0);
    expect(Number.isFinite(ms)).toBe(true);
  });
});
