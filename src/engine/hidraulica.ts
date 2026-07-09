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

  // f(Q) = carga de velocidade + perda − carga disponível. Cresce com Q:
  // f(0) = −Δh < 0; f(qTorr) = Δh + hf(qTorr) − Δh = hf > 0 → raiz em (0, qTorr).
  const f = (q: number): number => {
    const v = q / areaM2;
    return (v * v) / (2 * g) + hfHazenWilliamsM(q, comprimentoM, dM, coefC) - deltaHm;
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

/**
 * Perda de carga (m) de Hazen-Williams num tubo para a vazão `qM3` (m³/s):
 *   hf = 10,67 · L · Q^1,85 / (C^1,85 · D^4,87)  (L, D em metros).
 * Zero para vazão/parâmetros não-positivos.
 */
export function hfHazenWilliamsM(
  qM3: number,
  lengthM: number,
  diametroM: number,
  coefC: number,
): number {
  if (qM3 <= 0 || lengthM <= 0 || coefC <= 0 || diametroM <= 0) return 0;
  return (10.67 * lengthM * Math.pow(qM3, 1.85)) / (Math.pow(coefC, 1.85) * Math.pow(diametroM, 4.87));
}

/**
 * Ponto de operação de uma bomba com curva linear, considerando a perda de carga
 * do sistema. Resolve, por bisseção, a vazão `x` que satisfaz
 *   `x = base − kEff·(estáticaM + hfM(x))`,
 * ou seja, o encontro da curva da bomba com a curva do sistema (altura estática +
 * atrito). `hfM(x)` devolve a perda de atrito (m) na vazão `x`. Com `hfM ≡ 0`
 * recai no modelo sem atrito (`base − kEff·estática`). Unidades de `base`/`x`
 * livres, desde que `kEff` esteja em (unidade de vazão)/m.
 */
export function vazaoBombaOperacao(
  base: number,
  kEff: number,
  estaticaM: number,
  hfM: (x: number) => number,
): number {
  const q0 = Math.max(0, base - kEff * estaticaM); // vazão sem atrito (limite superior)
  if (q0 <= 0 || kEff <= 0) return q0; // já zerada, ou bomba ideal (curva vertical)
  // f(x) = base − kEff·(estática + hf(x)) − x. Decresce com x:
  // f(0) = q0 > 0; f(q0) = −kEff·hf(q0) < 0 → raiz em (0, q0).
  const f = (x: number): number => base - kEff * (estaticaM + hfM(x)) - x;
  let lo = 0;
  let hi = q0;
  for (let i = 0; i < 50; i++) {
    const m = (lo + hi) / 2;
    if (f(m) > 0) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}
