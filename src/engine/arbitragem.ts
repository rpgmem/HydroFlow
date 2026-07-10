/**
 * HydroFlow — Arbitragem de sensores e boias (Sprint 2, seção 4)
 *
 * Regra de arbitragem multi-sensor por bomba:
 *  - DESLIGAR tem prioridade absoluta sobre LIGAR.
 *  - Entre sensores que pedem LIGAR, basta um (OR lógico).
 *  - Sem prioridade manual configurável (decisão v1 — YAGNI).
 *
 * Proteção contra bomba a seco: se o reservatório de origem está vazio, a bomba
 * desliga independentemente do estado dos sensores (tratada no simulador, que
 * conhece o nível de origem).
 */

import type { NivelControle, PropsSensor } from '../domain/types';

export type Decisao = 'ligar' | 'desligar' | 'manter';

/**
 * Decisão de um único sensor eletrônico, avaliada sobre o nível monitorado no
 * ESTADO DO TICK ANTERIOR. Aplica histerese (banda morta entre min e max) e
 * `delay` (tempo mínimo entre trocas).
 */
export function avaliarSensor(
  sensor: PropsSensor,
  nivelMonitorado: number,
  tempoAtual: number,
): Decisao {
  // `delay` suprime trocas rápidas: dentro da janela, mantém o estado atual.
  // A janela só vale para uma troca no PASSADO (ultimaTroca ≤ tempoAtual). Um
  // ultimaTroca no futuro é lixo de outra execução (ex.: projeto exportado
  // durante um run e recarregado com o tempo zerado) — ignorá-lo evita a bomba
  // ficar "presa" até o relógio alcançar aquele instante.
  if (
    sensor.delay !== undefined &&
    sensor.delay > 0 &&
    sensor.ultimaTroca !== undefined &&
    sensor.ultimaTroca <= tempoAtual &&
    tempoAtual - sensor.ultimaTroca < sensor.delay
  ) {
    return 'manter';
  }

  const { nivelMaximo, nivelMinimo } = sensor;
  if (sensor.reversa) {
    // Reverso (corte por nível baixo): DESLIGA no mínimo, LIBERA (liga) no máximo.
    if (nivelMinimo !== undefined && nivelMonitorado <= nivelMinimo) return 'desligar';
    if (nivelMaximo !== undefined && nivelMonitorado >= nivelMaximo) return 'ligar';
    return 'manter';
  }
  if (nivelMaximo !== undefined && nivelMonitorado >= nivelMaximo) {
    return 'desligar';
  }
  if (nivelMinimo !== undefined && nivelMonitorado <= nivelMinimo) {
    return 'ligar';
  }
  // Banda morta: mantém o estado anterior (comportamento de histerese).
  return 'manter';
}

/**
 * Combina as decisões de todos os sensores de uma bomba com a regra de
 * prioridade. `estadoAnterior` é usado quando ninguém pede ativamente.
 */
export function arbitrarBomba(
  decisoes: Decisao[],
  estadoAnterior: boolean,
): boolean {
  if (decisoes.includes('desligar')) return false; // prioridade absoluta
  if (decisoes.includes('ligar')) return true; // OR lógico
  return estadoAnterior; // ninguém pediu → mantém
}

/**
 * Combinação de sensores de um canal do quadro pela lógica escolhida:
 *  - 'OU' (default): basta um pedir ligar (regra padrão `arbitrarBomba`).
 *  - 'E': só liga se TODOS pedirem ligar; qualquer 'desligar' vence.
 * Sem decisões (nenhum sensor), mantém o estado anterior nos dois casos.
 */
export function combinarSensores(
  decisoes: Decisao[],
  logica: 'E' | 'OU',
  estadoAnterior: boolean,
): boolean {
  if (decisoes.length === 0) return estadoAnterior;
  if (logica === 'E') {
    if (decisoes.includes('desligar')) return false; // um veta → desliga
    return decisoes.every((d) => d === 'ligar') ? true : estadoAnterior;
  }
  return arbitrarBomba(decisoes, estadoAnterior); // 'OU'
}

/**
 * Boia mecânica (válvula de aresta) — tubo/fonte. Sem histerese/delay: decide
 * apenas se a válvula está ABERTA neste tick, monitorando o nível do
 * reservatório de destino (fecha quando cheio, abre quando baixo).
 * Retorna `true` = deixa passar fluxo.
 */
export function boiaAberta(
  boia: NivelControle,
  nivelDestino: number,
  abertaAnterior: boolean,
): boolean {
  // Monitora o DESTINO: fecha no máximo (cheio), abre no mínimo; entre os dois
  // mantém o estado anterior (histerese).
  if (boia.nivelMaximo !== undefined && nivelDestino >= boia.nivelMaximo) {
    return false; // cheio → fecha
  }
  if (boia.nivelMinimo !== undefined && nivelDestino <= boia.nivelMinimo) {
    return true; // baixo → abre
  }
  return abertaAnterior;
}
