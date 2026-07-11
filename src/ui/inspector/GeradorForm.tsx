/**
 * Formulário do "gerador de vazão" — compartilhado por Fonte (entrada) e Consumo
 * (saída). Seletor de perfil (agrupado) + ajuda + preview ao vivo + campos
 * contextuais (só os parâmetros do perfil escolhido). Fase 1: fixo, trapezoidal
 * (com presets) e senoidal. Toda a configuração é estrutural → travada em
 * execução.
 */
import { useTranslation } from 'react-i18next';
import type { Gerador, PerfilVazao } from '../../domain/types';
import { ORDEM_PRESETS, PRESETS_TRAPEZOIDAIS, paramsPadrao, vazaoRef } from '../../domain/geradorVazao';
import { Num, type UniLabel } from './campos';
import { WaveformPreview } from './WaveformPreview';

/** Perfis oferecidos na Fase 1 (a lista cresce nas próximas fases). */
const PERIODICOS: PerfilVazao[] = ['trapezoidal', 'senoidal'];

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
    </>
  );
}
