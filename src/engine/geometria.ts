/**
 * HydroFlow — Geometria de reservatórios (Sprint 2)
 *
 * v1 assume seção transversal CONSTANTE (cilindro reto ou prisma retangular),
 * portanto a relação nível↔volume é linear: V = A·h. Seções variáveis (cone,
 * esfera, cilindro deitado) estão fora de escopo (seção 9 da especificação).
 */

import type { PropsReservatorio } from '../domain/types';

/** Área da seção transversal do reservatório. */
export function areaSecao(props: PropsReservatorio): number {
  if (props.formato === 'cilindro') {
    const r = props.raio ?? 0;
    return Math.PI * r * r;
  }
  // retangular
  return (props.largura ?? 0) * (props.comprimento ?? 0);
}

/** Volume correspondente a um nível de líquido (seção constante). */
export function volumeDeNivel(props: PropsReservatorio, nivel: number): number {
  return areaSecao(props) * Math.max(0, nivel);
}

/** Nível correspondente a um volume (seção constante). */
export function nivelDeVolume(props: PropsReservatorio, volume: number): number {
  const a = areaSecao(props);
  if (a <= 0) return 0;
  return Math.max(0, volume) / a;
}

/** Volume máximo antes de transbordar (nível na alturaMaxima). */
export function volumeMaximo(props: PropsReservatorio): number {
  return volumeDeNivel(props, props.alturaMaxima);
}
