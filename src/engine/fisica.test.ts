import { describe, it, expect } from 'vitest';
import { pressaoHidrostaticaKPa, colunaPressaoM, PRESSAO_ATM_KPA, muAgua, reynolds, regimeReynolds, sobrepressaoGolpeKPa, fatorAtritoDW, pvaporAguaKPa, npshDisponivelM } from './fisica';
import { velocidadeTuboMs } from './geometria';
import {
  exibirPressao,
  pressaoParaSI,
  labelPressao,
  exibirTemperatura,
  temperaturaParaSI,
  labelTemperatura,
} from '../domain/unidades';

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

describe('viscosidade e número de Reynolds', () => {
  it('μ da água ≈ 1,00e-3 Pa·s a 20 °C e cai com a temperatura', () => {
    expect(muAgua(20)).toBeCloseTo(1.0e-3, 4);
    expect(muAgua(50)).toBeLessThan(muAgua(20)); // água mais quente é menos viscosa
  });
  it('Re = ρ·v·D/μ', () => {
    // v=2 m/s, D=100 mm, μ(20°C) → Re ≈ 1000·2·0,1/1,0e-3 ≈ 200000
    expect(reynolds(2, 100, muAgua(20))).toBeCloseTo(2e5, -3);
    expect(reynolds(0, 100)).toBe(0);
  });
  it('classifica o regime', () => {
    expect(regimeReynolds(1500)).toBe('laminar');
    expect(regimeReynolds(3000)).toBe('transicao');
    expect(regimeReynolds(50000)).toBe('turbulento');
  });
  it('sobrepressão de Joukowsky ΔP = ρ·a·v (parada súbita)', () => {
    expect(sobrepressaoGolpeKPa(2)).toBeCloseTo(2000); // 1000·1000·2/1000 = 2000 kPa
    expect(sobrepressaoGolpeKPa(1)).toBeCloseTo(1000); // 1 m/s ≈ PN10
    expect(sobrepressaoGolpeKPa(0)).toBe(0);
  });
  it('integra com a velocidade do tubo', () => {
    const v = velocidadeTuboMs(0.02, 100); // 0,02 m³/s num tubo de 100 mm
    expect(regimeReynolds(reynolds(v, 100, muAgua(20)))).toBe('turbulento');
  });
});

describe('fator de atrito de Darcy (fatorAtritoDW)', () => {
  it('laminar: f = 64/Re', () => {
    expect(fatorAtritoDW(1000, 0.0015, 100)).toBeCloseTo(0.064);
  });
  it('turbulento (Swamee-Jain): ~0,018 para tubo quase liso a Re=1e5 (Moody)', () => {
    const f = fatorAtritoDW(1e5, 0.0015, 100);
    expect(f).toBeGreaterThan(0.015);
    expect(f).toBeLessThan(0.025);
  });
  it('mais áspero → mais atrito', () => {
    expect(fatorAtritoDW(1e5, 1.0, 100)).toBeGreaterThan(fatorAtritoDW(1e5, 0.0015, 100));
  });
  it('Re ≤ 0 → 0', () => {
    expect(fatorAtritoDW(0, 0.0015, 100)).toBe(0);
  });
});

describe('coluna de pressão (colunaPressaoM)', () => {
  it('é o inverso do Teorema de Stevin (round-trip)', () => {
    expect(colunaPressaoM(pressaoHidrostaticaKPa(7))).toBeCloseTo(7, 6);
    // 10 m de coluna ≈ 98,1 kPa → volta a ~10 m.
    expect(colunaPressaoM(98.1)).toBeCloseTo(10, 1);
  });
  it('pressão ≤ 0 → 0 m', () => {
    expect(colunaPressaoM(-5)).toBe(0);
  });
});

describe('pressão de vapor da água (pvaporAguaKPa)', () => {
  it('≈ 2,34 kPa a 20 °C', () => {
    expect(pvaporAguaKPa(20)).toBeCloseTo(2.34, 1);
  });
  it('cresce com a temperatura (a água ferve mais fácil quente)', () => {
    expect(pvaporAguaKPa(80)).toBeGreaterThan(pvaporAguaKPa(20));
    expect(pvaporAguaKPa(100)).toBeGreaterThan(pvaporAguaKPa(80));
  });
});

describe('NPSH disponível (npshDisponivelM)', () => {
  it('≈ 10,1 m ao nível do mar com sucção neutra (20 °C)', () => {
    // (P_atm − P_vapor)/(ρ·g) ≈ (101,325 − 2,34)·1000 / (1000·9,81) ≈ 10,1 m
    expect(npshDisponivelM(0, pvaporAguaKPa(20))).toBeCloseTo(10.09, 1);
  });
  it('soma a carga de sucção: fonte afogada aumenta o NPSH', () => {
    const neutro = npshDisponivelM(0, pvaporAguaKPa(20));
    expect(npshDisponivelM(5, pvaporAguaKPa(20))).toBeCloseTo(neutro + 5, 6);
    expect(npshDisponivelM(-7, pvaporAguaKPa(20))).toBeCloseTo(neutro - 7, 6);
  });
  it('água mais quente (mais vapor) reduz o NPSH disponível', () => {
    expect(npshDisponivelM(0, pvaporAguaKPa(80))).toBeLessThan(npshDisponivelM(0, pvaporAguaKPa(20)));
  });
});

describe('conversão de temperatura (°C canônico ↔ exibição)', () => {
  it('°C é identidade', () => {
    const u = { volume: 'm3', comprimento: 'm', temperatura: 'C' } as const;
    expect(exibirTemperatura(20, u)).toBeCloseTo(20);
    expect(temperaturaParaSI(20, u)).toBeCloseTo(20);
    expect(labelTemperatura(u)).toBe('°C');
  });
  it('°F: 20 °C = 68 °F (round-trip)', () => {
    const u = { volume: 'm3', comprimento: 'm', temperatura: 'F' } as const;
    expect(exibirTemperatura(20, u)).toBeCloseTo(68);
    expect(temperaturaParaSI(68, u)).toBeCloseTo(20);
    expect(labelTemperatura(u)).toBe('°F');
  });
  it('K: 20 °C = 293,15 K (round-trip)', () => {
    const u = { volume: 'm3', comprimento: 'm', temperatura: 'K' } as const;
    expect(exibirTemperatura(20, u)).toBeCloseTo(293.15);
    expect(temperaturaParaSI(293.15, u)).toBeCloseTo(20);
    expect(labelTemperatura(u)).toBe('K');
  });
});
