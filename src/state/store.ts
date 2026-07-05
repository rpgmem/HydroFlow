/**
 * HydroFlow — Estado da aplicação (Sprint 4)
 *
 * Reducer puro que orquestra os dois modos de operação (seção 6):
 *  - 'edicao':   grafo mutável (add/remove peça, conexão, mover no canvas).
 *  - 'execucao': grafo estruturalmente IMUTÁVEL — só valores mudam (nível,
 *                vazão, registro, bomba on/off, thresholds de sensor).
 *
 * A transição edição→execução roda a validação de grafo (seção 5) e só avança
 * se passar. A transição execução→edição exige pause/reset primeiro.
 *
 * O reducer é puro e independente de React (o loop de render vive no
 * componente), o que o torna diretamente testável no Vitest.
 */

import type { ErroValidacao } from '../domain/schema';
import { validarGrafo } from '../engine/validacaoGrafo';
import { rodarTicks, type ResultadoTick } from '../engine/simulador';
import type { Decisao } from '../engine/arbitragem';
import { sincronizarContador } from '../domain/factory';
import {
  isBomba,
  isSensor,
  isTubo,
  type Conexao,
  type ModoSistema,
  type Peca,
  type ProjetoSimulacao,
  type PropsPorTipo,
} from '../domain/types';

/** Uma entrada do log de eventos (acionamentos e alertas ao longo da execução). */
export type TipoEvento = 'bomba' | 'sensor' | 'seco' | 'ladrao' | 'deficit' | 'overflow';
export interface EventoLog {
  /** Tempo de simulação (s) em que o evento ocorreu. */
  tempo: number;
  tipo: TipoEvento;
  mensagem: string;
}

const MAX_EVENTOS = 300;

// Multiplicador de ticks por frame. Valores altos permitem acompanhar cenários
// realistas (vazões em L/s enchendo tanques de milhares de litros) em segundos.
export type Velocidade = 1 | 5 | 30 | 120;

export interface EstadoApp {
  projeto: ProjetoSimulacao;
  modo: ModoSistema;
  /** true = simulação avançando (play); false = pausada. Só em execução. */
  rodando: boolean;
  velocidade: Velocidade;
  tempo: number;
  errosValidacao: ErroValidacao[];
  vazoes: Record<string, number>;
  overflow: string[];
  bombasASeco: string[];
  boiasFechadas: string[];
  ladroesAtivos: string[];
  consumoInsuficiente: string[];
  sensores: Record<string, Decisao>;
  /** Log de eventos (acionamentos de bomba/sensor e alertas) da execução. */
  eventos: EventoLog[];
  /** id da peça selecionada no inspetor (ou null). */
  selecionada: string | null;
  /** id da conexão selecionada (para exclusão), ou null. */
  conexaoSelecionada: string | null;
  /** Snapshot do projeto ao entrar em execução, para RESET. */
  snapshotEdicao: ProjetoSimulacao | null;
}

export type Acao =
  | { tipo: 'ADD_PECA'; peca: Peca }
  | { tipo: 'REMOVER_PECA'; id: string }
  | { tipo: 'MOVER_PECA'; id: string; x: number; y: number }
  | { tipo: 'ADD_CONEXAO'; conexao: Conexao }
  | { tipo: 'REMOVER_CONEXAO'; id: string }
  | { tipo: 'ATUALIZAR_PROPS'; id: string; props: Partial<PropsPorTipo> }
  | { tipo: 'RENOMEAR_PECA'; id: string; rotulo: string }
  | { tipo: 'SELECIONAR'; id: string | null }
  | { tipo: 'SELECIONAR_CONEXAO'; id: string | null }
  | { tipo: 'SET_NOME'; nome: string }
  | { tipo: 'SET_UNIDADES'; unidades: ProjetoSimulacao['unidades'] }
  | { tipo: 'CARREGAR_PROJETO'; projeto: ProjetoSimulacao }
  | { tipo: 'ENTRAR_EXECUCAO' }
  | { tipo: 'SAIR_EXECUCAO' }
  | { tipo: 'PLAY' }
  | { tipo: 'PAUSE' }
  | { tipo: 'RESET' }
  | { tipo: 'SET_VELOCIDADE'; velocidade: Velocidade }
  | { tipo: 'TICK' };

export function estadoInicial(projeto: ProjetoSimulacao): EstadoApp {
  // Evita ids duplicados: alinha o contador aos ids já presentes no projeto
  // (início e carregamento — CARREGAR_PROJETO passa por aqui).
  sincronizarContador(projeto);
  return {
    projeto,
    modo: 'edicao',
    rodando: false,
    velocidade: 1,
    tempo: 0,
    errosValidacao: [],
    vazoes: {},
    overflow: [],
    bombasASeco: [],
    boiasFechadas: [],
    ladroesAtivos: [],
    consumoInsuficiente: [],
    sensores: {},
    eventos: [],
    selecionada: null,
    conexaoSelecionada: null,
    snapshotEdicao: null,
  };
}

/** Mutações que alteram a ESTRUTURA do grafo — proibidas em execução. */
const ACOES_ESTRUTURAIS = new Set<Acao['tipo']>([
  'ADD_PECA',
  'REMOVER_PECA',
  'ADD_CONEXAO',
  'REMOVER_CONEXAO',
  'SET_UNIDADES',
]);

function atualizarPeca(
  projeto: ProjetoSimulacao,
  id: string,
  fn: (p: Peca) => Peca,
): ProjetoSimulacao {
  return {
    ...projeto,
    pecas: projeto.pecas.map((p) => (p.id === id ? fn(p) : p)),
  };
}

function rotuloDePeca(projeto: ProjetoSimulacao, id: string): string {
  const p = projeto.pecas.find((x) => x.id === id);
  return p?.rotulo && p.rotulo.trim() ? p.rotulo : id;
}

/**
 * Deriva os eventos novos comparando o estado anterior com o resultado do tick:
 * transições de bomba (liga/desliga), decisões de sensor e a ENTRADA em cada
 * condição de alerta (a seco, ladrão, déficit, transbordo). Só transições — uma
 * condição contínua é registrada uma vez, quando começa.
 */
function derivarEventos(anterior: EstadoApp, r: ResultadoTick): EventoLog[] {
  const ev: EventoLog[] = [];
  const t = r.tempo;
  const rot = (id: string): string => rotuloDePeca(r.projeto, id);

  const antLigada = new Map(
    anterior.projeto.pecas.filter(isBomba).map((p) => [p.id, p.props.ligada ?? false]),
  );
  for (const p of r.projeto.pecas) {
    if (!isBomba(p)) continue;
    const antes = antLigada.get(p.id) ?? false;
    const agora = p.props.ligada ?? false;
    if (antes !== agora) {
      // Revezamento: anota qual metade assumiu (a unidadeAtiva já foi alternada
      // no tick da borda de subida).
      const unidade = agora && p.props.revezamento ? ` (unidade ${p.props.unidadeAtiva ?? 1})` : '';
      ev.push({ tempo: t, tipo: 'bomba', mensagem: `${rot(p.id)} ${agora ? 'ligou' : 'desligou'}${unidade}` });
    }
  }

  for (const [id, dec] of Object.entries(r.sensores)) {
    if (anterior.sensores[id] !== dec && (dec === 'ligar' || dec === 'desligar')) {
      ev.push({ tempo: t, tipo: 'sensor', mensagem: `${rot(id)} pediu ${dec}` });
    }
  }

  const entraram = (atual: string[], antes: string[], tipo: TipoEvento, msg: (n: string) => string): void => {
    const set = new Set(antes);
    for (const id of atual) if (!set.has(id)) ev.push({ tempo: t, tipo, mensagem: msg(rot(id)) });
  };
  entraram(r.bombasASeco, anterior.bombasASeco, 'seco', (n) => `${n}: rodando a seco (origem vazia)`);
  entraram(r.ladroesAtivos, anterior.ladroesAtivos, 'ladrao', (n) => `${n}: ladrão em transbordo`);
  entraram(r.consumoInsuficiente, anterior.consumoInsuficiente, 'deficit', (n) => `${n}: déficit (bomba não acompanha)`);
  entraram(r.overflow, anterior.overflow, 'overflow', (n) => `${n}: transbordou`);

  return ev;
}

export function reducer(estado: EstadoApp, acao: Acao): EstadoApp {
  // Guarda de imutabilidade estrutural em execução (seção 6).
  if (estado.modo === 'execucao' && ACOES_ESTRUTURAIS.has(acao.tipo)) {
    return estado; // mutação de grafo bloqueada durante a execução
  }

  switch (acao.tipo) {
    case 'ADD_PECA':
      return {
        ...estado,
        projeto: { ...estado.projeto, pecas: [...estado.projeto.pecas, acao.peca] },
        selecionada: acao.peca.id,
      };

    case 'REMOVER_PECA':
      return {
        ...estado,
        projeto: {
          ...estado.projeto,
          pecas: estado.projeto.pecas.filter((p) => p.id !== acao.id),
          // Remove conexões pendentes e referências de sensores.
          conexoes: estado.projeto.conexoes.filter(
            (c) => c.origem !== acao.id && c.destino !== acao.id,
          ),
        },
        selecionada: estado.selecionada === acao.id ? null : estado.selecionada,
      };

    case 'MOVER_PECA':
      // Mover no canvas é edição pura; em execução mantemos posição imutável
      // por consistência com "grafo estruturalmente imutável".
      if (estado.modo === 'execucao') return estado;
      return {
        ...estado,
        projeto: atualizarPeca(estado.projeto, acao.id, (p) => ({
          ...p,
          x: acao.x,
          y: acao.y,
        })),
      };

    case 'ADD_CONEXAO':
      return {
        ...estado,
        projeto: {
          ...estado.projeto,
          conexoes: [...estado.projeto.conexoes, acao.conexao],
        },
      };

    case 'REMOVER_CONEXAO':
      return {
        ...estado,
        projeto: {
          ...estado.projeto,
          conexoes: estado.projeto.conexoes.filter((c) => c.id !== acao.id),
        },
        conexaoSelecionada:
          estado.conexaoSelecionada === acao.id ? null : estado.conexaoSelecionada,
      };

    case 'ATUALIZAR_PROPS':
      // Permitido em ambos os modos: ajustar valores (registro, thresholds,
      // bomba manual) faz parte da operação em execução.
      return {
        ...estado,
        projeto: atualizarPeca(estado.projeto, acao.id, (p) => ({
          ...p,
          props: { ...p.props, ...acao.props } as PropsPorTipo,
        })),
      };

    case 'RENOMEAR_PECA':
      return {
        ...estado,
        projeto: atualizarPeca(estado.projeto, acao.id, (p) => ({
          ...p,
          rotulo: acao.rotulo,
        })),
      };

    case 'SELECIONAR':
      // Selecionar uma peça limpa a seleção de conexão (e vice-versa).
      return { ...estado, selecionada: acao.id, conexaoSelecionada: null };

    case 'SELECIONAR_CONEXAO':
      return { ...estado, conexaoSelecionada: acao.id, selecionada: null };

    case 'SET_NOME':
      return { ...estado, projeto: { ...estado.projeto, nome: acao.nome } };

    case 'SET_UNIDADES':
      return {
        ...estado,
        projeto: { ...estado.projeto, unidades: acao.unidades },
      };

    case 'CARREGAR_PROJETO':
      return { ...estadoInicial(acao.projeto) };

    case 'ENTRAR_EXECUCAO': {
      const validacao = validarGrafo(estado.projeto);
      if (!validacao.ok) {
        // Validação falhou → permanece em edição e exibe erros (seção 6).
        return { ...estado, errosValidacao: validacao.erros };
      }
      return {
        ...estado,
        modo: 'execucao',
        rodando: false,
        tempo: 0,
        errosValidacao: [],
        eventos: [], // novo run → log limpo
        snapshotEdicao: structuredClone(estado.projeto),
      };
    }

    case 'SAIR_EXECUCAO':
      // Exige pause primeiro (seção 6). Restaura o snapshot de edição para
      // descartar valores gerados pela simulação.
      if (estado.rodando) return estado;
      return {
        ...estado,
        modo: 'edicao',
        rodando: false,
        vazoes: {},
        overflow: [],
        bombasASeco: [],
        boiasFechadas: [],
        ladroesAtivos: [],
        consumoInsuficiente: [],
        sensores: {},
        eventos: [],
        projeto: estado.snapshotEdicao ?? estado.projeto,
        snapshotEdicao: null,
      };

    case 'PLAY':
      if (estado.modo !== 'execucao') return estado;
      return { ...estado, rodando: true };

    case 'PAUSE':
      return { ...estado, rodando: false };

    case 'RESET':
      if (estado.modo !== 'execucao') return estado;
      return {
        ...estado,
        rodando: false,
        tempo: 0,
        vazoes: {},
        overflow: [],
        bombasASeco: [],
        boiasFechadas: [],
        ladroesAtivos: [],
        consumoInsuficiente: [],
        sensores: {},
        eventos: [],
        projeto: estado.snapshotEdicao ?? estado.projeto,
      };

    case 'SET_VELOCIDADE':
      return { ...estado, velocidade: acao.velocidade };

    case 'TICK': {
      if (estado.modo !== 'execucao' || !estado.rodando) return estado;
      // Controle de velocidade (seção 7): roda N ticks por frame, sem alterar
      // o dt da física.
      const r = rodarTicks(estado.projeto, estado.velocidade, estado.tempo);
      const novosEventos = derivarEventos(estado, r);
      return {
        ...estado,
        projeto: r.projeto,
        vazoes: r.vazoes,
        overflow: r.overflow,
        bombasASeco: r.bombasASeco,
        boiasFechadas: r.boiasFechadas,
        ladroesAtivos: r.ladroesAtivos,
        consumoInsuficiente: r.consumoInsuficiente,
        sensores: r.sensores,
        eventos:
          novosEventos.length > 0
            ? [...estado.eventos, ...novosEventos].slice(-MAX_EVENTOS)
            : estado.eventos,
        tempo: r.tempo,
      };
    }

    default:
      return estado;
  }
}

// Pequenos seletores úteis para a UI.
export const bombasDe = (p: ProjetoSimulacao): Peca[] => p.pecas.filter(isBomba);
export const sensoresDe = (p: ProjetoSimulacao): Peca[] => p.pecas.filter(isSensor);
export const tubosDe = (p: ProjetoSimulacao): Peca[] => p.pecas.filter(isTubo);
