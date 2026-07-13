/**
 * Interruptor on/off (toggle) reutilizável. Por baixo é um `<input type="checkbox">` real — só o VISUAL muda (trilho + botão deslizante), então rótulos acessíveis
 * (aria-label / texto) e os testes por papel "checkbox" continuam funcionando.
 */
interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  /** Texto do rótulo ao lado do interruptor. */
  children?: React.ReactNode;
  disabled?: boolean;
  /** Nome acessível (quando o texto não basta ou difere do rótulo visível). */
  ariaLabel?: string;
  style?: React.CSSProperties;
}

export function Switch({ checked, onChange, children, disabled, ariaLabel, style }: Props) {
  return (
    <label className={`switch${disabled ? ' disabled' : ''}`} style={style}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch-track" aria-hidden />
      {children != null && <span className="switch-text">{children}</span>}
    </label>
  );
}
