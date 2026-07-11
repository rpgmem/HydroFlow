/**
 * HydroFlow — Vazão dos condutores/terminais por tipo de peça.
 *
 * A física de "quanto passa" em cada elemento fora da rede de junções: tubo por
 * gravidade (Torricelli/atrito, com refluxo e ladrão), bomba (curva/ponto de
 * operação e múltiplas saídas), fonte (vazão fixa com boia) e consumo (demanda
 * limitada pela capacidade do cano). O `simulador.ts` (o tick) orquestra estas
 * funções; a rede que bifurca/une em junções vive em `redeJuncoes.ts`.
 *
 * Cada função é PURA quanto ao estado do tick: recebe o índice de grafo, a peça e
 * os acumuladores (fluxos/vazões/alertas) por parâmetro — nada de fechar sobre o
 * `tick`. Toda a matemática é em SI (m, m³/s, s).
 */
import { isTubo, type PecaDe, type Unidades } from '../domain/types';
import { areaTuboM2, vazaoParaM3 } from './geometria';
import {
  hfHazenWilliamsM,
  vazaoBombaOperacao,
  vazaoGravidadeM3,
  COMPRIMENTO_PADRAO_M,
  HW_C_PADRAO,
} from './hidraulica';
import { metrosPorComprimento } from '../domain/unidades';
import { boiaAberta } from './arbitragem';
import { valorNoTempo } from '../domain/geradorVazao';
import { cargaM, reservatorioVazio, type FluxoResolvido, type GrafoIndex } from './grafo';

export function calcularTubo(
  idx: GrafoIndex,
  tubo: PecaDe<'tubo'>,
  g: number,
  u: Unidades,
  fluxos: FluxoResolvido[],
  ladroesAtivos: string[],
  atrito: boolean,
  comprimentoOverrideM?: number,
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
  // Vazão a partir de uma carga `dh` (m) pela lei de vazão (Torricelli/atrito).
  // `comprimentoOverrideM` (m) permite à cadeia usar o comprimento SOMADO dos
  // tubos em série; senão usa o comprimento do próprio tubo.
  const lengthM = comprimentoOverrideM ?? (tubo.props.comprimento ?? COMPRIMENTO_PADRAO_M) * kL;
  const vazaoDe = (dh: number): number =>
    vazaoGravidadeM3(atrito, areaM2, diametro, lengthM, tubo.props.coefC ?? HW_C_PADRAO, dh, g);

  // Tubo ladrão: só escoa o EXCEDENTE acima do nível de acionamento (a coluna
  // acima do lábio é a carga que empurra o transbordo — autolimitante).
  if (ladrao && Number.isFinite(ladrao.nivel)) {
    const excesso = (up.props.nivel ?? 0) - ladrao.nivel;
    if (excesso <= 1e-9) return 0; // abaixo do lábio → sem transbordo
    const q = vazaoDe(excesso * kL);
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
      const q = vazaoDe(deltaH);
      fluxos.push({ origem: up.id, destino: down?.id ?? null, vazao: q });
      return q;
    }
  }

  // Refluxo destino→origem — simétrico, bloqueado por checkValve.
  if (!checkValve && down && nivelDown > alturaSai + 1e-9) {
    const deltaH = supDown - Math.max(supUp, tapUp);
    if (deltaH > 1e-12) {
      const q = vazaoDe(deltaH);
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
export function coletarCadeiaTubos(idx: GrafoIndex, tuboInicial: string): string[] {
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
 * Perda de carga total (m) de Hazen-Williams ao longo de uma lista de tubos em
 * série, para a vazão `qM3` (m³/s). Usada no ponto de operação da bomba (sucção +
 * recalque) — canos em série somam suas perdas (mesma vazão).
 */
export function hfTubosM(idx: GrafoIndex, tubos: string[], qM3: number, u: Unidades): number {
  const kL = metrosPorComprimento(u);
  let hf = 0;
  for (const tid of tubos) {
    const t = idx.porId.get(tid);
    if (t && isTubo(t)) {
      hf += hfHazenWilliamsM(
        qM3,
        (t.props.comprimento ?? COMPRIMENTO_PADRAO_M) * kL,
        t.props.diametro / 1000,
        t.props.coefC ?? HW_C_PADRAO,
      );
    }
  }
  return hf;
}

export function calcularBomba(
  idx: GrafoIndex,
  bomba: PecaDe<'bomba'>,
  g: number,
  u: Unidades,
  tempo: number,
  fluxos: FluxoResolvido[],
  vazoes: Record<string, number>,
  consumoInsuficiente: string[],
  bombasASeco: string[],
  atrito: boolean,
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
    cons.props.aberto === false ? 0 : valorNoTempo(cons.props.gerador, tempo);

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
      const liftM = cargaM(dp.res, kL) - hUp; // carga estática (m) a vencer nesta saída
      // Curva: `alturaNominal` (plaquinha) deriva o k automaticamente e tem
      // precedência; senão usa o `curva.k` explícito; senão bomba ideal (k=0).
      const kEff =
        bomba.props.alturaNominal && bomba.props.alturaNominal > 0
          ? bomba.props.vazaoNominal / bomba.props.alturaNominal
          : bomba.props.curva
            ? bomba.props.curva.k
            : 0;
      // Com o atrito ligado, a vazão é o PONTO DE OPERAÇÃO (curva da bomba ∩ curva
      // do sistema): a perda de carga de sucção + recalque reduz a entrega. Sem
      // atrito, só a altura estática conta (comportamento de sempre).
      qUser = atrito
        ? vazaoBombaOperacao(base, kEff, liftM, (x) => hfTubosM(idx, [...upPath.tubos, ...dp.tubos], vazaoParaM3(x, u), u))
        : base - kEff * liftM;
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

export function calcularFonte(
  idx: GrafoIndex,
  fonte: PecaDe<'fonte'>,
  u: Unidades,
  tempo: number,
  fluxos: FluxoResolvido[],
  vazoes: Record<string, number>,
): number {
  const saidas = idx.saida.get(fonte.id) ?? [];
  if (saidas.length === 0) return 0;

  // Vazão de abastecimento no instante (perfil no tempo; 'fixo' = constante).
  const vazaoFonte = valorNoTempo(fonte.props.gerador, tempo);

  let total = 0;
  for (const c of saidas) {
    // Caminho fechado (registro OU boia de um tubo em série) → não abastece.
    const dp = idx.resolverFluxo(c.destino, 'down');
    if (!dp.res || !dp.aberto) continue;
    const down = dp.res;
    // Múltiplos destinos: usa vazaoAlocada; destino único usa a vazão da fonte.
    const qAlvo =
      saidas.length > 1
        ? (c.vazaoAlocada ?? 0)
        : (c.vazaoAlocada ?? vazaoFonte);

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

export function calcularConsumo(
  idx: GrafoIndex,
  consumo: PecaDe<'consumo'>,
  g: number,
  u: Unidades,
  tempo: number,
  fluxos: FluxoResolvido[],
  vazoes: Record<string, number>,
  atrito: boolean,
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

  let q = vazaoParaM3(valorNoTempo(consumo.props.gerador, tempo), u);
  // Realismo: a saída é limitada pela CAPACIDADE do cano mais estreito no
  // caminho (Torricelli pelo diâmetro e pela carga). Canos finos estrangulam.
  if (cp.tubos.length > 0) {
    const headM = cargaM(up, kL); // carga do reservatório até a saída (cota 0)
    let capMin = Infinity;
    for (const tid of cp.tubos) {
      const t = idx.porId.get(tid);
      if (t && isTubo(t)) {
        const cap = vazaoGravidadeM3(
          atrito,
          areaTuboM2(t.props.diametro),
          t.props.diametro,
          (t.props.comprimento ?? COMPRIMENTO_PADRAO_M) * kL,
          t.props.coefC ?? HW_C_PADRAO,
          Math.max(0, headM),
          g,
        );
        capMin = Math.min(capMin, cap);
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
