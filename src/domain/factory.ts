/**
 * HydroFlow — Fábricas de peças e projeto (Sprint 1/3)
 *
 * Cria entidades com defaults sãos. A geração de id é injetável para manter os
 * testes determinísticos (o motor não pode usar Date.now()/Math.random()).
 */

import {
  SCHEMA_VERSION,
  type Conexao,
  type Peca,
  type ProjetoSimulacao,
  type TipoPeca,
} from './types';

let contador = 0;
/** Gerador de id determinístico e simples (suficiente para v1 client-side). */
export function novoId(prefixo = 'p'): string {
  contador += 1;
  return `${prefixo}_${contador}`;
}

/** Reinicia o contador de ids — usado por testes para saída estável. */
export function _resetContadorIds(): void {
  contador = 0;
}

export function projetoVazio(nome = 'Novo Projeto'): ProjetoSimulacao {
  return {
    nome,
    versao: SCHEMA_VERSION,
    unidades: { volume: 'litros', comprimento: 'm' },
    configuracaoSimulacao: { dt: 0.1, g: 9.81 },
    pecas: [],
    conexoes: [],
  };
}

/** Portas padrão por tipo, usadas pelo editor para pontos de conexão. */
export function portasPadrao(tipo: TipoPeca): string[] {
  switch (tipo) {
    case 'reservatorio':
      return ['topo', 'base'];
    case 'juncao':
      return ['a', 'b', 'c'];
    case 'tubo':
    case 'bomba':
      return ['entrada', 'saida'];
    case 'fonte':
      return ['saida'];
    case 'consumo':
      return ['entrada'];
    case 'sensor':
      return ['sonda'];
  }
}

/** Cria uma peça com props padrão para o tipo informado. */
export function criarPeca(
  tipo: TipoPeca,
  x: number,
  y: number,
  id = novoId(tipo.slice(0, 3)),
): Peca {
  const base = { id, tipo, x, y, portas: portasPadrao(tipo) };
  switch (tipo) {
    case 'reservatorio':
      return {
        ...base,
        props: {
          formato: 'cilindro',
          raio: 1,
          alturaMaxima: 5,
          cotaBase: 0,
          nivel: 0,
        },
      };
    case 'tubo':
      return { ...base, props: { diametro: 0.1, registro: { aberto: true } } };
    case 'bomba':
      return { ...base, props: { vazaoNominal: 10, sensores: [], ligada: false } };
    case 'fonte':
      return { ...base, props: { vazaoFixa: 5 } };
    case 'consumo':
      return { ...base, props: { vazaoDemanda: 3, aberto: true } };
    case 'sensor':
      return { ...base, props: { bombaAlvo: '', nivelMinimo: 1, nivelMaximo: 4 } };
    case 'juncao':
      return { ...base, props: {} };
  }
}

export function criarConexao(
  origem: string,
  destino: string,
  extra: Partial<Omit<Conexao, 'id' | 'origem' | 'destino'>> = {},
): Conexao {
  return { id: novoId('c'), origem, destino, ...extra };
}
