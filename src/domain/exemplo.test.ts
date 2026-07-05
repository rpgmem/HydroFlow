import { describe, it, expect } from 'vitest';
import { projetoExemplo } from './exemplo';
import { validarGrafo } from '../engine/validacaoGrafo';
import { rodarTicks } from '../engine/simulador';
import { isReservatorio } from './types';

describe('projeto de exemplo (reservatórios empilhados)', () => {
  it('passa na validação de grafo', () => {
    expect(validarGrafo(projetoExemplo()).ok).toBe(true);
  });

  it('tem três reservatórios cilíndricos empilhados', () => {
    const reservatorios = projetoExemplo().pecas.filter(isReservatorio);
    expect(reservatorios).toHaveLength(3);
    expect(reservatorios.every((r) => r.props.formato === 'cilindro')).toBe(true);
    const cotas = reservatorios.map((r) => r.props.cotaBase).sort((a, b) => a - b);
    expect(cotas[0]! < cotas[1]! && cotas[1]! < cotas[2]!).toBe(true); // empilhados
  });

  it('a fonte reabastece o reservatório inferior (bomba desligada pelo sensor reverso)', () => {
    const nivel = (proj: ReturnType<typeof projetoExemplo>, id: string): number => {
      const p = proj.pecas.find((x) => x.id === id)!;
      return isReservatorio(p) ? (p.props.nivel ?? 0) : 0;
    };
    const inicial = projetoExemplo();
    const infAntes = nivel(inicial, 'inferior'); // 2 m — no mínimo do sensor reverso
    const r = rodarTicks(inicial, 600); // ~60 s de simulação
    // O sensor reverso do inferior desliga a bomba (inferior no mínimo); a fonte
    // enche o inferior, então o nível SOBE.
    expect(nivel(r.projeto, 'inferior')).toBeGreaterThan(infAntes);
  });

  it('simula sem gerar níveis inválidos (finitos e não-negativos)', () => {
    const r = rodarTicks(projetoExemplo(), 1000);
    for (const p of r.projeto.pecas.filter(isReservatorio)) {
      expect(Number.isFinite(p.props.nivel ?? 0)).toBe(true);
      expect(p.props.nivel ?? 0).toBeGreaterThanOrEqual(0);
    }
  });

  it('o sensor reverso do inferior desliga a bomba no nível inicial', () => {
    const r = rodarTicks(projetoExemplo(), 1);
    const bomba = r.projeto.pecas.find((x) => x.id === 'bomba')!;
    // inferior = 2 = mínimo do sensor reverso → 'desligar' vence o pedido do
    // sensor do superior → a bomba fica parada (protegida), sem "rodar a seco".
    expect((bomba.props as { ligada?: boolean }).ligada).toBe(false);
    expect(r.vazoes['succao'] ?? 0).toBe(0);
    expect(r.bombasASeco).not.toContain('bomba');
  });
});
