/**
 * HydroFlow — Geometria de reservatórios (Sprint 2)
 *
 * v1 assume seção transversal CONSTANTE (cilindro reto ou prisma retangular),
 * portanto a relação nível↔volume é linear: V = A·h. Seções variáveis (cone,
 * esfera, cilindro deitado) estão fora de escopo (seção 9 da especificação).
 *
 * UNIDADES: a física é calculada em SI (metros, m³, s). Os valores das peças
 * ficam nas unidades escolhidas pelo usuário e são convertidos aqui:
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
