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
  isJuncao,
  isReservatorio,
  isSensor,
  isTubo,
  type NivelControle,
  type Peca,
  type ProjetoSimulacao,
  type PropsBomba,
  type PropsConsumo,
  type PropsFonte,
  type PropsJuncao,
  type PropsReservatorio,
  type PropsSensor,
  type PropsTubo,
  type Unidades,
} from '../domain/types';
import { labelComprimento, labelVazao } from '../domain/unidades';
import { vazaoDeM3, vazaoMaxRecomendadaM3, VELOCIDADE_MAX_RECOMENDADA_MS } from '../engine/geometria';
import { CATALOGO_TUBOS, CATEGORIAS_TUBO, bitolaPorDn, rotuloBitola } from '../domain/tubosCatalogo';
import { Sparkline } from './Sparkline';

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
  /** Série temporal da peça (nível/vazão) acumulada na execução, p/ o sparkline. */
  historico?: number[];
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

export function Inspector({ peca, projeto, emExecucao, vazao, historico, dispatch }: Props) {
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

      {emExecucao && historico && historico.length >= 2 && (
        <Sparkline
          dados={historico}
          titulo={isReservatorio(peca) ? 'Nível' : 'Vazão'}
          unidade={isReservatorio(peca) ? u.comp : u.vazao}
        />
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
        {isTubo(peca) && <TuboForm props={peca.props} emExecucao={emExecucao} upd={upd} u={u} unidades={projeto.unidades} />}
        {isBomba(peca) && <BombaForm props={peca.props} emExecucao={emExecucao} upd={upd} u={u} />}
        {isFonte(peca) && <FonteForm props={peca.props} emExecucao={emExecucao} upd={upd} u={u} />}
        {isConsumo(peca) && <ConsumoForm props={peca.props} emExecucao={emExecucao} upd={upd} u={u} />}
        {isSensor(peca) && <SensorForm props={peca.props} projeto={projeto} upd={upd} u={u} />}
        {isJuncao(peca) && <JuncaoForm props={peca.props} emExecucao={emExecucao} upd={upd} />}
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

function TuboForm({
  props,
  emExecucao,
  upd,
  u,
  unidades,
}: {
  props: PropsTubo;
  emExecucao: boolean;
  upd: Upd;
  u: UniLabel;
  unidades: Unidades;
}) {
  const temBoia = props.boia !== undefined;
  const temLadrao = props.ladrao !== undefined;
  // Vazão máxima recomendada = área × velocidade recomendada (3 m/s). Ajuda o
  // usuário a dimensionar; acima disso o tubo é sinalizado durante a simulação.
  const vazaoMaxRec =
    props.diametro > 0 ? vazaoDeM3(vazaoMaxRecomendadaM3(props.diametro), unidades) : 0;
  return (
    <>
      {/* Bitola pré-configurada: seleciona o DN e grava o diâmetro INTERNO
          tabelado (usado no cálculo de vazão). "Personalizado" libera o mm. */}
      <div className="field">
        <label>Bitola</label>
        <select
          value={props.bitola ?? ''}
          disabled={emExecucao}
          aria-label="Bitola"
          onChange={(e) => {
            const b = bitolaPorDn(e.target.value);
            if (b) upd({ bitola: b.dn, diametro: b.internoMm });
            else upd({ bitola: undefined });
          }}
        >
          <option value="">Personalizado</option>
          {CATEGORIAS_TUBO.map((cat) => (
            <optgroup key={cat} label={cat}>
              {CATALOGO_TUBOS.filter((b) => b.categoria === cat).map((b) => (
                <option key={b.dn} value={b.dn}>
                  {rotuloBitola(b)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {/* Editar o diâmetro na mão limpa a bitola (vira "Personalizado"). */}
      <Num
        label="Diâmetro interno"
        unidade="mm"
        value={props.diametro}
        disabled={emExecucao}
        step={0.1}
        onChange={(v) => upd({ diametro: v, bitola: undefined })}
      />
      {props.diametro > 0 && (
        <p className="telemetry" style={{ marginTop: -4 }}>
          Vazão máx. recomendada:{' '}
          <strong>
            {vazaoMaxRec.toFixed(2)} {u.vazao}
          </strong>{' '}
          (a {VELOCIDADE_MAX_RECOMENDADA_MS.toLocaleString('pt-BR')} m/s)
        </p>
      )}
      {/* Altura de conexão em cada ponta (relativa à base do reservatório).
          0 = fundo; acima disso, só escoa a água acima do bocal. */}
      <Num
        label="Altura da ponta de entrada"
        unidade={u.comp}
        value={props.alturaEntrada ?? 0}
        disabled={emExecucao}
        onChange={(v) => upd({ alturaEntrada: v })}
      />
      <Num
        label="Altura da ponta de saída"
        unidade={u.comp}
        value={props.alturaSaida ?? 0}
        disabled={emExecucao}
        onChange={(v) => upd({ alturaSaida: v })}
      />
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
      {/* Altura nominal deriva a curva automaticamente; entre dois reservatórios
          a altura real da instalação reduz a vazão. Projetos antigos com `curva.k`
          aparecem aqui como a altura equivalente (vazaoNominal/k). */}
      <Num
        label="Altura nominal de recalque"
        unidade="m"
        value={props.alturaNominal ?? (props.curva && props.curva.k > 0 ? props.vazaoNominal / props.curva.k : 0)}
        disabled={emExecucao}
        step={0.5}
        onChange={(v) => upd({ alturaNominal: v > 0 ? v : undefined, curva: undefined })}
      />
      <p className="telemetry" style={{ marginTop: -4 }}>
        Entrega a vazão nominal a 0 m e zera nesta altura; entre dois reservatórios
        a altura real reduz a vazão automaticamente. 0 = bomba ideal (ignora a altura).
      </p>
      <div className="field">
        <label>Controle da bomba</label>
        <select
          value={props.modoControle ?? 'auto'}
          aria-label="Controle da bomba"
          onChange={(e) => upd({ modoControle: e.target.value })}
        >
          <option value="auto">Automático (pelo sensor)</option>
          <option value="ligado">Ligado (manual)</option>
          <option value="desligado">Desligado (manual)</option>
        </select>
      </div>
      {/* Bomba dupla em revezamento: rodízio de desgaste entre duas metades
          (mesma vazão e tubulação). Padrão = bomba única. */}
      <label className="checkbox">
        <input
          type="checkbox"
          checked={props.revezamento ?? false}
          disabled={emExecucao}
          aria-label="Bomba dupla em revezamento"
          onChange={(e) => upd({ revezamento: e.target.checked })}
        />
        Dupla em revezamento (alterna a cada acionamento)
      </label>
    </>
  );
}

function JuncaoForm({ props, emExecucao, upd }: { props: PropsJuncao; emExecucao: boolean; upd: Upd }) {
  const temDiam = props.diametro !== undefined && props.diametro > 0;
  return (
    <>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={temDiam}
          disabled={emExecucao}
          aria-label="Estrangular a junção (diâmetro)"
          // Ao ligar, assume a bitola DN110 (mesmo default dos tubos maiores);
          // ao desligar, limpa diâmetro e bitola.
          onChange={(e) => {
            const b = bitolaPorDn('DN110');
            if (e.target.checked && b) upd({ diametro: b.internoMm, bitola: b.dn });
            else if (e.target.checked) upd({ diametro: 100, bitola: undefined });
            else upd({ diametro: undefined, bitola: undefined });
          }}
        />
        Estrangular (limitar o fluxo pela junção)
      </label>
      {temDiam && (
        <>
          {/* Mesma lista de bitolas dos tubos: seleciona o DN e grava o diâmetro
              INTERNO tabelado. "Personalizado" libera o mm. */}
          <div className="field">
            <label>Bitola</label>
            <select
              value={props.bitola ?? ''}
              disabled={emExecucao}
              aria-label="Bitola da junção"
              onChange={(e) => {
                const b = bitolaPorDn(e.target.value);
                if (b) upd({ bitola: b.dn, diametro: b.internoMm });
                else upd({ bitola: undefined });
              }}
            >
              <option value="">Personalizado</option>
              {CATEGORIAS_TUBO.map((cat) => (
                <optgroup key={cat} label={cat}>
                  {CATALOGO_TUBOS.filter((b) => b.categoria === cat).map((b) => (
                    <option key={b.dn} value={b.dn}>
                      {rotuloBitola(b)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          {/* Editar o diâmetro na mão limpa a bitola (vira "Personalizado"). */}
          <Num
            label="Diâmetro interno da junção"
            unidade="mm"
            value={props.diametro}
            disabled={emExecucao}
            step={0.1}
            onChange={(v) => upd({ diametro: v, bitola: undefined })}
          />
        </>
      )}
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
  const perfil = props.perfil ?? 'fixo';
  return (
    <>
      <div className="field">
        <label>Perfil de consumo</label>
        <select
          value={perfil}
          disabled={emExecucao}
          aria-label="Perfil de consumo"
          onChange={(e) => upd({ perfil: e.target.value })}
        >
          <option value="fixo">Fixo (constante)</option>
          <option value="senoidal">Senoidal (varia entre mín. e máx.)</option>
          <option value="intermitente">Intermitente (liga/desliga)</option>
        </select>
      </div>

      {perfil === 'fixo' ? (
        <Num
          label="Vazão de saída"
          unidade={u.vazao}
          value={props.vazaoDemanda}
          disabled={emExecucao}
          onChange={(v) => upd({ vazaoDemanda: v })}
        />
      ) : (
        <>
          <Num label="Vazão mínima" unidade={u.vazao} value={props.vazaoMin ?? 0} disabled={emExecucao} onChange={(v) => upd({ vazaoMin: v })} />
          <Num label="Vazão máxima" unidade={u.vazao} value={props.vazaoMax ?? props.vazaoDemanda} disabled={emExecucao} onChange={(v) => upd({ vazaoMax: v })} />
          <Num label="Período (s)" value={props.periodo ?? 60} disabled={emExecucao} step={1} onChange={(v) => upd({ periodo: v })} />
          {perfil === 'intermitente' && (
            <Num label="Ciclo ligado (0 a 1)" value={props.cicloLigado ?? 0.5} disabled={emExecucao} step={0.05} onChange={(v) => upd({ cicloLigado: v })} />
          )}
        </>
      )}

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
  // A boia é uma válvula de NÍVEL que fica no cano/entrada do tanque — por isso
  // ela é configurada no tubo, não na fonte externa (suprimento infinito). O
  // motor ainda respeita uma `fonte.boia` de projetos antigos, mas não a expomos
  // mais aqui para não confundir.
  return (
    <Num label="Vazão fixa" unidade={u.vazao} value={props.vazaoFixa} disabled={emExecucao} onChange={(v) => upd({ vazaoFixa: v })} />
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
  const alvos = props.bombasAlvo;
  const alternarAlvo = (id: string, marcado: boolean): void =>
    upd({ bombasAlvo: marcado ? [...alvos, id] : alvos.filter((x) => x !== id) });
  const reversa = props.reversa ?? false;
  return (
    <>
      <div className="field">
        <label>Bombas controladas</label>
        {bombas.length === 0 ? (
          <p className="telemetry" style={{ margin: 0 }}>Nenhuma bomba no projeto.</p>
        ) : (
          bombas.map((b) => (
            <label className="checkbox" key={b.id}>
              <input
                type="checkbox"
                checked={alvos.includes(b.id)}
                aria-label={`Controlar ${b.rotulo && b.rotulo.trim() ? b.rotulo : b.id}`}
                onChange={(e) => alternarAlvo(b.id, e.target.checked)}
              />
              {b.rotulo && b.rotulo.trim() ? b.rotulo : b.id}
            </label>
          ))
        )}
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={reversa}
          aria-label="Sensor reverso (corte por nível baixo)"
          onChange={(e) => upd({ reversa: e.target.checked })}
        />
        Reverso (desliga no mínimo; protege a origem)
      </label>
      <Num
        label={reversa ? 'Nível mínimo (desliga)' : 'Nível mínimo (liga)'}
        unidade={u.comp}
        value={props.nivelMinimo}
        onChange={(v) => upd({ nivelMinimo: v })}
      />
      <Num
        label={reversa ? 'Nível máximo (libera/liga)' : 'Nível máximo (desliga)'}
        unidade={u.comp}
        value={props.nivelMaximo}
        onChange={(v) => upd({ nivelMaximo: v })}
      />
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
