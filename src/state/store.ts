/**
 * HydroFlow — Estado da aplicação
 *
 * Reducer puro que orquestra os dois modos de operação (seção 6):
 *  - 'edicao':   grafo mutável (add/remove peça, conexão, mover no canvas).
 *  - 'execucao': grafo estruturalmente IMUTÁVEL — só valores mudam (nível, vazão, registro, bomba on/off, thresholds de sensor).
 *
 * A transição edição→execução roda a validação de grafo (seção 5) e só avança se passar. A transição execução→edição exige pause/reset primeiro.
 *
 * O reducer é puro e independente de React (o loop de render vive no componente), o que o torna diretamente testável no Vitest.
 */

import type { ErroValidacao } from '../domain/schema';
import { validarGrafo } from '../engine/validacaoGrafo';
import { GrafoIndex } from '../engine/grafo';
import { desnivelTuboM } from '../engine/coerencia';
import { rodarTicks, type ResultadoTick } from '../engine/simulador';
import type { Decisao } from '../engine/arbitragem';
import { novoId, sincronizarContador } from '../domain/factory';
import { normalizarIds } from '../domain/normalizarIds';
import {
  isBomba,
  isConsumo,
  isQuadro,
  isReservatorio,
  isSensor,
  isTubo,
  type Conexao,
  type ModoSistema,
  type Peca,
  type ProjetoSimulacao,
  type PropsBomba,
  type PropsConsumo,
  type PropsPorTipo,
  type PropsQuadro,
  type PropsSensor,
  type PropsTubo,
} from '../domain/types';

/** Uma entrada do log de eventos (acionamentos e alertas ao longo da execução). */
export type TipoEvento = 'bomba' | 'sensor' | 'seco' | 'ladrao' | 'deficit' | 'overflow' | 'velocidade' | 'refluxo' | 'golpe' | 'cavitacao' | 'alivio' | 'comando';
export interface EventoLog {
  /** Tempo de simulação (s) em que o evento ocorreu. */
  tempo: number;
  tipo: TipoEvento;
  /** Chave i18n da mensagem (traduzida na UI) — o store não depende de i18n. */
  chave: string;
  /** Parâmetros de interpolação (ex.: `nome` = rótulo da peça, não traduzido). */
  params: Record<string, string | number>;
}

const MAX_EVENTOS = 300;
/** Máximo de amostras guardadas por peça para o sparkline do inspetor. */
const MAX_HISTORICO = 150;

// Multiplicador de ticks por frame. Valores altos permitem acompanhar cenários realistas (vazões em L/s enchendo tanques de milhares de litros) em segundos.
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
  tubosVelozes: string[];
  golpeAriete: string[];
  cavitacao: string[];
  aliviosAtivos: string[];
  refluxos: string[];
  consumoInsuficiente: string[];
  sensores: Record<string, Decisao>;
  /** Série temporal por peça (nível dos reservatórios, vazão dos condutores) acumulada durante a execução — alimenta o sparkline do inspetor. */
  historico: Record<string, number[]>;
  /** Log de eventos (acionamentos de bomba/sensor e alertas) da execução. */
  eventos: EventoLog[];
  /** id da peça selecionada no inspetor (ou null). */
  selecionada: string | null;
  /** id da conexão selecionada (para exclusão), ou null. */
  conexaoSelecionada: string | null;
  /** Snapshot do projeto ao entrar em execução, para RESET. */
  snapshotEdicao: ProjetoSimulacao | null;
  /** Pilhas de desfazer/refazer (só edição): projetos anteriores/posteriores. */
  undoStack: ProjetoSimulacao[];
  redoStack: ProjetoSimulacao[];
  /** Sequência incrementada a cada projeto CARREGADO (início/troca) — sinaliza ao Canvas que deve recentralizar a vista. Não faz parte do projeto salvo. */
  geracao: number;
}

// Sequência de "carregamentos" de projeto. Fora do estado (contador de módulo) porque `estadoInicial` cria estado do zero a cada carga e precisa de um valor
// crescente entre chamadas. É só bookkeeping de UI (não afeta a física/autosave).
let geracaoSeq = 0;

export type Acao =
  | { tipo: 'ADD_PECA'; peca: Peca }
  | { tipo: 'REMOVER_PECA'; id: string }
  | { tipo: 'MOVER_PECA'; id: string; x: number; y: number }
  | { tipo: 'ADD_CONEXAO'; conexao: Conexao }
  | { tipo: 'REMOVER_CONEXAO'; id: string }
  | { tipo: 'ATUALIZAR_PROPS'; id: string; props: Partial<PropsPorTipo> }
  | { tipo: 'DUPLICAR_PECA'; id: string }
  | { tipo: 'RENOMEAR_PECA'; id: string; rotulo: string }
  | { tipo: 'ATUALIZAR_COTA'; id: string; cota: number }
  | { tipo: 'NORMALIZAR_IDS' }
  | { tipo: 'SELECIONAR'; id: string | null }
  | { tipo: 'SELECIONAR_CONEXAO'; id: string | null }
  | { tipo: 'SET_NOME'; nome: string }
  | { tipo: 'SET_UNIDADES'; unidades: ProjetoSimulacao['unidades'] }
  | { tipo: 'SET_ATRITO'; atrito: boolean }
  | { tipo: 'SET_MODELO_ATRITO'; modeloAtrito: 'hazen-williams' | 'darcy-weisbach' }
  | { tipo: 'SET_VELOCIDADE_REF'; velocidadeRef: number }
  | { tipo: 'SET_TEMPERATURA'; temperaturaC: number }
  | { tipo: 'SET_LIMITE_GOLPE'; limiteGolpeArieteKPa: number }
  | { tipo: 'CARREGAR_PROJETO'; projeto: ProjetoSimulacao }
  | { tipo: 'ENTRAR_EXECUCAO' }
  | { tipo: 'SAIR_EXECUCAO' }
  | { tipo: 'PLAY' }
  | { tipo: 'PAUSE' }
  | { tipo: 'RESET' }
  | { tipo: 'SET_VELOCIDADE'; velocidade: Velocidade }
  | { tipo: 'UNDO' }
  | { tipo: 'REDO' }
  | { tipo: 'TICK' };

export function estadoInicial(projeto: ProjetoSimulacao): EstadoApp {
  // Evita ids duplicados: alinha o contador aos ids já presentes no projeto (início e carregamento — CARREGAR_PROJETO passa por aqui).
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
    tubosVelozes: [],
    golpeAriete: [],
    cavitacao: [],
    aliviosAtivos: [],
    refluxos: [],
    consumoInsuficiente: [],
    sensores: {},
    historico: {},
    eventos: [],
    selecionada: null,
    conexaoSelecionada: null,
    snapshotEdicao: null,
    undoStack: [],
    redoStack: [],
    geracao: (geracaoSeq += 1),
  };
}

/** Anexa uma amostra por peça (nível/vazão) ao histórico, com corte no teto. */
function registrarHistorico(
  anterior: Record<string, number[]>,
  r: ResultadoTick,
): Record<string, number[]> {
  const hist: Record<string, number[]> = {};
  for (const p of r.projeto.pecas) {
    let v: number | undefined;
    if (isReservatorio(p)) v = p.props.nivel ?? 0;
    else if (r.vazoes[p.id] !== undefined) v = r.vazoes[p.id];
    if (v === undefined) continue; // sensor/junção sem série
    const arr = anterior[p.id] ? anterior[p.id]!.slice(-(MAX_HISTORICO - 1)) : [];
    arr.push(v);
    hist[p.id] = arr;
  }
  return hist;
}

/** Mutações que alteram a ESTRUTURA do grafo — proibidas em execução. */
const ACOES_ESTRUTURAIS = new Set<Acao['tipo']>([
  'ADD_PECA',
  'REMOVER_PECA',
  'ADD_CONEXAO',
  'REMOVER_CONEXAO',
  'SET_UNIDADES',
  'SET_ATRITO',
  'SET_MODELO_ATRITO',
  'SET_VELOCIDADE_REF',
  'SET_TEMPERATURA',
  'SET_LIMITE_GOLPE',
  'DUPLICAR_PECA',
  'NORMALIZAR_IDS',
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
 * Deriva os eventos novos comparando o estado anterior com o resultado do tick: transições de bomba (liga/desliga), decisões de sensor e a ENTRADA
 * em cada condição de alerta (a seco, ladrão, déficit, transbordo). Só transições — uma condição contínua é registrada uma vez, quando começa.
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
      // Revezamento: anota qual metade assumiu (a unidadeAtiva já foi alternada no tick da borda de subida).
      const nome = rot(p.id);
      if (!agora) ev.push({ tempo: t, tipo: 'bomba', chave: 'log.bombaDesligou', params: { nome } });
      else if (p.props.revezamento)
        ev.push({ tempo: t, tipo: 'bomba', chave: 'log.bombaLigouUnidade', params: { nome, unidade: p.props.unidadeAtiva ?? 1 } });
      else ev.push({ tempo: t, tipo: 'bomba', chave: 'log.bombaLigou', params: { nome } });
    }
  }

  for (const [id, dec] of Object.entries(r.sensores)) {
    if (anterior.sensores[id] !== dec && (dec === 'ligar' || dec === 'desligar')) {
      ev.push({
        tempo: t,
        tipo: 'sensor',
        chave: dec === 'ligar' ? 'log.sensorPediuLigar' : 'log.sensorPediuDesligar',
        params: { nome: rot(id) },
      });
    }
  }

  const entraram = (atual: string[], antes: string[], tipo: TipoEvento, chave: string, extra: Record<string, string | number> = {}): void => {
    const set = new Set(antes);
    for (const id of atual) if (!set.has(id)) ev.push({ tempo: t, tipo, chave, params: { nome: rot(id), ...extra } });
  };
  entraram(r.bombasASeco, anterior.bombasASeco, 'seco', 'log.seco');
  entraram(r.ladroesAtivos, anterior.ladroesAtivos, 'ladrao', 'log.ladrao');
  entraram(r.aliviosAtivos, anterior.aliviosAtivos, 'alivio', 'log.alivio');
  const velRef = r.projeto.configuracaoSimulacao.velocidadeRef ?? 3;
  entraram(r.tubosVelozes, anterior.tubosVelozes, 'velocidade', 'log.velocidade', { velRef });
  entraram(r.refluxos, anterior.refluxos, 'refluxo', 'log.refluxo');
  entraram(r.consumoInsuficiente, anterior.consumoInsuficiente, 'deficit', 'log.deficit');
  entraram(r.overflow, anterior.overflow, 'overflow', 'log.overflow');
  // Golpe de aríete: risco PERMANENTE aparecendo (entrou na lista) …
  entraram(r.golpeAriete, anterior.golpeAriete, 'golpe', 'log.golpeRisco');
  // … e o evento PONTUAL: um tubo COM risco cuja vazão COLAPSA neste tick
  // (fechamento brusco / desligamento) — o instante em que o golpe ocorreria.
  const antGolpe = new Set(anterior.golpeAriete);
  for (const id of antGolpe) {
    if (Math.abs(r.vazoes[id] ?? 0) <= 1e-9) {
      ev.push({ tempo: t, tipo: 'golpe', chave: 'log.golpeOcorreu', params: { nome: rot(id) } });
    }
  }
  // Cavitação: risco surgindo (bomba entrou na lista de NPSH insuficiente).
  entraram(r.cavitacao, anterior.cavitacao, 'cavitacao', 'log.cavitacao');

  return ev;
}

/**
 * Evento de log para um COMANDO de operação feito durante a execução (abrir/fechar registro, modo da bomba/quadro, saída de consumo, habilitar sensor).
 * Compara as props antigas com o patch para descobrir o que mudou; devolve null quando a mudança não é um comando operável (ex.: ajuste estrutural). Só é
 * chamado em execução — em edição, comandos não vão para o log.
 */
function eventoDeComando(estado: EstadoApp, id: string, patch: Partial<PropsPorTipo>): EventoLog | null {
  const p = estado.projeto.pecas.find((x) => x.id === id);
  if (!p) return null;
  const nome = rotuloDePeca(estado.projeto, id);
  const tempo = estado.tempo;
  const ev = (chave: string, params: Record<string, string | number> = {}): EventoLog => ({
    tempo,
    tipo: 'comando',
    chave,
    params: { nome, ...params },
  });

  if (isTubo(p)) {
    const np = patch as Partial<PropsTubo>;
    if (np.registro !== undefined && (np.registro.aberto ?? true) !== (p.props.registro?.aberto ?? true)) {
      return ev(np.registro.aberto ? 'log.cmdRegistroAberto' : 'log.cmdRegistroFechado');
    }
  } else if (isBomba(p)) {
    const np = patch as Partial<PropsBomba>;
    if (np.modoControle !== undefined && np.modoControle !== (p.props.modoControle ?? 'auto')) {
      const chave =
        np.modoControle === 'ligado' ? 'log.cmdBombaLigada' : np.modoControle === 'desligado' ? 'log.cmdBombaDesligada' : 'log.cmdBombaAuto';
      return ev(chave);
    }
  } else if (isConsumo(p)) {
    const np = patch as Partial<PropsConsumo>;
    if (np.aberto !== undefined && np.aberto !== (p.props.aberto ?? true)) {
      return ev(np.aberto ? 'log.cmdConsumoAberto' : 'log.cmdConsumoFechado');
    }
  } else if (isSensor(p)) {
    const np = patch as Partial<PropsSensor>;
    if (np.ativo !== undefined && np.ativo !== (p.props.ativo ?? true)) {
      return ev(np.ativo ? 'log.cmdSensorAtivo' : 'log.cmdSensorInativo');
    }
  } else if (isQuadro(p)) {
    const np = patch as Partial<PropsQuadro>;
    if (np.canais) {
      for (const nc of np.canais) {
        const oc = p.props.canais.find((c) => c.bomba === nc.bomba);
        if (oc && oc.modo !== nc.modo) {
          const bomba = rotuloDePeca(estado.projeto, nc.bomba);
          const chave =
            nc.modo === 'manual' ? 'log.cmdQuadroManual' : nc.modo === 'desligado' ? 'log.cmdQuadroDesligado' : 'log.cmdQuadroAuto';
          return ev(chave, { bomba });
        }
      }
    }
  }
  return null;
}

/**
 * Ao criar uma conexão, se um tubo envolvido ficou com AMBAS as pontas de
 * elevação conhecida (reservatório/bomba) e ainda está SEM `comprimento`,
 * preenche-o com o desnível entre as pontas (mínimo coerente; o usuário ajusta).
 * Nunca sobrescreve um comprimento já informado; se o desnível for indefinido
 * (junção/ambiente) ou ~0, não faz nada.
 */
function autoPreencherComprimento(projeto: ProjetoSimulacao, conexao: Conexao): ProjetoSimulacao {
  const idx = new GrafoIndex(projeto);
  const tocados = new Set([conexao.origem, conexao.destino]);
  let mudou = false;
  const pecas = projeto.pecas.map((p) => {
    if (!isTubo(p) || !tocados.has(p.id) || p.props.comprimento !== undefined) return p;
    const desn = desnivelTuboM(idx, p);
    if (desn === undefined || desn <= 0.1) return p;
    mudou = true;
    return { ...p, props: { ...p.props, comprimento: Math.ceil(desn * 10) / 10 } };
  });
  return mudou ? { ...projeto, pecas } : projeto;
}

/** Ações de EDIÇÃO que alteram o projeto e devem entrar no histórico (undo). */
const ACOES_UNDOAVEIS = new Set<Acao['tipo']>([
  'ADD_PECA',
  'REMOVER_PECA',
  'MOVER_PECA',
  'ADD_CONEXAO',
  'REMOVER_CONEXAO',
  'ATUALIZAR_PROPS',
  'RENOMEAR_PECA',
  'ATUALIZAR_COTA',
  'DUPLICAR_PECA',
  'NORMALIZAR_IDS',
  'SET_NOME',
  'SET_UNIDADES',
  'SET_ATRITO',
  'SET_MODELO_ATRITO',
  'SET_VELOCIDADE_REF',
  'SET_TEMPERATURA',
  'SET_LIMITE_GOLPE',
]);

const MAX_UNDO = 60;

/**
 * Reducer público: envolve o `reducerBase` com o histórico de desfazer/refazer.
 * Antes de aplicar uma edição undoável (só em edição), empilha o projeto atual e zera o redo. UNDO/REDO trocam o projeto entre as pilhas.
 */
export function reducer(estado: EstadoApp, acao: Acao): EstadoApp {
  if (acao.tipo === 'UNDO') {
    if (estado.modo !== 'edicao' || estado.undoStack.length === 0) return estado;
    const anterior = estado.undoStack[estado.undoStack.length - 1]!;
    return {
      ...estado,
      projeto: anterior,
      undoStack: estado.undoStack.slice(0, -1),
      redoStack: [...estado.redoStack, estado.projeto],
      selecionada: null,
      conexaoSelecionada: null,
    };
  }
  if (acao.tipo === 'REDO') {
    if (estado.modo !== 'edicao' || estado.redoStack.length === 0) return estado;
    const proximo = estado.redoStack[estado.redoStack.length - 1]!;
    return {
      ...estado,
      projeto: proximo,
      redoStack: estado.redoStack.slice(0, -1),
      undoStack: [...estado.undoStack, estado.projeto],
      selecionada: null,
      conexaoSelecionada: null,
    };
  }
  const novo = reducerBase(estado, acao);
  // Registra no histórico quando uma edição de fato mudou o projeto.
  if (
    estado.modo === 'edicao' &&
    ACOES_UNDOAVEIS.has(acao.tipo) &&
    novo.projeto !== estado.projeto
  ) {
    return {
      ...novo,
      undoStack: [...estado.undoStack, estado.projeto].slice(-MAX_UNDO),
      redoStack: [],
    };
  }
  return novo;
}

function reducerBase(estado: EstadoApp, acao: Acao): EstadoApp {
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
      // Mover no canvas é edição pura; em execução mantemos posição imutável por consistência com "grafo estruturalmente imutável".
      if (estado.modo === 'execucao') return estado;
      return {
        ...estado,
        projeto: atualizarPeca(estado.projeto, acao.id, (p) => ({
          ...p,
          x: acao.x,
          y: acao.y,
        })),
      };

    case 'ADD_CONEXAO': {
      // Preenche o comprimento do tubo com o desnível entre as pontas quando a
      // ligação completa uma extremidade de elevação conhecida (só se em branco).
      const comConexao: ProjetoSimulacao = {
        ...estado.projeto,
        conexoes: [...estado.projeto.conexoes, acao.conexao],
      };
      return { ...estado, projeto: autoPreencherComprimento(comConexao, acao.conexao) };
    }

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

    case 'ATUALIZAR_PROPS': {
      // Permitido em ambos os modos: em execução, só os COMANDOS de operação (registro, modo da bomba/quadro, saída de consumo, sensor on/off) chegam
      // aqui — a UI trava o resto. O comando também atualiza o snapshot de edição (persiste ao voltar à edição e sobrevive ao RESET) e entra no log; NÃO
      // gera histórico de desfazer (o wrapper só registra em edição).
      const aplicar = (proj: ProjetoSimulacao): ProjetoSimulacao =>
        atualizarPeca(proj, acao.id, (p) => ({
          ...p,
          props: { ...p.props, ...acao.props } as PropsPorTipo,
        }));
      if (estado.modo !== 'execucao') {
        return { ...estado, projeto: aplicar(estado.projeto) };
      }
      const ev = eventoDeComando(estado, acao.id, acao.props);
      return {
        ...estado,
        projeto: aplicar(estado.projeto),
        snapshotEdicao: estado.snapshotEdicao ? aplicar(estado.snapshotEdicao) : estado.snapshotEdicao,
        eventos: ev ? [...estado.eventos, ev].slice(-MAX_EVENTOS) : estado.eventos,
      };
    }

    case 'DUPLICAR_PECA': {
      const orig = estado.projeto.pecas.find((p) => p.id === acao.id);
      if (!orig) return estado;
      // Cópia deslocada (2 células da grade), com novo id e rótulo "(cópia)".
      // As conexões NÃO são duplicadas (a cópia entra solta, para religar).
      const nova: Peca = {
        ...structuredClone(orig),
        id: novoId(orig.tipo.slice(0, 3)),
        x: orig.x + 40,
        y: orig.y + 40,
        rotulo: orig.rotulo ? `${orig.rotulo} (cópia)` : undefined,
      };
      return {
        ...estado,
        projeto: { ...estado.projeto, pecas: [...estado.projeto.pecas, nova] },
        selecionada: nova.id,
      };
    }

    case 'RENOMEAR_PECA':
      return {
        ...estado,
        projeto: atualizarPeca(estado.projeto, acao.id, (p) => ({
          ...p,
          rotulo: acao.rotulo,
        })),
      };

    case 'ATUALIZAR_COTA':
      return {
        ...estado,
        projeto: atualizarPeca(estado.projeto, acao.id, (p) => ({
          ...p,
          cota: acao.cota,
        })),
      };

    case 'NORMALIZAR_IDS': {
      // Reescreve os ids das peças como slug do rótulo (fiel), atualizando todas as referências. Os ids mudam → limpa a seleção. Sem mudança → no-op.
      const projeto = normalizarIds(estado.projeto);
      if (projeto === estado.projeto) return estado;
      return { ...estado, projeto, selecionada: null, conexaoSelecionada: null };
    }

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

    case 'SET_ATRITO':
      return {
        ...estado,
        projeto: {
          ...estado.projeto,
          configuracaoSimulacao: { ...estado.projeto.configuracaoSimulacao, atrito: acao.atrito },
        },
      };

    case 'SET_MODELO_ATRITO':
      return {
        ...estado,
        projeto: {
          ...estado.projeto,
          configuracaoSimulacao: {
            ...estado.projeto.configuracaoSimulacao,
            modeloAtrito: acao.modeloAtrito,
          },
        },
      };

    case 'SET_VELOCIDADE_REF':
      return {
        ...estado,
        projeto: {
          ...estado.projeto,
          configuracaoSimulacao: {
            ...estado.projeto.configuracaoSimulacao,
            velocidadeRef: acao.velocidadeRef,
          },
        },
      };

    case 'SET_TEMPERATURA':
      return {
        ...estado,
        projeto: {
          ...estado.projeto,
          configuracaoSimulacao: {
            ...estado.projeto.configuracaoSimulacao,
            temperaturaC: acao.temperaturaC,
          },
        },
      };

    case 'SET_LIMITE_GOLPE':
      return {
        ...estado,
        projeto: {
          ...estado.projeto,
          configuracaoSimulacao: {
            ...estado.projeto.configuracaoSimulacao,
            limiteGolpeArieteKPa: acao.limiteGolpeArieteKPa,
          },
        },
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
        historico: {}, // novo run → série limpa
        snapshotEdicao: structuredClone(estado.projeto),
      };
    }

    case 'SAIR_EXECUCAO':
      // Exige pause primeiro (seção 6). Restaura o snapshot de edição para descartar valores gerados pela simulação.
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
        tubosVelozes: [],
        golpeAriete: [],
        cavitacao: [],
        aliviosAtivos: [],
        refluxos: [],
        consumoInsuficiente: [],
        sensores: {},
        historico: {},
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
        tubosVelozes: [],
        golpeAriete: [],
        cavitacao: [],
        aliviosAtivos: [],
        refluxos: [],
        consumoInsuficiente: [],
        sensores: {},
        historico: {},
        eventos: [],
        projeto: estado.snapshotEdicao ?? estado.projeto,
      };

    case 'SET_VELOCIDADE':
      return { ...estado, velocidade: acao.velocidade };

    case 'TICK': {
      if (estado.modo !== 'execucao' || !estado.rodando) return estado;
      // Controle de velocidade (seção 7): roda N ticks por frame, sem alterar o dt da física.
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
        tubosVelozes: r.tubosVelozes,
        golpeAriete: r.golpeAriete,
        cavitacao: r.cavitacao,
        aliviosAtivos: r.aliviosAtivos,
        refluxos: r.refluxos,
        consumoInsuficiente: r.consumoInsuficiente,
        sensores: r.sensores,
        historico: registrarHistorico(estado.historico, r),
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
