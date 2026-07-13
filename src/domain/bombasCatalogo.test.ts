import { describe, it, expect } from 'vitest';
import { CATALOGO_BOMBAS, GRUPOS_BOMBA, modeloBombaPorId } from './bombasCatalogo';

describe('catálogo de bombas', () => {
  it('tem ids únicos', () => {
    const ids = CATALOGO_BOMBAS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tem os dois grupos e todo modelo pertence a um deles', () => {
    for (const m of CATALOGO_BOMBAS) expect(GRUPOS_BOMBA).toContain(m.grupo);
    expect(CATALOGO_BOMBAS.some((m) => m.grupo === 'superficie')).toBe(true);
    expect(CATALOGO_BOMBAS.some((m) => m.grupo === 'submergivel')).toBe(true);
  });

  it('guarda a vazão nominal já em SI (m³/h ÷ 3600)', () => {
    const centr1cv = modeloBombaPorId('sup-centr-1-0');
    expect(centr1cv).toBeDefined();
    expect(centr1cv!.vazaoNominal).toBeCloseTo(8.0 / 3600, 9); // 8 m³/h
    expect(centr1cv!.alturaNominal).toBe(18);
  });

  it('submergíveis usam NPSH 0,30 m (operar afogadas)', () => {
    const subs = CATALOGO_BOMBAS.filter((m) => m.grupo === 'submergivel');
    expect(subs.length).toBeGreaterThan(0);
    expect(subs.every((m) => m.npshRequerido === 0.3)).toBe(true);
  });

  it('a injetora não tem NPSH (N/A)', () => {
    expect(modeloBombaPorId('sup-injet-1-0')!.npshRequerido).toBeUndefined();
  });

  it('deriva a potência em W da CV (1 CV = 735,49875 W)', () => {
    expect(modeloBombaPorId('sup-centr-1-0')!.potenciaW).toBe(735); // 1,0 CV
    expect(modeloBombaPorId('sup-perif-0-25')!.potenciaW).toBe(184); // 0,25 CV → 183,9 ≈ 184
    expect(modeloBombaPorId('sup-centr-10')!.potenciaW).toBe(7355); // 10,0 CV
  });

  it('o rótulo é "{Tipo} {Potência} CV"', () => {
    for (const m of CATALOGO_BOMBAS) {
      expect(m.nome).toBe(`${m.tipo} ${m.potenciaCV} CV`);
    }
  });

  it('modeloBombaPorId retorna undefined para id ausente/desconhecido', () => {
    expect(modeloBombaPorId(undefined)).toBeUndefined();
    expect(modeloBombaPorId('nao-existe')).toBeUndefined();
  });
});
