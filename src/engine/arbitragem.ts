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
 * Avaliação SEQUENCIAL (esquerda→direita) das decisões dos sensores de um canal,
 * combinadas pelos operadores E/OU entre pares consecutivos. Expressão PURA: não
 * há precedência automática de 'desligar' — a proteção fica por conta do usuário
 * (ex.: uma boia reversa atrás de um `E`).
 *
 * Só quem tem opinião ATIVA entra na conta: 'ligar'→true, 'desligar'→false. As
 * decisões `undefined` (sensor desabilitado) e 'manter' (banda morta, sem opinião)
 * são puladas — um sensor sem opinião não altera a expressão, então o operador
 * usado é sempre o que antecede a PRÓXIMA decisão presente. A dobra aplica
 * ((b0 op0 b1) op1 b2) …, com `operadores[i]` entre a decisão i e a i+1 (faltando,
 * usa `padrao`). Sem nenhuma opinião ativa → mantém o estado anterior.
 *
 * Consequência de projeto: uma boia REVERSA de proteção só corta a bomba se estiver
 * ligada por um `E` (ex.: «nível-baixo E origem-com-água»); atrás de um `OU` seu
 * 'desligar' não vence — é o preço da expressão pura (a proteção é escolha do usuário).
 */
export function avaliarSequencia(
  decisoes: (Decisao | undefined)[],
  operadores: ('E' | 'OU')[],
  padrao: 'E' | 'OU',
  estadoAnterior: boolean,
): boolean {
  let acc: boolean | undefined;
  decisoes.forEach((d, i) => {
    if (d === undefined || d === 'manter') return; // sem opinião ativa → não influencia
    const b = d === 'ligar';
    if (acc === undefined) {
      acc = b;
      return;
    }
    const op = operadores[i - 1] ?? padrao;
    acc = op === 'E' ? acc && b : acc || b;
  });
  return acc ?? estadoAnterior;
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
