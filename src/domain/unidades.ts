/**
 * Rótulos de unidades para exibição na UI. O motor trata os números na unidade de comprimento escolhida (volume = área·altura), então estas funções servem
 * apenas para rotular os campos e a telemetria.
 */
import type { Unidades } from './types';

/** Comprimento: 'm' ou 'cm'. */
export function labelComprimento(u: Unidades): string {
  return u.comprimento;
}

/** Volume: 'L' (litros) ou 'm³'. */
export function labelVolume(u: Unidades): string {
  return u.volume === 'litros' ? 'L' : 'm³';
}

/** Vazão: volume por segundo (ex.: 'L/s' ou 'm³/s'). */
export function labelVazao(u: Unidades): string {
  return `${labelVolume(u)}/s`;
}

// --- Fatores de conversão para a física interna (SI: metros, m³) ------------

/** Metros por unidade de comprimento (cm → 0,01; m → 1). */
export function metrosPorComprimento(u: Unidades): number {
  return u.comprimento === 'cm' ? 0.01 : 1;
}

/** Metros cúbicos por unidade de volume (litros → 0,001; m³ → 1). */
export function m3PorVolume(u: Unidades): number {
  return u.volume === 'litros' ? 0.001 : 1;
}
