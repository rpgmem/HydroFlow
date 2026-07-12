/**
 * Gerador de vazão no tempo — a matemática pura dos perfis `f(t)` usados pela Fonte (entrada) e pelo Consumo (saída). Determinístico (sem `Math.random`);
 * o valor é sempre clampado em ≥ 0. Compartilhado entre o motor (vazão real) e a UI (preview ao vivo), por isso vive no domínio, sem dependências de engine/UI.
 *
 * `fixo`, `trapezoidal` (com presets: quadrada, retangular, triangular, dente de serra ↑/↓, trapézio) e `senoidal`. As demais formas entram posteriormente.
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

/** Hash inteiro determinístico → [0,1). Reproduzível (sem `Math.random`). */
function hash01(semente: number, passo: number): number {
  let a = (Math.imul(semente | 0, 2654435761) + Math.imul(passo | 0, 40503)) >>> 0;
  a ^= a >>> 15;
  a = Math.imul(a, 2246822519);
  a ^= a >>> 13;
  a = Math.imul(a, 3266489917);
  a ^= a >>> 16;
  return (a >>> 0) / 4294967296;
}

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

    case 'degrau': {
      // Evento único: v0 até `instante`, transição (rampa `rampa` s; 0 = seco), depois v1.
      const v0 = g.v0 ?? 0;
      const v1 = g.v1 ?? 0;
      const t0 = g.instante ?? 0;
      const r = Math.max(0, g.rampa ?? 0);
      if (t < t0) return v0;
      if (r > 0 && t < t0 + r) return v0 + (v1 - v0) * ((t - t0) / r);
      return v1;
    }

    case 'pulso': {
      // Evento único: um disparo retangular de `largura` s a partir de `inicio`.
      const base = g.base ?? 0;
      const amp = g.amplitude ?? 0;
      const ini = g.inicio ?? 0;
      const larg = Math.max(0, g.largura ?? 0);
      return t >= ini && t < ini + larg ? amp : base;
    }

    case 'exponencial': {
      // Aproximação/decaimento com constante de tempo τ. subida: base→alvo; decaimento: alvo→base.
      const base = g.base ?? 0;
      const alvo = g.alvo ?? 0;
      const tau = g.tau && g.tau > 0 ? g.tau : 1;
      const e = Math.exp(-Math.max(0, t) / tau);
      return g.sentido === 'decaimento' ? base + (alvo - base) * e : base + (alvo - base) * (1 - e);
    }

    case 'diaria': {
      // 2 picos num dia real (86.400 s). Cada pico é um trapézio (subida/patamar/
      // descida em horas). O valor é o MÁXIMO entre a base e os dois picos.
      const T = 86400;
      const th = modPos(t, T);
      const base = g.base ?? 0;
      const pico = (H: number, val: number, s: number, p: number, d: number): number => {
        const Hs = H * 3600;
        const ss = Math.max(0, s) * 3600;
        const ps = Math.max(0, p) * 3600;
        const ds = Math.max(0, d) * 3600;
        // Avalia considerando o "wrap" à meia-noite (offsets −T, 0, +T).
        let melhor = base;
        for (const off of [-T, 0, T]) {
          const x = th - off;
          let v = base;
          if (ss > 0 && x >= Hs - ss && x < Hs) v = base + (val - base) * ((x - (Hs - ss)) / ss);
          else if (x >= Hs && x < Hs + ps) v = val;
          else if (ds > 0 && x >= Hs + ps && x < Hs + ps + ds) v = val - (val - base) * ((x - Hs - ps) / ds);
          if (v > melhor) melhor = v;
        }
        return melhor;
      };
      const manha = pico(g.pmHora ?? 7, g.pmValor ?? base, g.pmSubida ?? 2, g.pmPatamar ?? 3, g.pmDescida ?? 2);
      const noite = pico(g.pnHora ?? 19, g.pnValor ?? base, g.pnSubida ?? 2, g.pnPatamar ?? 3, g.pnDescida ?? 2);
      return Math.max(base, manha, noite);
    }

    case 'escalonada': {
      // Escada crescente de `degraus` níveis (min→max) por período; depois reseta.
      const min = g.min ?? 0;
      const max = Math.max(min, g.max ?? min);
      const T = periodoOk(g.periodo);
      const N = Math.max(1, Math.round(g.degraus ?? 4));
      if (N === 1) return max;
      const p = modPos(t, T) / T;
      const k = Math.min(N - 1, Math.floor(p * N));
      return min + ((max - min) * k) / (N - 1);
    }

    case 'amortecida': {
      // Senoidal que decai com constante τ (transiente): base + A·e^(−t/τ)·sin.
      const base = g.base ?? 0;
      const amp = g.amplitude ?? 0;
      const T = periodoOk(g.periodo);
      const tau = g.tau && g.tau > 0 ? g.tau : 1;
      return base + amp * Math.exp(-Math.max(0, t) / tau) * Math.sin((2 * Math.PI * t) / T);
    }

    case 'aleatoria': {
      // "Ruído" reproduzível: um valor por `granularidade` s, via PRNG semeado.
      const min = g.min ?? 0;
      const max = Math.max(min, g.max ?? min);
      const gran = g.granularidade && g.granularidade > 0 ? g.granularidade : 5;
      const passo = Math.floor(Math.max(0, t) / gran);
      return min + (max - min) * hash01(Math.floor(g.semente ?? 1), passo);
    }
  }
}

/** Janela de tempo (s) mostrada no preview, adequada a cada perfil. */
export function janelaPreview(g: Gerador): number {
  switch (g.perfil) {
    case 'fixo':
      return 10;
    case 'diaria':
      return 86400; // 1 dia
    case 'degrau':
      return ((g.instante ?? 0) + Math.max(0, g.rampa ?? 0)) * 2 + 20;
    case 'pulso':
      return ((g.inicio ?? 0) + Math.max(0, g.largura ?? 0)) * 1.6 + 10;
    case 'exponencial':
      return (g.tau && g.tau > 0 ? g.tau : 30) * 5;
    case 'amortecida':
      return Math.max(periodoOk(g.periodo) * 4, (g.tau && g.tau > 0 ? g.tau : 60) * 3);
    case 'aleatoria':
      return (g.granularidade && g.granularidade > 0 ? g.granularidade : 5) * 24;
    default:
      return periodoOk(g.periodo) * 2.5; // periódicos (trapezoidal/senoidal/escalonada)
  }
}

/** Vazão "representativa" de um gerador — usada para ancorar (`V`) ao trocar de perfil. */
export function vazaoRef(g: Gerador): number {
  switch (g.perfil) {
    case 'fixo':
      return g.vazao ?? 0;
    case 'degrau':
      return Math.max(g.v0 ?? 0, g.v1 ?? 0);
    case 'pulso':
      return Math.max(g.base ?? 0, g.amplitude ?? 0);
    case 'exponencial':
      return Math.max(g.base ?? 0, g.alvo ?? 0);
    case 'diaria':
      return Math.max(g.base ?? 0, g.pmValor ?? 0, g.pnValor ?? 0);
    case 'amortecida':
      return (g.base ?? 0) + (g.amplitude ?? 0);
    case 'aleatoria':
      return g.max ?? 0;
    default:
      return g.max ?? g.vazao ?? 0; // periódicos (trapezoidal/senoidal/escalonada)
  }
}

/** Gerador de vazão constante. */
export function geradorFixo(vazao: number): Gerador {
  return { perfil: 'fixo', vazao };
}

/**
 * Parâmetros padrão de um perfil, ancorados na vazão atual `V` (regra: ao trocar de perfil, a peça já nasce com uma onda "de verdade", não zerada).
 */
export function paramsPadrao(perfil: PerfilVazao, V: number): Gerador {
  switch (perfil) {
    case 'fixo':
      return { perfil: 'fixo', vazao: V };
    case 'senoidal':
      return { perfil: 'senoidal', min: 0.5 * V, max: 1.5 * V, periodo: 60 };
    case 'trapezoidal':
      return { perfil: 'trapezoidal', min: 0, max: V, periodo: 60, preset: 'quadrada', ...PRESETS_TRAPEZOIDAIS.quadrada };
    case 'degrau':
      return { perfil: 'degrau', v0: 0, v1: V, instante: 30, rampa: 0 };
    case 'pulso':
      return { perfil: 'pulso', base: 0, amplitude: V, inicio: 10, largura: 20 };
    case 'exponencial':
      return { perfil: 'exponencial', base: 0, alvo: V, tau: 30, sentido: 'subida' };
    case 'diaria':
      return {
        perfil: 'diaria',
        base: V / 4,
        pmHora: 7, pmValor: V, pmSubida: 2, pmPatamar: 3, pmDescida: 2,
        pnHora: 19, pnValor: V, pnSubida: 2, pnPatamar: 3, pnDescida: 2,
      };
    case 'escalonada':
      return { perfil: 'escalonada', min: 0, max: V, periodo: 60, degraus: 4 };
    case 'amortecida':
      return { perfil: 'amortecida', base: 0, amplitude: V, periodo: 30, tau: 60 };
    case 'aleatoria':
      return { perfil: 'aleatoria', min: 0, max: V, semente: 1, granularidade: 5 };
  }
}
