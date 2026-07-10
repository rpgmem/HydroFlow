import { describe, it, expect, beforeEach } from 'vitest';
import { validarGrafo } from './validacaoGrafo';
import {
  criarConexao,
  criarPeca,
  projetoVazio,
  _resetContadorIds,
} from '../domain/factory';
import type { Peca, ProjetoSimulacao } from '../domain/types';

beforeEach(() => _resetContadorIds());

function proj(pecas: Peca[], conexoes: ProjetoSimulacao['conexoes'] = []): ProjetoSimulacao {
  return { ...projetoVazio(), pecas, conexoes };
}

describe('validação de grafo — bloqueios', () => {
  it('rejeita nó órfão (peça sem conexão)', () => {
    const orfa = criarPeca('reservatorio', 0, 0, 'R1');
    const r = validarGrafo(proj([orfa]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.some((e) => e.mensagem.includes('órfã'))).toBe(true);
  });

  it('anexa chave i18n + params (para a UI traduzir), mantendo a mensagem pt', () => {
    const orfa = criarPeca('reservatorio', 0, 0, 'R1');
    const r = validarGrafo(proj([orfa]));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const e = r.erros.find((x) => x.chave === 'validacao.orfa');
      expect(e).toBeDefined();
      expect(e!.params).toMatchObject({ id: 'R1', tipoKey: 'reservatorio' });
      expect(e!.mensagem).toContain('órfã'); // fallback pt preservado (motor puro)
    }
  });

  it('rejeita ids de conexão duplicados', () => {
    const a = criarPeca('reservatorio', 0, 0, 'A');
    const b = criarPeca('reservatorio', 0, 0, 'B');
    const c1 = criarConexao('A', 'B');
    const c2 = { ...criarConexao('A', 'B'), id: c1.id }; // mesmo id
    const r = validarGrafo(proj([a, b], [c1, c2]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.some((e) => e.mensagem.includes('id de conexão duplicado'))).toBe(true);
  });

  it('rejeita aresta com origem/destino inexistente', () => {
    const r = criarPeca('reservatorio', 0, 0, 'R1');
    const res = validarGrafo(proj([r], [criarConexao('R1', 'FANTASMA')]));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.erros.some((e) => e.mensagem.includes('não corresponde'))).toBe(true);
  });

  it('rejeita ciclo moto-perpétuo (bomba em loop sem dreno)', () => {
    const a = criarPeca('reservatorio', 0, 0, 'A');
    const b = criarPeca('reservatorio', 0, 0, 'B');
    const p = criarPeca('bomba', 0, 0, 'P');
    const t = criarPeca('tubo', 0, 0, 'T');
    // A → P → B → T → A : ciclo fechado com bomba, sem saída.
    const r = validarGrafo(
      proj(
        [a, b, p, t],
        [criarConexao('A', 'P'), criarConexao('P', 'B'), criarConexao('B', 'T'), criarConexao('T', 'A')],
      ),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.some((e) => e.mensagem.includes('moto-perpétuo'))).toBe(true);
  });

  it('rejeita fonte com soma de vazaoAlocada > vazaoFixa', () => {
    const f = criarPeca('fonte', 0, 0, 'F');
    (f.props as { vazaoFixa: number }).vazaoFixa = 10;
    const b = criarPeca('reservatorio', 0, 0, 'B');
    const c = criarPeca('reservatorio', 0, 0, 'C');
    const r = validarGrafo(
      proj(
        [f, b, c],
        [
          criarConexao('F', 'B', { vazaoAlocada: 6 }),
          criarConexao('F', 'C', { vazaoAlocada: 6 }), // soma 12 > 10
        ],
      ),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.some((e) => e.mensagem.includes('excede'))).toBe(true);
  });

  it('rejeita quadro sem efeito (não comanda nenhuma bomba)', () => {
    // Quadro com uma boia-membro mas SEM canal de bomba → não faz nada.
    const f = criarPeca('fonte', 0, 0, 'F');
    const res = criarPeca('reservatorio', 0, 0, 'R');
    const s = criarPeca('sensor', 0, 0, 'S');
    const q: Peca = { id: 'Q', tipo: 'quadro', x: 0, y: 0, portas: [], props: { canais: [], sensores: ['S'] } };
    const r = validarGrafo(proj([f, res, s, q], [criarConexao('F', 'R'), criarConexao('S', 'R')]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.some((e) => e.chave === 'validacao.quadroSemEfeito')).toBe(true);
  });
});

describe('validação de grafo — permitidos', () => {
  it('permite fonte com múltiplos destinos dentro da vazão', () => {
    const f = criarPeca('fonte', 0, 0, 'F');
    (f.props as { vazaoFixa: number }).vazaoFixa = 10;
    const b = criarPeca('reservatorio', 0, 0, 'B');
    const c = criarPeca('reservatorio', 0, 0, 'C');
    const r = validarGrafo(
      proj(
        [f, b, c],
        [
          criarConexao('F', 'B', { vazaoAlocada: 4 }),
          criarConexao('F', 'C', { vazaoAlocada: 6 }),
        ],
      ),
    );
    expect(r.ok).toBe(true);
  });

  it('permite múltiplos sensores na mesma bomba', () => {
    const a = criarPeca('reservatorio', 0, 0, 'A');
    const d = criarPeca('reservatorio', 0, 0, 'D');
    const p = criarPeca('bomba', 0, 0, 'P');
    const s1 = criarPeca('sensor', 0, 0, 'S1');
    const s2 = criarPeca('sensor', 0, 0, 'S2');
    (s1.props as { bombasAlvo: string[] }).bombasAlvo = ['P'];
    (s2.props as { bombasAlvo: string[] }).bombasAlvo = ['P'];
    const r = validarGrafo(
      proj(
        [a, d, p, s1, s2],
        [
          criarConexao('A', 'P'),
          criarConexao('P', 'D'),
          criarConexao('S1', 'A'),
          criarConexao('S2', 'D'),
        ],
      ),
    );
    expect(r.ok).toBe(true);
  });

  it('permite ciclo com bomba se houver dreno para fora', () => {
    const a = criarPeca('reservatorio', 0, 0, 'A');
    const b = criarPeca('reservatorio', 0, 0, 'B');
    const p = criarPeca('bomba', 0, 0, 'P');
    const t = criarPeca('tubo', 0, 0, 'T');
    const dreno = criarPeca('reservatorio', 0, 0, 'DRENO');
    const t2 = criarPeca('tubo', 0, 0, 'T2');
    const r = validarGrafo(
      proj(
        [a, b, p, t, dreno, t2],
        [
          criarConexao('A', 'P'),
          criarConexao('P', 'B'),
          criarConexao('B', 'T'),
          criarConexao('T', 'A'),
          criarConexao('B', 'T2'), // dreno sai do ciclo
          criarConexao('T2', 'DRENO'),
        ],
      ),
    );
    expect(r.ok).toBe(true);
  });

  it('sensor apontando para bomba existente não é órfão mesmo sem conexão', () => {
    const p = criarPeca('bomba', 0, 0, 'P');
    const a = criarPeca('reservatorio', 0, 0, 'A');
    const d = criarPeca('reservatorio', 0, 0, 'D');
    const s = criarPeca('sensor', 0, 0, 'S');
    (s.props as { bombasAlvo: string[] }).bombasAlvo = ['P'];
    const r = validarGrafo(
      proj([p, a, d, s], [criarConexao('A', 'P'), criarConexao('P', 'D')]),
    );
    expect(r.ok).toBe(true);
  });
});
