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

  it('a fonte reabastece o reservatório inferior (sucção protegida pela boia reversa)', () => {
    const nivel = (proj: ReturnType<typeof projetoExemplo>, id: string): number => {
      const p = proj.pecas.find((x) => x.id === id)!;
      return isReservatorio(p) ? (p.props.nivel ?? 0) : 0;
    };
    const inicial = projetoExemplo();
    const infAntes = nivel(inicial, 'inferior'); // 2 m — no mínimo da boia reversa
    const r = rodarTicks(inicial, 600); // ~60 s de simulação
    // A boia reversa da sucção está fechada (inferior no mínimo), a bomba não
    // puxa; a fonte enche o inferior, então o nível SOBE.
    expect(nivel(r.projeto, 'inferior')).toBeGreaterThan(infAntes);
  });

  it('simula sem gerar níveis inválidos (finitos e não-negativos)', () => {
    const r = rodarTicks(projetoExemplo(), 1000);
    for (const p of r.projeto.pecas.filter(isReservatorio)) {
      expect(Number.isFinite(p.props.nivel ?? 0)).toBe(true);
      expect(p.props.nivel ?? 0).toBeGreaterThanOrEqual(0);
    }
  });

  it('a boia reversa da sucção protege o inferior no nível inicial', () => {
    const r = rodarTicks(projetoExemplo(), 1);
    // inferior = 2 = mínimo da boia reversa da sucção → sucção fechada: a bomba
    // não puxa e NÃO é sinalizada "a seco" (é proteção, não falta d'água).
    expect(r.vazoes['succao'] ?? 0).toBe(0);
    expect(r.boiasFechadas).toContain('succao');
    expect(r.bombasASeco).not.toContain('bomba');
  });
});
