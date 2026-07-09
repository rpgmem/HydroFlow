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
  type PropsJuncao,
} from '../domain/types';
import {
  areaTuboM2,
  nivelDeVolumeM3,
  vazaoDeM3,
  vazaoParaM3,
  velocidadeTuboMs,
  volumeM3DeNivel,
  volumeMaximoM3,
  VELOCIDADE_MAX_RECOMENDADA_MS,
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
  /** Tubos com velocidade acima da recomendada (subdimensionados) neste tick. */
  tubosVelozes: string[];
  /** Tubos com fluxo contrário à seta (refluxo) neste tick — inesperado. */
  refluxos: string[];
  /** Consumos cuja demanda excede a vazão da bomba que os alimenta (déficit). */
  consumoInsuficiente: string[];
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
    // Na banda morta ('manter'), o sensor assere a SUA intenção persistida
    // (pedindoLigar) — histerese real por sensor. Sem isso, com vários sensores
    // um "manter" deixaria outro sensor vencer (ex.: o reverso segurando a bomba
    // desligada perderia para o normal pedindo ligar → chatter).
    const efetiva: Decisao =
      decisao !== 'manter'
        ? decisao
        : p.props.pedindoLigar === true
          ? 'ligar'
          : p.props.pedindoLigar === false
            ? 'desligar'
            : 'manter';
    sensores[p.id] = efetiva;
    // Persiste a intenção (para a histerese e o delay) a partir da decisão
    // EFETIVA deste tick — no início do tick, coerente com a arbitragem.
    const querLigar =
      efetiva === 'ligar' ? true : efetiva === 'desligar' ? false : p.props.pedindoLigar;
    if (querLigar !== p.props.pedindoLigar) {
      p.props.ultimaTroca = tempoAtual;
      p.props.pedindoLigar = querLigar;
    }
    // Um sensor pode reger várias bombas simultaneamente.
    for (const alvo of p.props.bombasAlvo) {
      const lista = decisoesPorBomba.get(alvo) ?? [];
      lista.push(efetiva);
      decisoesPorBomba.set(alvo, lista);
    }
  }

  // ---- (2) Controle de bombas (modo/arbitragem) -----------------------
  // 'ligado'/'desligado' forçam o estado (o botão manual); 'auto' segue os
  // sensores (normais e reversos — 'desligar' vence). A bomba NÃO desliga sozinha
  // por nível: a proteção é feita por um sensor REVERSO na origem. Se mesmo assim
  // a origem esvaziar com a bomba ligada, é detectado como "rodando a seco".
  for (const p of proj.pecas) {
    if (!isBomba(p)) continue;
    const antes = p.props.ligada ?? false;
    const modo = p.props.modoControle ?? 'auto';
    let agora: boolean;
    if (modo === 'ligado') agora = true;
    else if (modo === 'desligado') agora = false;
    else agora = arbitrarBomba(decisoesPorBomba.get(p.id) ?? [], antes);
    p.props.ligada = agora;
    // Revezamento: a cada ACIONAMENTO (borda de subida) a metade ativa alterna —
    // undefined→1, 1→2, 2→1. Quem assumiu por último descansa no ciclo seguinte.
    if (p.props.revezamento && agora && !antes) {
      p.props.unidadeAtiva = p.props.unidadeAtiva === 1 ? 2 : 1;
    }
  }

  // ---- (2b) Estado das boias mecânicas (histerese persistida) ----------
  // Cada boia de tubo atualiza aberta/fechada monitorando o reservatório de
  // destino. Entre mín. e máx. mantém o estado anterior (b.aberta) — histerese
  // real, sem chatter. O resto do tick lê b.aberta.
  for (const p of proj.pecas) {
    if (!isTubo(p) || !p.props.boia) continue;
    const b = p.props.boia;
    const mon = idx.resolverReservatorio(p.id, 'down');
    if (mon) b.aberta = boiaAberta(b, mon.props.nivel ?? 0, b.aberta ?? true);
  }

  // ---- (3) Cálculo de vazão de cada aresta condutora (em m³/s) ---------
  const u = proj.unidades;
  const fluxos: FluxoResolvido[] = [];
  const vazoesM3: Record<string, number> = {};
  const consumoInsuficiente: string[] = [];
  const bombasASeco: string[] = []; // bombas ligadas com a origem vazia (rodando a seco)
  const refluxos: string[] = []; // tubos com fluxo contrário à seta (inesperado)

  const ladroesAtivos: string[] = [];
  const cadeiaResolvida = new Set<string>();
  // Junções que bifurcam/unem: resolvidas ANTES como uma REDE de vazão, para
  // dividir/somar o fluxo conservando massa no nó. Terminais (consumo/fonte/
  // bomba) ligados a uma junção entram como NÓS DE VAZÃO da própria rede — assim
  // um consumo puxando de uma união pode forçar refluxo do ramo mais alto, em vez
  // de cada driver resolver seu caminho isolado. Os terminais assim resolvidos
  // ficam em `driversResolvidos` (o laço de ativos os pula) e seus tubos em
  // `cadeiaResolvida`.
  const driversResolvidos = new Set<string>();
  resolverGravidadeComJuncoes(
    idx,
    g,
    u,
    tempoAtual,
    fluxos,
    vazoesM3,
    cadeiaResolvida,
    driversResolvidos,
    bombasASeco,
    refluxos,
  );

  // Elementos ATIVOS: além da própria vazão, anotam a vazão nos tubos em série
  // pelos quais empurram a água (para a telemetria/animação refletir o fluxo que
  // passa por esses canos). Os já resolvidos pela rede de junções são pulados.
  for (const p of proj.pecas) {
    if (driversResolvidos.has(p.id)) continue;
    if (isBomba(p)) vazoesM3[p.id] = calcularBomba(idx, p, g, u, tempoAtual, fluxos, vazoesM3, consumoInsuficiente, bombasASeco);
    else if (isFonte(p)) vazoesM3[p.id] = calcularFonte(idx, p, u, fluxos, vazoesM3);
    else if (isConsumo(p)) vazoesM3[p.id] = calcularConsumo(idx, p, g, u, tempoAtual, fluxos, vazoesM3);
  }
  // Tubos por gravidade / ladrão: só os que ainda não foram atribuídos por um
  // elemento ativo (um cano alimentado por fonte/bomba tem sua vazão dada pelo
  // driver).
  //
  // Uma CADEIA de tubos em série limitada por reservatórios nas duas pontas
  // carrega UM único fluxo, limitado pelo cano mais estreito (o gargalo). Sem
  // isso, cada tubo resolveria os mesmos reservatórios e empurraria o próprio
  // fluxo — tubos em série viravam paralelos e a origem drenava N×. Ladrão,
  // registro fechado e descarga ao ambiente/sucção seguem a lógica por tubo.
  for (const p of proj.pecas) {
    if (!isTubo(p) || vazoesM3[p.id] !== undefined || cadeiaResolvida.has(p.id)) continue;
    const fechado = p.props.registro !== undefined && !p.props.registro.aberto;
    const up = fechado || p.props.ladrao ? null : idx.resolverReservatorio(p.id, 'up', true);
    const down = fechado || p.props.ladrao ? null : idx.resolverReservatorio(p.id, 'down', true);
    if (!up || !down) {
      // Registro fechado, ladrão, descarga ao ambiente ou sucção de bomba
      // (sem reservatório nas duas pontas) → lógica por tubo, como antes.
      const q = calcularTubo(idx, p, g, u, fluxos, ladroesAtivos);
      vazoesM3[p.id] = q;
      if (q < -1e-9) refluxos.push(p.id); // fluxo contrário à seta
      continue;
    }
    // Cadeia entre dois reservatórios → resolve UMA vez, pelo gargalo (menor
    // diâmetro). Uma boia fechada em qualquer tubo da cadeia interrompe o fluxo.
    const cadeia = coletarCadeiaTubos(idx, p.id);
    cadeia.forEach((id) => cadeiaResolvida.add(id));
    const diam = (id: string): number => (idx.porId.get(id) as PecaDe<'tubo'>).props.diametro;
    const gargalo = cadeia.reduce((a, b) => (diam(b) < diam(a) ? b : a));
    const boiaFechada = cadeia.some((id) => {
      const b = (idx.porId.get(id) as PecaDe<'tubo'>).props.boia;
      return b !== undefined && !(b.aberta ?? true);
    });
    const q = boiaFechada
      ? 0
      : calcularTubo(idx, idx.porId.get(gargalo) as PecaDe<'tubo'>, g, u, fluxos, ladroesAtivos);
    for (const id of cadeia) vazoesM3[id] = q; // toda a cadeia carrega a mesma vazão
    if (q < -1e-9) cadeia.forEach((id) => refluxos.push(id)); // fluxo contrário à seta
  }

  // Tubos com velocidade acima da recomendada (v = Q/A > limite) = subdimensionados
  // para a vazão que passa. Só um aviso de dimensionamento; não altera a física.
  const tubosVelozes: string[] = [];
  for (const p of proj.pecas) {
    if (!isTubo(p)) continue;
    const v = velocidadeTuboMs(vazoesM3[p.id] ?? 0, p.props.diametro);
    if (v > VELOCIDADE_MAX_RECOMENDADA_MS + 1e-6) tubosVelozes.push(p.id);
  }

  // Boias fechadas neste tick (para a UI colorir) — estado calculado no passo 2b.
  const boiasFechadas: string[] = [];
  for (const p of proj.pecas) {
    if (isTubo(p) && p.props.boia && !(p.props.boia.aberta ?? true)) {
      boiasFechadas.push(p.id);
    }
  }

  // ---- (4 + 5) Atualização de volume e overflow ------------------------
  const overflow = aplicarFluxos(proj, u, fluxos, dt);

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
    tubosVelozes,
    refluxos,
    consumoInsuficiente,
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

  // Tubo com conexão a jusante que NÃO alcança um reservatório (leva a uma bomba
  // ou consumo) não é descarga livre ao ambiente — o elemento ativo governa esse
  // fluxo. Só um tubo PENDURADO (sem conexão a jusante) descarrega ao ambiente.
  // Sem isso, o cano de sucção de uma bomba drenava a origem à toa quando ociosa.
  if (!down && (idx.saida.get(tubo.id)?.length ?? 0) > 0) return 0;

  // Altura em que o tubo toca cada reservatório (relativa à base). Uma tomada em
  // altura só escoa a água ACIMA dela.
  const alturaEnt = tubo.props.alturaEntrada ?? 0;
  const alturaSai = tubo.props.alturaSaida ?? 0;
  const nivelUp = up.props.nivel ?? 0;
  const nivelDown = down?.props.nivel ?? 0;

  const supUp = cargaM(up, kL); // elevação da superfície da origem
  const tapUp = (up.props.cotaBase + alturaEnt) * kL; // bocal na origem
  const supDown = down ? cargaM(down, kL) : 0; // superfície do destino (0 = ambiente)
  const tapDown = down ? (down.props.cotaBase + alturaSai) * kL : 0; // bocal no destino

  // Boia mecânica: fechada interrompe o fluxo (estado calculado no passo 2b, com
  // histerese; normal monitora o destino, reversa monitora a origem).
  if (boia && !(boia.aberta ?? true)) return 0;

  // Fluxo natural origem→destino. A origem precisa ter água ACIMA do seu bocal
  // (senão o bocal "chupa ar" e nada sai). A água descarrega no MAIOR entre a
  // superfície e o bocal do destino: um bocal alto exige mais carga para ser
  // vencido (não dá para empurrar água acima da própria superfície da origem).
  if (nivelUp > alturaEnt + 1e-9) {
    const recebe = down ? Math.max(supDown, tapDown) : 0; // ambiente = solo (0)
    const deltaH = supUp - recebe;
    if (deltaH > 1e-12) {
      const q = areaM2 * Math.sqrt(2 * g * deltaH);
      fluxos.push({ origem: up.id, destino: down?.id ?? null, vazao: q });
      return q;
    }
  }

  // Refluxo destino→origem — simétrico, bloqueado por checkValve.
  if (!checkValve && down && nivelDown > alturaSai + 1e-9) {
    const deltaH = supDown - Math.max(supUp, tapUp);
    if (deltaH > 1e-12) {
      const q = areaM2 * Math.sqrt(2 * g * deltaH);
      fluxos.push({ origem: down.id, destino: up.id, vazao: q });
      return -q; // sinal indica sentido reverso na telemetria
    }
  }

  return 0;
}

/** Anota a vazão (m³/s) de um caminho nos tubos em série (telemetria/animação). */
function anotarTubos(vazoes: Record<string, number>, tubos: string[], q: number): void {
  for (const t of tubos) vazoes[t] = (vazoes[t] ?? 0) + q;
}

/**
 * Coleta os IDs dos tubos ABERTOS (não-ladrão) de uma mesma cadeia em série a
 * partir de `tuboInicial`: tubos ligados diretamente ou por junções, sem um
 * reservatório/elemento ativo no meio. Um tubo de registro fechado ou ladrão é
 * fronteira (quebra a cadeia) e não é incluído.
 */
function coletarCadeiaTubos(idx: GrafoIndex, tuboInicial: string): string[] {
  const tubos = new Set<string>();
  const visitado = new Set<string>([tuboInicial]);
  const fila: string[] = [tuboInicial];
  while (fila.length > 0) {
    const id = fila.pop()!;
    const peca = idx.porId.get(id);
    if (peca && isTubo(peca)) tubos.add(id);
    const vizinhos = [
      ...(idx.entrada.get(id) ?? []).map((c) => c.origem),
      ...(idx.saida.get(id) ?? []).map((c) => c.destino),
    ];
    for (const v of vizinhos) {
      if (visitado.has(v)) continue;
      const vp = idx.porId.get(v);
      if (!vp) continue;
      // Atravessa junções (sem volume) e tubos abertos não-ladrão; para em
      // reservatório/bomba/fonte/consumo e em tubo de registro fechado/ladrão.
      const atravessa =
        vp.tipo === 'juncao' ||
        (isTubo(vp) &&
          !vp.props.ladrao &&
          !(vp.props.registro !== undefined && !vp.props.registro.aberto));
      if (!atravessa) continue;
      visitado.add(v);
      fila.push(v);
    }
  }
  return [...tubos];
}

/**
 * Resolve as sub-redes de gravidade que contêm JUNÇÕES como uma pequena REDE DE
 * VAZÃO, para a junção realmente DIVIDIR (bifurcar) e SOMAR (unir) o fluxo,
 * conservando massa no nó. Reservatórios são nós de carga FIXA (a superfície);
 * junções são nós de carga INCÓGNITA, resolvida por iteração (Gauss-Seidel +
 * bisseção) até o fluxo líquido no nó zerar. Cada "run" de tubos em série entre
 * dois nós vira uma aresta com área = a do gargalo (menor diâmetro).
 *
 * Marca em `resolvidos` os tubos tratados (o laço de gravidade os ignora) e anota
 * a telemetria. Limitações (v1): não modela checkValve/altura DENTRO de um run
 * entre nós (uma boia fechada, sim, bloqueia o run). Para esses casos, use um
 * reservatório no ponto de divisão. Um reservatório vazio pode gerar leve fluxo
 * fantasma na rede (o clamp de volume evita drená-lo abaixo de zero).
 */
interface ArestaRede {
  a: string;
  b: string;
  area: number;
  tubos: string[];
  /** Por tubo: traversal a→b coincide com o sentido origem→destino do tubo? */
  alinhado: Record<string, boolean>;
}
function resolverGravidadeComJuncoes(
  idx: GrafoIndex,
  g: number,
  u: Unidades,
  tempo: number,
  fluxos: FluxoResolvido[],
  vazoes: Record<string, number>,
  resolvidos: Set<string>,
  driversResolvidos: Set<string>,
  bombasASeco: string[],
  refluxos: string[],
): void {
  const kL = metrosPorComprimento(u);
  const ehCandidato = (p: Peca | undefined): p is PecaDe<'tubo'> =>
    !!p &&
    isTubo(p) &&
    vazoes[p.id] === undefined &&
    !p.props.ladrao &&
    !(p.props.registro !== undefined && !p.props.registro.aberto);
  const ehTerminal = (p: Peca | undefined): boolean =>
    !!p && (isConsumo(p) || isFonte(p) || isBomba(p)) && vazoes[p.id] === undefined;
  const juncoes = [...idx.porId.values()].filter((p) => p.tipo === 'juncao');
  const cargaRes = (r: PecaDe<'reservatorio'>): number => (r.props.cotaBase + (r.props.nivel ?? 0)) * kL;
  const vizinhosDe = (id: string): string[] => [
    ...(idx.entrada.get(id) ?? []).map((c) => c.origem),
    ...(idx.saida.get(id) ?? []).map((c) => c.destino),
  ];
  // Um reservatório VAZIO não FORNECE água (só recebe): sem coluna acima do fundo
  // não há o que escoar, ainda que a carga (cotaBase + nível) seja alta pela
  // elevação. Sem isso, o solver usaria a cota de fundo como carga fixa e criaria
  // fluxo FANTASMA saindo do tanque vazio — ex.: o "superior" já esvaziado ainda
  // empurrando água pela União para o "meio". O clamp de volume não bastava: a
  // vazão calculada (e a seta de refluxo) continuavam acesas.
  const resVazio = (n: string): boolean => {
    const pe = idx.porId.get(n);
    return !!pe && isReservatorio(pe) && reservatorioVazio(pe);
  };

  const compVisitada = new Set<string>();
  for (const j0 of juncoes) {
    if (compVisitada.has(j0.id)) continue;

    // --- Componente: BFS por junções + tubos candidatos; reservatório = fronteira;
    // consumo/fonte/bomba = TERMINAIS (nós de vazão, também fronteira).
    const juncSet = new Set<string>();
    const tuboSet = new Set<string>();
    const resSet = new Set<string>();
    const terminais = new Set<string>();
    const fila = [j0.id];
    const vis = new Set([j0.id]);
    while (fila.length) {
      const id = fila.pop()!;
      const pe = idx.porId.get(id)!;
      if (pe.tipo === 'juncao') {
        juncSet.add(id);
        compVisitada.add(id);
      } else if (isTubo(pe)) tuboSet.add(id);
      for (const v of vizinhosDe(id)) {
        const vp = idx.porId.get(v);
        if (!vp) continue;
        if (isReservatorio(vp)) {
          resSet.add(v);
        } else if (ehTerminal(vp)) {
          terminais.add(v);
        } else if ((vp.tipo === 'juncao' || ehCandidato(vp)) && !vis.has(v)) {
          vis.add(v);
          fila.push(v);
        }
      }
    }

    // --- Runs (arestas) entre nós: caminha de um nó pelos tubos em série.
    const areaJuncao = (id: string): number => {
      const pe = idx.porId.get(id);
      const d = pe && pe.tipo === 'juncao' ? (pe.props as PropsJuncao).diametro : undefined;
      return d && d > 0 ? areaTuboM2(d) : Infinity;
    };
    const caminhar = (de: string, primeiro: string): ArestaRede | null => {
      let prev = de;
      let cur = primeiro;
      const tubos: string[] = [];
      const alinhado: Record<string, boolean> = {};
      let area = Infinity;
      const local = new Set<string>([de]);
      for (let guard = 0; guard < 1000; guard++) {
        const pe = idx.porId.get(cur);
        if (!pe) return null;
        if (isReservatorio(pe) || pe.tipo === 'juncao') {
          return { a: de, b: cur, area: tubos.length ? area : areaTuboM2(1000), tubos, alinhado };
        }
        if (!ehCandidato(pe)) return null;
        if (pe.props.boia && !(pe.props.boia.aberta ?? true)) return null; // boia fechada bloqueia o run
        tubos.push(cur);
        // traversal prev→cur→next; alinhado = prev é o lado de ENTRADA de cur
        // (conexão prev→cur), i.e., a travessia segue origem→destino do tubo.
        alinhado[cur] = (idx.entrada.get(cur) ?? []).some((c) => c.origem === prev);
        area = Math.min(area, areaTuboM2(pe.props.diametro));
        local.add(cur);
        const next = vizinhosDe(cur).find((v) => v !== prev && !local.has(v));
        if (next === undefined) return null; // beco (ambiente) → sem aresta
        prev = cur;
        cur = next;
      }
      return null;
    };

    const arestas: ArestaRede[] = [];
    const chaves = new Set<string>();
    for (const j of juncSet) {
      for (const viz of vizinhosDe(j)) {
        const ar = caminhar(j, viz);
        if (!ar) continue;
        const chave = ar.tubos.length ? [...ar.tubos].sort().join('|') : `direto:${[ar.a, ar.b].sort().join('-')}`;
        if (chaves.has(chave)) continue;
        chaves.add(chave);
        ar.area = Math.min(ar.area, areaJuncao(ar.a), areaJuncao(ar.b));
        arestas.push(ar);
      }
    }

    // --- Carga de cada nó: reservatório fixo, junção incógnita.
    const carga = new Map<string, number>();
    for (const rid of resSet) carga.set(rid, cargaRes(idx.porId.get(rid) as PecaDe<'reservatorio'>));
    const cargaDe = (n: string): number => carga.get(n) ?? 0;
    const repHead = resSet.size ? Math.max(...[...resSet].map(cargaDe)) : 0; // p/ o lift da bomba

    // --- Terminais → injeção de vazão (m³/s) no nó em que se ligam. + = entra.
    const injecao = new Map<string, number>();
    const runsTerminais: { run: ArestaRede; q: number; para: string }[] = []; // telemetria/telemetria
    for (const t of terminais) {
      const pe = idx.porId.get(t)!;
      // acha o run do terminal até o nó (junção/reservatório) da rede.
      let run: ArestaRede | null = null;
      for (const viz of vizinhosDe(t)) {
        if (!(vis.has(viz) || resSet.has(viz))) continue;
        run = caminhar(t, viz);
        if (run) break;
      }
      if (!run || !juncSet.has(run.b)) continue; // só injetamos em JUNÇÃO
      const noAtar = run.b;
      let q = 0; // m³/s, + = entra no nó
      if (isConsumo(pe)) {
        const dem = pe.props.aberto === false ? 0 : demandaConsumo(pe.props, tempo);
        q = -vazaoParaM3(Math.max(0, dem), u); // consumo RETIRA
      } else if (isFonte(pe)) {
        q = vazaoParaM3(Math.max(0, pe.props.vazaoFixa), u); // fonte injeta
      } else if (isBomba(pe)) {
        if (pe.props.ligada) {
          const suc = idx.resolverReservatorio(pe.id, 'up', true);
          if (suc && reservatorioVazio(suc)) {
            bombasASeco.push(pe.id);
          } else if (suc) {
            const kEff =
              pe.props.alturaNominal && pe.props.alturaNominal > 0
                ? pe.props.vazaoNominal / pe.props.alturaNominal
                : pe.props.curva
                  ? pe.props.curva.k
                  : 0;
            const liftM = repHead - cargaRes(suc);
            const qUser = Math.max(0, pe.props.vazaoNominal - kEff * liftM);
            q = vazaoParaM3(qUser, u);
            if (q > 0) fluxos.push({ origem: suc.id, destino: null, vazao: q }); // drena a sucção
          }
        }
      }
      injecao.set(noAtar, (injecao.get(noAtar) ?? 0) + q);
      runsTerminais.push({ run, q, para: noAtar });
      vazoes[pe.id] = Math.abs(q);
      driversResolvidos.add(pe.id);
    }

    if (resSet.size === 0 && injecao.size === 0) continue; // nada a mover
    if (arestas.length === 0) continue;

    const arestasDe = new Map<string, ArestaRede[]>();
    for (const j of juncSet) arestasDe.set(j, []);
    for (const ar of arestas) {
      if (juncSet.has(ar.a)) arestasDe.get(ar.a)!.push(ar);
      if (juncSet.has(ar.b)) arestasDe.get(ar.b)!.push(ar);
    }
    // init junção = média das cargas conhecidas dos vizinhos.
    for (const j of juncSet) {
      const hs = arestasDe
        .get(j)!
        .map((ar) => carga.get(ar.a === j ? ar.b : ar.a))
        .filter((x): x is number => x !== undefined);
      carga.set(j, hs.length ? hs.reduce((s, x) => s + x, 0) / hs.length : repHead);
    }
    const fluxoEntra = (ar: ArestaRede, hJ: number, outro: string): number => {
      const dh = cargaDe(outro) - hJ;
      const q = ar.area * Math.sign(dh) * Math.sqrt(2 * g * Math.abs(dh));
      return q > 0 && resVazio(outro) ? 0 : q; // vazio não fornece; só recebe
    };
    // --- Gauss-Seidel + bisseção (com bordas adaptativas p/ as injeções).
    for (let it = 0; it < 300; it++) {
      let maxD = 0;
      for (const j of juncSet) {
        const inc = arestasDe.get(j)!;
        if (inc.length === 0) continue;
        const outros = inc.map((ar) => (ar.a === j ? ar.b : ar.a));
        const inj = injecao.get(j) ?? 0;
        const net = (h: number): number => inc.reduce((s, ar, k) => s + fluxoEntra(ar, h, outros[k]!), 0) + inj;
        const hs = outros.map(cargaDe);
        let lo = Math.min(...hs);
        let hi = Math.max(...hs);
        for (let e = 0; e < 80 && net(lo) < 0; e++) lo -= Math.max(1, hi - lo);
        for (let e = 0; e < 80 && net(hi) > 0; e++) hi += Math.max(1, hi - lo);
        for (let bi = 0; bi < 70; bi++) {
          const mid = (lo + hi) / 2;
          if (net(mid) > 0) lo = mid;
          else hi = mid;
        }
        const nh = (lo + hi) / 2;
        maxD = Math.max(maxD, Math.abs(nh - cargaDe(j)));
        carga.set(j, nh);
      }
      if (maxD < 1e-7) break;
    }

    // --- Aplica: fluxo por aresta, net por reservatório, telemetria + refluxo.
    const netRes = new Map<string, number>(); // + = saída líquida do reservatório
    const anotar = (ar: ArestaRede, qAB: number): void => {
      for (const t of ar.tubos) {
        const s = ar.alinhado[t] ? qAB : -qAB; // sinal no sentido origem→destino do tubo
        vazoes[t] = s;
        if (s < -1e-9) refluxos.push(t); // fluindo contra a seta
      }
    };
    for (const ar of arestas) {
      const dh = cargaDe(ar.a) - cargaDe(ar.b);
      let q = ar.area * Math.sign(dh) * Math.sqrt(2 * g * Math.abs(dh)); // + = a→b
      if (q > 0 && resVazio(ar.a)) q = 0; // a forneceria, mas está vazio
      if (q < 0 && resVazio(ar.b)) q = 0; // b forneceria, mas está vazio
      if (isReservatorio(idx.porId.get(ar.a)!)) netRes.set(ar.a, (netRes.get(ar.a) ?? 0) + q);
      if (isReservatorio(idx.porId.get(ar.b)!)) netRes.set(ar.b, (netRes.get(ar.b) ?? 0) - q);
      anotar(ar, q);
    }
    // telemetria dos runs de terminais (q é a favor do nó; a→b vai do terminal ao nó).
    for (const { run, q } of runsTerminais) anotar(run, -q);
    for (const [rid, net] of netRes) {
      if (Math.abs(net) < 1e-12) continue;
      if (net > 0) fluxos.push({ origem: rid, destino: null, vazao: net });
      else fluxos.push({ origem: null, destino: rid, vazao: -net });
    }
    for (const t of tuboSet) resolvidos.add(t); // todo o componente foi tratado
  }
}

function calcularBomba(
  idx: GrafoIndex,
  bomba: PecaDe<'bomba'>,
  g: number,
  u: Unidades,
  tempo: number,
  fluxos: FluxoResolvido[],
  vazoes: Record<string, number>,
  consumoInsuficiente: string[],
  bombasASeco: string[],
): number {
  if (!bomba.props.ligada) return 0;

  // Fonte de sucção respeitando válvulas em série (registro/boia). Sem origem
  // alcançável ou com o caminho fechado, a bomba não move nada.
  const upPath = idx.resolverFluxo(bomba.id, 'up');
  if (!upPath.res || !upPath.aberto) return 0;
  const up = upPath.res;
  // Origem vazia com a bomba ligada = RODANDO A SECO. Não move nada (evita vazão
  // fantasma) e sinaliza o alerta/log — a proteção fica a cargo da boia reversa.
  if (reservatorioVazio(up)) {
    bombasASeco.push(bomba.id);
    return 0;
  }
  const kL = metrosPorComprimento(u);
  const hUp = cargaM(up, kL);

  void g; // a bomba é forçada (não usa Torricelli); g mantém a assinatura uniforme

  // Uma bomba pode alimentar múltiplas saídas: reservatórios (recalque) ou
  // pontos de CONSUMO (ex.: bomba de incêndio → hidrantes). A vazão nominal é
  // dividida só entre as saídas ABERTAS. Uma saída para consumo só conta se o
  // consumo estiver aberto e com demanda > 0 — por isso "consumo 0 = a bomba não
  // empurra nada". Empurrar para um reservatório cheio é permitido (transborda).
  const demandaDe = (cons: PecaDe<'consumo'>): number =>
    cons.props.aberto === false ? 0 : demandaConsumo(cons.props, tempo);

  const abertas = (idx.saida.get(bomba.id) ?? [])
    .map((c) => ({ c, dp: idx.resolverFluxo(c.destino, 'down') }))
    .filter((x) => {
      if (!x.dp.aberto) return false;
      if (x.dp.res) return true; // reservatório sempre aceita
      if (x.dp.consumo) return demandaDe(x.dp.consumo) > 0; // consumo só com demanda
      return false;
    });
  const m = abertas.length;
  if (m === 0) return 0; // nenhuma saída aberta/demandada → bomba não move nada

  let total = 0;
  for (const { c, dp } of abertas) {
    const base = c.vazaoAlocada ?? bomba.props.vazaoNominal / m;
    let qUser: number;
    let destino: string | null;
    if (dp.res) {
      const liftM = cargaM(dp.res, kL) - hUp; // carga (m) a vencer nesta saída
      // Curva: `alturaNominal` (plaquinha) deriva o k automaticamente e tem
      // precedência; senão usa o `curva.k` explícito; senão bomba ideal (k=0).
      const kEff =
        bomba.props.alturaNominal && bomba.props.alturaNominal > 0
          ? bomba.props.vazaoNominal / bomba.props.alturaNominal
          : bomba.props.curva
            ? bomba.props.curva.k
            : 0;
      qUser = base - kEff * liftM;
      destino = dp.res.id;
    } else {
      // Saída para consumo: a bomba entrega a MENOR entre a sua vazão (parcela) e
      // a demanda. Se a demanda excede a vazão da bomba, ela não acompanha →
      // alerta de déficit no consumo (não é erro; a bomba entrega o que dá).
      const cons = dp.consumo!;
      const demanda = demandaDe(cons);
      qUser = Math.min(base, demanda);
      destino = null; // consumo descarta a água (dreno para o ambiente)
      if (demanda > base + 1e-9) consumoInsuficiente.push(cons.id);
    }
    const q = vazaoParaM3(Math.max(0, qUser), u); // bomba não gera vazão negativa

    if (q > 0) {
      fluxos.push({ origem: up.id, destino, vazao: q });
      anotarTubos(vazoes, dp.tubos, q); // canos desta saída
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
    tubosVelozes: [],
    refluxos: [],
    consumoInsuficiente: [],
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
