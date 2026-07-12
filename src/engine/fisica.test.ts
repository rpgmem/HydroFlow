import { describe, it, expect } from 'vitest';
import { pressaoHidrostaticaKPa, PRESSAO_ATM_KPA } from './fisica';
import { exibirPressao, pressaoParaSI, labelPressao } from '../domain/unidades';

describe('pressaoHidrostaticaKPa (Teorema de Stevin)', () => {
  it('10 m de coluna ≈ 98,1 kPa (≈ 1 atm)', () => {
    expect(pressaoHidrostaticaKPa(10)).toBeCloseTo(98.1, 1);
    expect(pressaoHidrostaticaKPa(10)).toBeLessThan(PRESSAO_ATM_KPA);
  });
  it('coluna 0 (ou negativa) → 0', () => {
    expect(pressaoHidrostaticaKPa(0)).toBe(0);
    expect(pressaoHidrostaticaKPa(-5)).toBe(0);
  });
  it('escala com g', () => {
    expect(pressaoHidrostaticaKPa(2, 10)).toBeCloseTo(20, 5); // 1000·10·2/1000
  });
});

describe('conversão de pressão (kPa canônico ↔ exibição)', () => {
  it('kPa é identidade', () => {
    const u = { volume: 'm3', comprimento: 'm', pressao: 'kPa' } as const;
    expect(exibirPressao(100, u)).toBeCloseTo(100);
    expect(pressaoParaSI(100, u)).toBeCloseTo(100);
    expect(labelPressao(u)).toBe('kPa');
  });
  it('m.c.a.: 98,0665 kPa = 10 m.c.a.', () => {
    const u = { volume: 'm3', comprimento: 'm', pressao: 'mca' } as const;
    expect(exibirPressao(98.0665, u)).toBeCloseTo(10, 4);
    expect(pressaoParaSI(10, u)).toBeCloseTo(98.0665, 4);
    expect(labelPressao(u)).toBe('m.c.a.');
  });
  it('psi: round-trip', () => {
    const u = { volume: 'm3', comprimento: 'm', pressao: 'psi' } as const;
    expect(pressaoParaSI(exibirPressao(100, u), u)).toBeCloseTo(100, 6);
    expect(labelPressao(u)).toBe('psi');
  });
  it('sem preferência → kPa (default)', () => {
    const u = { volume: 'm3', comprimento: 'm' } as const;
    expect(exibirPressao(50, u)).toBeCloseTo(50);
    expect(labelPressao(u)).toBe('kPa');
  });
});
