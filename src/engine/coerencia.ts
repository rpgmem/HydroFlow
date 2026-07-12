/**
 * HydroFlow — Avisos de COERÊNCIA física (não-bloqueantes).
 *
 * Diferente da validação de grafo (que BLOQUEIA a execução), aqui apenas
 * SINALIZAMOS incoerências de dimensionamento que o usuário pode querer ajustar:
 *
 *  - Tomada acima do topo: a `alturaEntrada`/`alturaSaida` de um tubo passa da
 *    `alturaMaxima` do reservatório conectado → a água nunca alcança o bocal
 *    (fluxo zero). Vale sempre.
 *  - Comprimento curto: com o atrito ligado, o `comprimento` (desenvolvido) do
 *    tubo é MENOR que o desnível entre suas pontas — fisicamente impossível
 *    (não dá para ligar dois pontos com um cano mais curto que a distância).
 *
 * Só considera pontas de elevação CONHECIDA (reservatório ou bomba); pontas em
 * junção / descarga ao ambiente ficam indefinidas e o aviso não dispara.
 */
import { GrafoIndex } from './grafo';
import { COMPRIMENTO_PADRAO_M } from './hidraulica';
import { isTubo, isReservatorio, isBomba, type Peca, type PecaDe, type ProjetoSimulacao } from '../domain/types';
import type { ErroValidacao } from '../domain/schema';

const nomeDe = (p: Peca): string => (p.rotulo && p.rotulo.trim() ? p.rotulo : p.id);

/** Elevação (m, SI) de um extremo de tubo, se determinável: reservatório (cota + tomada) ou bomba (cota). Junção/ambiente → indefinido. */
function elevacaoExtremoM(peca: Peca | undefined, tomadaM: number): number | undefined {
  if (peca === undefined) return undefined;
  if (isReservatorio(peca)) return (peca.cota ?? 0) + tomadaM;
  if (isBomba(peca)) return peca.cota ?? 0;
  return undefined;
}

/** Vizinho direto único de um lado do tubo (ou undefined se houver 0 ou vários). */
function vizinhoUnico(idx: GrafoIndex, tuboId: string, lado: 'up' | 'down'): Peca | undefined {
  const conexoes = lado === 'up' ? idx.entrada.get(tuboId) : idx.saida.get(tuboId);
  if (!conexoes || conexoes.length !== 1) return undefined;
  const outro = lado === 'up' ? conexoes[0]!.origem : conexoes[0]!.destino;
  return idx.porId.get(outro);
}

/**
 * Desnível vertical (m, SI) entre as pontas de um tubo, quando as DUAS pontas
 * têm elevação conhecida (reservatório/bomba, vizinhos diretos). Senão `undefined`.
 */
export function desnivelTuboM(idx: GrafoIndex, tubo: PecaDe<'tubo'>): number | undefined {
  const up = vizinhoUnico(idx, tubo.id, 'up');
  const down = vizinhoUnico(idx, tubo.id, 'down');
  const eUp = elevacaoExtremoM(up, tubo.props.alturaEntrada ?? 0);
  const eDown = elevacaoExtremoM(down, tubo.props.alturaSaida ?? 0);
  if (eUp === undefined || eDown === undefined) return undefined;
  return Math.abs(eUp - eDown);
}

/** Reservatório vizinho direto de um lado, se houver (para checar a tomada vs. o topo). */
function reservatorioVizinho(idx: GrafoIndex, tuboId: string, lado: 'up' | 'down'): PecaDe<'reservatorio'> | undefined {
  const v = vizinhoUnico(idx, tuboId, lado);
  return v && isReservatorio(v) ? v : undefined;
}

/** Avisos de coerência física do projeto (não-bloqueantes). */
export function avisosCoerencia(projeto: ProjetoSimulacao): ErroValidacao[] {
  const avisos: ErroValidacao[] = [];
  const idx = new GrafoIndex(projeto);
  const atrito = projeto.configuracaoSimulacao.atrito === true;

  for (const p of projeto.pecas) {
    if (!isTubo(p)) continue;
    const nome = nomeDe(p);

    // Tomada acima do topo do reservatório conectado (entrada e/ou saída).
    const resUp = reservatorioVizinho(idx, p.id, 'up');
    if (resUp && (p.props.alturaEntrada ?? 0) > resUp.props.alturaMaxima + 1e-9) {
      avisos.push({
        caminho: `pecas[${p.id}].props.alturaEntrada`,
        mensagem: `tomada de entrada (${p.props.alturaEntrada} m) acima do topo do reservatório "${nomeDe(resUp)}" (${resUp.props.alturaMaxima} m)`,
        chave: 'coerencia.tomadaAcima',
        params: { nome, tomada: (p.props.alturaEntrada ?? 0).toFixed(1), topo: resUp.props.alturaMaxima.toFixed(1) },
      });
    }
    const resDown = reservatorioVizinho(idx, p.id, 'down');
    if (resDown && (p.props.alturaSaida ?? 0) > resDown.props.alturaMaxima + 1e-9) {
      avisos.push({
        caminho: `pecas[${p.id}].props.alturaSaida`,
        mensagem: `tomada de saída (${p.props.alturaSaida} m) acima do topo do reservatório "${nomeDe(resDown)}" (${resDown.props.alturaMaxima} m)`,
        chave: 'coerencia.tomadaAcima',
        params: { nome, tomada: (p.props.alturaSaida ?? 0).toFixed(1), topo: resDown.props.alturaMaxima.toFixed(1) },
      });
    }

    // Comprimento desenvolvido menor que o desnível (só com atrito, que é quando o comprimento é usado).
    if (atrito) {
      const desnivel = desnivelTuboM(idx, p);
      if (desnivel !== undefined) {
        const comp = p.props.comprimento ?? COMPRIMENTO_PADRAO_M;
        if (comp < desnivel - 1e-6) {
          avisos.push({
            caminho: `pecas[${p.id}].props.comprimento`,
            mensagem: `comprimento (${comp.toFixed(1)} m) menor que o desnível entre as pontas (${desnivel.toFixed(1)} m)`,
            chave: 'coerencia.comprimentoCurto',
            params: { nome, comprimento: comp.toFixed(1), desnivel: desnivel.toFixed(1) },
          });
        }
      }
    }
  }
  return avisos;
}
