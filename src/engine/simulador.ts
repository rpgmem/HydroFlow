/**
 * HydroFlow — Motor de simulação
 *
 * Motor puro, desacoplado de React: recebe um `ProjetoSimulacao` e devolve o estado do próximo tick. Nenhuma dependência de DOM/canvas — testável isolado.
 *
 * FÍSICA SIMPLIFICADA (Torricelli + continuidade de volume; NÃO é CFD):
 *
 *   Vazão por gravidade (tubo):  v = √(2·g·Δh)
 *                                A = π·(diametro/2)²
 *                                Q = A·v
 *   Δh = (cota + nivel)_origem − (cota + nivel)_destino (sempre a carga hidráulica total; nunca só o nível bruto)
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
  isQuadro,
  isReservatorio,
  isSensor,
  isTubo,
  operadoresDoCanal,
  sensoresDoCanal,
  type CanalQuadro,
  type PecaDe,
  type ProjetoSimulacao,
} from '../domain/types';
import {
  nivelDeVolumeM3,
  vazaoDeM3,
  velocidadeTuboMs,
  volumeM3DeNivel,
  volumeMaximoM3,
  VELOCIDADE_MAX_RECOMENDADA_MS,
} from './geometria';
import { COMPRIMENTO_PADRAO_M } from './hidraulica';
import { sobrepressaoGolpeKPa, LIMITE_GOLPE_PADRAO_KPA, muAgua, TEMPERATURA_PADRAO_C } from './fisica';
import { metrosPorComprimento, UNIDADES_CANONICAS } from '../domain/unidades';
import { arbitrarBomba, avaliarSensor, avaliarSequencia, boiaAberta, type Decisao } from './arbitragem';
import { resolverGravidadeComJuncoes } from './redeJuncoes';
import { GrafoIndex, type FluxoResolvido } from './grafo';
import {
  calcularBomba,
  calcularConsumo,
  calcularFonte,
  calcularTubo,
  coletarCadeiaTubos,
} from './vazaoPecas';
import { valorNoTempo } from '../domain/geradorVazao';
import type { Unidades } from '../domain/types';

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
  /** Tubos com RISCO de golpe de aríete: a sobrepressão de Joukowsky numa parada súbita passaria do teto de pressão. */
  golpeAriete: string[];
  /** Tubos com fluxo contrário à seta (refluxo) neste tick — inesperado. */
  refluxos: string[];
  /** Consumos cuja demanda excede a vazão da bomba que os alimenta (déficit). */
  consumoInsuficiente: string[];
  /** Decisão corrente de cada sensor (id → 'ligar' | 'desligar' | 'manter'). */
  sensores: Record<string, Decisao>;
  /** Tempo de simulação acumulado (s) após este tick. */
  tempo: number;
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

/**
 * Demanda instantânea total (na unidade do usuário) dos CONSUMOS alcançáveis à jusante de `bombaId` seguindo as conexões de saída (por tubos/junções/
 * reservatórios). Usada pelo quadro no 'auto' sem sensor: a bomba só liga se houver consumo pedindo água na linha.
 */
function demandaJusante(idx: GrafoIndex, bombaId: string, tempo: number): number {
  const visto = new Set<string>([bombaId]);
  const fila = [bombaId];
  let soma = 0;
  while (fila.length > 0) {
    const id = fila.pop()!;
    for (const c of idx.saida.get(id) ?? []) {
      if (visto.has(c.destino)) continue;
      visto.add(c.destino);
      const d = idx.porId.get(c.destino);
      if (!d) continue;
      if (isConsumo(d)) {
        soma += d.props.aberto === false ? 0 : valorNoTempo(d.props.gerador, tempo);
      }
      fila.push(c.destino);
    }
  }
  return soma;
}

/** Executa um passo de simulação. Não muta a entrada (retorna novo projeto). */
export function tick(projeto: ProjetoSimulacao, tempoAtual = 0): ResultadoTick {
  const proj: ProjetoSimulacao = structuredClone(projeto);
  const idx = new GrafoIndex(proj);
  const dt = proj.configuracaoSimulacao.dt;
  const g = proj.configuracaoSimulacao.g;
  const atrito = proj.configuracaoSimulacao.atrito === true; // perda de carga por atrito
  const modeloAtrito = proj.configuracaoSimulacao.modeloAtrito ?? 'hazen-williams';
  const muPas = muAgua(proj.configuracaoSimulacao.temperaturaC ?? TEMPERATURA_PADRAO_C); // viscosidade p/ Darcy-Weisbach
  const velRef = proj.configuracaoSimulacao.velocidadeRef ?? VELOCIDADE_MAX_RECOMENDADA_MS;
  const tempoFim = tempoAtual + dt;

  // ---- (0) Quadros de comando (MCC) -------------------------------------
  // Uma bomba referenciada por um canal passa a OBEDECER o quadro (o `modoControle` dela é ignorado). O sensor escolhido num canal 'auto' age só
  // pelo quadro (seu `bombasAlvo` direto não roteia). Peças não referenciadas por nenhum quadro mantêm o controle direto. Primeira referência a uma bomba vence.
  const regidaPorQuadro = new Map<string, { canal: CanalQuadro; logica: 'E' | 'OU'; membros: string[] }>();
  const sensoresEmQuadro = new Set<string>();
  for (const p of proj.pecas) {
    if (!isQuadro(p)) continue;
    const logica = p.props.logica ?? 'OU';
    const membros = p.props.sensores ?? [];
    for (const c of p.props.canais) {
      if (c.bomba && !regidaPorQuadro.has(c.bomba)) regidaPorQuadro.set(c.bomba, { canal: c, logica, membros });
    }
    for (const s of membros) sensoresEmQuadro.add(s); // boias-membro
  }

  // ---- (1) Sensores avaliam sobre o estado do tick anterior -------------
  const decisoesPorBomba = new Map<string, Decisao[]>();
  const sensores: Record<string, Decisao> = {};
  for (const p of proj.pecas) {
    if (!isSensor(p)) continue;
    if (p.props.ativo === false) continue; // sensor desabilitado no painel → sem decisão
    const resMon = reservatorioMonitorado(idx, p.id);
    const nivel = resMon?.props.nivel ?? 0;
    const decisao = avaliarSensor(p.props, nivel, tempoAtual);
    // Na banda morta ('manter'), o sensor assere a SUA intenção persistida (pedindoLigar) — histerese real por sensor. Sem isso, com vários sensores
    // um "manter" deixaria outro sensor vencer (ex.: o reverso segurando a bomba desligada perderia para o normal pedindo ligar → chatter).
    const efetiva: Decisao =
      decisao !== 'manter'
        ? decisao
        : p.props.pedindoLigar === true
          ? 'ligar'
          : p.props.pedindoLigar === false
            ? 'desligar'
            : 'manter';
    sensores[p.id] = efetiva;
    // Persiste a intenção (para a histerese e o delay) a partir da decisão EFETIVA deste tick — no início do tick, coerente com a arbitragem.
    const querLigar =
      efetiva === 'ligar' ? true : efetiva === 'desligar' ? false : p.props.pedindoLigar;
    if (querLigar !== p.props.pedindoLigar) {
      p.props.ultimaTroca = tempoAtual;
      p.props.pedindoLigar = querLigar;
    }
    // Um sensor pode reger várias bombas simultaneamente — a MENOS que ele esteja sob um quadro de comandos (aí só age pelo quadro; o roteamento direto para).
    if (!sensoresEmQuadro.has(p.id)) {
      for (const alvo of p.props.bombasAlvo) {
        const lista = decisoesPorBomba.get(alvo) ?? [];
        lista.push(efetiva);
        decisoesPorBomba.set(alvo, lista);
      }
    }
  }

  // ---- (2) Controle de bombas (modo/arbitragem) -----------------------
  // 'ligado'/'desligado' forçam o estado (o botão manual); 'auto' segue os sensores (normais e reversos — 'desligar' vence). A bomba NÃO desliga sozinha
  // por nível: a proteção é feita por um sensor REVERSO na origem. Se mesmo assim a origem esvaziar com a bomba ligada, é detectado como "rodando a seco".
  for (const p of proj.pecas) {
    if (!isBomba(p)) continue;
    const antes = p.props.ligada ?? false;
    const regida = regidaPorQuadro.get(p.id);
    let agora: boolean;
    if (regida) {
      // Regida por um quadro: o canal manda (o modoControle da bomba é ignorado).
      const { canal, logica } = regida;
      if (canal.modo === 'desligado') agora = false;
      else if (canal.modo === 'manual') agora = true;
      else {
        // 'auto': segue os sensores marcados no canal; se NENHUM foi marcado, segue TODOS os sensores-membro do quadro (assim uma boia-membro — em
        // especial uma REVERSA de proteção — nunca é silenciosamente ignorada: seu 'desligar' continua tendo precedência). Só quando o quadro não tem sensor
        // ALGUM é que o 'auto' vira acionamento por DEMANDA (consumo > 0 à jusante).
        const marcados = sensoresDoCanal(canal);
        const ids = marcados.length > 0 ? marcados : regida.membros;
        if (ids.length === 0) {
          agora = demandaJusante(idx, p.id, tempoAtual) > 1e-9;
        } else {
          // Sequência ordenada: cada gap tem seu operador (default = lógica global).
          // No fallback "segue todos os membros" não há operadores explícitos, logo todos os gaps caem no padrão `logica` (compatível com o comportamento
          // anterior). Decisões `undefined` (sensor inativo) são puladas.
          const decisoes = ids.map((id) => sensores[id]);
          const operadores = marcados.length > 0 ? operadoresDoCanal(canal, logica) : [];
          agora = avaliarSequencia(decisoes, operadores, logica, antes);
        }
      }
    } else {
      const modo = p.props.modoControle ?? 'auto';
      if (modo === 'ligado') agora = true;
      else if (modo === 'desligado') agora = false;
      else agora = arbitrarBomba(decisoesPorBomba.get(p.id) ?? [], antes);
    }
    p.props.ligada = agora;
    // Revezamento: quando regida, o QUADRO decide (canal.revezamento + unidade); senão, a própria bomba (props.revezamento). Com uma unidade forçada (1/2) a
    // metade fica fixa; sem ela, alterna a cada ACIONAMENTO (borda de subida).
    const revezar = regida ? (regida.canal.revezamento ?? false) : (p.props.revezamento ?? false);
    const unidadeForcada = regida?.canal.unidade;
    if (revezar) {
      if (unidadeForcada === 1 || unidadeForcada === 2) p.props.unidadeAtiva = unidadeForcada;
      else if (agora && !antes) p.props.unidadeAtiva = p.props.unidadeAtiva === 1 ? 2 : 1;
    } else if (regida) {
      p.props.unidadeAtiva = undefined; // quadro sem revezamento → bomba única
    }
  }

  // ---- (2b) Estado das boias mecânicas (histerese persistida) ----------
  // Cada boia de tubo atualiza aberta/fechada monitorando o reservatório de destino. Entre mín. e máx. mantém o estado anterior (b.aberta) — histerese
  // real, sem chatter. O resto do tick lê b.aberta.
  for (const p of proj.pecas) {
    if (!isTubo(p) || !p.props.boia) continue;
    const b = p.props.boia;
    const mon = idx.resolverReservatorio(p.id, 'down');
    if (mon) b.aberta = boiaAberta(b, mon.props.nivel ?? 0, b.aberta ?? true);
  }

  // ---- (3) Cálculo de vazão de cada aresta condutora (em m³/s) ---------
  // As magnitudes do projeto são canônicas (SI); o motor ignora a preferência
  // de EXIBIÇÃO (`proj.unidades`) e calcula sempre em SI.
  const u = UNIDADES_CANONICAS;
  const fluxos: FluxoResolvido[] = [];
  const vazoesM3: Record<string, number> = {};
  const consumoInsuficiente: string[] = [];
  const bombasASeco: string[] = []; // bombas ligadas com a origem vazia (rodando a seco)
  const refluxos: string[] = []; // tubos com fluxo contrário à seta (inesperado)

  const ladroesAtivos: string[] = [];
  const cadeiaResolvida = new Set<string>();
  // Junções que bifurcam/unem: resolvidas ANTES como uma REDE de vazão, para dividir/somar o fluxo conservando massa no nó. Terminais (consumo/fonte/
  // bomba) ligados a uma junção entram como NÓS DE VAZÃO da própria rede — assim um consumo puxando de uma união pode forçar refluxo do ramo mais alto,
  //  em vez de cada driver resolver seu caminho isolado. Os terminais assim resolvidos ficam em `driversResolvidos` (o laço de ativos os pula) e seus
  // tubos em `cadeiaResolvida`.
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
    atrito,
    modeloAtrito,
    muPas,
  );

  // Elementos ATIVOS: além da própria vazão, anotam a vazão nos tubos em série pelos quais empurram a água (para a telemetria/animação refletir o fluxo que
  // passa por esses canos). Os já resolvidos pela rede de junções são pulados.
  for (const p of proj.pecas) {
    if (driversResolvidos.has(p.id)) continue;
    if (isBomba(p)) vazoesM3[p.id] = calcularBomba(idx, p, g, u, tempoAtual, fluxos, vazoesM3, consumoInsuficiente, bombasASeco, atrito, modeloAtrito, muPas);
    else if (isFonte(p)) vazoesM3[p.id] = calcularFonte(idx, p, u, tempoAtual, fluxos, vazoesM3);
    else if (isConsumo(p)) vazoesM3[p.id] = calcularConsumo(idx, p, g, u, tempoAtual, fluxos, vazoesM3, atrito, modeloAtrito, muPas);
  }
  // Tubos por gravidade / ladrão: só os que ainda não foram atribuídos por um elemento ativo (um cano alimentado por fonte/bomba tem sua vazão dada pelo
  // driver).
  //
  // Uma CADEIA de tubos em série limitada por reservatórios nas duas pontas carrega UM único fluxo, limitado pelo cano mais estreito (o gargalo). Sem
  // isso, cada tubo resolveria os mesmos reservatórios e empurraria o próprio fluxo — tubos em série viravam paralelos e a origem drenava N×. Ladrão,
  // registro fechado e descarga ao ambiente/sucção seguem a lógica por tubo.
  for (const p of proj.pecas) {
    if (!isTubo(p) || vazoesM3[p.id] !== undefined || cadeiaResolvida.has(p.id)) continue;
    const fechado = p.props.registro !== undefined && !p.props.registro.aberto;
    const up = fechado || p.props.ladrao ? null : idx.resolverReservatorio(p.id, 'up', true);
    const down = fechado || p.props.ladrao ? null : idx.resolverReservatorio(p.id, 'down', true);
    if (!up || !down) {
      // Registro fechado, ladrão, descarga ao ambiente ou sucção de bomba (sem reservatório nas duas pontas) → lógica por tubo, como antes.
      const q = calcularTubo(idx, p, g, u, fluxos, ladroesAtivos, atrito, modeloAtrito, muPas);
      vazoesM3[p.id] = q;
      if (q < -1e-9) refluxos.push(p.id); // fluxo contrário à seta
      continue;
    }
    // Cadeia entre dois reservatórios → resolve UMA vez, pelo gargalo (menor diâmetro). Uma boia fechada em qualquer tubo da cadeia interrompe o fluxo.
    const cadeia = coletarCadeiaTubos(idx, p.id);
    cadeia.forEach((id) => cadeiaResolvida.add(id));
    const diam = (id: string): number => (idx.porId.get(id) as PecaDe<'tubo'>).props.diametro;
    const gargalo = cadeia.reduce((a, b) => (diam(b) < diam(a) ? b : a));
    const boiaFechada = cadeia.some((id) => {
      const b = (idx.porId.get(id) as PecaDe<'tubo'>).props.boia;
      return b !== undefined && !(b.aberta ?? true);
    });
    // Atrito na cadeia: usa o comprimento SOMADO dos tubos em série (com o diâmetro do gargalo) — perda de carga do trecho inteiro, não só do gargalo.
    const kLc = metrosPorComprimento(u);
    const compTotalM = atrito
      ? cadeia.reduce((s, id) => s + ((idx.porId.get(id) as PecaDe<'tubo'>).props.comprimento ?? COMPRIMENTO_PADRAO_M) * kLc, 0)
      : undefined;
    const q = boiaFechada
      ? 0
      : calcularTubo(idx, idx.porId.get(gargalo) as PecaDe<'tubo'>, g, u, fluxos, ladroesAtivos, atrito, modeloAtrito, muPas, compTotalM);
    for (const id of cadeia) vazoesM3[id] = q; // toda a cadeia carrega a mesma vazão
    if (q < -1e-9) cadeia.forEach((id) => refluxos.push(id)); // fluxo contrário à seta
  }

  // Tubos com velocidade acima da recomendada (v = Q/A > limite) = subdimensionados para a vazão que passa. Só um aviso de dimensionamento; não altera a física.
  const tubosVelozes: string[] = [];
  for (const p of proj.pecas) {
    if (!isTubo(p)) continue;
    const v = velocidadeTuboMs(vazoesM3[p.id] ?? 0, p.props.diametro);
    if (v > velRef + 1e-6) tubosVelozes.push(p.id);
  }

  // Risco de golpe de aríete (indicador PERMANENTE): a sobrepressão de Joukowsky
  // numa parada súbita (ΔP = ρ·a·v) passaria do teto de pressão do tubo. Só um
  // aviso — não altera a física (o motor é quase-estático).
  const limiteGolpe = proj.configuracaoSimulacao.limiteGolpeArieteKPa ?? LIMITE_GOLPE_PADRAO_KPA;
  const golpeAriete: string[] = [];
  for (const p of proj.pecas) {
    if (!isTubo(p)) continue;
    const v = velocidadeTuboMs(vazoesM3[p.id] ?? 0, p.props.diametro);
    if (v <= 1e-6) continue;
    const teto = p.props.pressaoNominal ?? limiteGolpe;
    if (sobrepressaoGolpeKPa(v) > teto) golpeAriete.push(p.id);
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
    golpeAriete,
    refluxos,
    consumoInsuficiente,
    sensores,
    tempo: tempoFim,
  };
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

  // Limita saídas para não drenar abaixo de zero: escala proporcionalmente quando a soma das saídas de um reservatório excede seu volume disponível.
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
    golpeAriete: [],
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
