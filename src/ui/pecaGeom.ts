/**
 * Geometria de desenho das peças (compartilhada entre PecaView e Canvas).
 * Fica fora do módulo de componente para não quebrar o fast-refresh do Vite (que exige que arquivos de componente exportem só componentes).
 */
import type { Peca } from '../domain/types';

/** Passo da grade de encaixe (snap) ao arrastar peças na edição, em px. As colunas do exemplo (múltiplas de 120) continuam alinhadas — 120 = 6×20.
 */
export const GRADE = 20;

/** Diâmetro (px) uniforme dos nós/componentes pontuais (bomba, fonte, consumo, sensor, junção). Padronizado para todos terem a MESMA pegada — a diferença
 *  entre eles vem da forma e da cor, não do tamanho. */
export const TAMANHO_NO = 46;

/** Metade da "pegada" de cada tipo, usada para desenhar e ancorar conexões. */
export function tamanhoPeca(tipo: Peca['tipo']): { w: number; h: number } {
  switch (tipo) {
    case 'reservatorio':
      return { w: 64, h: 88 }; // recipiente (alto): mantém proporção de tanque
    case 'tubo':
      return { w: 76, h: 16 }; // conduto (comprido): mantém proporção de cano
    case 'bomba':
    case 'fonte':
    case 'consumo':
    case 'sensor':
    case 'juncao':
      // Componentes pontuais: mesmo diâmetro para todos (forma + cor distinguem).
      return { w: TAMANHO_NO, h: TAMANHO_NO };
    case 'quadro':
      // Quadro de comandos (painel): quadrado, do mesmo diâmetro dos demais nós.
      return { w: TAMANHO_NO, h: TAMANHO_NO };
  }
}
