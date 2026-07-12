/**
 * Materiais de tubo — presets que preenchem a rugosidade ε (Darcy-Weisbach) e o
 * coeficiente C (Hazen-Williams). Como a `bitola`, o `material` é só um rótulo de
 * UI: selecionar grava `rugosidade` + `coefC`; o motor lê esses dois, não o material.
 *
 * Valores de referência (ε em mm; C de Hazen-Williams):
 *  - PVC/plástico e cobre: lisos (ε ~0,0015; C ~140)
 *  - aço comercial: ε ~0,045; C ~120
 *  - ferro fundido: ε ~0,26; C ~100
 *  - concreto: ε ~0,3; C ~130
 */
import type { PropsTubo } from './types';

export type MaterialTubo = NonNullable<PropsTubo['material']>;

export const MATERIAIS_TUBO: Record<MaterialTubo, { rugosidadeMM: number; coefC: number }> = {
  pvc: { rugosidadeMM: 0.0015, coefC: 140 },
  cobre: { rugosidadeMM: 0.0015, coefC: 140 },
  aco: { rugosidadeMM: 0.045, coefC: 120 },
  ferro: { rugosidadeMM: 0.26, coefC: 100 },
  concreto: { rugosidadeMM: 0.3, coefC: 130 },
};

export const ORDEM_MATERIAIS: MaterialTubo[] = ['pvc', 'cobre', 'aco', 'ferro', 'concreto'];
