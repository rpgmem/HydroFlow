/**
 * Inspetor de propriedades (Sprint 3/4). Edita as props da peça selecionada.
 * Em execução, apenas valores operacionais permanecem editáveis (registro,
 * bomba manual, thresholds de sensor); dimensões estruturais ficam bloqueadas.
 */
import type { Acao } from '../state/store';
import {
  isBomba,
  isConsumo,
  isFonte,
  isReservatorio,
  isSensor,
  isTubo,
  type NivelControle,
  type Peca,
  type ProjetoSimulacao,
  type PropsBomba,
  type PropsConsumo,
  type PropsFonte,
  type PropsReservatorio,
  type PropsSensor,
  type PropsTubo,
} from '../domain/types';
import { labelComprimento, labelVazao } from '../domain/unidades';

/** Rótulos de unidade derivados das unidades do projeto. */
interface UniLabel {
  comp: string;
  vazao: string;
}

interface Props {
  peca: Peca | undefined;
  projeto: ProjetoSimulacao;
  emExecucao: boolean;
  /** Vazão atual da peça selecionada (unidade de volume/s), se houver. */
  vazao?: number;
  dispatch: React.Dispatch<Acao>;
}

function Num({
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

export function Inspector({ peca, projeto, emExecucao, vazao, dispatch }: Props) {
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

  const u: UniLabel = {
    comp: labelComprimento(projeto.unidades),
    vazao: labelVazao(projeto.unidades),
  };

  return (
    <div className="panel right">
      <h3>
        {peca.tipo} <span className="telemetry">#{peca.id}</span>
      </h3>

      {emExecucao && (
        <p className="telemetry" style={{ marginTop: 0 }}>
          Somente leitura durante a execução. Volte à edição para alterar valores.
        </p>
      )}

      {vazao !== undefined && Math.abs(vazao) > 1e-9 && (
        <p className="telemetry" style={{ marginTop: 0 }}>
          Vazão atual: <strong>{vazao.toFixed(2)} {u.vazao}</strong>
        </p>
      )}

      {/* Em execução tudo fica desabilitado: evita a falsa sensação de edição
          (os valores são restaurados ao voltar para a edição). */}
      <fieldset className="inspetor-campos" disabled={emExecucao}>
        <div className="field">
          <label>Nome</label>
          <input
            type="text"
            aria-label="Nome"
            placeholder={peca.id}
            value={peca.rotulo ?? ''}
            onChange={(e) =>
              dispatch({ tipo: 'RENOMEAR_PECA', id: peca.id, rotulo: e.target.value })
            }
          />
        </div>

        {isReservatorio(peca) && (
          <ReservatorioForm props={peca.props} emExecucao={emExecucao} upd={upd} u={u} />
        )}
        {isTubo(peca) && <TuboForm props={peca.props} emExecucao={emExecucao} upd={upd} u={u} />}
        {isBomba(peca) && <BombaForm props={peca.props} emExecucao={emExecucao} upd={upd} u={u} />}
        {isFonte(peca) && <FonteForm props={peca.props} emExecucao={emExecucao} upd={upd} u={u} />}
        {isConsumo(peca) && <ConsumoForm props={peca.props} emExecucao={emExecucao} upd={upd} u={u} />}
        {isSensor(peca) && <SensorForm props={peca.props} projeto={projeto} upd={upd} u={u} />}
      </fieldset>

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
  u,
}: {
  props: PropsReservatorio;
  emExecucao: boolean;
  upd: Upd;
  u: UniLabel;
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
        <Num label="Raio" unidade={u.comp} value={props.raio} disabled={emExecucao} onChange={(v) => upd({ raio: v })} />
      ) : (
        <>
          <Num label="Largura" unidade={u.comp} value={props.largura} disabled={emExecucao} onChange={(v) => upd({ largura: v })} />
          <Num label="Comprimento" unidade={u.comp} value={props.comprimento} disabled={emExecucao} onChange={(v) => upd({ comprimento: v })} />
        </>
      )}
      <Num label="Altura máxima" unidade={u.comp} value={props.alturaMaxima} disabled={emExecucao} onChange={(v) => upd({ alturaMaxima: v })} />
      <Num label="Cota da base" unidade={u.comp} value={props.cotaBase} disabled={emExecucao} onChange={(v) => upd({ cotaBase: v })} />
      <Num label="Nível atual" unidade={u.comp} value={props.nivel} onChange={(v) => upd({ nivel: v })} />
    </>
  );
}

function TuboForm({ props, emExecucao, upd, u }: { props: PropsTubo; emExecucao: boolean; upd: Upd; u: UniLabel }) {
  const temBoia = props.boia !== undefined;
  const temLadrao = props.ladrao !== undefined;
  return (
    <>
      <Num label="Diâmetro" unidade="mm" value={props.diametro} disabled={emExecucao} step={1} onChange={(v) => upd({ diametro: v })} />
      {/* Com boia, o registro manual perde o sentido (a boia governa a abertura). */}
      {!temBoia && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={props.registro?.aberto ?? true}
            aria-label="Registro aberto"
            onChange={(e) => upd({ registro: { aberto: e.target.checked } })}
          />
          Registro aberto
        </label>
      )}
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
      {/* Boia e ladrão são mutuamente exclusivos (papéis de válvula distintos). */}
      {!temLadrao && (
        <BoiaFields boia={props.boia} upd={upd} unidade={u.comp} aoAtivar={{ registro: { aberto: true } }} />
      )}
      {!temBoia && (
        <>
          <label className="checkbox" style={{ marginTop: 8 }}>
            <input
              type="checkbox"
              checked={temLadrao}
              disabled={emExecucao}
              aria-label="Ladrão (dreno de transbordo)"
              onChange={(e) => upd({ ladrao: e.target.checked ? { nivel: 0 } : undefined })}
            />
            Ladrão (dreno de transbordo)
          </label>
          {temLadrao && (
            <Num
              label="Ladrão: escoa acima de"
              unidade={u.comp}
              value={props.ladrao?.nivel}
              disabled={emExecucao}
              onChange={(v) => upd({ ladrao: { nivel: v } })}
            />
          )}
        </>
      )}
    </>
  );
}

/**
 * Boia mecânica (válvula de nível embutida na aresta). Monitora o reservatório
 * de destino: fecha ao encher (nível ≥ máximo), abre ao baixar (nível ≤ mínimo).
 * Sem histerese/delay (isso é exclusivo do sensor eletrônico).
 */
function BoiaFields({
  boia,
  upd,
  unidade,
  aoAtivar = {},
}: {
  boia: NivelControle | undefined;
  upd: Upd;
  unidade?: string;
  aoAtivar?: Record<string, unknown>;
}) {
  const ativa = boia !== undefined;
  return (
    <>
      <label className="checkbox" style={{ marginTop: 8 }}>
        <input
          type="checkbox"
          checked={ativa}
          aria-label="Boia (válvula de nível)"
          onChange={(e) =>
            upd(
              e.target.checked
                ? { boia: { nivelMinimo: 0, nivelMaximo: 1 }, ...aoAtivar }
                : { boia: undefined },
            )
          }
        />
        Boia (válvula de nível)
      </label>
      {ativa && (
        <>
          <Num
            label="Boia: abre com nível ≤"
            unidade={unidade}
            value={boia.nivelMinimo}
            onChange={(v) => upd({ boia: { ...boia, nivelMinimo: v } })}
          />
          <Num
            label="Boia: fecha com nível ≥"
            unidade={unidade}
            value={boia.nivelMaximo}
            onChange={(v) => upd({ boia: { ...boia, nivelMaximo: v } })}
          />
        </>
      )}
    </>
  );
}

function BombaForm({ props, emExecucao, upd, u }: { props: PropsBomba; emExecucao: boolean; upd: Upd; u: UniLabel }) {
  return (
    <>
      <Num label="Vazão nominal" unidade={u.vazao} value={props.vazaoNominal} disabled={emExecucao} onChange={(v) => upd({ vazaoNominal: v })} />
      <Num
        label="Curva k (0 = sem curva)"
        value={props.curva?.k ?? 0}
        disabled={emExecucao}
        step={0.1}
        onChange={(v) => upd({ curva: v > 0 ? { k: v } : undefined })}
      />
      <Num
        label="Proteção a seco: desliga se origem ≤"
        unidade={u.comp}
        value={props.protecaoSeco ?? 0}
        onChange={(v) => upd({ protecaoSeco: v })}
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

function ConsumoForm({
  props,
  emExecucao,
  upd,
  u,
}: {
  props: PropsConsumo;
  emExecucao: boolean;
  upd: Upd;
  u: UniLabel;
}) {
  return (
    <>
      <Num
        label="Vazão de saída"
        unidade={u.vazao}
        value={props.vazaoDemanda}
        disabled={emExecucao}
        onChange={(v) => upd({ vazaoDemanda: v })}
      />
      <label className="checkbox">
        <input
          type="checkbox"
          checked={props.aberto ?? true}
          aria-label="Saída aberta"
          onChange={(e) => upd({ aberto: e.target.checked })}
        />
        Saída aberta
      </label>
    </>
  );
}

function FonteForm({ props, emExecucao, upd, u }: { props: PropsFonte; emExecucao: boolean; upd: Upd; u: UniLabel }) {
  return (
    <>
      <Num label="Vazão fixa" unidade={u.vazao} value={props.vazaoFixa} disabled={emExecucao} onChange={(v) => upd({ vazaoFixa: v })} />
      <BoiaFields boia={props.boia} upd={upd} unidade={u.comp} />
    </>
  );
}

function SensorForm({
  props,
  projeto,
  upd,
  u,
}: {
  props: PropsSensor;
  projeto: ProjetoSimulacao;
  upd: Upd;
  u: UniLabel;
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
      <Num label="Nível mínimo (liga)" unidade={u.comp} value={props.nivelMinimo} onChange={(v) => upd({ nivelMinimo: v })} />
      <Num label="Nível máximo (desliga)" unidade={u.comp} value={props.nivelMaximo} onChange={(v) => upd({ nivelMaximo: v })} />
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
