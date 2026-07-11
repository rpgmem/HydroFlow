/**
 * Gerador de vazão no tempo — a matemática pura dos perfis `f(t)` usados pela
 * Fonte (entrada) e pelo Consumo (saída). Determinístico (sem `Math.random`);
 * o valor é sempre clampado em ≥ 0. Compartilhado entre o motor (vazão real) e a
 * UI (preview ao vivo), por isso vive no domínio, sem dependências de engine/UI.
 *
 * Fase 1: `fixo`, `trapezoidal` (com presets: quadrada, retangular, triangular,
 * dente de serra ↑/↓, trapézio) e `senoidal`. As demais formas entram nas fases
 * seguintes (ver issue do plano).
 */
import type { Gerador, PerfilVazao } from './types';

/** Período padrão (s) quando ausente/inválido. */
const PERIODO_PADRAO = 60;

/** Frações (subida/alto/descida/baixo) de cada preset do trapezoidal. */
export const PRESETS_TRAPEZOIDAIS: Record<
  string,
  { subida: number; alto: number; descida: number; baixo: number }
> = {
  quadrada: { subida: 0, alto: 0.5, descida: 0, baixo: 0.5 },
  retangular: { subida: 0, alto: 0.3, descida: 0, baixo: 0.7 },
  triangular: { subida: 0.5, alto: 0, descida: 0.5, baixo: 0 },
  serraSubindo: { subida: 1, alto: 0, descida: 0, baixo: 0 },
  serraDescendo: { subida: 0, alto: 0, descida: 1, baixo: 0 },
  trapezio: { subida: 0.25, alto: 0.25, descida: 0.25, baixo: 0.25 },
};

/** Ordem dos presets para a UI. */
export const ORDEM_PRESETS = ['quadrada', 'retangular', 'triangular', 'serraSubindo', 'serraDescendo', 'trapezio'] as const;

const periodoOk = (p: number | undefined): number => (p !== undefined && p > 0 ? p : PERIODO_PADRAO);
const modPos = (t: number, T: number): number => ((t % T) + T) % T;

/** Vazão do gerador no instante `t` (s), na unidade do usuário. Sempre ≥ 0. */
export function valorNoTempo(g: Gerador, t: number): number {
  const v = calcular(g, t);
  return Number.isFinite(v) && v > 0 ? v : 0; // clamp ≥ 0
}

function calcular(g: Gerador, t: number): number {
  switch (g.perfil) {
    case 'fixo':
      return g.vazao ?? 0;

    case 'senoidal': {
      const min = g.min ?? 0;
      const max = Math.max(min, g.max ?? min);
      const T = periodoOk(g.periodo);
      return min + (max - min) * (0.5 + 0.5 * Math.sin((2 * Math.PI * t) / T + (g.fase ?? 0)));
    }

    case 'trapezoidal': {
      const min = g.min ?? 0;
      const max = Math.max(min, g.max ?? min);
      const T = periodoOk(g.periodo);
      // Normaliza as 4 frações para somar 1 (baixo = o resto).
      const sR = Math.max(0, g.subida ?? 0);
      const aR = Math.max(0, g.alto ?? 0);
      const dR = Math.max(0, g.descida ?? 0);
      const bR = Math.max(0, g.baixo ?? 0);
      const tot = sR + aR + dR + bR || 1;
      const fs = sR / tot;
      const fa = aR / tot;
      const fd = dR / tot;
      const p = modPos(t, T) / T; // fase em [0,1)
      if (fs > 0 && p < fs) return min + (max - min) * (p / fs); // rampa de subida
      if (p < fs + fa) return max; // patamar alto
      if (fd > 0 && p < fs + fa + fd) return max - (max - min) * ((p - fs - fa) / fd); // rampa de descida
      return min; // patamar baixo
    }
  }
}

/** Vazão "representativa" de um gerador — usada para ancorar (`V`) ao trocar de perfil. */
export function vazaoRef(g: Gerador): number {
  if (g.perfil === 'fixo') return g.vazao ?? 0;
  return g.max ?? g.vazao ?? 0;
}

/** Gerador de vazão constante. */
export function geradorFixo(vazao: number): Gerador {
  return { perfil: 'fixo', vazao };
}

/**
 * Parâmetros padrão de um perfil, ancorados na vazão atual `V` (regra: ao trocar
 * de perfil, a peça já nasce com uma onda "de verdade", não zerada).
 */
export function paramsPadrao(perfil: PerfilVazao, V: number): Gerador {
  switch (perfil) {
    case 'fixo':
      return { perfil: 'fixo', vazao: V };
    case 'senoidal':
      return { perfil: 'senoidal', min: 0.5 * V, max: 1.5 * V, periodo: 60 };
    case 'trapezoidal':
      return { perfil: 'trapezoidal', min: 0, max: V, periodo: 60, preset: 'quadrada', ...PRESETS_TRAPEZOIDAIS.quadrada };
  }
}
