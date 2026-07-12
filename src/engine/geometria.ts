/**
 * HydroFlow — Geometria de reservatórios
 *
 * v1 assume seção transversal CONSTANTE (cilindro reto ou prisma retangular), portanto a relação nível↔volume é linear: V = A·h. Seções variáveis (cone,
 * esfera, cilindro deitado) estão fora de escopo (seção 9 da especificação).
 *
 * UNIDADES: a física é calculada em SI (metros, m³, s). Os valores das peças ficam nas unidades escolhidas pelo usuário e são convertidos aqui:
 *  - comprimentos (raio, largura, nível, cota…) → metros via `metrosPorComprimento`
 *  - volume/vazão exibidos em litros ou m³ via `m3PorVolume`
 *  - DIÂMETRO de tubo é sempre em MILÍMETROS.
 */

import type { PropsReservatorio, Unidades } from '../domain/types';
import { m3PorVolume, metrosPorComprimento } from '../domain/unidades';

/** Área da seção transversal na unidade de comprimento² (sem conversão). */
export function areaSecao(props: PropsReservatorio): number {
  if (props.formato === 'cilindro') {
    const r = props.raio ?? 0;
    return Math.PI * r * r;
  }
  return (props.largura ?? 0) * (props.comprimento ?? 0); // retangular
}

/** Área da seção transversal em m². */
export function areaSecaoM2(props: PropsReservatorio, u: Unidades): number {
  const kL = metrosPorComprimento(u);
  return areaSecao(props) * kL * kL;
}

/** Volume (m³) correspondente a um nível de líquido (na unidade do usuário). */
export function volumeM3DeNivel(
  props: PropsReservatorio,
  nivel: number,
  u: Unidades,
): number {
  const kL = metrosPorComprimento(u);
  return areaSecaoM2(props, u) * Math.max(0, nivel) * kL;
}

/** Nível (na unidade do usuário) correspondente a um volume em m³. */
export function nivelDeVolumeM3(
  props: PropsReservatorio,
  volumeM3: number,
  u: Unidades,
): number {
  const a = areaSecaoM2(props, u);
  if (a <= 0) return 0;
  const kL = metrosPorComprimento(u);
  return Math.max(0, volumeM3) / a / kL;
}

/** Volume máximo (m³) antes de transbordar (nível na alturaMaxima). */
export function volumeMaximoM3(props: PropsReservatorio, u: Unidades): number {
  return volumeM3DeNivel(props, props.alturaMaxima, u);
}

/** Área da seção interna de um tubo, em m², a partir do diâmetro em MM. */
export function areaTuboM2(diametroMM: number): number {
  const rM = diametroMM / 1000 / 2;
  return Math.PI * rM * rM;
}

/** Converte uma vazão da unidade do usuário (volume/s) para m³/s. */
export function vazaoParaM3(vazaoUsuario: number, u: Unidades): number {
  return vazaoUsuario * m3PorVolume(u);
}

/** Converte uma vazão de m³/s para a unidade do usuário (volume/s). */
export function vazaoDeM3(vazaoM3: number, u: Unidades): number {
  return vazaoM3 / m3PorVolume(u);
}

/**
 * Velocidade máxima recomendada de escoamento em tubos (m/s). Regra clássica de projeto (limita perda de carga, ruído e golpe de aríete). As "vazões máximas
 * recomendadas" das tabelas de bitola correspondem exatamente a esta velocidade aplicada ao diâmetro interno.
 */
export const VELOCIDADE_MAX_RECOMENDADA_MS = 3.0;

/** Velocidade de escoamento (m/s) de uma vazão `qM3` (m³/s) num tubo de `diametroMM`. */
export function velocidadeTuboMs(qM3: number, diametroMM: number): number {
  const a = areaTuboM2(diametroMM);
  return a > 0 ? Math.abs(qM3) / a : 0;
}

/** Vazão máxima recomendada (m³/s) de um tubo: área × velocidade de referência (padrão 3 m/s, ou a `velRef` configurada no projeto). */
export function vazaoMaxRecomendadaM3(
  diametroMM: number,
  velRef: number = VELOCIDADE_MAX_RECOMENDADA_MS,
): number {
  return areaTuboM2(diametroMM) * velRef;
}
