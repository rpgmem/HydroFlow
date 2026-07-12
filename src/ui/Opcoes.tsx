/**
 * Menu ⚙ Opções: consolida configurações que não são "peças" — idioma, unidades do projeto, tema de exibição e a física opcional (perda de carga por atrito).
 * Dropdown recolhível na toolbar (inline no desktop, colapsado no ⋯ no mobile).
 */
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { Acao, EstadoApp } from '../state/store';
import type { Unidades } from '../domain/types';
import { rotulosDuplicados } from '../domain/normalizarIds';
import { exibirTemperatura, temperaturaParaSI, labelTemperatura, exibirPressao, pressaoParaSI, labelPressao } from '../domain/unidades';
import { TEMPERATURA_PADRAO_C, LIMITE_GOLPE_PADRAO_KPA } from '../engine/fisica';
import { IDIOMAS } from '../i18n';
import { Switch } from './Switch';

/** Como o tempo de simulação é mostrado na barra: só segundos, só relógio 24 h, ou ambos. */
export type FormatoTempo = 'segundos' | 'horario' | 'ambos';

interface Props {
  estado: EstadoApp;
  dispatch: React.Dispatch<Acao>;
  tema: 'escuro' | 'claro';
  onAlternarTema: () => void;
  formatoTempo: FormatoTempo;
  onFormatoTempo: (f: FormatoTempo) => void;
}

export function Opcoes({ estado, dispatch, tema, onAlternarTema, formatoTempo, onFormatoTempo }: Props) {
  const { t, i18n } = useTranslation();
  const [aberto, setAberto] = useState(false);
  const emExecucao = estado.modo === 'execucao';
  const duplicados = rotulosDuplicados(estado.projeto);
  const u = estado.projeto.unidades;
  const atrito = estado.projeto.configuracaoSimulacao.atrito === true;
  const velRef = estado.projeto.configuracaoSimulacao.velocidadeRef ?? 3;
  const tempC = estado.projeto.configuracaoSimulacao.temperaturaC ?? TEMPERATURA_PADRAO_C;
  const limiteGolpe = estado.projeto.configuracaoSimulacao.limiteGolpeArieteKPa ?? LIMITE_GOLPE_PADRAO_KPA;
  const idiomaAtual = (i18n.resolvedLanguage ?? i18n.language ?? 'pt').split('-')[0];

  return (
    <div className="opcoes">
      <button
        className={aberto ? 'ativo' : ''}
        aria-label={t('opcoes.titulo')}
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
      >
        {t('opcoes.botao')}
      </button>
      {aberto && (
        <>
          <div className="opcoes-backdrop" onClick={() => setAberto(false)} aria-hidden />
          <div className="opcoes-menu" role="dialog" aria-label={t('opcoes.titulo')}>
            <p className="opcoes-sec">{t('opcoes.idioma')}</p>
            <div className="field">
              <label>{t('opcoes.idiomaLabel')}</label>
              <select
                aria-label={t('opcoes.idiomaLabel')}
                value={idiomaAtual}
                onChange={(e) => void i18n.changeLanguage(e.target.value)}
              >
                {IDIOMAS.map((lng) => (
                  <option key={lng} value={lng}>
                    {t(`idioma.${lng}`)}
                  </option>
                ))}
              </select>
            </div>

            <p className="opcoes-sec">{t('opcoes.unidades')}</p>
            <div className="field">
              <label>{t('opcoes.volume')}</label>
              <select
                aria-label={t('opcoes.volumeLabel')}
                disabled={emExecucao}
                value={u.volume}
                onChange={(e) =>
                  dispatch({ tipo: 'SET_UNIDADES', unidades: { ...u, volume: e.target.value as Unidades['volume'] } })
                }
              >
                <option value="litros">{t('opcoes.litros')}</option>
                <option value="m3">{t('opcoes.m3')}</option>
              </select>
            </div>
            <div className="field">
              <label>{t('opcoes.comprimento')}</label>
              <select
                aria-label={t('opcoes.comprimentoLabel')}
                disabled={emExecucao}
                value={u.comprimento}
                onChange={(e) =>
                  dispatch({ tipo: 'SET_UNIDADES', unidades: { ...u, comprimento: e.target.value as Unidades['comprimento'] } })
                }
              >
                <option value="m">{t('opcoes.metros')}</option>
                <option value="cm">{t('opcoes.cm')}</option>
              </select>
            </div>
            <div className="field">
              <label>{t('opcoes.pressao')}</label>
              <select
                aria-label={t('opcoes.pressaoLabel')}
                disabled={emExecucao}
                value={u.pressao ?? 'kPa'}
                onChange={(e) =>
                  dispatch({ tipo: 'SET_UNIDADES', unidades: { ...u, pressao: e.target.value as Unidades['pressao'] } })
                }
              >
                <option value="kPa">kPa</option>
                <option value="mca">m.c.a.</option>
                <option value="psi">psi</option>
              </select>
            </div>
            <div className="field">
              <label>{t('opcoes.temperatura')}</label>
              <select
                aria-label={t('opcoes.temperaturaLabel')}
                value={u.temperatura ?? 'C'}
                onChange={(e) =>
                  dispatch({ tipo: 'SET_UNIDADES', unidades: { ...u, temperatura: e.target.value as Unidades['temperatura'] } })
                }
              >
                <option value="C">°C</option>
                <option value="F">°F</option>
                <option value="K">K</option>
              </select>
            </div>

            <p className="opcoes-sec">{t('opcoes.exibicao')}</p>
            <Switch checked={tema === 'claro'} onChange={onAlternarTema} ariaLabel={t('opcoes.temaClaro')}>
              {t('opcoes.temaClaro')}
            </Switch>
            <div className="field">
              <label>{t('opcoes.formatoTempo')}</label>
              <select
                aria-label={t('opcoes.formatoTempo')}
                value={formatoTempo}
                onChange={(e) => onFormatoTempo(e.target.value as FormatoTempo)}
              >
                <option value="segundos">{t('opcoes.formatoSegundos')}</option>
                <option value="horario">{t('opcoes.formatoHorario')}</option>
                <option value="ambos">{t('opcoes.formatoAmbos')}</option>
              </select>
            </div>

            <p className="opcoes-sec">{t('opcoes.fisica')}</p>
            <Switch
              checked={atrito}
              disabled={emExecucao}
              ariaLabel={t('opcoes.atritoLabel')}
              onChange={(v) => dispatch({ tipo: 'SET_ATRITO', atrito: v })}
            >
              {t('opcoes.atrito')}
            </Switch>
            <p className="telemetry" style={{ margin: '2px 0 0' }}>
              <Trans i18nKey="opcoes.atritoDica" components={{ 1: <strong />, 3: <strong /> }} />
            </p>
            {atrito && (
              <div className="field" style={{ marginTop: 8 }}>
                <label>{t('opcoes.modeloAtrito')}</label>
                <select
                  aria-label={t('opcoes.modeloAtrito')}
                  disabled={emExecucao}
                  value={estado.projeto.configuracaoSimulacao.modeloAtrito ?? 'hazen-williams'}
                  onChange={(e) =>
                    dispatch({ tipo: 'SET_MODELO_ATRITO', modeloAtrito: e.target.value as 'hazen-williams' | 'darcy-weisbach' })
                  }
                >
                  <option value="hazen-williams">{t('opcoes.modeloHW')}</option>
                  <option value="darcy-weisbach">{t('opcoes.modeloDW')}</option>
                </select>
              </div>
            )}

            <div className="field" style={{ marginTop: 8 }}>
              <label>{t('opcoes.velocidadeRef')}</label>
              <input
                type="number"
                step={0.1}
                min={0.1}
                disabled={emExecucao}
                aria-label={t('opcoes.velocidadeRefLabel')}
                value={velRef}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v > 0) dispatch({ tipo: 'SET_VELOCIDADE_REF', velocidadeRef: v });
                }}
              />
            </div>
            <p className="telemetry" style={{ margin: '2px 0 0' }}>
              <Trans i18nKey="opcoes.velocidadeRefDica" components={{ 1: <strong /> }} />
            </p>

            <div className="field" style={{ marginTop: 8 }}>
              <label>{t('opcoes.temperaturaAgua')} ({labelTemperatura(u)})</label>
              <input
                type="number"
                step={1}
                disabled={emExecucao}
                aria-label={t('opcoes.temperaturaAguaLabel')}
                value={Number(exibirTemperatura(tempC, u).toFixed(2))}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) dispatch({ tipo: 'SET_TEMPERATURA', temperaturaC: temperaturaParaSI(v, u) });
                }}
              />
            </div>
            <p className="telemetry" style={{ margin: '2px 0 0' }}>
              <Trans i18nKey="opcoes.temperaturaDica" components={{ 1: <strong /> }} />
            </p>

            <div className="field" style={{ marginTop: 8 }}>
              <label>{t('opcoes.limiteGolpe')} ({labelPressao(u)})</label>
              <input
                type="number"
                step={50}
                min={0}
                disabled={emExecucao}
                aria-label={t('opcoes.limiteGolpeLabel')}
                value={Number(exibirPressao(limiteGolpe, u).toFixed(2))}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v > 0) dispatch({ tipo: 'SET_LIMITE_GOLPE', limiteGolpeArieteKPa: pressaoParaSI(v, u) });
                }}
              />
            </div>
            <p className="telemetry" style={{ margin: '2px 0 0' }}>
              <Trans i18nKey="opcoes.limiteGolpeDica" components={{ 1: <strong /> }} />
            </p>

            <p className="opcoes-sec">{t('opcoes.projeto')}</p>
            <button
              type="button"
              disabled={emExecucao || duplicados.length > 0}
              aria-label={t('opcoes.normalizarIds')}
              onClick={() => {
                if (emExecucao || duplicados.length > 0) return;
                if (window.confirm(t('opcoes.normalizarConfirm'))) {
                  dispatch({ tipo: 'NORMALIZAR_IDS' });
                  setAberto(false);
                }
              }}
            >
              {t('opcoes.normalizarIds')}
            </button>
            {duplicados.length > 0 ? (
              <p className="opcoes-aviso" role="alert" style={{ margin: '4px 0 0' }}>
                {t('opcoes.rotulosDuplicados', { lista: duplicados.join(', ') })}
              </p>
            ) : (
              <p className="telemetry" style={{ margin: '2px 0 0' }}>{t('opcoes.normalizarDica')}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
