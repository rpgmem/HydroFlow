/**
 * HydroFlow — Índice de grafo e primitivas estruturais do motor.
 *
 * Camada FUNDACIONAL da engine: a topologia (quem conecta com quem) e as
 * travessias que respondem "qual reservatório/terminal está deste lado". Sem
 * nenhuma física (Torricelli/atrito/bomba) — depende só de `domain/types`. Por
 * isso é importável tanto pelo `simulador.ts` (o tick) quanto pelo
 * `redeJuncoes.ts` (a rede) sem criar ciclo de import.
 */
import {
  isBomba,
  isConsumo,
  isFonte,
  isReservatorio,
  isTubo,
  type Conexao,
  type Peca,
  type PecaDe,
  type ProjetoSimulacao,
} from '../domain/types';

/** Um movimento de líquido resolvido para um tick (vazão em m³/s). */
export interface FluxoResolvido {
  /** Reservatório de onde sai o volume (null = fonte externa). */
  origem: string | null;
  /** Reservatório para onde entra o volume (null = descarte externo). */
  destino: string | null;
  /** Vazão volumétrica em m³/s, sempre ≥ 0. */
  vazao: number;
}

/** Carga hidráulica total de um reservatório em METROS: (cotaBase + nível)·kL. */
export function cargaM(peca: PecaDe<'reservatorio'>, kL: number): number {
  return (peca.props.cotaBase + (peca.props.nivel ?? 0)) * kL;
}

/**
 * Reservatório VAZIO: sem coluna d'água na origem não há o que escoar, ainda que
 * a carga (cotaBase + nível) seja positiva pela elevação. Evita vazão "fantasma"
 * saindo de um tanque vazio.
 */
export function reservatorioVazio(r: PecaDe<'reservatorio'>): boolean {
  return (r.props.nivel ?? 0) <= 1e-9;
}

/**
 * Índices de vizinhança para consultas O(1) durante o tick.
 */
export class GrafoIndex {
  readonly porId: Map<string, Peca>;
  /** conexões de saída (origem == id). */
  readonly saida: Map<string, Conexao[]>;
  /** conexões de entrada (destino == id). */
  readonly entrada: Map<string, Conexao[]>;

  constructor(projeto: ProjetoSimulacao) {
    this.porId = new Map(projeto.pecas.map((p) => [p.id, p]));
    this.saida = new Map();
    this.entrada = new Map();
    const anexar = (m: Map<string, Conexao[]>, k: string, c: Conexao): void => {
      const lista = m.get(k);
      if (lista) lista.push(c);
      else m.set(k, [c]);
    };
    for (const c of projeto.conexoes) {
      anexar(this.saida, c.origem, c);
      anexar(this.entrada, c.destino, c);
    }
  }

  /**
   * Caminha em uma direção atravessando junções/condutores até achar um
   * reservatório. 'up' segue arestas de entrada; 'down' segue arestas de saída.
   *
   * Com `bloquearFechados`, um tubo de **registro fechado** é intransponível —
   * usado nas resoluções de FLUXO (bomba/fonte/consumo) para que fechar o
   * registro de um cano em série realmente interrompa o fluxo que passa por ele.
   * Resoluções que só observam nível (sensores) usam `false`.
   */
  resolverReservatorio(
    start: string,
    dir: 'up' | 'down',
    bloquearFechados = false,
    visitado = new Set<string>(),
  ): PecaDe<'reservatorio'> | null {
    if (visitado.has(start)) return null;
    visitado.add(start);
    const peca = this.porId.get(start);
    if (!peca) return null;
    if (isReservatorio(peca)) return peca;
    // Tubo com registro fechado corta o caminho do fluxo.
    if (
      bloquearFechados &&
      isTubo(peca) &&
      peca.props.registro &&
      !peca.props.registro.aberto
    ) {
      return null;
    }
    // Junção (ou qualquer nó de passagem) → continua atravessando.
    const arestas = dir === 'up' ? this.entrada.get(start) : this.saida.get(start);
    for (const c of arestas ?? []) {
      const prox = dir === 'up' ? c.origem : c.destino;
      const r = this.resolverReservatorio(prox, dir, bloquearFechados, visitado);
      if (r) return r;
    }
    return null;
  }

  /**
   * Resolve o caminho de FLUXO de um condutor ativo (bomba/fonte/consumo) até o
   * TERMINAL — um reservatório (`res`) ou um ponto de consumo (`consumo`) —,
   * informando também se o caminho está ABERTO. Fecha quando um tubo em série tem
   * registro fechado OU boia fechada. A boia é mecânica: monitora o reservatório
   * de destino (fecha ao encher) — só avaliada no sentido 'down'.
   *
   * `ehRaiz` distingue o nó de partida dos intermediários: no meio do caminho, um
   * consumo é terminal (dreno) e uma bomba/fonte é BARREIRA (elemento ativo
   * governa o próprio fluxo — não se atravessa). Na raiz isso não vale, para a
   * própria bomba resolver a sucção e o próprio consumo achar sua origem.
   */
  resolverFluxo(
    start: string,
    dir: 'up' | 'down',
    visitado = new Set<string>(),
    ehRaiz = true,
  ): {
    res: PecaDe<'reservatorio'> | null;
    consumo: PecaDe<'consumo'> | null;
    aberto: boolean;
    tubos: string[];
  } {
    const vazio = { res: null, consumo: null, aberto: true, tubos: [] };
    if (visitado.has(start)) return vazio;
    visitado.add(start);
    const peca = this.porId.get(start);
    if (!peca) return vazio;
    if (isReservatorio(peca)) return { res: peca, consumo: null, aberto: true, tubos: [] };
    // Consumo é terminal (dreno), inclusive na raiz de uma consulta 'down' (bomba
    // ligada direto no consumo). Exceção: a raiz de uma consulta 'up' é o próprio
    // consumo perguntando qual é a sua origem — aí atravessa.
    if (isConsumo(peca) && !(ehRaiz && dir === 'up')) {
      return { res: null, consumo: peca, aberto: true, tubos: [] };
    }
    // Elemento ativo (bomba/fonte) é barreira no meio do caminho: ele governa o
    // próprio fluxo, não se atravessa por gravidade.
    if (!ehRaiz && (isBomba(peca) || isFonte(peca))) return vazio;

    const arestas = dir === 'up' ? this.entrada.get(start) : this.saida.get(start);
    for (const c of arestas ?? []) {
      const prox = dir === 'up' ? c.origem : c.destino;
      const sub = this.resolverFluxo(prox, dir, visitado, false);
      if (!sub.res && !sub.consumo) continue;
      let aberto = sub.aberto;
      const tubos = sub.tubos;
      if (isTubo(peca)) {
        tubos.push(peca.id); // cano atravessado por este caminho de fluxo
        const b = peca.props.boia;
        if (peca.props.registro && !peca.props.registro.aberto) {
          aberto = false; // registro fechado
        } else if (b && !(b.aberta ?? true)) {
          aberto = false; // boia fechada (estado calculado no passo 2b)
        }
      }
      return { res: sub.res, consumo: sub.consumo, aberto, tubos };
    }
    return vazio;
  }
}
