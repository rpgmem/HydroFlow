import { describe, it, expect, beforeEach } from 'vitest';
import { reducer, estadoInicial, type EstadoApp } from './store';
import {
  criarConexao,
  criarPeca,
  projetoVazio,
  _resetContadorIds,
} from '../domain/factory';
import type { ProjetoSimulacao, PropsReservatorio, PropsTubo } from '../domain/types';

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

describe('comandos de operação em execução', () => {
  // Grafo válido com um tubo (registro operável): F → T → R.
  function projetoComTubo(): ProjetoSimulacao {
    return {
      ...projetoVazio(),
      pecas: [criarPeca('fonte', 0, 0, 'F'), criarPeca('tubo', 50, 0, 'T'), criarPeca('reservatorio', 100, 0, 'R')],
      conexoes: [criarConexao('F', 'T'), criarConexao('T', 'R')],
    };
  }
  const registroDe = (e: EstadoApp): boolean | undefined =>
    (e.projeto.pecas.find((p) => p.id === 'T')!.props as PropsTubo).registro?.aberto;

  it('um comando entra no log, mas não gera histórico de desfazer', () => {
    let e = reducer(comEstado(projetoComTubo()), { tipo: 'ENTRAR_EXECUCAO' });
    const undoAntes = e.undoStack.length;
    e = reducer(e, { tipo: 'ATUALIZAR_PROPS', id: 'T', props: { registro: { aberto: false } } });
    expect(e.eventos.some((ev) => ev.tipo === 'comando' && ev.chave === 'log.cmdRegistroFechado')).toBe(true);
    expect(e.undoStack.length).toBe(undoAntes); // não empilhou undo
  });

  it('o comando persiste ao RESET e ao voltar para a edição', () => {
    let e = reducer(comEstado(projetoComTubo()), { tipo: 'ENTRAR_EXECUCAO' });
    e = reducer(e, { tipo: 'ATUALIZAR_PROPS', id: 'T', props: { registro: { aberto: false } } });
    expect(registroDe(reducer(e, { tipo: 'RESET' }))).toBe(false); // RESET mantém o comando
    const rEdit = reducer(e, { tipo: 'SAIR_EXECUCAO' });
    expect(rEdit.modo).toBe('edicao');
    expect(registroDe(rEdit)).toBe(false); // persiste na edição
  });

  it('em edição, ATUALIZAR_PROPS não gera log e entra no undo', () => {
    let e = comEstado(projetoComTubo());
    e = reducer(e, { tipo: 'ATUALIZAR_PROPS', id: 'T', props: { registro: { aberto: false } } });
    expect(e.eventos).toHaveLength(0);
    expect(e.undoStack).toHaveLength(1);
  });
});

describe('desfazer / refazer (undo/redo)', () => {
  it('desfaz e refaz uma edição', () => {
    let e = comEstado(projetoVazio());
    e = reducer(e, { tipo: 'ADD_PECA', peca: criarPeca('reservatorio', 0, 0, 'X') });
    expect(e.projeto.pecas).toHaveLength(1);
    e = reducer(e, { tipo: 'UNDO' });
    expect(e.projeto.pecas).toHaveLength(0); // voltou ao estado anterior
    e = reducer(e, { tipo: 'REDO' });
    expect(e.projeto.pecas).toHaveLength(1); // refez
  });

  it('uma nova edição limpa a pilha de refazer', () => {
    let e = comEstado(projetoVazio());
    e = reducer(e, { tipo: 'ADD_PECA', peca: criarPeca('reservatorio', 0, 0, 'A') });
    e = reducer(e, { tipo: 'UNDO' });
    expect(e.redoStack).toHaveLength(1);
    e = reducer(e, { tipo: 'ADD_PECA', peca: criarPeca('bomba', 0, 0, 'B') });
    expect(e.redoStack).toHaveLength(0); // nova edição descarta o redo
  });

  it('UNDO sem histórico não faz nada', () => {
    const e = comEstado(projetoVazio());
    expect(reducer(e, { tipo: 'UNDO' })).toBe(e);
  });

  it('não registra histórico durante a execução', () => {
    let e = reducer(comEstado(projetoValido()), { tipo: 'ENTRAR_EXECUCAO' });
    e = reducer(e, { tipo: 'ATUALIZAR_PROPS', id: 'R', props: { alturaMaxima: 42 } });
    expect(e.undoStack).toHaveLength(0); // execução não empilha
  });
});

describe('renomear e selecionar conexão', () => {
  it('RENOMEAR_PECA altera o rótulo mantendo o id estável', () => {
    let e = comEstado(projetoVazio());
    e = reducer(e, { tipo: 'ADD_PECA', peca: criarPeca('bomba', 0, 0, 'b1') });
    e = reducer(e, { tipo: 'RENOMEAR_PECA', id: 'b1', rotulo: 'Bomba principal' });
    const p = e.projeto.pecas.find((x) => x.id === 'b1')!;
    expect(p.id).toBe('b1');
    expect(p.rotulo).toBe('Bomba principal');
  });

  it('selecionar conexão limpa a seleção de peça e vice-versa', () => {
    let e = comEstado(projetoValido());
    e = reducer(e, { tipo: 'SELECIONAR', id: 'F' });
    expect(e.selecionada).toBe('F');
    e = reducer(e, { tipo: 'SELECIONAR_CONEXAO', id: 'x' });
    expect(e.selecionada).toBeNull();
    expect(e.conexaoSelecionada).toBe('x');
    e = reducer(e, { tipo: 'SELECIONAR', id: 'R' });
    expect(e.conexaoSelecionada).toBeNull();
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
