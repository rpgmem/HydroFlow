import { describe, it, expect } from 'vitest';
import { vazaoGravidadeM3, vazaoBombaOperacao, hfHazenWilliamsM, hfDarcyWeisbachM } from './hidraulica';
import { areaTuboM2 } from './geometria';

// As leis com atrito não têm forma fechada e são resolvidas por Newton salvaguardado. Aqui garantimos que a raiz devolvida REALMENTE satisfaz a
// equação (resíduo ~0) e mantém as propriedades físicas, em vez de fixar números mágicos — assim a troca de solver (bisseção → Newton) fica protegida.

describe('vazaoGravidadeM3 (Hazen-Williams)', () => {
  const g = 9.81;
  const casos = [
    { dMM: 50, L: 1 },
    { dMM: 100, L: 10 },
    { dMM: 160, L: 200 },
  ];
  const cargas = [0.01, 0.5, 5, 50];

  it('sem atrito devolve o Torricelli puro (A·√(2gΔh))', () => {
    const A = areaTuboM2(100);
    expect(vazaoGravidadeM3(false, A, 100, 10, 140, 5, g)).toBeCloseTo(A * Math.sqrt(2 * g * 5), 9);
  });

  it('a raiz satisfaz Δh = v²/2g + hf(Q) (resíduo ~0)', () => {
    for (const { dMM, L } of casos) {
      const A = areaTuboM2(dMM);
      for (const dh of cargas) {
        const q = vazaoGravidadeM3(true, A, dMM, L, 140, dh, g);
        const v = q / A;
        const residuo = (v * v) / (2 * g) + hfHazenWilliamsM(q, L, dMM / 1000, 140) - dh;
        expect(Math.abs(residuo)).toBeLessThan(1e-9);
      }
    }
  });

  it('o atrito só REDUZ a vazão frente ao Torricelli (limite superior)', () => {
    const A = areaTuboM2(100);
    for (const dh of cargas) {
      const comAtrito = vazaoGravidadeM3(true, A, 100, 200, 140, dh, g);
      const torr = A * Math.sqrt(2 * g * dh);
      expect(comAtrito).toBeGreaterThan(0);
      expect(comAtrito).toBeLessThan(torr);
    }
  });
});

describe('vazaoBombaOperacao (ponto de operação)', () => {
  const hf = (x: number): number => hfHazenWilliamsM(x, 100, 0.1, 140);

  it('sem perda (hf ≡ 0) recai em base − kEff·estática', () => {
    expect(vazaoBombaOperacao(30, 1.5, 4, () => 0)).toBeCloseTo(30 - 1.5 * 4, 9);
  });

  it('bomba ideal (kEff = 0) entrega a base independentemente do atrito', () => {
    expect(vazaoBombaOperacao(30, 0, 10, hf)).toBe(30);
  });

  it('satura em 0 quando a estática supera a curva', () => {
    expect(vazaoBombaOperacao(10, 1, 100, hf)).toBe(0);
  });

  it('a raiz satisfaz x = base − kEff·(estática + hf(x)) (resíduo ~0)', () => {
    for (const base of [10, 30, 50]) {
      for (const k of [0.5, 1.5, 3]) {
        for (const est of [0, 2, 10]) {
          const x = vazaoBombaOperacao(base, k, est, hf);
          if (x <= 0) continue;
          const residuo = base - k * (est + hf(x)) - x;
          expect(Math.abs(residuo)).toBeLessThan(1e-9);
        }
      }
    }
  });

  it('o atrito reduz a entrega frente ao caso puramente estático', () => {
    const semAtrito = vazaoBombaOperacao(30, 1.5, 4, () => 0);
    const comAtrito = vazaoBombaOperacao(30, 1.5, 4, hf);
    expect(comAtrito).toBeGreaterThan(0);
    expect(comAtrito).toBeLessThan(semAtrito);
  });
});

describe('Darcy-Weisbach', () => {
  const g = 9.81;
  const dw = { modelo: 'darcy-weisbach' as const, rugosidadeMM: 0.0015, muPas: 1e-3 };

  it('resolve Δh = v²/2g + hf_DW (resíduo ~0)', () => {
    const A = areaTuboM2(100);
    const dh = 5, L = 10;
    const q = vazaoGravidadeM3(true, A, 100, L, 140, dh, g, dw);
    const v = q / A;
    const hf = hfDarcyWeisbachM(q, L, 100, dw.rugosidadeMM, dw.muPas, g);
    expect((v * v) / (2 * g) + hf).toBeCloseTo(dh, 4);
  });

  it('o atrito REDUZ a vazão frente ao Torricelli', () => {
    const A = areaTuboM2(100);
    const qTorr = A * Math.sqrt(2 * g * 5);
    const q = vazaoGravidadeM3(true, A, 100, 50, 140, 5, g, dw);
    expect(q).toBeGreaterThan(0);
    expect(q).toBeLessThan(qTorr);
  });

  it('Darcy-Weisbach e Hazen-Williams ficam na mesma ordem de grandeza', () => {
    const A = areaTuboM2(100);
    const hw = vazaoGravidadeM3(true, A, 100, 50, 140, 5, g);
    const q = vazaoGravidadeM3(true, A, 100, 50, 140, 5, g, dw);
    expect(q).toBeGreaterThan(hw * 0.5);
    expect(q).toBeLessThan(hw * 2);
  });

  it('tubo mais áspero entrega menos', () => {
    const A = areaTuboM2(100);
    const liso = vazaoGravidadeM3(true, A, 100, 50, 140, 5, g, dw);
    const aspero = vazaoGravidadeM3(true, A, 100, 50, 140, 5, g, { ...dw, rugosidadeMM: 1.0 });
    expect(aspero).toBeLessThan(liso);
  });
});
