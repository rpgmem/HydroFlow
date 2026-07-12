/**
 * HydroFlow — Constantes e relações físicas puras (SI)
 *
 * Funções determinísticas e sem estado, em unidades canônicas (SI). Base
 * compartilhada dos itens de física avançada (pressão, Reynolds, atrito,
 * NPSH, golpe de aríete). Cresce por PR — aqui entram só as usadas até aqui.
 */

/** Densidade da água (kg/m³) — assumida constante na faixa usual. */
export const DENSIDADE_AGUA_KGM3 = 1000;

/** Aceleração da gravidade padrão (m/s²). Espelha `configuracaoSimulacao.g`. */
export const G_PADRAO_MS2 = 9.81;

/** Pressão atmosférica ao nível do mar (kPa). */
export const PRESSAO_ATM_KPA = 101.325;

/** Temperatura padrão da água (°C) quando não configurada. */
export const TEMPERATURA_PADRAO_C = 20;

/**
 * Pressão hidrostática (kPa) de uma coluna d'água de `colunaM` metros
 * (Teorema de Stevin): ΔP = ρ·g·h. Ex.: 10 m ≈ 98,1 kPa ≈ 1 atm.
 */
export function pressaoHidrostaticaKPa(colunaM: number, g: number = G_PADRAO_MS2): number {
  return (DENSIDADE_AGUA_KGM3 * g * Math.max(0, colunaM)) / 1000;
}

/**
 * Altura da coluna d'água (m) equivalente a uma pressão (kPa) — o inverso do
 * Teorema de Stevin: h = P/(ρ·g). Ex.: 98,1 kPa ≈ 10 m. Usada para converter o
 * setpoint da válvula de alívio em altura de coluna.
 */
export function colunaPressaoM(pKPa: number, g: number = G_PADRAO_MS2): number {
  return (Math.max(0, pKPa) * 1000) / (DENSIDADE_AGUA_KGM3 * g);
}

/**
 * Viscosidade dinâmica da água (Pa·s) em função da temperatura (°C). Correlação
 * empírica (tipo Vogel) válida ~0–100 °C: μ = 2,414e-5·10^(247,8/(T_K − 140)).
 * Em 20 °C ≈ 1,00e-3 Pa·s.
 */
export function muAgua(tC: number = TEMPERATURA_PADRAO_C): number {
  const tK = tC + 273.15;
  return 2.414e-5 * Math.pow(10, 247.8 / (tK - 140));
}

/**
 * Número de Reynolds (adimensional) de um escoamento em tubo cheio:
 * Re = ρ·v·D/μ. `vMs` em m/s, `diametroMM` em mm, `muPas` em Pa·s.
 */
export function reynolds(
  vMs: number,
  diametroMM: number,
  muPas: number = muAgua(),
): number {
  if (muPas <= 0) return 0;
  return (DENSIDADE_AGUA_KGM3 * Math.abs(vMs) * (diametroMM / 1000)) / muPas;
}

/** Regime de escoamento pelo número de Reynolds (faixa clássica de tubos). */
export function regimeReynolds(re: number): 'laminar' | 'transicao' | 'turbulento' {
  if (re < 2000) return 'laminar';
  if (re > 4000) return 'turbulento';
  return 'transicao';
}

/** Rugosidade absoluta padrão (mm) — PVC/plástico liso, default do Darcy-Weisbach. */
export const RUGOSIDADE_PADRAO_MM = 0.0015;

/**
 * Fator de atrito de Darcy `f` (adimensional) para o Darcy-Weisbach:
 *  - laminar (Re < 2000): f = 64/Re;
 *  - turbulento (Re > 4000): Swamee-Jain (aproximação explícita de Colebrook)
 *    f = 0,25 / [log10(ε/(3,7·D) + 5,74/Re^0,9)]²;
 *  - transição (2000–4000): interpola linearmente entre os dois.
 * `epsMM` e `diametroMM` na MESMA unidade (mm) — só a razão ε/D importa.
 */
export function fatorAtritoDW(re: number, epsMM: number, diametroMM: number): number {
  if (re <= 0 || diametroMM <= 0) return 0;
  const epsD = Math.max(0, epsMM) / diametroMM;
  const turbulento = (r: number): number => {
    const x = Math.log10(epsD / 3.7 + 5.74 / Math.pow(r, 0.9));
    return 0.25 / (x * x);
  };
  if (re < 2000) return 64 / re;
  if (re > 4000) return turbulento(re);
  // transição: mistura laminar(2000) → turbulento(4000).
  const t = (re - 2000) / 2000;
  return (1 - t) * (64 / 2000) + t * turbulento(4000);
}

/**
 * Celeridade da onda de pressão (m/s) para o golpe de aríete — velocidade com
 * que a sobrepressão se propaga no tubo. Depende da elasticidade do fluido e do
 * tubo; ~1000 m/s é um valor típico para água em tubo relativamente rígido.
 */
export const CELERIDADE_GOLPE_MS = 1000;

/** Limite de pressão padrão para o alerta de golpe (kPa) — ordem de PN10 = 1000 kPa. */
export const LIMITE_GOLPE_PADRAO_KPA = 1000;

/**
 * Sobrepressão do golpe de aríete (kPa) numa PARADA SÚBITA do escoamento
 * (equação de Joukowsky): ΔP = ρ·a·Δv, com Δv = |v| (parada total). É a pior
 * sobrepressão possível ao fechar um registro / desligar uma bomba de repente.
 */
export function sobrepressaoGolpeKPa(
  vMs: number,
  celeridade: number = CELERIDADE_GOLPE_MS,
): number {
  return (DENSIDADE_AGUA_KGM3 * celeridade * Math.abs(vMs)) / 1000;
}

/**
 * Pressão de vapor de saturação da água (kPa) em função da temperatura (°C),
 * pela equação de Tetens: P = 0,61078·exp(17,27·T/(T + 237,3)). Em 20 °C ≈
 * 2,34 kPa. É a pressão em que a água "ferve" na temperatura dada — o piso de
 * pressão abaixo do qual há cavitação na sucção da bomba.
 */
export function pvaporAguaKPa(tC: number = TEMPERATURA_PADRAO_C): number {
  return 0.61078 * Math.exp((17.27 * tC) / (tC + 237.3));
}

/**
 * NPSH disponível (m) na sucção de uma bomba — a energia líquida acima da
 * pressão de vapor na entrada, em metros de coluna d'água:
 *   NPSH_disp = (P_atm − P_vapor)/(ρ·g) + carga_sucção
 * `cargaSuccaoM` é a carga de sucção já LÍQUIDA das perdas: (cota + nível da
 * fonte) − cota da bomba − perdas por atrito na sucção (m). Positiva quando a
 * fonte está acima da bomba (afogada), negativa em sucção negativa (bomba
 * acima). Abaixo do NPSH REQUERIDO pela bomba, há risco de cavitação.
 */
export function npshDisponivelM(
  cargaSuccaoM: number,
  pvaporKPa: number,
  pAtmKPa: number = PRESSAO_ATM_KPA,
  g: number = G_PADRAO_MS2,
): number {
  const hAtmVapor = ((pAtmKPa - pvaporKPa) * 1000) / (DENSIDADE_AGUA_KGM3 * g);
  return hAtmVapor + cargaSuccaoM;
}
