/**
 * HydroFlow — Constantes e relações físicas puras (SI)
 *
 * Funções determinísticas e sem estado, em unidades canônicas (SI). Base
 * compartilhada dos itens de física avançada (pressão, Reynolds, atrito,
 * NPSH, golpe de aríete). Cresce por PR — aqui entram só as usadas até aqui.
 */

/** Densidade da água (kg/m³) — assumida constante na faixa usual. */
export const DENSIDADE_AGUA_KGM3 = 1000;

/** Aceleração da gravidade padrão (m/s²). Espelha `configuracaoSimulacao.g`. */
export const G_PADRAO_MS2 = 9.81;

/** Pressão atmosférica ao nível do mar (kPa). */
export const PRESSAO_ATM_KPA = 101.325;

/**
 * Pressão hidrostática (kPa) de uma coluna d'água de `colunaM` metros
 * (Teorema de Stevin): ΔP = ρ·g·h. Ex.: 10 m ≈ 98,1 kPa ≈ 1 atm.
 */
export function pressaoHidrostaticaKPa(colunaM: number, g: number = G_PADRAO_MS2): number {
  return (DENSIDADE_AGUA_KGM3 * g * Math.max(0, colunaM)) / 1000;
}
