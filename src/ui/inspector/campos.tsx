/**
 * Blocos compartilhados dos formulários do inspetor: o campo numérico `Num` e os tipos `Upd`/`UniLabel`. Separados para os formulários por tipo (forms.tsx)
 * reusarem sem inchar o Inspector principal.
 */
import type { Unidades } from '../../domain/types';
import {
  comprimentoParaSI,
  exibirComprimento,
  exibirVazao,
  vazaoParaSI,
  exibirPressao,
  pressaoParaSI,
} from '../../domain/unidades';

/** Rótulos de unidade derivados das unidades do projeto. */
export interface UniLabel {
  comp: string;
  vazao: string;
}

/** Atualiza props da peça selecionada (dispatch de ATUALIZAR_PROPS no Inspector). */
export type Upd = (p: Record<string, unknown>) => void;

/**
 * Campo numérico. Quando `dim` + `unidades` são informados, o `value`/`onChange`
 * são em SI (canônico) e o campo converte para/da unidade de EXIBIÇÃO; sem eles,
 * o valor é usado como está (campos adimensionais: mm, segundos, contagens…).
 */
export function Num({
  label,
  value,
  onChange,
  disabled,
  step = 0.1,
  unidade,
  unidades,
  dim,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  disabled?: boolean;
  step?: number;
  /** Sufixo de unidade exibido no rótulo (não faz parte do aria-label). */
  unidade?: string;
  /** Unidade de exibição do projeto (para converter SI↔exibição). */
  unidades?: Unidades;
  /** Dimensão do valor SI: 'comp' (m), 'vazao' (m³/s) ou 'pressao' (kPa). Ausente = sem conversão. */
  dim?: 'comp' | 'vazao' | 'pressao';
}) {
  const converte = dim !== undefined && unidades !== undefined;
  const paraExibir = (v: number): number =>
    dim === 'vazao' ? exibirVazao(v, unidades!) : dim === 'pressao' ? exibirPressao(v, unidades!) : exibirComprimento(v, unidades!);
  const paraSI = (v: number): number =>
    dim === 'vazao' ? vazaoParaSI(v, unidades!) : dim === 'pressao' ? pressaoParaSI(v, unidades!) : comprimentoParaSI(v, unidades!);
  const exibido = value === undefined ? '' : converte ? paraExibir(value) : value;
  return (
    <div className="field">
      <label>
        {label}
        {unidade ? <span className="unidade"> ({unidade})</span> : null}
      </label>
      <input
        type="number"
        step={step}
        value={exibido}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => {
          const v = Number(e.target.value);
          onChange(converte ? paraSI(v) : v);
        }}
      />
    </div>
  );
}
