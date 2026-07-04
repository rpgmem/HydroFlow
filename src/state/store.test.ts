import { describe, it, expect, beforeEach } from 'vitest';
import { reducer, estadoInicial, type EstadoApp } from './store';
import {
  criarConexao,
  criarPeca,
  projetoVazio,
  _resetContadorIds,
} from '../domain/factory';
import type { ProjetoSimulacao, PropsReservatorio } from '../domain/types';

beforeEach(() => _resetContadorIds());

/** Grafo válido mínimo: fonte → reservatório (sem órfãos, sem ciclo). */
function projetoValido(): ProjetoSimulacao {
  const f = criarPeca('fonte', 0, 0, 'F');
  const r = criarPeca('reservatorio', 100, 0, 'R');
  return {
    ...projetoVazio(),
    pecas: [f, r],
    conexoes: [criarConexao('F', 'R')],
  };
}

function comEstado(projeto: ProjetoSimulacao): EstadoApp {
  return estadoInicial(projeto);
}

describe('mutação de grafo por modo', () => {
  it('permite adicionar peça em edição', () => {
    const e = reducer(comEstado(projetoVazio()), {
      tipo: 'ADD_PECA',
      peca: criarPeca('reservatorio', 0, 0, 'X'),
    });
    expect(e.projeto.pecas).toHaveLength(1);
  });

  it('bloqueia mutação estrutural do grafo em execução', () => {
    let e = reducer(comEstado(projetoValido()), { tipo: 'ENTRAR_EXECUCAO' });
    expect(e.modo).toBe('execucao');
    const antes = e.projeto.pecas.length;
    e = reducer(e, { tipo: 'ADD_PECA', peca: criarPeca('bomba', 0, 0, 'B') });
    expect(e.projeto.pecas).toHaveLength(antes); // ignorado
    e = reducer(e, { tipo: 'REMOVER_PECA', id: 'F' });
    expect(e.projeto.pecas).toHaveLength(antes); // ignorado
    e = reducer(e, { tipo: 'ADD_CONEXAO', conexao: criarConexao('F', 'R') });
    expect(e.projeto.conexoes).toHaveLength(1); // ignorado
  });

  it('permite ajustar valores (ATUALIZAR_PROPS) em execução', () => {
    let e = reducer(comEstado(projetoValido()), { tipo: 'ENTRAR_EXECUCAO' });
    e = reducer(e, {
      tipo: 'ATUALIZAR_PROPS',
      id: 'R',
      props: { alturaMaxima: 99 },
    });
    const r = e.projeto.pecas.find((p) => p.id === 'R')!.props as PropsReservatorio;
    expect(r.alturaMaxima).toBe(99);
  });
});

describe('validação impede execução com erro', () => {
  it('não entra em execução com nó órfão; expõe os erros', () => {
    const orfa = criarPeca('reservatorio', 0, 0, 'SOLO');
    const est = comEstado({ ...projetoVazio(), pecas: [orfa] });
    const e = reducer(est, { tipo: 'ENTRAR_EXECUCAO' });
    expect(e.modo).toBe('edicao'); // permaneceu em edição
    expect(e.errosValidacao.length).toBeGreaterThan(0);
  });

  it('limpa os erros ao entrar com grafo válido', () => {
    let e = comEstado({ ...projetoVazio(), pecas: [criarPeca('reservatorio', 0, 0, 'X')] });
    e = reducer(e, { tipo: 'ENTRAR_EXECUCAO' }); // falha, popula erros
    expect(e.errosValidacao.length).toBeGreaterThan(0);
    e = reducer(comEstado(projetoValido()), { tipo: 'ENTRAR_EXECUCAO' });
    expect(e.errosValidacao).toHaveLength(0);
    expect(e.modo).toBe('execucao');
  });
});

describe('transição execução → edição', () => {
  it('exige pause: SAIR_EXECUCAO é ignorado enquanto rodando', () => {
    let e = reducer(comEstado(projetoValido()), { tipo: 'ENTRAR_EXECUCAO' });
    e = reducer(e, { tipo: 'PLAY' });
    expect(e.rodando).toBe(true);
    e = reducer(e, { tipo: 'SAIR_EXECUCAO' });
    expect(e.modo).toBe('execucao'); // não saiu enquanto rodando
    e = reducer(e, { tipo: 'PAUSE' });
    e = reducer(e, { tipo: 'SAIR_EXECUCAO' });
    expect(e.modo).toBe('edicao'); // agora sim
  });

  it('RESET restaura o snapshot de edição', () => {
    let e = reducer(comEstado(projetoValido()), { tipo: 'ENTRAR_EXECUCAO' });
    e = reducer(e, { tipo: 'PLAY' });
    e = reducer(e, { tipo: 'TICK' }); // altera níveis
    const nivelDepois = (e.projeto.pecas.find((p) => p.id === 'R')!.props as PropsReservatorio).nivel;
    expect(nivelDepois).toBeGreaterThan(0);
    e = reducer(e, { tipo: 'RESET' });
    const nivelReset = (e.projeto.pecas.find((p) => p.id === 'R')!.props as PropsReservatorio).nivel;
    expect(nivelReset).toBe(0);
    expect(e.tempo).toBe(0);
    expect(e.rodando).toBe(false);
  });
});

describe('controle de velocidade e loop', () => {
  it('TICK avança N passos conforme a velocidade', () => {
    let e = reducer(comEstado(projetoValido()), { tipo: 'ENTRAR_EXECUCAO' });
    e = reducer(e, { tipo: 'SET_VELOCIDADE', velocidade: 5 });
    e = reducer(e, { tipo: 'PLAY' });
    e = reducer(e, { tipo: 'TICK' });
    expect(e.tempo).toBeCloseTo(0.5, 9); // 5 · dt(0.1)
  });

  it('TICK é no-op quando pausado', () => {
    let e = reducer(comEstado(projetoValido()), { tipo: 'ENTRAR_EXECUCAO' });
    e = reducer(e, { tipo: 'TICK' }); // rodando=false
    expect(e.tempo).toBe(0);
  });
});
