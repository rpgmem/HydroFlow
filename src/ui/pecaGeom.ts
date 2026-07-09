/**
 * Geometria de desenho das peças (compartilhada entre PecaView e Canvas).
 * Fica fora do módulo de componente para não quebrar o fast-refresh do Vite
 * (que exige que arquivos de componente exportem só componentes).
 */
import type { Peca } from '../domain/types';

/** Metade da "pegada" de cada tipo, usada para desenhar e ancorar conexões. */
export function tamanhoPeca(tipo: Peca['tipo']): { w: number; h: number } {
  switch (tipo) {
    case 'reservatorio':
      return { w: 64, h: 88 };
    case 'tubo':
      return { w: 76, h: 16 };
    case 'bomba':
      return { w: 46, h: 46 };
    case 'fonte':
      return { w: 48, h: 48 };
    case 'consumo':
      return { w: 44, h: 44 };
    case 'sensor':
      return { w: 32, h: 32 };
    case 'juncao':
      // Nó de conexão pequeno (um "ponto"): pegada enxuta para as setas
      // encostarem no próprio ponto, sem sobra.
      return { w: 16, h: 16 };
  }
}
