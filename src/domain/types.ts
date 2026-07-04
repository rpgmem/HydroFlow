/**
 * HydroFlow — Modelo de Domínio (Sprint 1)
 *
 * Tipos TypeScript de todas as entidades do simulador hidráulico.
 * A tipagem forte modela as relações ricas entre peças, portas e conexões,
 * e serve de contrato único entre o motor de simulação (puro) e a UI.
 *
 * Ver README.md (seção "Schema") para a documentação de cada campo.
 */

/** Versão atual do schema serializado em arquivos `.json`. */
export const SCHEMA_VERSION = '1.0.0';

export type TipoPeca =
  | 'reservatorio'
  | 'tubo'
  | 'bomba'
  | 'fonte'
  | 'sensor'
  | 'juncao';

export type ModoSistema = 'edicao' | 'execucao';

export interface Unidades {
  volume: 'litros' | 'm3';
  comprimento: 'cm' | 'm';
}

export interface ConfiguracaoSimulacao {
  /** Passo de tempo do tick, em segundos. */
  dt: number;
  /** Aceleração da gravidade (padrão 9.81 m/s²). */
  g: number;
}

/**
 * Controle de nível compartilhado por sensores eletrônicos, boias de fonte
 * e boias mecânicas de tubo. `histerese` e `delay` só têm efeito no sensor
 * eletrônico (a boia mecânica é instantânea, sem histerese/delay).
 */
export interface NivelControle {
  nivelMinimo?: number;
  nivelMaximo?: number;
  /** Só sensor eletrônico: evita chaveamento no limiar. */
  histerese?: boolean;
  /** Só sensor eletrônico: tempo mínimo (s) entre liga/desliga. */
  delay?: number;
}

// ---------------------------------------------------------------------------
// Props por tipo de peça (seção 3.1 da especificação)
// ---------------------------------------------------------------------------

export interface PropsReservatorio {
  formato: 'cilindro' | 'retangular';
  raio?: number; // cilindro
  largura?: number; // retangular
  comprimento?: number; // retangular
  alturaMaxima: number;
  /** Elevação física da base em relação ao solo — permite empilhamento. */
  cotaBase: number;
  /** Nível atual do líquido (estado mutável durante a execução). */
  nivel?: number;
}

export interface PropsTubo {
  diametro: number;
  /** Impede refluxo (fluxo apenas origem→destino). */
  checkValve?: boolean;
  /** Controle manual on/off. */
  registro?: { aberto: boolean };
  /** Válvula mecânica embutida na aresta (sem histerese/delay). */
  boia?: NivelControle;
}

export interface PropsBomba {
  vazaoNominal: number;
  /** Curva simplificada: vazao = vazaoNominal - k·Δh. */
  curva?: { k: number };
  /** IDs dos sensores eletrônicos que controlam esta bomba. */
  sensores: string[];
  /** Estado atual liga/desliga (mutável durante a execução). */
  ligada?: boolean;
}

export interface PropsFonte {
  vazaoFixa: number;
  boia?: NivelControle;
}

export type PropsSensor = NivelControle & {
  /** ID da bomba controlada por este sensor. */
  bombaAlvo: string;
  /** Estado interno do sensor (pedido de liga/desliga do tick anterior). */
  pedindoLigar?: boolean;
  /** Instante (s de simulação) da última troca de estado — usado pelo delay. */
  ultimaTroca?: number;
};

// Junção não tem props além das portas — só distribui vazão, sem volume.
export type PropsJuncao = Record<string, never>;

export type PropsPorTipo =
  | PropsReservatorio
  | PropsTubo
  | PropsBomba
  | PropsFonte
  | PropsSensor
  | PropsJuncao;

// ---------------------------------------------------------------------------
// Entidades principais
// ---------------------------------------------------------------------------

export interface Peca {
  id: string; // uuid
  tipo: TipoPeca;
  x: number;
  y: number;
  rotacao?: number; // tubo/bomba
  /** Portas nomeadas — reservatório/junção definem (ex.: ['topo', 'base']). */
  portas?: string[];
  props: PropsPorTipo;
}

export interface Conexao {
  id: string;
  origem: string; // id da peça
  origemPorta?: string;
  destino: string;
  destinoPorta?: string;
  /** Obrigatório quando origem é Fonte com múltiplos destinos. */
  vazaoAlocada?: number;
}

export interface ProjetoSimulacao {
  nome: string;
  versao: string; // schema versioning
  unidades: Unidades;
  configuracaoSimulacao: ConfiguracaoSimulacao;
  pecas: Peca[];
  conexoes: Conexao[];
}

// ---------------------------------------------------------------------------
// Type guards tipados por `tipo` — reduzem casts espalhados pelo motor/UI.
// ---------------------------------------------------------------------------

export type PecaDe<T extends TipoPeca> = Peca & {
  tipo: T;
  props: T extends 'reservatorio'
    ? PropsReservatorio
    : T extends 'tubo'
      ? PropsTubo
      : T extends 'bomba'
        ? PropsBomba
        : T extends 'fonte'
          ? PropsFonte
          : T extends 'sensor'
            ? PropsSensor
            : PropsJuncao;
};

export const isReservatorio = (p: Peca): p is PecaDe<'reservatorio'> =>
  p.tipo === 'reservatorio';
export const isTubo = (p: Peca): p is PecaDe<'tubo'> => p.tipo === 'tubo';
export const isBomba = (p: Peca): p is PecaDe<'bomba'> => p.tipo === 'bomba';
export const isFonte = (p: Peca): p is PecaDe<'fonte'> => p.tipo === 'fonte';
export const isSensor = (p: Peca): p is PecaDe<'sensor'> => p.tipo === 'sensor';
export const isJuncao = (p: Peca): p is PecaDe<'juncao'> => p.tipo === 'juncao';
