import { describe, it, expect } from 'vitest';
import { CATALOGO_TUBOS, bitolaPorDn, rotuloBitola } from './tubosCatalogo';

describe('catálogo de bitolas de tubo', () => {
  it('tem DNs únicos e internos positivos e crescentes', () => {
    const dns = CATALOGO_TUBOS.map((b) => b.dn);
    expect(new Set(dns).size).toBe(dns.length); // sem duplicados
    for (const b of CATALOGO_TUBOS) {
      expect(b.internoMm).toBeGreaterThan(0);
    }
    const internos = CATALOGO_TUBOS.map((b) => b.internoMm);
    const ordenados = [...internos].sort((a, b) => a - b);
    expect(internos).toEqual(ordenados); // ordem crescente
  });

  it('o interno é sempre menor que o nominal (bore < DN)', () => {
    for (const b of CATALOGO_TUBOS) {
      const nominal = parseFloat(b.nominal); // "110 mm" → 110
      expect(b.internoMm).toBeLessThan(nominal);
    }
  });

  it('bitolaPorDn resolve o interno tabelado', () => {
    expect(bitolaPorDn('DN110')?.internoMm).toBe(97.8);
    expect(bitolaPorDn('DN50')?.internoMm).toBe(44.0);
    expect(bitolaPorDn('DN250')?.internoMm).toBe(230.0);
    expect(bitolaPorDn('inexistente')).toBeUndefined();
    expect(bitolaPorDn(undefined)).toBeUndefined();
  });

  it('marca a Junta Elástica como aproximada e a Soldável Fria como exata', () => {
    expect(bitolaPorDn('DN110')?.aproximado).toBeUndefined(); // soldável = exato
    expect(bitolaPorDn('DN160')?.aproximado).toBe(true); // junta elástica = aprox.
    expect(rotuloBitola(bitolaPorDn('DN160')!)).toContain('~'); // rótulo sinaliza aprox.
  });
});
