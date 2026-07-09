/**
 * HydroFlow — Solver da rede de junções (extraído do motor).
 *
 * Resolve as sub-redes de gravidade que contêm JUNÇÕES como uma pequena REDE DE
 * VAZÃO, para a junção realmente DIVIDIR (bifurcar) e SOMAR (unir) o fluxo,
 * conservando massa no nó. Reservatórios são nós de carga FIXA (a superfície);
 * junções são nós de carga INCÓGNITA, resolvida por iteração (Gauss-Seidel +
 * bisseção) até o fluxo líquido no nó zerar. Cada "run" de tubos em série entre
 * dois nós vira uma aresta com área = a do gargalo (menor diâmetro).
 *
 * O tipo `GrafoIndex`/`FluxoResolvido` e os ajudantes `reservatorioVazio`/
 * `demandaConsumo` vêm de `simulador.ts` (o índice de grafo e a física comuns).
 * O import de `GrafoIndex`/`FluxoResolvido` é só de TIPO (não cria ciclo em
 * runtime); os dois ajudantes são funções puras hasteadas.
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
import { metrosPorComprimento } from '../domain/unidades';
import {
  demandaConsumo,
  reservatorioVazio,
  type FluxoResolvido,
  type GrafoIndex,
} from './simulador';

/** Uma aresta da rede: um "run" de tubos em série entre dois nós (junção/reserv.). */
interface ArestaRede {
  a: string;
  b: string;
  area: number;
  tubos: string[];
  /** Por tubo: traversal a→b coincide com o sentido origem→destino do tubo? */
  alinhado: Record<string, boolean>;
}

/**
 * Marca em `resolvidos` os tubos tratados (o laço de gravidade os ignora) e anota
 * a telemetria. Limitações (v1): não modela checkValve/altura DENTRO de um run
 * entre nós (uma boia fechada, sim, bloqueia o run). Para esses casos, use um
 * reservatório no ponto de divisão. Um reservatório vazio pode gerar leve fluxo
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
    // Além de entrar no solve das cargas, cada terminal também vira uma OFERTA ou
    // DEMANDA REAL de volume (com origem/destino), casada adiante às trocas dos
    // reservatórios — para o volume aplicado conservar massa mesmo sob limite.
    const injecao = new Map<string, number>();
    const runsTerminais: { run: ArestaRede; q: number; para: string }[] = []; // telemetria
    const ofertasTerm: { origem: string | null; vol: number }[] = [];
    const demandasTerm: { destino: string | null; vol: number }[] = [];
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
        const qm = vazaoParaM3(Math.max(0, dem), u);
        q = -qm; // consumo RETIRA
        if (qm > 0) demandasTerm.push({ destino: null, vol: qm }); // descarta ao ambiente
      } else if (isFonte(pe)) {
        q = vazaoParaM3(Math.max(0, pe.props.vazaoFixa), u); // fonte injeta
        if (q > 0) ofertasTerm.push({ origem: null, vol: q }); // vem do ambiente
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
            if (q > 0) ofertasTerm.push({ origem: suc.id, vol: q }); // entrega DA sucção
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

    // --- Transferência de volume por rota DIRETA origem→destino (bipartite).
    // Descolar o dreno (reservatório→ambiente) do enchimento (ambiente→destino)
    // faria o limite de volume (reservatório quase vazio) escalar SÓ o dreno,
    // criando água no destino (o refluxo fantasma da União com o superior no fim).
    // Casando cada FONTE real (reservatório que perde, fonte, bomba pela sucção)
    // com cada SORVEDOURO real (reservatório que ganha, consumo) na proporção de
    // cada um, o escalonamento propaga aos destinos e a massa conserva.
    const ofertas: { origem: string | null; vol: number }[] = [...ofertasTerm];
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
