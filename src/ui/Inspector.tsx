/**
 * Inspetor de propriedades. Escolhe o formulário conforme o tipo da peça selecionada (os formulários vivem em `inspector/forms.tsx`) e mostra a
 * telemetria corrente + o sparkline. Em execução, os campos ficam somente-leitura.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GrafoIndex, coletarTubosDeBomba } from '../engine/grafo';
import type { Acao } from '../state/store';
import {
  isAlivio,
  isBomba,
  isConsumo,
  isFonte,
  isJuncao,
  isQuadro,
  isReservatorio,
  isSensor,
  isTubo,
  type Peca,
  type ProjetoSimulacao,
} from '../domain/types';
import { labelComprimento, labelVazao, exibirComprimento, exibirVazao } from '../domain/unidades';
import { VELOCIDADE_MAX_RECOMENDADA_MS } from '../engine/geometria';
import { TEMPERATURA_PADRAO_C, LIMITE_GOLPE_PADRAO_KPA } from '../engine/fisica';
import { Sparkline } from './Sparkline';
import { Num, type UniLabel } from './inspector/campos';
import {
  AlivioForm,
  BombaForm,
  ConsumoForm,
  FonteForm,
  JuncaoForm,
  QuadroForm,
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
  const { t } = useTranslation();
  // Tubos em linha de bomba (parada abrupta → golpe cheio); os demais são atenuados.
  const tubosBomba = useMemo(() => coletarTubosDeBomba(new GrafoIndex(projeto)), [projeto]);
  if (!peca) {
    return (
      <div className="panel right">
        <h3>{t('inspector.titulo')}</h3>
        <p className="telemetry">{t('inspector.vazio')}</p>
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
        {t(`pecas.${peca.tipo}`)} <span className="telemetry">#{peca.id}</span>
      </h3>

      {emExecucao && (
        <p className="telemetry" style={{ marginTop: 0 }}>
          {t('inspector.somenteLeitura')}
        </p>
      )}

      {vazao !== undefined && Math.abs(vazao) > 1e-9 && (
        <p className="telemetry" style={{ marginTop: 0 }}>
          {t('inspector.vazaoAtual')}<strong>{exibirVazao(vazao, projeto.unidades).toFixed(2)} {u.vazao}</strong>
        </p>
      )}

      {emExecucao && historico && historico.length >= 2 && (
        <Sparkline
          dados={historico.map((v) =>
            isReservatorio(peca) ? exibirComprimento(v, projeto.unidades) : exibirVazao(v, projeto.unidades),
          )}
          titulo={isReservatorio(peca) ? t('inspector.nivel') : t('inspector.vazao')}
          unidade={isReservatorio(peca) ? u.comp : u.vazao}
        />
      )}

      {/* Em execução, só os COMANDOS de operação ficam ativos (registro, modo da bomba/quadro, saída de consumo, sensor on/off); o resto é bloqueado
          campo a campo (via `disabled={emExecucao}`), não pelo fieldset. Assim o operador comanda a simulação sem alterar a estrutura/dimensionamento. */}
      <fieldset className="inspetor-campos">
        <div className="field">
          <label>{t('inspector.nome')}</label>
          <input
            type="text"
            aria-label={t('inspector.nome')}
            placeholder={peca.id}
            value={peca.rotulo ?? ''}
            disabled={emExecucao}
            onChange={(e) =>
              dispatch({ tipo: 'RENOMEAR_PECA', id: peca.id, rotulo: e.target.value })
            }
          />
        </div>

        <Num
          label={t('inspector.cota')}
          unidade={u.comp}
          unidades={projeto.unidades}
          dim="comp"
          value={peca.cota ?? 0}
          disabled={emExecucao}
          onChange={(v) => dispatch({ tipo: 'ATUALIZAR_COTA', id: peca.id, cota: v })}
        />

        {isReservatorio(peca) && (
          <ReservatorioForm props={peca.props} emExecucao={emExecucao} upd={upd} u={u} unidades={projeto.unidades} />
        )}
        {isTubo(peca) && <TuboForm props={peca.props} emExecucao={emExecucao} upd={upd} u={u} unidades={projeto.unidades} atrito={projeto.configuracaoSimulacao.atrito === true} modeloAtrito={projeto.configuracaoSimulacao.modeloAtrito ?? 'hazen-williams'} velRef={projeto.configuracaoSimulacao.velocidadeRef ?? VELOCIDADE_MAX_RECOMENDADA_MS} vazao={vazao} temperaturaC={projeto.configuracaoSimulacao.temperaturaC ?? TEMPERATURA_PADRAO_C} limiteGolpeKPa={projeto.configuracaoSimulacao.limiteGolpeArieteKPa ?? LIMITE_GOLPE_PADRAO_KPA} golpeAbrupto={tubosBomba.has(peca.id)} />}
        {isBomba(peca) && <BombaForm props={peca.props} emExecucao={emExecucao} upd={upd} u={u} projeto={projeto} pecaId={peca.id} dispatch={dispatch} />}
        {isFonte(peca) && <FonteForm props={peca.props} emExecucao={emExecucao} upd={upd} u={u} unidades={projeto.unidades} />}
        {isConsumo(peca) && <ConsumoForm props={peca.props} emExecucao={emExecucao} upd={upd} u={u} unidades={projeto.unidades} />}
        {isSensor(peca) && <SensorForm props={peca.props} emExecucao={emExecucao} projeto={projeto} upd={upd} u={u} pecaId={peca.id} dispatch={dispatch} />}
        {isJuncao(peca) && <JuncaoForm props={peca.props} emExecucao={emExecucao} upd={upd} />}
        {isQuadro(peca) && <QuadroForm props={peca.props} emExecucao={emExecucao} upd={upd} u={u} projeto={projeto} dispatch={dispatch} />}
        {isAlivio(peca) && <AlivioForm props={peca.props} emExecucao={emExecucao} upd={upd} unidades={projeto.unidades} />}
      </fieldset>

      {!emExecucao && (
        <div className="inspetor-acoes">
          <button onClick={() => dispatch({ tipo: 'DUPLICAR_PECA', id: peca.id })}>
            {t('inspector.duplicar')}
          </button>
          <button className="danger" onClick={() => dispatch({ tipo: 'REMOVER_PECA', id: peca.id })}>
            {t('inspector.remover')}
          </button>
        </div>
      )}
    </div>
  );
}
