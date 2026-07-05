/**
 * HydroFlow — Motor de simulação (Sprint 2, seção 4)
 *
 * Motor puro, desacoplado de React: recebe um `ProjetoSimulacao` e devolve o
 * estado do próximo tick. Nenhuma dependência de DOM/canvas — testável isolado.
 *
 * FÍSICA SIMPLIFICADA (Torricelli + continuidade de volume; NÃO é CFD):
 *
 *   Vazão por gravidade (tubo):  v = √(2·g·Δh)
 *                                A = π·(diametro/2)²
 *                                Q = A·v
 *   Δh = (cotaBase + nivel)_origem − (cotaBase + nivel)_destino
 *        (sempre a carga hidráulica total; nunca só o nível bruto)
 *   Bomba:   Q = vazaoNominal           (sem curva)
 *            Q = vazaoNominal − k·Δh_lift (com curva), Δh_lift = carga a vencer
 *            Sentido forçado pela conexão, independe do Δh natural.
 *   Fonte:   Q = vazaoFixa (constante, externa ao grafo)
 *
 * ORDEM DE AVALIAÇÃO NO tick():
 *   1. Sensores e boias avaliam com base no ESTADO DO TICK ANTERIOR.
 *   2. Arbitragem de bombas (desligar > ligar; OR entre "ligar").
 *   3. Cálculo de vazão de cada aresta (tubo, bomba, fonte).
 *   4. Atualização de volume/nível de cada reservatório.
 *   5. Aplicação de overflow (clipping na alturaMaxima).
 */

import {
  isBomba,
  isConsumo,
  isFonte,
  isReservatorio,
  isSensor,
  isTubo,
  type Conexao,
  type Peca,
  type PecaDe,
  type ProjetoSimulacao,
} from '../domain/types';
import {
  areaTuboM2,
  nivelDeVolumeM3,
  vazaoDeM3,
  vazaoParaM3,
  volumeM3DeNivel,
  volumeMaximoM3,
} from './geometria';
import { metrosPorComprimento } from '../domain/unidades';
import { arbitrarBomba, avaliarSensor, boiaAberta, type Decisao } from './arbitragem';
import type { Unidades } from '../domain/types';

/** Um movimento de líquido resolvido para um tick (vazão em m³/s). */
interface FluxoResolvido {
  /** Reservatório de onde sai o volume (null = fonte externa). */
  origem: string | null;
  /** Reservatório para onde entra o volume (null = descarte externo). */
  destino: string | null;
  /** Vazão volumétrica em m³/s, sempre ≥ 0. */
  vazao: number;
}

export interface ResultadoTick {
  /** Novo estado do projeto (nível, ligada, estados de sensor atualizados). */
  projeto: ProjetoSimulacao;
  /** Vazão calculada por peça condutora (id → Q), para telemetria/UI. */
  vazoes: Record<string, number>;
  /** Reservatórios que transbordaram neste tick. */
  overflow: string[];
  /** Bombas desligadas por proteção contra funcionamento a seco. */
  bombasASeco: string[];
  /** Tubos cuja boia está fechada neste tick (destino cheio). */
  boiasFechadas: string[];
  /** Tubos ladrão em transbordo neste tick (origem acima do nível de ladrão). */
  ladroesAtivos: string[];
  /** Decisão corrente de cada sensor (id → 'ligar' | 'desligar' | 'manter'). */
  sensores: Record<string, Decisao>;
  /** Tempo de simulação acumulado (s) após este tick. */
  tempo: number;
}

/** Carga hidráulica total de um reservatório em METROS: (cotaBase + nível)·kL. */
function cargaM(peca: PecaDe<'reservatorio'>, kL: number): number {
  return (peca.props.cotaBase + (peca.props.nivel ?? 0)) * kL;
}

/**
 * Reservatório VAZIO: sem coluna d'água na origem não há o que escoar, ainda que
 * a carga (cotaBase + nível) seja positiva pela elevação. Evita vazão "fantasma"
 * saindo de um tanque vazio.
 */
function reservatorioVazio(r: PecaDe<'reservatorio'>): boolean {
  return (r.props.nivel ?? 0) <= 1e-9;
}

/**
 * Índices de vizinhança para consultas O(1) durante o tick.
 */
class GrafoIndex {
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
   * reservatório, informando também se o caminho está ABERTO. Um caminho fecha
   * quando um tubo em série tem o registro fechado OU uma boia fechada. A boia é
   * mecânica: monitora o reservatório de destino (fecha ao encher) — por isso só
   * é avaliada no sentido 'down' (empurrando água para o destino).
   */
  resolverFluxo(
    start: string,
    dir: 'up' | 'down',
    visitado = new Set<string>(),
  ): { res: PecaDe<'reservatorio'> | null; aberto: boolean; tubos: string[] } {
    if (visitado.has(start)) return { res: null, aberto: true, tubos: [] };
    visitado.add(start);
    const peca = this.porId.get(start);
    if (!peca) return { res: null, aberto: true, tubos: [] };
    if (isReservatorio(peca)) return { res: peca, aberto: true, tubos: [] };

    const arestas = dir === 'up' ? this.entrada.get(start) : this.saida.get(start);
    for (const c of arestas ?? []) {
      const prox = dir === 'up' ? c.origem : c.destino;
      const sub = this.resolverFluxo(prox, dir, visitado);
      if (!sub.res) continue;
      let aberto = sub.aberto;
      const tubos = sub.tubos;
      if (isTubo(peca)) {
        tubos.push(peca.id); // cano atravessado por este caminho de fluxo
        if (peca.props.registro && !peca.props.registro.aberto) {
          aberto = false; // registro fechado
        } else if (
          peca.props.boia &&
          dir === 'down' &&
          !boiaAberta(peca.props.boia, sub.res.props.nivel ?? 0, true)
        ) {
          aberto = false; // boia fechada (destino cheio)
        }
      }
      return { res: sub.res, aberto, tubos };
    }
    return { res: null, aberto: true, tubos: [] };
  }
}

/** Reservatório que um sensor/boia monitora: o reservatório a ele conectado. */
function reservatorioMonitorado(
  idx: GrafoIndex,
  pecaId: string,
): PecaDe<'reservatorio'> | null {
  // Tenta ambos os sentidos — o sensor pode estar ligado por qualquer porta.
  return (
    idx.resolverReservatorio(pecaId, 'up') ??
    idx.resolverReservatorio(pecaId, 'down')
  );
}

/** Executa um passo de simulação. Não muta a entrada (retorna novo projeto). */
export function tick(projeto: ProjetoSimulacao, tempoAtual = 0): ResultadoTick {
  const proj: ProjetoSimulacao = structuredClone(projeto);
  const idx = new GrafoIndex(proj);
  const dt = proj.configuracaoSimulacao.dt;
  const g = proj.configuracaoSimulacao.g;
  const tempoFim = tempoAtual + dt;

  // ---- (1) Sensores avaliam sobre o estado do tick anterior -------------
  const decisoesPorBomba = new Map<string, Decisao[]>();
  const sensores: Record<string, Decisao> = {};
  for (const p of proj.pecas) {
    if (!isSensor(p)) continue;
    const resMon = reservatorioMonitorado(idx, p.id);
    const nivel = resMon?.props.nivel ?? 0;
    const decisao = avaliarSensor(p.props, nivel, tempoAtual);
    sensores[p.id] = decisao;
    const lista = decisoesPorBomba.get(p.props.bombaAlvo) ?? [];
    lista.push(decisao);
    decisoesPorBomba.set(p.props.bombaAlvo, lista);
  }

  // ---- (2) Arbitragem de bombas + proteção contra seco -----------------
  const bombasASeco: string[] = [];
  for (const p of proj.pecas) {
    if (!isBomba(p)) continue;
    const decisoes = decisoesPorBomba.get(p.id) ?? [];
    let ligada = arbitrarBomba(decisoes, p.props.ligada ?? false);

    const origem = idx.resolverReservatorio(p.id, 'up');
    const limiteSeco = p.props.protecaoSeco ?? 0;
    if (ligada && origem && (origem.props.nivel ?? 0) <= limiteSeco) {
      ligada = false; // bomba a seco: desliga independentemente dos sensores
      bombasASeco.push(p.id);
    }
    p.props.ligada = ligada;
  }

  // ---- (3) Cálculo de vazão de cada aresta condutora (em m³/s) ---------
  const u = proj.unidades;
  const fluxos: FluxoResolvido[] = [];
  const vazoesM3: Record<string, number> = {};

  // Elementos ATIVOS primeiro: além da própria vazão, anotam a vazão nos tubos
  // em série pelos quais empurram a água (para a telemetria/animação refletir o
  // fluxo que passa por esses canos).
  for (const p of proj.pecas) {
    if (isBomba(p)) vazoesM3[p.id] = calcularBomba(idx, p, g, u, fluxos, vazoesM3);
    else if (isFonte(p)) vazoesM3[p.id] = calcularFonte(idx, p, u, fluxos, vazoesM3);
    else if (isConsumo(p)) vazoesM3[p.id] = calcularConsumo(idx, p, g, u, tempoAtual, fluxos, vazoesM3);
  }
  // Tubos por gravidade / ladrão: só os que ainda não foram atribuídos por um
  // elemento ativo (um cano alimentado por fonte/bomba tem sua vazão dada pelo
  // driver).
  const ladroesAtivos: string[] = [];
  for (const p of proj.pecas) {
    if (isTubo(p) && vazoesM3[p.id] === undefined) {
      vazoesM3[p.id] = calcularTubo(idx, p, g, u, fluxos, ladroesAtivos);
    }
  }

  // Estado das boias (para a UI colorir): fechada quando o reservatório de
  // destino está cheio. Avaliado sobre os níveis do início do tick.
  const boiasFechadas: string[] = [];
  for (const p of proj.pecas) {
    if (!isTubo(p) || !p.props.boia) continue;
    const down = idx.resolverReservatorio(p.id, 'down');
    if (down && !boiaAberta(p.props.boia, down.props.nivel ?? 0, true)) {
      boiasFechadas.push(p.id);
    }
  }

  // ---- (4 + 5) Atualização de volume e overflow ------------------------
  const overflow = aplicarFluxos(proj, u, fluxos, dt);

  // Persiste estado dos sensores (ultimaTroca / pedindoLigar) p/ delay.
  atualizarEstadoSensores(proj, idx, tempoFim);

  // Telemetria: converte as vazões de m³/s para a unidade do usuário (volume/s).
  const vazoes: Record<string, number> = {};
  for (const [id, q] of Object.entries(vazoesM3)) vazoes[id] = vazaoDeM3(q, u);

  return {
    projeto: proj,
    vazoes,
    overflow,
    bombasASeco,
    boiasFechadas,
    ladroesAtivos,
    sensores,
    tempo: tempoFim,
  };
}

// ---------------------------------------------------------------------------
// Cálculo por tipo de aresta
// ---------------------------------------------------------------------------

function calcularTubo(
  idx: GrafoIndex,
  tubo: PecaDe<'tubo'>,
  g: number,
  u: Unidades,
  fluxos: FluxoResolvido[],
  ladroesAtivos: string[],
): number {
  const { registro, boia, checkValve, diametro, ladrao } = tubo.props;
  if (registro && !registro.aberto) return 0; // registro fechado

  const up = idx.resolverReservatorio(tubo.id, 'up', true);
  const down = idx.resolverReservatorio(tubo.id, 'down', true);
  // Sem reservatório a montante não há coluna d'água que gere fluxo por
  // gravidade. Se o lado de montante é uma fonte/bomba (não-reservatório), quem
  // move a água é esse elemento ativo — o tubo não deve inventar refluxo.
  if (!up) return 0;

  const kL = metrosPorComprimento(u);
  const areaM2 = areaTuboM2(diametro);

  // Tubo ladrão: só escoa o EXCEDENTE acima do nível de acionamento (a coluna
  // acima do lábio é a carga que empurra o transbordo — autolimitante).
  if (ladrao && Number.isFinite(ladrao.nivel)) {
    const excesso = (up.props.nivel ?? 0) - ladrao.nivel;
    if (excesso <= 1e-9) return 0; // abaixo do lábio → sem transbordo
    const v = Math.sqrt(2 * g * excesso * kL);
    const q = areaM2 * v;
    fluxos.push({ origem: up.id, destino: down?.id ?? null, vazao: q });
    ladroesAtivos.push(tubo.id);
    return q;
  }

  const hUp = cargaM(up, kL);
  const hDown = down ? cargaM(down, kL) : 0; // destino ausente = saída ao ambiente
  const deltaH = hUp - hDown;

  // Boia mecânica: monitora o reservatório de destino (fecha quando cheio).
  if (boia && down) {
    const aberta = boiaAberta(boia, down.props.nivel ?? 0, true);
    if (!aberta) return 0;
  }

  if (Math.abs(deltaH) < 1e-12) return 0;

  const v = Math.sqrt(2 * g * Math.abs(deltaH));
  const q = areaM2 * v;

  if (deltaH > 0) {
    // Fluxo natural origem→destino.
    if (reservatorioVazio(up)) return 0; // origem vazia → nada a escoar
    fluxos.push({ origem: up.id, destino: down?.id ?? null, vazao: q });
    return q;
  }
  // deltaH < 0 → refluxo destino→origem, bloqueado por checkValve.
  if (checkValve) return 0;
  if (!down || reservatorioVazio(down)) return 0; // origem do refluxo vazia → sem fluxo
  fluxos.push({ origem: down.id, destino: up.id, vazao: q });
  return -q; // sinal indica sentido reverso na telemetria
}

/** Anota a vazão (m³/s) de um caminho nos tubos em série (telemetria/animação). */
function anotarTubos(vazoes: Record<string, number>, tubos: string[], q: number): void {
  for (const t of tubos) vazoes[t] = (vazoes[t] ?? 0) + q;
}

function calcularBomba(
  idx: GrafoIndex,
  bomba: PecaDe<'bomba'>,
  g: number,
  u: Unidades,
  fluxos: FluxoResolvido[],
  vazoes: Record<string, number>,
): number {
  if (!bomba.props.ligada) return 0;

  // Fonte de sucção respeitando válvulas em série (registro/boia). Sem origem
  // alcançável ou com o caminho fechado, a bomba não move nada.
  const upPath = idx.resolverFluxo(bomba.id, 'up');
  if (!upPath.res || !upPath.aberto) return 0;
  const up = upPath.res;
  const kL = metrosPorComprimento(u);
  const hUp = cargaM(up, kL);

  void g; // a bomba é forçada (não usa Torricelli); g mantém a assinatura uniforme

  // Uma bomba pode alimentar múltiplas saídas (ex.: recalque para dois
  // reservatórios). Primeiro descobrimos quais saídas estão realmente ABERTAS
  // (registro/boia/destino) — a vazão nominal é dividida só entre elas. Assim,
  // fechar uma saída NÃO desperdiça a sua parcela: a bomba manda a vazão cheia
  // pelas saídas que restam. Empurrar para um reservatório cheio é permitido
  // (transborda, com alerta do ladrão) — só o consumo em 0 não recebe fluxo.
  const abertas = (idx.saida.get(bomba.id) ?? [])
    .map((c) => ({ c, dp: idx.resolverFluxo(c.destino, 'down') }))
    .filter((x) => x.dp.res && x.dp.aberto);
  const m = abertas.length;
  if (m === 0) return 0; // nenhuma saída aberta → bomba não move nada

  let total = 0;
  for (const { c, dp } of abertas) {
    const down = dp.res!;
    const liftM = cargaM(down, kL) - hUp; // carga (m) a vencer nesta saída
    const base = c.vazaoAlocada ?? bomba.props.vazaoNominal / m;
    const qUser = bomba.props.curva ? base - bomba.props.curva.k * liftM : base;
    const q = vazaoParaM3(Math.max(0, qUser), u); // bomba não gera vazão negativa

    if (q > 0) {
      fluxos.push({ origem: up.id, destino: down.id, vazao: q });
      anotarTubos(vazoes, dp.tubos, q); // canos de recalque desta saída
      total += q;
    }
  }
  if (total > 0) anotarTubos(vazoes, upPath.tubos, total); // canos de sucção
  return total;
}

function calcularFonte(
  idx: GrafoIndex,
  fonte: PecaDe<'fonte'>,
  u: Unidades,
  fluxos: FluxoResolvido[],
  vazoes: Record<string, number>,
): number {
  const saidas = idx.saida.get(fonte.id) ?? [];
  if (saidas.length === 0) return 0;

  let total = 0;
  for (const c of saidas) {
    // Caminho fechado (registro OU boia de um tubo em série) → não abastece.
    const dp = idx.resolverFluxo(c.destino, 'down');
    if (!dp.res || !dp.aberto) continue;
    const down = dp.res;
    // Múltiplos destinos: usa vazaoAlocada; destino único usa vazaoFixa.
    const qAlvo =
      saidas.length > 1
        ? (c.vazaoAlocada ?? 0)
        : (c.vazaoAlocada ?? fonte.props.vazaoFixa);

    // Boia da própria fonte: fecha quando o destino está cheio.
    let qUser = qAlvo;
    if (fonte.props.boia) {
      const aberta = boiaAberta(fonte.props.boia, down.props.nivel ?? 0, true);
      if (!aberta) qUser = 0;
    }
    const q = vazaoParaM3(Math.max(0, qUser), u);
    if (q > 0) {
      fluxos.push({ origem: null, destino: down.id, vazao: q });
      anotarTubos(vazoes, dp.tubos, q); // canos entre a fonte e o destino
      total += q;
    }
  }
  return total;
}

/**
 * Demanda de um consumo no instante `tempo`, conforme o perfil (na unidade do
 * usuário). Determinístico — sem aleatoriedade — para manter o motor testável.
 */
function demandaConsumo(props: PecaDe<'consumo'>['props'], tempo: number): number {
  const perfil = props.perfil ?? 'fixo';
  if (perfil === 'fixo') return Math.max(0, props.vazaoDemanda);

  const min = Math.max(0, props.vazaoMin ?? 0);
  const max = Math.max(min, props.vazaoMax ?? props.vazaoDemanda);
  const periodo = props.periodo && props.periodo > 0 ? props.periodo : 60;

  if (perfil === 'senoidal') {
    return min + (max - min) * (0.5 + 0.5 * Math.sin((2 * Math.PI * tempo) / periodo));
  }
  // intermitente: onda quadrada (ligado em `max` durante `cicloLigado` do período).
  const duty = Math.min(1, Math.max(0, props.cicloLigado ?? 0.5));
  const fase = (((tempo % periodo) + periodo) % periodo) / periodo;
  return fase < duty ? max : min;
}

function calcularConsumo(
  idx: GrafoIndex,
  consumo: PecaDe<'consumo'>,
  g: number,
  u: Unidades,
  tempo: number,
  fluxos: FluxoResolvido[],
  vazoes: Record<string, number>,
): number {
  const cp = idx.resolverFluxo(consumo.id, 'up');
  // REIVINDICA os canos do caminho do consumo (mesmo com demanda 0, consumo
  // fechado ou caminho bloqueado). Sem isso, o cano ficaria "sem dono" e o
  // calcularTubo o trataria como ralo para o ambiente, drenando o reservatório
  // na vazão cheia da gravidade e ignorando a demanda do consumo. É QUEM o
  // consumo consome que sai — nada mais.
  const reivindicar = (q: number): void => {
    if (cp.tubos.length > 0) anotarTubos(vazoes, cp.tubos, q);
  };

  if (!cp.res) return 0; // sem reservatório de origem → nada a drenar
  if (consumo.props.aberto === false || !cp.aberto || reservatorioVazio(cp.res)) {
    reivindicar(0); // fechado, caminho bloqueado ou origem vazia → sem fluxo
    return 0;
  }
  const up = cp.res;
  const kL = metrosPorComprimento(u);

  let q = vazaoParaM3(demandaConsumo(consumo.props, tempo), u);
  // Realismo: a saída é limitada pela CAPACIDADE do cano mais estreito no
  // caminho (Torricelli pelo diâmetro e pela carga). Canos finos estrangulam.
  if (cp.tubos.length > 0) {
    const headM = cargaM(up, kL); // carga do reservatório até a saída (cota 0)
    let capMin = Infinity;
    for (const tid of cp.tubos) {
      const t = idx.porId.get(tid);
      if (t && isTubo(t)) {
        capMin = Math.min(capMin, areaTuboM2(t.props.diametro) * Math.sqrt(2 * g * Math.max(0, headM)));
      }
    }
    q = Math.min(q, capMin);
  }
  reivindicar(q); // canos entre o reservatório e o consumo (0 se demanda 0)
  if (q > 0) {
    fluxos.push({ origem: up.id, destino: null, vazao: q });
  }
  return q;
}

// ---------------------------------------------------------------------------
// Aplicação de fluxos → volumes → overflow (tudo em m³)
// ---------------------------------------------------------------------------

function aplicarFluxos(
  proj: ProjetoSimulacao,
  u: Unidades,
  fluxos: FluxoResolvido[],
  dt: number,
): string[] {
  // Volume atual (m³) por reservatório.
  const volume = new Map<string, number>();
  for (const p of proj.pecas) {
    if (isReservatorio(p)) {
      volume.set(p.id, volumeM3DeNivel(p.props, p.props.nivel ?? 0, u));
    }
  }

  // Limita saídas para não drenar abaixo de zero: escala proporcionalmente
  // quando a soma das saídas de um reservatório excede seu volume disponível.
  const saidaPorRes = new Map<string, number>();
  for (const f of fluxos) {
    if (f.origem) saidaPorRes.set(f.origem, (saidaPorRes.get(f.origem) ?? 0) + f.vazao * dt);
  }
  const escala = new Map<string, number>();
  for (const [id, saidaVol] of saidaPorRes) {
    const disp = volume.get(id) ?? 0;
    escala.set(id, saidaVol > disp && saidaVol > 0 ? disp / saidaVol : 1);
  }

  // Aplica cada fluxo (com escala na origem).
  for (const f of fluxos) {
    const fator = f.origem ? (escala.get(f.origem) ?? 1) : 1;
    const vol = f.vazao * dt * fator;
    if (f.origem) volume.set(f.origem, (volume.get(f.origem) ?? 0) - vol);
    if (f.destino && volume.has(f.destino)) {
      volume.set(f.destino, (volume.get(f.destino) ?? 0) + vol);
    }
    // destino null (ou junção sem volume) → volume descartado do grafo.
  }

  // Converte de volta para nível e aplica overflow (clipping na alturaMaxima).
  const overflow: string[] = [];
  for (const p of proj.pecas) {
    if (!isReservatorio(p)) continue;
    let vol = volume.get(p.id) ?? 0;
    const vMax = volumeMaximoM3(p.props, u);
    if (vol > vMax) {
      overflow.push(p.id); // excedente se perde (transborda), sem travar o tick
      vol = vMax;
    }
    if (vol < 0) vol = 0;
    p.props.nivel = nivelDeVolumeM3(p.props, vol, u);
  }
  return overflow;
}

/**
 * Registra a última troca de estado de cada sensor (para o `delay`) e o pedido
 * corrente. Executado ao final do tick para que o próximo tick veja o histórico.
 */
function atualizarEstadoSensores(
  proj: ProjetoSimulacao,
  idx: GrafoIndex,
  tempo: number,
): void {
  for (const p of proj.pecas) {
    if (!isSensor(p)) continue;
    const resMon = reservatorioMonitorado(idx, p.id);
    const nivel = resMon?.props.nivel ?? 0;
    const decisao = avaliarSensor(p.props, nivel, tempo);
    const querLigar =
      decisao === 'ligar' ? true : decisao === 'desligar' ? false : p.props.pedindoLigar;
    if (querLigar !== p.props.pedindoLigar) {
      p.props.ultimaTroca = tempo;
      p.props.pedindoLigar = querLigar;
    }
  }
}

/** Roda N ticks encadeando estado e tempo (controle de velocidade — seção 7). */
export function rodarTicks(
  projeto: ProjetoSimulacao,
  n: number,
  tempoInicial = 0,
): ResultadoTick {
  let estado = projeto;
  let tempo = tempoInicial;
  let ultimo: ResultadoTick = {
    projeto,
    vazoes: {},
    overflow: [],
    bombasASeco: [],
    boiasFechadas: [],
    ladroesAtivos: [],
    sensores: {},
    tempo,
  };
  for (let i = 0; i < n; i++) {
    ultimo = tick(estado, tempo);
    estado = ultimo.projeto;
    tempo = ultimo.tempo;
  }
  return ultimo;
}
