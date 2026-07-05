/**
 * Catálogo de bitolas de tubo pré-configuradas. O usuário seleciona a bitola
 * (DN) mais adequada e a aplicação usa o DIÂMETRO INTERNO tabelado no cálculo de
 * vazão (Torricelli), em vez do nominal — mais realista.
 *
 * Fonte: tabela de referência PVC (soldável fria predial e junta elástica para
 * irrigação/adutoras). Os internos do grupo "Junta Elástica" são aproximados
 * (variam com a classe de pressão) — marcados com `aproximado`.
 *
 * Modelo: `PropsTubo.diametro` (mm) é sempre o diâmetro interno usado na física;
 * `PropsTubo.bitola` guarda apenas o rótulo do preset (ex.: 'DN110'). Selecionar
 * um preset grava `diametro = internoMm` e `bitola = dn`; editar o mm na mão
 * limpa `bitola` (vira "Personalizado"). Projetos sem `bitola` seguem válidos.
 */

export type CategoriaTubo = 'Soldável Fria' | 'Junta Elástica';

export interface BitolaTubo {
  /** Identificador/rotulo do preset (ex.: 'DN110'). */
  dn: string;
  /** Dimensão nominal métrica (ex.: '110 mm'; '125/140 mm' quando agrupada). */
  nominal: string;
  /** Diâmetro de referência em polegadas (ex.: '4"'). */
  polegada: string;
  /** Diâmetro interno médio em MILÍMETROS — usado no cálculo de vazão. */
  internoMm: number;
  /** Sistema de junta / categoria de linha (agrupa o seletor). */
  categoria: CategoriaTubo;
  /** Interno aproximado (varia com a classe de pressão). */
  aproximado?: boolean;
}

/** Bitolas do catálogo, em ordem crescente de diâmetro. */
export const CATALOGO_TUBOS: readonly BitolaTubo[] = [
  // Soldável Fria (Predial / Residencial) — internos exatos.
  { dn: 'DN20', nominal: '20 mm', polegada: '1/2"', internoMm: 16.6, categoria: 'Soldável Fria' },
  { dn: 'DN25', nominal: '25 mm', polegada: '3/4"', internoMm: 21.6, categoria: 'Soldável Fria' },
  { dn: 'DN32', nominal: '32 mm', polegada: '1"', internoMm: 27.8, categoria: 'Soldável Fria' },
  { dn: 'DN40', nominal: '40 mm', polegada: '1.1/4"', internoMm: 35.2, categoria: 'Soldável Fria' },
  { dn: 'DN50', nominal: '50 mm', polegada: '1.1/2"', internoMm: 44.0, categoria: 'Soldável Fria' },
  { dn: 'DN60', nominal: '60 mm', polegada: '2"', internoMm: 53.4, categoria: 'Soldável Fria' },
  { dn: 'DN75', nominal: '75 mm', polegada: '2.1/2"', internoMm: 66.6, categoria: 'Soldável Fria' },
  { dn: 'DN85', nominal: '85 mm', polegada: '3"', internoMm: 75.6, categoria: 'Soldável Fria' },
  { dn: 'DN110', nominal: '110 mm', polegada: '4"', internoMm: 97.8, categoria: 'Soldável Fria' },
  // Junta Elástica (Irrigação / Infraestrutura) — internos aproximados.
  { dn: 'DN125', nominal: '125 mm', polegada: '5"', internoMm: 114.0, categoria: 'Junta Elástica', aproximado: true },
  { dn: 'DN140', nominal: '140 mm', polegada: '5"', internoMm: 128.0, categoria: 'Junta Elástica', aproximado: true },
  { dn: 'DN160', nominal: '160 mm', polegada: '6"', internoMm: 147.0, categoria: 'Junta Elástica', aproximado: true },
  { dn: 'DN200', nominal: '200 mm', polegada: '8"', internoMm: 184.0, categoria: 'Junta Elástica', aproximado: true },
  { dn: 'DN250', nominal: '250 mm', polegada: '10"', internoMm: 230.0, categoria: 'Junta Elástica', aproximado: true },
];

/** Busca uma bitola pelo seu identificador (ex.: 'DN110'). */
export function bitolaPorDn(dn: string | undefined): BitolaTubo | undefined {
  if (!dn) return undefined;
  return CATALOGO_TUBOS.find((b) => b.dn === dn);
}

/** Ordem das categorias no seletor (agrupamento). */
export const CATEGORIAS_TUBO: readonly CategoriaTubo[] = ['Soldável Fria', 'Junta Elástica'];

/** Rótulo curto de uma bitola para o seletor: `DN110 (4") — Ø 97,8 mm`. */
export function rotuloBitola(b: BitolaTubo): string {
  const interno = b.internoMm.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${b.dn} (${b.polegada}) — Ø ${b.aproximado ? '~' : ''}${interno} mm`;
}
