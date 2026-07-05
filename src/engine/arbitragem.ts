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
  nivelMonitorado: number,
  abertaAnterior: boolean,
): boolean {
  if (boia.reversa) {
    // Reversa (corte por nível baixo): monitora a ORIGEM. Fecha no mínimo (para
    // não esvaziar), reabre no máximo. O chamador passa o nível da origem.
    if (boia.nivelMinimo !== undefined && nivelMonitorado <= boia.nivelMinimo) {
      return false; // baixo → fecha
    }
    if (boia.nivelMaximo !== undefined && nivelMonitorado >= boia.nivelMaximo) {
      return true; // recuperou → abre
    }
    return abertaAnterior;
  }
  // Normal: monitora o DESTINO. Fecha no máximo (cheio), abre no mínimo.
  if (boia.nivelMaximo !== undefined && nivelMonitorado >= boia.nivelMaximo) {
    return false; // cheio → fecha
  }
  if (boia.nivelMinimo !== undefined && nivelMonitorado <= boia.nivelMinimo) {
    return true; // baixo → abre
  }
  return abertaAnterior;
}
