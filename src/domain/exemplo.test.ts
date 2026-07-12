import { describe, it, expect } from 'vitest';
import { projetoExemplo } from './exemplo';
import { validarGrafo } from '../engine/validacaoGrafo';
import { rodarTicks } from '../engine/simulador';
import { isReservatorio, isTubo } from './types';
import { bitolaPorDn } from './tubosCatalogo';

describe('projeto de exemplo (reservatórios empilhados)', () => {
  it('passa na validação de grafo', () => {
    expect(validarGrafo(projetoExemplo()).ok).toBe(true);
  });

  it('tem três reservatórios cilíndricos empilhados', () => {
    const reservatorios = projetoExemplo().pecas.filter(isReservatorio);
    expect(reservatorios).toHaveLength(3);
    expect(reservatorios.every((r) => r.props.formato === 'cilindro')).toBe(true);
    const cotas = reservatorios.map((r) => r.cota ?? 0).sort((a, b) => a - b);
    expect(cotas[0]! < cotas[1]! && cotas[1]! < cotas[2]!).toBe(true); // empilhados
  });

  it('os tubos com bitola usam o diâmetro interno tabelado', () => {
    for (const t of projetoExemplo().pecas.filter(isTubo)) {
      if (t.props.bitola) {
        const b = bitolaPorDn(t.props.bitola);
        expect(b, `bitola ${t.props.bitola} existe no catálogo`).toBeDefined();
        expect(t.props.diametro).toBe(b!.internoMm);
      }
    }
  });

  it('a bomba de recalque liga no nível inicial (recalca para o superior)', () => {
    // Estado inicial de operação: inferior alto (liberado pela boia reversa) e
    // superior abaixo do máximo → a bomba está ligada recalcando, sem rodar a seco.
    const r = rodarTicks(projetoExemplo(), 1);
    const bomba = r.projeto.pecas.find((x) => x.id === 'bomba_recalque')!;
    expect((bomba.props as { ligada?: boolean }).ligada).toBe(true);
    expect(r.vazoes['cano_de_succao'] ?? 0).toBeGreaterThan(0);
    expect(r.bombasASeco).not.toContain('bomba_recalque');
  });

  it('simula sem gerar níveis inválidos (finitos e não-negativos)', () => {
    const r = rodarTicks(projetoExemplo(), 1000);
    for (const p of r.projeto.pecas.filter(isReservatorio)) {
      expect(Number.isFinite(p.props.nivel ?? 0)).toBe(true);
      expect(p.props.nivel ?? 0).toBeGreaterThanOrEqual(0);
    }
  });

  it('o sensor reverso do inferior desliga a bomba quando a sucção esvazia', () => {
    // Proteção da origem: forçando o inferior no mínimo do sensor reverso (2 m),
    // o 'desligar' vence e a bomba para — sem rodar a seco.
    const proj = projetoExemplo();
    const inf = proj.pecas.find((x) => x.id === 'inferior_75_000_l')!;
    (inf.props as { nivel?: number }).nivel = 2;
    const r = rodarTicks(proj, 1);
    const bomba = r.projeto.pecas.find((x) => x.id === 'bomba_recalque')!;
    expect((bomba.props as { ligada?: boolean }).ligada).toBe(false);
    expect(r.vazoes['cano_de_succao'] ?? 0).toBe(0);
    expect(r.bombasASeco).not.toContain('bomba_recalque');
  });
});
