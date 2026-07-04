import { describe, it, expect, beforeEach } from 'vitest';
import {
  novoId,
  sincronizarContador,
  projetoVazio,
  criarPeca,
  criarConexao,
  _resetContadorIds,
} from './factory';

beforeEach(() => _resetContadorIds());

describe('sincronizarContador (evita ids duplicados após carregar)', () => {
  it('avança o contador para além do maior sufixo numérico presente', () => {
    const proj = {
      ...projetoVazio(),
      pecas: [criarPeca('tubo', 0, 0, 'tub_85')],
      conexoes: [{ id: 'c_16', origem: 'a', destino: 'b' }],
    };
    sincronizarContador(proj);
    expect(novoId('c')).toBe('c_86'); // > 85 (maior sufixo) → sem colisão
  });

  it('ids gerados após sincronizar não colidem com os existentes', () => {
    const proj = {
      ...projetoVazio(),
      pecas: [criarPeca('reservatorio', 0, 0, 'inferior')],
      conexoes: [
        criarConexao('a', 'b'), // c_1
        criarConexao('a', 'b'), // c_2
      ],
    };
    const existentes = new Set(proj.conexoes.map((c) => c.id));
    sincronizarContador(proj);
    const novo = criarConexao('a', 'b').id;
    expect(existentes.has(novo)).toBe(false);
  });

  it('nunca reduz o contador', () => {
    novoId(); // p_1
    novoId(); // p_2
    sincronizarContador(projetoVazio()); // vazio → não reduz
    expect(novoId()).toBe('p_3');
  });
});
