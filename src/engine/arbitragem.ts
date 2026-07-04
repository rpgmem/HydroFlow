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
  if (
    sensor.delay !== undefined &&
    sensor.delay > 0 &&
    sensor.ultimaTroca !== undefined &&
    tempoAtual - sensor.ultimaTroca < sensor.delay
  ) {
    return 'manter';
  }

  const { nivelMaximo, nivelMinimo } = sensor;
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
  if (boia.nivelMaximo !== undefined && nivelDestino >= boia.nivelMaximo) {
    return false; // cheio → fecha
  }
  if (boia.nivelMinimo !== undefined && nivelDestino <= boia.nivelMinimo) {
    return true; // baixo → abre
  }
  return abertaAnterior;
}
