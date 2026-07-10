/**
 * Inspetor de propriedades (Sprint 3/4). Escolhe o formulário conforme o tipo da
 * peça selecionada (os formulários vivem em `inspector/forms.tsx`) e mostra a
 * telemetria corrente + o sparkline. Em execução, os campos ficam somente-leitura.
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
  type Peca,
  type ProjetoSimulacao,
} from '../domain/types';
import { labelComprimento, labelVazao } from '../domain/unidades';
import { VELOCIDADE_MAX_RECOMENDADA_MS } from '../engine/geometria';
import { Sparkline } from './Sparkline';
import type { UniLabel } from './inspector/campos';
import {
  BombaForm,
  ConsumoForm,
  FonteForm,
  JuncaoForm,
  ReservatorioForm,
  SensorForm,
  TuboForm,
} from './inspector/forms';

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
          <ReservatorioForm props={peca.props} emExecucao={emExecucao} upd={upd} u={u} unidades={projeto.unidades} />
        )}
        {isTubo(peca) && <TuboForm props={peca.props} emExecucao={emExecucao} upd={upd} u={u} unidades={projeto.unidades} atrito={projeto.configuracaoSimulacao.atrito === true} velRef={projeto.configuracaoSimulacao.velocidadeRef ?? VELOCIDADE_MAX_RECOMENDADA_MS} />}
        {isBomba(peca) && <BombaForm props={peca.props} emExecucao={emExecucao} upd={upd} u={u} />}
        {isFonte(peca) && <FonteForm props={peca.props} emExecucao={emExecucao} upd={upd} u={u} />}
        {isConsumo(peca) && <ConsumoForm props={peca.props} emExecucao={emExecucao} upd={upd} u={u} />}
        {isSensor(peca) && <SensorForm props={peca.props} projeto={projeto} upd={upd} u={u} />}
        {isJuncao(peca) && <JuncaoForm props={peca.props} emExecucao={emExecucao} upd={upd} />}
      </fieldset>

      {!emExecucao && (
        <div className="inspetor-acoes">
          <button onClick={() => dispatch({ tipo: 'DUPLICAR_PECA', id: peca.id })}>
            ⧉ Duplicar
          </button>
          <button className="danger" onClick={() => dispatch({ tipo: 'REMOVER_PECA', id: peca.id })}>
            Remover peça
          </button>
        </div>
      )}
    </div>
  );
}
