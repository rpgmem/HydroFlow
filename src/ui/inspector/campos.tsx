/**
 * Blocos compartilhados dos formulários do inspetor: o campo numérico `Num` e os tipos `Upd`/`UniLabel`. Separados para os formulários por tipo (forms.tsx)
 * reusarem sem inchar o Inspector principal.
 */

/** Rótulos de unidade derivados das unidades do projeto. */
export interface UniLabel {
  comp: string;
  vazao: string;
}

/** Atualiza props da peça selecionada (dispatch de ATUALIZAR_PROPS no Inspector). */
export type Upd = (p: Record<string, unknown>) => void;

export function Num({
  label,
  value,
  onChange,
  disabled,
  step = 0.1,
  unidade,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  disabled?: boolean;
  step?: number;
  /** Sufixo de unidade exibido no rótulo (não faz parte do aria-label). */
  unidade?: string;
}) {
  return (
    <div className="field">
      <label>
        {label}
        {unidade ? <span className="unidade"> ({unidade})</span> : null}
      </label>
      <input
        type="number"
        step={step}
        value={value ?? ''}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
