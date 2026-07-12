/**
 * Formulário do "gerador de vazão" — compartilhado por Fonte (entrada) e Consumo (saída). Seletor de perfil (agrupado) + ajuda + preview ao vivo + campos contextuais
 * (só os parâmetros do perfil escolhido). Fixo, trapezoidal (com presets) e senoidal. Toda a configuração é estrutural → travada em execução.
 */
import { useTranslation } from 'react-i18next';
import type { Gerador, PerfilVazao } from '../../domain/types';
import { ORDEM_PRESETS, PRESETS_TRAPEZOIDAIS, paramsPadrao, vazaoRef } from '../../domain/geradorVazao';
import { Num, type UniLabel } from './campos';
import { WaveformPreview } from './WaveformPreview';

const PERIODICOS: PerfilVazao[] = ['trapezoidal', 'senoidal', 'escalonada'];
const TRANSIENTES: PerfilVazao[] = ['degrau', 'pulso', 'exponencial', 'diaria', 'amortecida'];

export function GeradorForm({
  gerador,
  emExecucao,
  u,
  upd,
}: {
  gerador: Gerador;
  emExecucao: boolean;
  u: UniLabel;
  upd: (g: Gerador) => void;
}) {
  const { t } = useTranslation();
  const set = (patch: Partial<Gerador>): void => upd({ ...gerador, ...patch });
  // Trocar de perfil semeia os params a partir da vazão atual (âncora V).
  const trocarPerfil = (perfil: PerfilVazao): void => {
    const V = vazaoRef(gerador) || 5;
    upd(paramsPadrao(perfil, V));
  };
  const aplicarPreset = (nome: string): void => {
    const p = PRESETS_TRAPEZOIDAIS[nome];
    if (p) set({ preset: nome, ...p });
  };

  return (
    <>
      <div className="field">
        <label>{t('form.perfilVazao')}</label>
        <select
          value={gerador.perfil}
          disabled={emExecucao}
          aria-label={t('form.perfilVazao')}
          onChange={(e) => trocarPerfil(e.target.value as PerfilVazao)}
        >
          <optgroup label={t('form.grpPadrao')}>
            <option value="fixo">{t('perfis.fixo')}</option>
          </optgroup>
          <optgroup label={t('form.grpPeriodicos')}>
            {PERIODICOS.map((p) => (
              <option key={p} value={p}>{t(`perfis.${p}`)}</option>
            ))}
          </optgroup>
          <optgroup label={t('form.grpTransientes')}>
            {TRANSIENTES.map((p) => (
              <option key={p} value={p}>{t(`perfis.${p}`)}</option>
            ))}
          </optgroup>
          <optgroup label={t('form.grpOutros')}>
            <option value="aleatoria">{t('perfis.aleatoria')}</option>
          </optgroup>
        </select>
      </div>

      <p className="telemetry" style={{ margin: '0 0 4px' }}>{t(`perfilAjuda.${gerador.perfil}`)}</p>
      <WaveformPreview gerador={gerador} unidade={u.vazao} />

      {gerador.perfil === 'fixo' && (
        <Num label={t('form.vazaoConstante')} unidade={u.vazao} value={gerador.vazao} disabled={emExecucao} onChange={(v) => set({ vazao: v })} />
      )}

      {gerador.perfil === 'senoidal' && (
        <>
          <Num label={t('form.vazaoMin')} unidade={u.vazao} value={gerador.min} disabled={emExecucao} onChange={(v) => set({ min: v })} />
          <Num label={t('form.vazaoMax')} unidade={u.vazao} value={gerador.max} disabled={emExecucao} onChange={(v) => set({ max: v })} />
          <Num label={t('form.periodo')} value={gerador.periodo} disabled={emExecucao} step={1} onChange={(v) => set({ periodo: v })} />
        </>
      )}

      {gerador.perfil === 'trapezoidal' && (
        <>
          <div className="field">
            <label>{t('form.forma')}</label>
            <select
              value={gerador.preset ?? ''}
              disabled={emExecucao}
              aria-label={t('form.forma')}
              onChange={(e) => aplicarPreset(e.target.value)}
            >
              {ORDEM_PRESETS.map((p) => (
                <option key={p} value={p}>{t(`presets.${p}`)}</option>
              ))}
              {!gerador.preset && <option value="">{t('presets.personalizado')}</option>}
            </select>
          </div>
          <Num label={t('form.vazaoMin')} unidade={u.vazao} value={gerador.min} disabled={emExecucao} onChange={(v) => set({ min: v })} />
          <Num label={t('form.vazaoMax')} unidade={u.vazao} value={gerador.max} disabled={emExecucao} onChange={(v) => set({ max: v })} />
          <Num label={t('form.periodo')} value={gerador.periodo} disabled={emExecucao} step={1} onChange={(v) => set({ periodo: v })} />
          {/* Avançado: as 4 frações do período (editar limpa o preset → "personalizado"). */}
          <details className="avancado">
            <summary>{t('form.avancado')}</summary>
            <Num label={t('form.fracSubida')} value={gerador.subida} disabled={emExecucao} step={0.05} onChange={(v) => set({ subida: v, preset: undefined })} />
            <Num label={t('form.fracAlto')} value={gerador.alto} disabled={emExecucao} step={0.05} onChange={(v) => set({ alto: v, preset: undefined })} />
            <Num label={t('form.fracDescida')} value={gerador.descida} disabled={emExecucao} step={0.05} onChange={(v) => set({ descida: v, preset: undefined })} />
            <Num label={t('form.fracBaixo')} value={gerador.baixo} disabled={emExecucao} step={0.05} onChange={(v) => set({ baixo: v, preset: undefined })} />
          </details>
        </>
      )}

      {gerador.perfil === 'escalonada' && (
        <>
          <Num label={t('form.vazaoMin')} unidade={u.vazao} value={gerador.min} disabled={emExecucao} onChange={(v) => set({ min: v })} />
          <Num label={t('form.vazaoMax')} unidade={u.vazao} value={gerador.max} disabled={emExecucao} onChange={(v) => set({ max: v })} />
          <Num label={t('form.periodo')} value={gerador.periodo} disabled={emExecucao} step={1} onChange={(v) => set({ periodo: v })} />
          <Num label={t('form.degraus')} value={gerador.degraus} disabled={emExecucao} step={1} onChange={(v) => set({ degraus: v })} />
        </>
      )}

      {gerador.perfil === 'amortecida' && (
        <>
          <Num label={t('form.base')} unidade={u.vazao} value={gerador.base} disabled={emExecucao} onChange={(v) => set({ base: v })} />
          <Num label={t('form.amplitude')} unidade={u.vazao} value={gerador.amplitude} disabled={emExecucao} onChange={(v) => set({ amplitude: v })} />
          <Num label={t('form.periodo')} value={gerador.periodo} disabled={emExecucao} step={1} onChange={(v) => set({ periodo: v })} />
          <Num label={t('form.tau')} value={gerador.tau} disabled={emExecucao} step={1} onChange={(v) => set({ tau: v })} />
        </>
      )}

      {gerador.perfil === 'aleatoria' && (
        <>
          <Num label={t('form.vazaoMin')} unidade={u.vazao} value={gerador.min} disabled={emExecucao} onChange={(v) => set({ min: v })} />
          <Num label={t('form.vazaoMax')} unidade={u.vazao} value={gerador.max} disabled={emExecucao} onChange={(v) => set({ max: v })} />
          <Num label={t('form.granularidade')} value={gerador.granularidade} disabled={emExecucao} step={1} onChange={(v) => set({ granularidade: v })} />
          <Num label={t('form.semente')} value={gerador.semente} disabled={emExecucao} step={1} onChange={(v) => set({ semente: v })} />
        </>
      )}

      {gerador.perfil === 'degrau' && (
        <>
          <Num label={t('form.degrauV0')} unidade={u.vazao} value={gerador.v0} disabled={emExecucao} onChange={(v) => set({ v0: v })} />
          <Num label={t('form.degrauV1')} unidade={u.vazao} value={gerador.v1} disabled={emExecucao} onChange={(v) => set({ v1: v })} />
          <Num label={t('form.instante')} value={gerador.instante} disabled={emExecucao} step={1} onChange={(v) => set({ instante: v })} />
          <Num label={t('form.rampa')} value={gerador.rampa} disabled={emExecucao} step={1} onChange={(v) => set({ rampa: v })} />
        </>
      )}

      {gerador.perfil === 'pulso' && (
        <>
          <Num label={t('form.base')} unidade={u.vazao} value={gerador.base} disabled={emExecucao} onChange={(v) => set({ base: v })} />
          <Num label={t('form.amplitude')} unidade={u.vazao} value={gerador.amplitude} disabled={emExecucao} onChange={(v) => set({ amplitude: v })} />
          <Num label={t('form.inicio')} value={gerador.inicio} disabled={emExecucao} step={1} onChange={(v) => set({ inicio: v })} />
          <Num label={t('form.pulsoLargura')} value={gerador.largura} disabled={emExecucao} step={1} onChange={(v) => set({ largura: v })} />
        </>
      )}

      {gerador.perfil === 'exponencial' && (
        <>
          <div className="field">
            <label>{t('form.sentido')}</label>
            <select value={gerador.sentido ?? 'subida'} disabled={emExecucao} aria-label={t('form.sentido')} onChange={(e) => set({ sentido: e.target.value as 'subida' | 'decaimento' })}>
              <option value="subida">{t('form.expSubida')}</option>
              <option value="decaimento">{t('form.expDecaimento')}</option>
            </select>
          </div>
          <Num label={t('form.base')} unidade={u.vazao} value={gerador.base} disabled={emExecucao} onChange={(v) => set({ base: v })} />
          <Num label={t('form.alvo')} unidade={u.vazao} value={gerador.alvo} disabled={emExecucao} onChange={(v) => set({ alvo: v })} />
          <Num label={t('form.tau')} value={gerador.tau} disabled={emExecucao} step={1} onChange={(v) => set({ tau: v })} />
        </>
      )}

      {gerador.perfil === 'diaria' && (
        <>
          <Num label={t('form.diariaBase')} unidade={u.vazao} value={gerador.base} disabled={emExecucao} onChange={(v) => set({ base: v })} />
          <strong style={{ fontSize: 13 }}>🌅 {t('form.picoManha')}</strong>
          <Num label={t('form.diaHora')} value={gerador.pmHora} disabled={emExecucao} step={0.5} onChange={(v) => set({ pmHora: v })} />
          <Num label={t('form.diaValor')} unidade={u.vazao} value={gerador.pmValor} disabled={emExecucao} onChange={(v) => set({ pmValor: v })} />
          <Num label={t('form.diaSubida')} value={gerador.pmSubida} disabled={emExecucao} step={0.5} onChange={(v) => set({ pmSubida: v })} />
          <Num label={t('form.diaPatamar')} value={gerador.pmPatamar} disabled={emExecucao} step={0.5} onChange={(v) => set({ pmPatamar: v })} />
          <Num label={t('form.diaDescida')} value={gerador.pmDescida} disabled={emExecucao} step={0.5} onChange={(v) => set({ pmDescida: v })} />
          <strong style={{ fontSize: 13 }}>🌆 {t('form.picoNoite')}</strong>
          <Num label={t('form.diaHora')} value={gerador.pnHora} disabled={emExecucao} step={0.5} onChange={(v) => set({ pnHora: v })} />
          <Num label={t('form.diaValor')} unidade={u.vazao} value={gerador.pnValor} disabled={emExecucao} onChange={(v) => set({ pnValor: v })} />
          <Num label={t('form.diaSubida')} value={gerador.pnSubida} disabled={emExecucao} step={0.5} onChange={(v) => set({ pnSubida: v })} />
          <Num label={t('form.diaPatamar')} value={gerador.pnPatamar} disabled={emExecucao} step={0.5} onChange={(v) => set({ pnPatamar: v })} />
          <Num label={t('form.diaDescida')} value={gerador.pnDescida} disabled={emExecucao} step={0.5} onChange={(v) => set({ pnDescida: v })} />
        </>
      )}
    </>
  );
}
