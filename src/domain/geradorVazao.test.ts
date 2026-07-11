import { describe, it, expect } from 'vitest';
import { valorNoTempo, paramsPadrao, vazaoRef, PRESETS_TRAPEZOIDAIS } from './geradorVazao';
import type { Gerador } from './types';

describe('gerador de vazão — valorNoTempo', () => {
  it('fixo é constante e nunca negativo', () => {
    expect(valorNoTempo({ perfil: 'fixo', vazao: 7 }, 0)).toBe(7);
    expect(valorNoTempo({ perfil: 'fixo', vazao: 7 }, 999)).toBe(7);
    expect(valorNoTempo({ perfil: 'fixo', vazao: -3 }, 0)).toBe(0); // clamp ≥ 0
  });

  it('senoidal varia entre mín e máx (meio, pico, vale)', () => {
    const g: Gerador = { perfil: 'senoidal', min: 1, max: 3, periodo: 4 };
    expect(valorNoTempo(g, 0)).toBeCloseTo(2, 9); // sin 0 → meio
    expect(valorNoTempo(g, 1)).toBeCloseTo(3, 9); // sin π/2 → máx
    expect(valorNoTempo(g, 3)).toBeCloseTo(1, 9); // sin 3π/2 → mín
  });

  it('trapezoidal — preset quadrada (50% alto / 50% baixo)', () => {
    const g: Gerador = { perfil: 'trapezoidal', min: 0, max: 5, periodo: 10, ...PRESETS_TRAPEZOIDAIS.quadrada };
    expect(valorNoTempo(g, 0)).toBe(5); // 0..50% → alto
    expect(valorNoTempo(g, 4)).toBe(5);
    expect(valorNoTempo(g, 5)).toBe(0); // 50..100% → baixo
    expect(valorNoTempo(g, 9)).toBe(0);
  });

  it('trapezoidal — dente de serra ↑ sobe linear e cai no fim', () => {
    const g: Gerador = { perfil: 'trapezoidal', min: 0, max: 10, periodo: 10, ...PRESETS_TRAPEZOIDAIS.serraSubindo };
    expect(valorNoTempo(g, 0)).toBeCloseTo(0, 9);
    expect(valorNoTempo(g, 5)).toBeCloseTo(5, 9);
    expect(valorNoTempo(g, 9)).toBeCloseTo(9, 9);
    expect(valorNoTempo(g, 10)).toBeCloseTo(0, 9); // wrap → volta ao mínimo
  });

  it('trapezoidal — dente de serra ↓ é o espelho (começa no máx, desce)', () => {
    const g: Gerador = { perfil: 'trapezoidal', min: 0, max: 10, periodo: 10, ...PRESETS_TRAPEZOIDAIS.serraDescendo };
    expect(valorNoTempo(g, 0)).toBeCloseTo(10, 9);
    expect(valorNoTempo(g, 5)).toBeCloseTo(5, 9);
    expect(valorNoTempo(g, 9)).toBeCloseTo(1, 9);
  });

  it('trapezoidal — triangular sobe até o meio e desce', () => {
    const g: Gerador = { perfil: 'trapezoidal', min: 0, max: 8, periodo: 8, ...PRESETS_TRAPEZOIDAIS.triangular };
    expect(valorNoTempo(g, 0)).toBeCloseTo(0, 9);
    expect(valorNoTempo(g, 4)).toBeCloseTo(8, 9); // pico no meio
    expect(valorNoTempo(g, 6)).toBeCloseTo(4, 9); // descendo
  });

  it('trapezoidal normaliza frações que não somam 1', () => {
    // subida 1, alto 1 (total 2) → subida ocupa a 1ª metade, alto a 2ª.
    const g: Gerador = { perfil: 'trapezoidal', min: 0, max: 4, periodo: 10, subida: 1, alto: 1, descida: 0, baixo: 0 };
    expect(valorNoTempo(g, 2.5)).toBeCloseTo(2, 6); // metade da subida
    expect(valorNoTempo(g, 7)).toBe(4); // já no patamar alto
  });

  it('paramsPadrao ancora na vazão V e vazaoRef devolve o representativo', () => {
    expect(paramsPadrao('fixo', 12)).toEqual({ perfil: 'fixo', vazao: 12 });
    const sen = paramsPadrao('senoidal', 10);
    expect(sen).toMatchObject({ perfil: 'senoidal', min: 5, max: 15 });
    expect(vazaoRef(sen)).toBe(15); // máx
    expect(vazaoRef({ perfil: 'fixo', vazao: 9 })).toBe(9);
  });
});
