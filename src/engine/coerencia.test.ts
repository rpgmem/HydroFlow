import { describe, it, expect, beforeEach } from 'vitest';
import { avisosCoerencia, desnivelTuboM } from './coerencia';
import { GrafoIndex } from './grafo';
import { projetoVazio, criarConexao, _resetContadorIds } from '../domain/factory';
import type { Peca, ProjetoSimulacao, PropsReservatorio, PropsTubo } from '../domain/types';

function res(id: string, cota: number, alturaMaxima: number): Peca {
  return {
    id,
    tipo: 'reservatorio',
    x: 0,
    y: 0,
    cota,
    props: { formato: 'retangular', largura: 10, comprimento: 10, alturaMaxima, nivel: 0 } as PropsReservatorio,
  };
}
function tubo(id: string, props: Partial<PropsTubo> = {}): Peca {
  return { id, tipo: 'tubo', x: 0, y: 0, props: { diametro: 100, ...props } };
}
function projeto(pecas: Peca[], conexoes = projetoVazio().conexoes, atrito = false): ProjetoSimulacao {
  return {
    ...projetoVazio(),
    unidades: { volume: 'm3', comprimento: 'm' },
    configuracaoSimulacao: { ...projetoVazio().configuracaoSimulacao, atrito },
    pecas,
    conexoes,
  };
}

beforeEach(() => _resetContadorIds());

describe('desnivelTuboM', () => {
  it('mede o desnível entre reservatórios (cota + tomada)', () => {
    const p = projeto(
      [res('A', 0, 5), res('B', 20, 5), tubo('T')],
      [criarConexao('A', 'T'), criarConexao('T', 'B')],
    );
    const T = p.pecas.find((x) => x.id === 'T') as Peca & { tipo: 'tubo' };
    expect(desnivelTuboM(new GrafoIndex(p), T as never)).toBeCloseTo(20);
  });
  it('é indefinido quando uma ponta é junção (elevação desconhecida)', () => {
    const p = projeto(
      [res('A', 0, 5), { id: 'J', tipo: 'juncao', x: 0, y: 0, props: {} }, tubo('T')],
      [criarConexao('A', 'T'), criarConexao('T', 'J')],
    );
    const T = p.pecas.find((x) => x.id === 'T') as Peca & { tipo: 'tubo' };
    expect(desnivelTuboM(new GrafoIndex(p), T as never)).toBeUndefined();
  });
});

describe('avisosCoerencia', () => {
  it('avisa comprimento menor que o desnível (com atrito)', () => {
    const p = projeto(
      [res('A', 0, 5), res('B', 20, 5), tubo('T', { comprimento: 5 })],
      [criarConexao('A', 'T'), criarConexao('T', 'B')],
      true,
    );
    const avisos = avisosCoerencia(p);
    expect(avisos.some((a) => a.chave === 'coerencia.comprimentoCurto')).toBe(true);
  });
  it('não avisa comprimento sem atrito (o comprimento não é usado)', () => {
    const p = projeto(
      [res('A', 0, 5), res('B', 20, 5), tubo('T', { comprimento: 5 })],
      [criarConexao('A', 'T'), criarConexao('T', 'B')],
      false,
    );
    expect(avisosCoerencia(p).some((a) => a.chave === 'coerencia.comprimentoCurto')).toBe(false);
  });
  it('não avisa quando o comprimento cobre o desnível', () => {
    const p = projeto(
      [res('A', 0, 5), res('B', 20, 5), tubo('T', { comprimento: 22 })],
      [criarConexao('A', 'T'), criarConexao('T', 'B')],
      true,
    );
    expect(avisosCoerencia(p).some((a) => a.chave === 'coerencia.comprimentoCurto')).toBe(false);
  });
  it('avisa tomada acima do topo do reservatório', () => {
    const p = projeto(
      [res('A', 0, 5), res('B', 0, 5), tubo('T', { alturaSaida: 8 })],
      [criarConexao('A', 'T'), criarConexao('T', 'B')],
    );
    const avisos = avisosCoerencia(p);
    expect(avisos.some((a) => a.chave === 'coerencia.tomadaAcima')).toBe(true);
  });
  it('não avisa tomada dentro da altura do reservatório', () => {
    const p = projeto(
      [res('A', 0, 5), res('B', 0, 10), tubo('T', { alturaSaida: 8 })],
      [criarConexao('A', 'T'), criarConexao('T', 'B')],
    );
    expect(avisosCoerencia(p).some((a) => a.chave === 'coerencia.tomadaAcima')).toBe(false);
  });
});
