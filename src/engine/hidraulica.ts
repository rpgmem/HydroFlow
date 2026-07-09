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
 *
 * As raízes das leis com atrito (que não têm forma fechada) são resolvidas por
 * `raizCrescente` — Newton salvaguardado, ~5–8 avaliações em vez das ~50 de uma
 * bisseção pura. É o caminho quente quando a opção de atrito está ligada.
 */

/** Coeficiente C de Hazen-Williams padrão (plástico/PVC liso). */
export const HW_C_PADRAO = 140;
/** Comprimento assumido (m) quando o tubo não informa `comprimento` e o atrito
 *  está ligado. Mantém o modelo utilizável sem exigir preencher tudo. */
export const COMPRIMENTO_PADRAO_M = 1;
/** Expoente da vazão em Hazen-Williams (hf ∝ Q^1,85). */
const HW_EXP = 1.85;

/**
 * Raiz de uma função ESTRITAMENTE CRESCENTE `f` em `[lo, hi]`, com
 * `f(lo) ≤ 0 ≤ f(hi)`, por **Newton salvaguardado**: dá o passo de Newton quando
 * ele cai dentro do intervalo corrente e usa bisseção caso contrário. Converge em
 * ~5–8 avaliações onde a bisseção pura levava ~50 — o ganho quente do modo atrito.
 *
 * `df` é a derivada de `f`; pode ser **aproximada** — se estiver ruim, o passo de
 * Newton sai do intervalo e a bisseção assume: só afeta a velocidade, nunca a
 * correção. `f` é sempre avaliada ANTES de `df` no mesmo `x`, o que deixa o
 * chamador memoizar termos caros (`Math.pow`, perda de carga) entre as duas.
 */
function raizCrescente(
  f: (x: number) => number,
  df: (x: number) => number,
  lo: number,
  hi: number,
  x0: number,
): number {
  let a = lo;
  let b = hi;
  let x = x0;
  for (let i = 0; i < 40; i++) {
    const fx = f(x);
    if (fx > 0) b = x;
    else a = x;
    if (b - a < 1e-12 || Math.abs(fx) < 1e-13) return x;
    const d = df(x);
    let nx = d > 0 ? x - fx / d : NaN;
    if (!(nx > a && nx < b)) nx = (a + b) / 2; // passo fora do intervalo → bisseção
    x = nx;
  }
  return x;
}

/**
 * Vazão (m³/s) por gravidade dada a carga disponível `deltaHm` (m).
 *
 * Sem atrito (ou sem comprimento/C/diâmetro válidos) devolve o Torricelli puro.
 * Com atrito, resolve `Δh = v²/2g + hf(Q)` (Hazen-Williams) por Newton
 * salvaguardado — o atrito só REDUZ a vazão frente ao Torricelli (o limite
 * superior). `diametroMM` em milímetros; `comprimentoM` em metros.
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

  // f(Q) = carga de velocidade + perda − carga disponível, com hf = K·Q^1,85:
  //   f(Q) = Q²/(2g·A²) + K·Q^1,85 − Δh,   f'(Q) = Q/(g·A²) + 1,85·K·Q^0,85.
  // Cresce com Q: f(0) = −Δh < 0; f(qTorr) = hf(qTorr) > 0 → raiz em (0, qTorr).
  const velCoef = 1 / (2 * g * areaM2 * areaM2); // Q²/(2g·A²) = velCoef·Q²
  const K = (10.67 * comprimentoM) / (Math.pow(coefC, 1.85) * Math.pow(dM, 4.87));
  let pot = 0; // Q^0,85 memoizado entre f e df (mesma Q consecutiva)
  let potDe = NaN;
  const potencia = (q: number): number => {
    if (q !== potDe) {
      pot = Math.pow(q, HW_EXP - 1); // Q^0,85
      potDe = q;
    }
    return pot;
  };
  const f = (q: number): number => velCoef * q * q + K * potencia(q) * q - deltaHm; // K·Q^1,85 = K·Q^0,85·Q
  const df = (q: number): number => 2 * velCoef * q + HW_EXP * K * potencia(q);
  return raizCrescente(f, df, 0, qTorr, qTorr);
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
 * do sistema. Resolve a vazão `x` que satisfaz
 *   `x = base − kEff·(estáticaM + hfM(x))`,
 * ou seja, o encontro da curva da bomba com a curva do sistema (altura estática +
 * atrito). `hfM(x)` devolve a perda de atrito (m) na vazão `x`. Com `hfM ≡ 0`
 * recai no modelo sem atrito (`base − kEff·estática`). Unidades de `base`/`x`
 * livres, desde que `kEff` esteja em (unidade de vazão)/m.
 *
 * Resolvido por Newton salvaguardado. A derivada usa `hf ∝ x^1,85` (Hazen-
 * Williams), então `d(hf)/dx = 1,85·hf(x)/x` — só uma avaliação de `hfM` por passo.
 * Se o `hfM` não seguir essa lei, a derivada fica aproximada e a bisseção assume
 * (correção preservada; só a velocidade muda).
 */
export function vazaoBombaOperacao(
  base: number,
  kEff: number,
  estaticaM: number,
  hfM: (x: number) => number,
): number {
  const q0 = Math.max(0, base - kEff * estaticaM); // vazão sem atrito (limite superior)
  if (q0 <= 0 || kEff <= 0) return q0; // já zerada, ou bomba ideal (curva vertical)
  // Trabalha com g(x) = −f(x) = x + kEff·(estática + hf(x)) − base, CRESCENTE:
  // g(0) = kEff·estática − base = −q0 < 0; g(q0) = kEff·hf(q0) > 0 → raiz em (0, q0).
  let hf = 0; // hf(x) memoizado entre g e dg (mesma x consecutiva)
  let hfDe = NaN;
  const perda = (x: number): number => {
    if (x !== hfDe) {
      hf = hfM(x);
      hfDe = x;
    }
    return hf;
  };
  const gFn = (x: number): number => x + kEff * (estaticaM + perda(x)) - base;
  const dgFn = (x: number): number => (x > 0 ? 1 + (kEff * HW_EXP * perda(x)) / x : 1);
  return raizCrescente(gFn, dgFn, 0, q0, q0);
}
