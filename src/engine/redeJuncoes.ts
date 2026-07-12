/**
 * HydroFlow — Solver da rede de junções (extraído do motor).
 *
 * Resolve as sub-redes de gravidade que contêm JUNÇÕES como uma pequena REDE DE VAZÃO, para a junção realmente DIVIDIR (bifurcar) e SOMAR (unir) o fluxo,
 * conservando massa no nó. Reservatórios são nós de carga FIXA (a superfície); junções são nós de carga INCÓGNITA, resolvida por iteração (Gauss-Seidel +
 * bisseção) até o fluxo líquido no nó zerar. Cada "run" de tubos em série entre dois nós vira uma aresta com área = a do gargalo (menor diâmetro).
 *
 * O tipo `GrafoIndex`/`FluxoResolvido` e os ajudantes `reservatorioVazio`/ `demandaConsumo` vêm de `simulador.ts` (o índice de grafo e a física comuns).
 * O import de `GrafoIndex`/`FluxoResolvido` é só de TIPO (não cria ciclo em runtime); os dois ajudantes são funções puras hasteadas.
 */
import {
  isBomba,
  isConsumo,
  isFonte,
  isReservatorio,
  isTubo,
  type Peca,
  type PecaDe,
  type PropsJuncao,
  type Unidades,
} from '../domain/types';
import { areaTuboM2, vazaoParaM3 } from './geometria';
import { vazaoBombaOperacao, vazaoGravidadeM3, COMPRIMENTO_PADRAO_M, HW_C_PADRAO, type ModeloAtrito } from './hidraulica';
import { RUGOSIDADE_PADRAO_MM } from './fisica';
import { metrosPorComprimento } from '../domain/unidades';
import { reservatorioVazio, type FluxoResolvido, type GrafoIndex } from './grafo';
import { hfTubosM } from './vazaoPecas';
import { valorNoTempo } from '../domain/geradorVazao';

/** Bomba acoplada à rede (com atrito): a vazão depende da carga do nó. */
interface ContribBomba {
  no: string;
  sucId: string;
  sucHeadM: number;
  baseM3: number;
  kEffM3: number;
  tubosSuc: string[];
  peId: string;
  run: ArestaRede;
}

/** Uma aresta da rede: um "run" de tubos em série entre dois nós (junção/reserv.). */
interface ArestaRede {
  a: string;
  b: string;
  area: number;
  tubos: string[];
  /** Por tubo: traversal a→b coincide com o sentido origem→destino do tubo? */
  alinhado: Record<string, boolean>;
  /** Altura da tomada (relativa à base) no lado do reservatório `b`, quando `b` é reservatório e há um tubo adjacente. Um reservatório só fornece se o nível
   *  estiver ACIMA dessa tomada. undefined = sem tomada em altura (tap no fundo). */
  tapB?: number;
  /** Comprimento SOMADO dos tubos do run (m) — para a perda de carga (atrito). */
  comprimentoM: number;
  /** Menor diâmetro de tubo do run (mm) — o gargalo, usado na perda de carga. */
  diamMinMM: number;
  /** Menor coeficiente C (Hazen-Williams) do run. */
  coefC: number;
  /** Maior rugosidade ε (mm) do run — a mais áspera (Darcy-Weisbach). */
  rugosidadeMM: number;
}

/**
 * Marca em `resolvidos` os tubos tratados (o laço de gravidade os ignora) e anota a telemetria. Limitações (v1): não modela checkValve/altura DENTRO de um run
 * entre nós (uma boia fechada, sim, bloqueia o run). Para esses casos, use um reservatório no ponto de divisão. Um reservatório vazio pode gerar leve fluxo
 * fantasma na rede (o clamp de volume evita drená-lo abaixo de zero).
 */
export function resolverGravidadeComJuncoes(
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
  atrito: boolean,
  modelo: ModeloAtrito,
  muPas: number,
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
  const cargaRes = (r: PecaDe<'reservatorio'>): number => ((r.cota ?? 0) + (r.props.nivel ?? 0)) * kL;
  const vizinhosDe = (id: string): string[] => [
    ...(idx.entrada.get(id) ?? []).map((c) => c.origem),
    ...(idx.saida.get(id) ?? []).map((c) => c.destino),
  ];
  // Um reservatório só FORNECE água acima da TOMADA por onde a aresta o toca (e, no mínimo, acima do fundo — tomada 0). Sem coluna acima do bocal não há o que
  // escoar, ainda que a carga (cota + nível) seja alta pela elevação. Sem isso, o solver usaria a cota de fundo como carga fixa e criaria fluxo
  // FANTASMA saindo do tanque (ex.: o "superior" já esvaziado empurrando água pela União para o "meio", ou fornecendo por uma tomada acima do próprio nível). O
  // clamp de volume não bastava: a vazão calculada (e a seta de refluxo) ficavam acesas. `tap` é a altura da tomada relativa à base (0 = fundo).
  const podeFornecer = (n: string, tap: number): boolean => {
    const pe = idx.porId.get(n);
    if (!pe || !isReservatorio(pe)) return true; // junção sempre "fornece"
    return (pe.props.nivel ?? 0) > tap + 1e-9;
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
      let comprimentoM = 0;
      let diamMinMM = Infinity;
      let coefC = Infinity;
      let rugMax = 0;
      const local = new Set<string>([de]);
      for (let guard = 0; guard < 1000; guard++) {
        const pe = idx.porId.get(cur);
        if (!pe) return null;
        if (isReservatorio(pe) || pe.tipo === 'juncao') {
          // Tomada no lado do reservatório: altura do bocal do último tubo (o adjacente, = prev) na porta que toca o reservatório. Conexão
          // tubo→reservatório usa alturaSaida; reservatório→tubo usa alturaEntrada.
          let tapB: number | undefined;
          if (isReservatorio(pe) && tubos.length) {
            const ult = idx.porId.get(prev) as PecaDe<'tubo'>;
            const tuboEntraNoRes = (idx.entrada.get(cur) ?? []).some((c) => c.origem === prev);
            tapB = tuboEntraNoRes ? (ult.props.alturaSaida ?? 0) : (ult.props.alturaEntrada ?? 0);
          }
          return {
            a: de,
            b: cur,
            area: tubos.length ? area : areaTuboM2(1000),
            tubos,
            alinhado,
            tapB,
            comprimentoM,
            diamMinMM: tubos.length ? diamMinMM : 1000,
            coefC: tubos.length ? coefC : HW_C_PADRAO,
            rugosidadeMM: tubos.length ? rugMax : RUGOSIDADE_PADRAO_MM,
          };
        }
        if (!ehCandidato(pe)) return null;
        if (pe.props.boia && !(pe.props.boia.aberta ?? true)) return null; // boia fechada bloqueia o run
        tubos.push(cur);
        // traversal prev→cur→next; alinhado = prev é o lado de ENTRADA de cur (conexão prev→cur), i.e., a travessia segue origem→destino do tubo.
        alinhado[cur] = (idx.entrada.get(cur) ?? []).some((c) => c.origem === prev);
        area = Math.min(area, areaTuboM2(pe.props.diametro));
        diamMinMM = Math.min(diamMinMM, pe.props.diametro);
        comprimentoM += (pe.props.comprimento ?? COMPRIMENTO_PADRAO_M) * kL;
        coefC = Math.min(coefC, pe.props.coefC ?? HW_C_PADRAO);
        rugMax = Math.max(rugMax, pe.props.rugosidade ?? RUGOSIDADE_PADRAO_MM);
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
    // Além de entrar no solve das cargas, cada terminal também vira uma OFERTA ou DEMANDA REAL de volume (com origem/destino), casada adiante às trocas dos
    // reservatórios — para o volume aplicado conservar massa mesmo sob limite.
    const injecao = new Map<string, number>();
    const runsTerminais: { run: ArestaRede; q: number; para: string }[] = []; // telemetria
    const ofertasTerm: { origem: string | null; vol: number }[] = [];
    const demandasTerm: { destino: string | null; vol: number }[] = [];
    const contribBombas: ContribBomba[] = []; // bombas acopladas (atrito)
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
        const dem = pe.props.aberto === false ? 0 : valorNoTempo(pe.props.gerador, tempo);
        const qm = vazaoParaM3(Math.max(0, dem), u);
        q = -qm; // consumo RETIRA
        if (qm > 0) demandasTerm.push({ destino: null, vol: qm }); // descarta ao ambiente
      } else if (isFonte(pe)) {
        q = vazaoParaM3(Math.max(0, valorNoTempo(pe.props.gerador, tempo)), u); // fonte injeta
        if (q > 0) ofertasTerm.push({ origem: null, vol: q }); // vem do ambiente
      } else if (isBomba(pe)) {
        if (pe.props.ligada) {
          const suc = idx.resolverReservatorio(pe.id, 'up', true);
          if (suc && reservatorioVazio(suc)) {
            bombasASeco.push(pe.id);
          } else if (suc) {
            const kEffUser =
              pe.props.alturaNominal && pe.props.alturaNominal > 0
                ? pe.props.vazaoNominal / pe.props.alturaNominal
                : pe.props.curva
                  ? pe.props.curva.k
                  : 0;
            const sucHeadM = cargaRes(suc);
            const tubosSuc = idx.resolverFluxo(pe.id, 'up').tubos;
            if (atrito) {
              // Ponto de operação ACOPLADO à rede: a vazão da bomba depende da carga do nó (que já inclui o atrito a jusante) + o atrito da
              // sucção. Resolvida no Gauss-Seidel; finalizada após o solve.
              contribBombas.push({
                no: noAtar,
                sucId: suc.id,
                sucHeadM,
                baseM3: vazaoParaM3(pe.props.vazaoNominal, u),
                kEffM3: vazaoParaM3(kEffUser, u),
                tubosSuc,
                peId: pe.id,
                run,
              });
              driversResolvidos.add(pe.id);
              continue; // injeção/oferta/telemetria da bomba são feitas após o solve
            }
            // Sem atrito: vazão forçada pela altura estática (comportamento de sempre).
            const liftM = repHead - sucHeadM;
            q = vazaoParaM3(Math.max(0, pe.props.vazaoNominal - kEffUser * liftM), u);
            if (q > 0) {
              ofertasTerm.push({ origem: suc.id, vol: q }); // entrega DA sucção
              // Telemetria dos canos de SUCÇÃO (fora da rede): carregam a vazão.
              for (const tb of tubosSuc) {
                vazoes[tb] = q;
                resolvidos.add(tb);
              }
            }
          }
        }
      }
      injecao.set(noAtar, (injecao.get(noAtar) ?? 0) + q);
      runsTerminais.push({ run, q, para: noAtar });
      vazoes[pe.id] = Math.abs(q);
      driversResolvidos.add(pe.id);
    }

    if (resSet.size === 0 && injecao.size === 0 && contribBombas.length === 0) continue; // nada a mover
    if (arestas.length === 0) continue;

    // Bombas acopladas por nó + a vazão da bomba dada a carga do nó `hJ`: ponto de operação (curva ∩ sistema) com a estática = hJ − carga da sucção e o atrito
    // da sucção. A jusante já está embutido em hJ (as arestas têm atrito).
    const bombasPorNo = new Map<string, ContribBomba[]>();
    for (const b of contribBombas) {
      const arr = bombasPorNo.get(b.no);
      if (arr) arr.push(b);
      else bombasPorNo.set(b.no, [b]);
    }
    const qBomba = (b: ContribBomba, hJ: number): number =>
      Math.max(0, vazaoBombaOperacao(b.baseM3, b.kEffM3, hJ - b.sucHeadM, (x) => hfTubosM(idx, b.tubosSuc, x, u, g, modelo, muPas)));

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
    // Magnitude da vazão numa aresta para uma carga |dh| (m): Torricelli puro ou, com o atrito ligado, Hazen-Williams sobre o comprimento SOMADO do run (com o
    // diâmetro do gargalo — aproximação da série de tubos).
    const magVazao = (ar: ArestaRede, absDh: number): number =>
      vazaoGravidadeM3(atrito, ar.area, ar.diamMinMM, ar.comprimentoM, ar.coefC, absDh, g, {
        modelo,
        rugosidadeMM: ar.rugosidadeMM,
        muPas,
      });
    const fluxoEntra = (ar: ArestaRede, hJ: number, outro: string): number => {
      const dh = cargaDe(outro) - hJ;
      const q = Math.sign(dh) * magVazao(ar, Math.abs(dh));
      // `outro` é a ponta oposta à junção; a tomada só existe quando é o reserv. b.
      const tap = outro === ar.b ? (ar.tapB ?? 0) : 0;
      return q > 0 && !podeFornecer(outro, tap) ? 0 : q; // abaixo da tomada não fornece
    };
    // --- Gauss-Seidel + bisseção (com bordas adaptativas p/ as injeções).
    for (let it = 0; it < 300; it++) {
      let maxD = 0;
      for (const j of juncSet) {
        const inc = arestasDe.get(j)!;
        if (inc.length === 0) continue;
        const outros = inc.map((ar) => (ar.a === j ? ar.b : ar.a));
        const inj = injecao.get(j) ?? 0;
        const bombas = bombasPorNo.get(j) ?? [];
        const net = (h: number): number =>
          inc.reduce((s, ar, k) => s + fluxoEntra(ar, h, outros[k]!), 0) +
          inj +
          bombas.reduce((s, b) => s + qBomba(b, h), 0); // bomba injeta no nó
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
      let q = Math.sign(dh) * magVazao(ar, Math.abs(dh)); // + = a→b
      if (q > 0 && !podeFornecer(ar.a, 0)) q = 0; // a (junção) forneceria — n/a
      if (q < 0 && !podeFornecer(ar.b, ar.tapB ?? 0)) q = 0; // b abaixo da tomada não fornece
      if (isReservatorio(idx.porId.get(ar.a)!)) netRes.set(ar.a, (netRes.get(ar.a) ?? 0) + q);
      if (isReservatorio(idx.porId.get(ar.b)!)) netRes.set(ar.b, (netRes.get(ar.b) ?? 0) - q);
      anotar(ar, q);
    }
    // Telemetria dos runs de terminais. O run vai do terminal (a) ao nó (b), e `q` é o fluxo FAVOR DO NÓ — ou seja, exatamente o sentido a→b. Então `anotar`
    // recebe `q` direto (ele já converte para o sinal origem→destino de cada tubo).
    // Passar -q invertia o sinal: um tubo entre uma junção e um consumo (água indo para o consumo, sentido normal) aparecia como refluxo (violeta) sem ser.
    for (const { run, q } of runsTerminais) anotar(run, q);

    // --- Finaliza as bombas ACOPLADAS (atrito): a vazão é o ponto de operação na carga JÁ resolvida do nó. Anota o cano de sucção (fora da rede), o run até o
    // nó e vira uma OFERTA de volume com origem na sucção.
    const ofertasBomba: { origem: string | null; vol: number }[] = [];
    for (const b of contribBombas) {
      const q = qBomba(b, cargaDe(b.no));
      vazoes[b.peId] = q;
      if (q > 0) {
        ofertasBomba.push({ origem: b.sucId, vol: q });
        for (const tb of b.tubosSuc) {
          vazoes[tb] = q;
          resolvidos.add(tb);
        }
        anotar(b.run, -q); // run bomba→nó: q entra no nó, contra a→b (terminal→nó)
      }
    }

    // --- Transferência de volume por rota DIRETA origem→destino (bipartite).
    // Descolar o dreno (reservatório→ambiente) do enchimento (ambiente→destino) faria o limite de volume (reservatório quase vazio) escalar SÓ o dreno,
    // criando água no destino (o refluxo fantasma da União com o superior no fim).
    // Casando cada FONTE real (reservatório que perde, fonte, bomba pela sucção) com cada SORVEDOURO real (reservatório que ganha, consumo) na proporção de
    // cada um, o escalonamento propaga aos destinos e a massa conserva.
    const ofertas: { origem: string | null; vol: number }[] = [...ofertasTerm, ...ofertasBomba];
    const demandas: { destino: string | null; vol: number }[] = [...demandasTerm];
    for (const [rid, net] of netRes) {
      if (net > 1e-12) ofertas.push({ origem: rid, vol: net });
      else if (net < -1e-12) demandas.push({ destino: rid, vol: -net });
    }
    const totalO = ofertas.reduce((s, o) => s + o.vol, 0);
    const totalD = demandas.reduce((s, d) => s + d.vol, 0);
    const T = Math.max(totalO, totalD, 1e-12); // normaliza (não superaloca se O≠D)
    for (const o of ofertas) {
      for (const d of demandas) {
        const vazao = (o.vol * d.vol) / T;
        if (vazao > 1e-12) fluxos.push({ origem: o.origem, destino: d.destino, vazao });
      }
    }
    for (const t of tuboSet) resolvidos.add(t); // todo o componente foi tratado
  }
}
