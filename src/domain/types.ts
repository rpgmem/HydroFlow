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
  | 'consumo'
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
  /**
   * Liga a perda de carga por atrito (Hazen-Williams) nos escoamentos por
   * gravidade. Padrão (ausente/false) = Torricelli puro, como antes. Quando
   * ligado, cada tubo usa seu `comprimento` e `coefC` (C de Hazen-Williams).
   */
  atrito?: boolean;
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
  /**
   * Só sensor: lógica REVERSA (corte por nível baixo). Em vez de LIGAR no mínimo
   * e DESLIGAR no máximo, o sensor reverso DESLIGA a bomba no nível mínimo e a
   * libera (LIGAR) no máximo. Aplicado a um reservatório de origem, protege-o de
   * esvaziar / desliga a bomba de um reservatório para hidrantes quando ele baixa.
   * A bomba respeita os sensores normais e reversos ao mesmo tempo (desligar vence).
   */
  reversa?: boolean;
  /**
   * Só boia de tubo: estado atual aberta/fechada (mutável durante a execução).
   * Persistido entre ticks para dar HISTERESE real — entre mín. e máx. a boia
   * mantém o estado anterior, evitando chaveamento rápido (chatter).
   */
  aberta?: boolean;
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
  /** Diâmetro interno em MILÍMETROS (fonte da verdade para o cálculo de vazão). */
  diametro: number;
  /**
   * Rótulo da bitola pré-configurada selecionada (ex.: 'DN110'), do catálogo em
   * `tubosCatalogo.ts`. Apenas informativo/UI: selecionar um preset grava
   * `diametro = internoMm`. Ausente = diâmetro "Personalizado".
   */
  bitola?: string;
  /**
   * Altura em que o tubo toca cada reservatório, relativa à BASE dele (unidade
   * de comprimento). Default 0 = conexão no fundo. Uma tomada em altura só escoa
   * a água ACIMA dela (bocal lateral): `alturaEntrada` é a ponta ligada ao
   * reservatório de origem; `alturaSaida`, a ligada ao destino.
   */
  alturaEntrada?: number;
  alturaSaida?: number;
  /** Impede refluxo (fluxo apenas origem→destino). */
  checkValve?: boolean;
  /** Controle manual on/off. */
  registro?: { aberto: boolean };
  /** Válvula mecânica embutida na aresta (sem histerese/delay). */
  boia?: NivelControle;
  /**
   * Tubo ladrão (dreno de transbordo): só escoa o excedente quando o nível do
   * reservatório de origem passa de `nivel` (na unidade de comprimento).
   */
  ladrao?: { nivel: number };
  /**
   * Comprimento do tubo (unidade de comprimento) — usado só quando o atrito está
   * ligado (Hazen-Williams). Ausente → assume `COMPRIMENTO_PADRAO_M` (1 m).
   */
  comprimento?: number;
  /**
   * Coeficiente C de Hazen-Williams (rugosidade). Ausente → `HW_C_PADRAO` (140,
   * plástico/PVC). Ex.: ~130 cimento, ~100 ferro fundido usado.
   */
  coefC?: number;
}

export interface PropsBomba {
  vazaoNominal: number;
  /** Curva simplificada (explícita): vazao = vazaoNominal - k·Δh. */
  curva?: { k: number };
  /**
   * Altura nominal de recalque (m) — a "plaquinha" da bomba. Quando informada, a
   * curva é DERIVADA automaticamente: a bomba entrega `vazaoNominal` a 0 m e zera
   * nesta altura (Q = vazaoNominal·(1 − Δh/alturaNominal)). Assim, entre dois
   * reservatórios, a altura real da instalação reduz a vazão sozinha. Tem
   * precedência sobre `curva`. Ausente = bomba ideal (ignora a altura).
   */
  alturaNominal?: number;
  /** IDs dos sensores eletrônicos que controlam esta bomba. */
  sensores: string[];
  /**
   * Modo de controle da bomba:
   *  - 'auto'      → segue os sensores (histerese/arbitragem). Default.
   *  - 'ligado'    → forçada LIGADA (ainda sujeita à proteção a seco).
   *  - 'desligado' → forçada DESLIGADA.
   */
  modoControle?: 'auto' | 'ligado' | 'desligado';
  /** Estado atual liga/desliga (mutável durante a execução). */
  ligada?: boolean;
  /**
   * Bomba dupla em REVEZAMENTO: uma única bomba (mesmos sensores, mesma vazão e
   * mesma tubulação) desenhada como um círculo dividido em duas metades ("1" e
   * "2"). A cada ACIONAMENTO (borda de subida do liga), a metade ativa alterna —
   * quem rodou por último descansa no ciclo seguinte. É só rodízio de desgaste:
   * hidraulicamente equivale a uma bomba comum.
   */
  revezamento?: boolean;
  /** Revezamento: metade atualmente/último a assumir (1 ou 2). Estado transitório. */
  unidadeAtiva?: 1 | 2;
}

export interface PropsFonte {
  vazaoFixa: number;
  boia?: NivelControle;
}

// consumo — ponto de saída/demanda: retira água do reservatório de origem a uma
// vazão configurável e a descarta (sem destino no grafo). É o oposto da Fonte.
export interface PropsConsumo {
  /** Vazão de saída no perfil 'fixo' (limitada pelo que houver disponível). */
  vazaoDemanda: number;
  /** Controle manual on/off da saída. */
  aberto?: boolean;
  /**
   * Perfil de consumo ao longo do tempo. 'fixo' = constante; 'senoidal' = varia
   * suavemente entre min e max; 'intermitente' = liga/desliga (onda quadrada).
   * Determinístico em função do tempo de simulação.
   */
  perfil?: 'fixo' | 'senoidal' | 'intermitente';
  /** Perfis variáveis: vazão mínima e máxima. */
  vazaoMin?: number;
  vazaoMax?: number;
  /** Período do ciclo, em segundos (perfis variáveis). */
  periodo?: number;
  /** Intermitente: fração do período com a saída ligada (0..1). */
  cicloLigado?: number;
}

export type PropsSensor = NivelControle & {
  /** IDs das bombas controladas por este sensor (um sensor pode reger várias). */
  bombasAlvo: string[];
  /** Estado interno do sensor (pedido de liga/desliga do tick anterior). */
  pedindoLigar?: boolean;
  /** Instante (s de simulação) da última troca de estado — usado pelo delay. */
  ultimaTroca?: number;
};

// Junção: nó sem volume que divide/soma a vazão. Pode ter um diâmetro interno
// opcional (mm) que ESTRANGULA o fluxo que passa por ela (como um cano estreito).
export interface PropsJuncao {
  /** Diâmetro interno em MILÍMETROS que limita o fluxo pela junção (opcional). */
  diametro?: number;
  /**
   * Rótulo da bitola pré-configurada selecionada (ex.: 'DN110'), do catálogo em
   * `tubosCatalogo.ts` — mesma lista dos tubos. Apenas informativo/UI: selecionar
   * um preset grava `diametro` = diâmetro interno tabelado; editar o mm na mão
   * limpa a bitola (vira "Personalizado").
   */
  bitola?: string;
}

export type PropsPorTipo =
  | PropsReservatorio
  | PropsTubo
  | PropsBomba
  | PropsFonte
  | PropsConsumo
  | PropsSensor
  | PropsJuncao;

// ---------------------------------------------------------------------------
// Entidades principais
// ---------------------------------------------------------------------------

export interface Peca {
  id: string; // uuid (identidade estável — referenciada por conexões/sensores)
  tipo: TipoPeca;
  /** Nome amigável exibido na UI. Se ausente, mostra o id. Editável. */
  rotulo?: string;
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
          : T extends 'consumo'
            ? PropsConsumo
            : T extends 'sensor'
              ? PropsSensor
              : PropsJuncao;
};

export const isReservatorio = (p: Peca): p is PecaDe<'reservatorio'> =>
  p.tipo === 'reservatorio';
export const isTubo = (p: Peca): p is PecaDe<'tubo'> => p.tipo === 'tubo';
export const isBomba = (p: Peca): p is PecaDe<'bomba'> => p.tipo === 'bomba';
export const isFonte = (p: Peca): p is PecaDe<'fonte'> => p.tipo === 'fonte';
export const isConsumo = (p: Peca): p is PecaDe<'consumo'> =>
  p.tipo === 'consumo';
export const isSensor = (p: Peca): p is PecaDe<'sensor'> => p.tipo === 'sensor';
export const isJuncao = (p: Peca): p is PecaDe<'juncao'> => p.tipo === 'juncao';
