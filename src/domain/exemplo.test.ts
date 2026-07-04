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

  it('a bomba enche o reservatório do meio E o superior (saída dividida)', () => {
    const nivel = (proj: ReturnType<typeof projetoExemplo>, id: string): number => {
      const p = proj.pecas.find((x) => x.id === id)!;
      return isReservatorio(p) ? (p.props.nivel ?? 0) : 0;
    };
    const inicial = projetoExemplo();
    const meioAntes = nivel(inicial, 'meio');
    const supAntes = nivel(inicial, 'superior');

    const r = rodarTicks(inicial, 200); // ~20 s de simulação
    expect(nivel(r.projeto, 'meio')).toBeGreaterThan(meioAntes);
    expect(nivel(r.projeto, 'superior')).toBeGreaterThan(supAntes);
  });

  it('a bomba liga sozinha pelo sensor (superior começa abaixo do mínimo)', () => {
    const r = rodarTicks(projetoExemplo(), 1);
    const bomba = r.projeto.pecas.find((x) => x.id === 'bomba')!;
    expect((bomba.props as { ligada?: boolean }).ligada).toBe(true);
  });
});
