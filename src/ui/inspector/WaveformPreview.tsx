/**
 * Preview ao vivo da onda de vazão de um gerador (Fonte/Consumo). Desenha
 * `valorNoTempo(g, t)` numa janela de tempo, em SVG puro — atualiza sozinho ao
 * mudar os parâmetros. Mostra a forma; o eixo Y vai de 0 ao máximo da janela.
 */
import { useTranslation } from 'react-i18next';
import type { Gerador } from '../../domain/types';
import { janelaPreview, valorNoTempo } from '../../domain/geradorVazao';

const W = 240;
const H = 76;
const PAD = 6;
const N = 160; // amostras

export function WaveformPreview({ gerador, unidade }: { gerador: Gerador; unidade: string }) {
  const { t } = useTranslation();
  const janela = Math.max(1, janelaPreview(gerador));

  const ts = Array.from({ length: N + 1 }, (_, i) => (i / N) * janela);
  const ys = ts.map((t2) => valorNoTempo(gerador, t2));
  const ymax = Math.max(1e-9, ...ys) * 1.15;

  const px = (t2: number): number => PAD + (t2 / janela) * (W - 2 * PAD);
  const py = (v: number): number => H - PAD - (v / ymax) * (H - 2 * PAD);
  const pontos = ts.map((t2, i) => `${px(t2).toFixed(1)},${py(ys[i]!).toFixed(1)}`).join(' ');
  const yZero = py(0);

  return (
    <div className="waveform-preview">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t('form.previewLabel')}>
        {/* linha de base (vazão 0) */}
        <line x1={PAD} y1={yZero} x2={W - PAD} y2={yZero} className="wf-base" />
        <polyline points={pontos} className="wf-linha" fill="none" />
      </svg>
      <span className="wf-legenda telemetry">
        {t('form.previewMax', { vazao: (ymax / 1.15).toFixed(1), unidade })}
      </span>
    </div>
  );
}
