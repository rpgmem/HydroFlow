/**
 * HydroFlow — Leis de vazão (hidráulica).
 *
 * Concentra o cálculo de vazão por gravidade num único ponto, para o resto do
 * motor (`calcularTubo`, `calcularConsumo`, rede de junções) apenas CHAMAR sem
 * repetir a escolha do modelo. Hoje há dois modelos:
 *  - Torricelli puro:  Q = A·√(2g·Δh)   (padrão; sem perda de carga)
 *  - Hazen-Williams:   Δh = v²/2g + hf(Q), com
 *                      hf = 10,67 · L · Q^1,85 / (C^1,85 · D^4,87)  (só com atrito)
 *
 * Toda a matemática é em SI (m, m³/s, s). Nenhuma dependência de DOM/estado.
 */

/** Coeficiente C de Hazen-Williams padrão (plástico/PVC liso). */
export const HW_C_PADRAO = 140;
/** Comprimento assumido (m) quando o tubo não informa `comprimento` e o atrito
 *  está ligado. Mantém o modelo utilizável sem exigir preencher tudo. */
export const COMPRIMENTO_PADRAO_M = 1;

/**
 * Vazão (m³/s) por gravidade dada a carga disponível `deltaHm` (m).
 *
 * Sem atrito (ou sem comprimento/C/diâmetro válidos) devolve o Torricelli puro.
 * Com atrito, resolve por bisseção `Δh = v²/2g + hf(Q)` (Hazen-Williams) — o
 * atrito só REDUZ a vazão frente ao Torricelli (o limite superior).
 * `diametroMM` em milímetros; `comprimentoM` em metros.
 */
export function vazaoGravidadeM3(
  atrito: boolean,
  areaM2: number,
  diametroMM: number,
  comprimentoM: number,
  coefC: number,
  deltaHm: number,
  g: number,
): number {
  if (deltaHm <= 0 || areaM2 <= 0) return 0;
  const qTorr = areaM2 * Math.sqrt(2 * g * deltaHm); // Torricelli (limite superior)
  const dM = diametroMM / 1000;
  if (!atrito || !(comprimentoM > 0) || !(coefC > 0) || !(dM > 0)) return qTorr;

  const hf = (q: number): number =>
    (10.67 * comprimentoM * Math.pow(q, 1.85)) / (Math.pow(coefC, 1.85) * Math.pow(dM, 4.87));
  // f(Q) = carga de velocidade + perda − carga disponível. Cresce com Q:
  // f(0) = −Δh < 0; f(qTorr) = Δh + hf(qTorr) − Δh = hf > 0 → raiz em (0, qTorr).
  const f = (q: number): number => {
    const v = q / areaM2;
    return (v * v) / (2 * g) + hf(q) - deltaHm;
  };
  let lo = 0;
  let hi = qTorr;
  for (let i = 0; i < 50; i++) {
    const m = (lo + hi) / 2;
    if (f(m) > 0) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
}
