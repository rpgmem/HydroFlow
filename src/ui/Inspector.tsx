/**
 * Inspetor de propriedades (Sprint 3/4). Edita as props da peça selecionada.
 * Em execução, apenas valores operacionais permanecem editáveis (registro,
 * bomba manual, thresholds de sensor); dimensões estruturais ficam bloqueadas.
 */
import type { Acao } from '../state/store';
import {
  isBomba,
  isFonte,
  isReservatorio,
  isSensor,
  isTubo,
  type Peca,
  type ProjetoSimulacao,
  type PropsBomba,
  type PropsFonte,
  type PropsReservatorio,
  type PropsSensor,
  type PropsTubo,
} from '../domain/types';

interface Props {
  peca: Peca | undefined;
  projeto: ProjetoSimulacao;
  emExecucao: boolean;
  dispatch: React.Dispatch<Acao>;
}

function Num({
  label,
  value,
  onChange,
  disabled,
  step = 0.1,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  disabled?: boolean;
  step?: number;
}) {
  return (
    <div className="field">
      <label>{label}</label>
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

export function Inspector({ peca, projeto, emExecucao, dispatch }: Props) {
  if (!peca) {
    return (
      <div className="panel right">
        <h3>Inspetor</h3>
        <p className="telemetry">Selecione uma peça para editar suas propriedades.</p>
      </div>
    );
  }

  const upd = (props: Record<string, unknown>): void =>
    dispatch({ tipo: 'ATUALIZAR_PROPS', id: peca.id, props: props as never });

  return (
    <div className="panel right">
      <h3>
        {peca.tipo} <span className="telemetry">#{peca.id}</span>
      </h3>

      {isReservatorio(peca) && (
        <ReservatorioForm props={peca.props} emExecucao={emExecucao} upd={upd} />
      )}
      {isTubo(peca) && <TuboForm props={peca.props} emExecucao={emExecucao} upd={upd} />}
      {isBomba(peca) && (
        <BombaForm props={peca.props} emExecucao={emExecucao} upd={upd} />
      )}
      {isFonte(peca) && <FonteForm props={peca.props} emExecucao={emExecucao} upd={upd} />}
      {isSensor(peca) && (
        <SensorForm props={peca.props} projeto={projeto} upd={upd} />
      )}

      {!emExecucao && (
        <button
          className="danger"
          style={{ marginTop: 12 }}
          onClick={() => dispatch({ tipo: 'REMOVER_PECA', id: peca.id })}
        >
          Remover peça
        </button>
      )}
    </div>
  );
}

type Upd = (p: Record<string, unknown>) => void;

function ReservatorioForm({
  props,
  emExecucao,
  upd,
}: {
  props: PropsReservatorio;
  emExecucao: boolean;
  upd: Upd;
}) {
  return (
    <>
      <div className="field">
        <label>Formato</label>
        <select
          value={props.formato}
          disabled={emExecucao}
          aria-label="Formato"
          onChange={(e) => upd({ formato: e.target.value })}
        >
          <option value="cilindro">Cilindro</option>
          <option value="retangular">Retangular</option>
        </select>
      </div>
      {props.formato === 'cilindro' ? (
        <Num label="Raio" value={props.raio} disabled={emExecucao} onChange={(v) => upd({ raio: v })} />
      ) : (
        <>
          <Num label="Largura" value={props.largura} disabled={emExecucao} onChange={(v) => upd({ largura: v })} />
          <Num label="Comprimento" value={props.comprimento} disabled={emExecucao} onChange={(v) => upd({ comprimento: v })} />
        </>
      )}
      <Num label="Altura máxima" value={props.alturaMaxima} disabled={emExecucao} onChange={(v) => upd({ alturaMaxima: v })} />
      <Num label="Cota da base" value={props.cotaBase} disabled={emExecucao} onChange={(v) => upd({ cotaBase: v })} />
      <Num label="Nível atual" value={props.nivel} onChange={(v) => upd({ nivel: v })} />
    </>
  );
}

function TuboForm({ props, emExecucao, upd }: { props: PropsTubo; emExecucao: boolean; upd: Upd }) {
  return (
    <>
      <Num label="Diâmetro" value={props.diametro} disabled={emExecucao} step={0.01} onChange={(v) => upd({ diametro: v })} />
      <label className="checkbox">
        <input
          type="checkbox"
          checked={props.registro?.aberto ?? true}
          aria-label="Registro aberto"
          onChange={(e) => upd({ registro: { aberto: e.target.checked } })}
        />
        Registro aberto
      </label>
      <label className="checkbox" style={{ marginTop: 8 }}>
        <input
          type="checkbox"
          checked={props.checkValve ?? false}
          disabled={emExecucao}
          aria-label="Check valve"
          onChange={(e) => upd({ checkValve: e.target.checked })}
        />
        Check valve (anti-refluxo)
      </label>
    </>
  );
}

function BombaForm({ props, emExecucao, upd }: { props: PropsBomba; emExecucao: boolean; upd: Upd }) {
  return (
    <>
      <Num label="Vazão nominal" value={props.vazaoNominal} disabled={emExecucao} onChange={(v) => upd({ vazaoNominal: v })} />
      <Num
        label="Curva k (0 = sem curva)"
        value={props.curva?.k ?? 0}
        disabled={emExecucao}
        step={0.1}
        onChange={(v) => upd({ curva: v > 0 ? { k: v } : undefined })}
      />
      <label className="checkbox">
        <input
          type="checkbox"
          checked={props.ligada ?? false}
          aria-label="Bomba ligada"
          onChange={(e) => upd({ ligada: e.target.checked })}
        />
        Ligada (manual)
      </label>
    </>
  );
}

function FonteForm({ props, emExecucao, upd }: { props: PropsFonte; emExecucao: boolean; upd: Upd }) {
  return (
    <Num label="Vazão fixa" value={props.vazaoFixa} disabled={emExecucao} onChange={(v) => upd({ vazaoFixa: v })} />
  );
}

function SensorForm({
  props,
  projeto,
  upd,
}: {
  props: PropsSensor;
  projeto: ProjetoSimulacao;
  upd: Upd;
}) {
  const bombas = projeto.pecas.filter(isBomba);
  return (
    <>
      <div className="field">
        <label>Bomba controlada</label>
        <select
          value={props.bombaAlvo}
          aria-label="Bomba controlada"
          onChange={(e) => upd({ bombaAlvo: e.target.value })}
        >
          <option value="">—</option>
          {bombas.map((b) => (
            <option key={b.id} value={b.id}>
              {b.id}
            </option>
          ))}
        </select>
      </div>
      <Num label="Nível mínimo (liga)" value={props.nivelMinimo} onChange={(v) => upd({ nivelMinimo: v })} />
      <Num label="Nível máximo (desliga)" value={props.nivelMaximo} onChange={(v) => upd({ nivelMaximo: v })} />
      <label className="checkbox">
        <input
          type="checkbox"
          checked={props.histerese ?? false}
          aria-label="Histerese"
          onChange={(e) => upd({ histerese: e.target.checked })}
        />
        Histerese
      </label>
      <Num label="Delay (s)" value={props.delay} onChange={(v) => upd({ delay: v })} />
    </>
  );
}
