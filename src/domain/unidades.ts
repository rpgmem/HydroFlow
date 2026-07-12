/**
 * Unidades: o ARMAZENAMENTO é canônico em SI (metros, m³, m³/s). O campo
 * `unidades` do projeto é apenas a PREFERÊNCIA DE EXIBIÇÃO — a UI converte
 * SI↔exibição com os helpers abaixo, e o motor trabalha sempre em SI
 * (`UNIDADES_CANONICAS`). Estas funções rotulam campos/telemetria e convertem.
 */
import type { Unidades } from './types';

/** Unidade canônica (SI) usada pelo armazenamento e pelo motor. */
export const UNIDADES_CANONICAS: Unidades = { volume: 'm3', comprimento: 'm' };

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

// --- Conversão SI ↔ EXIBIÇÃO (a UI trabalha com valores canônicos em SI) -----

/** Comprimento SI (m) → valor exibido na unidade `u`. */
export function exibirComprimento(m: number, u: Unidades): number {
  return m / metrosPorComprimento(u);
}
/** Valor de comprimento na unidade `u` → SI (m). */
export function comprimentoParaSI(valor: number, u: Unidades): number {
  return valor * metrosPorComprimento(u);
}
/** Volume SI (m³) → valor exibido na unidade `u`. */
export function exibirVolume(m3: number, u: Unidades): number {
  return m3 / m3PorVolume(u);
}
/** Valor de volume na unidade `u` → SI (m³). */
export function volumeParaSI(valor: number, u: Unidades): number {
  return valor * m3PorVolume(u);
}
/** Vazão SI (m³/s) → valor exibido na unidade `u` (mesmo fator do volume). */
export function exibirVazao(m3s: number, u: Unidades): number {
  return m3s / m3PorVolume(u);
}
/** Valor de vazão na unidade `u` → SI (m³/s). */
export function vazaoParaSI(valor: number, u: Unidades): number {
  return valor * m3PorVolume(u);
}
