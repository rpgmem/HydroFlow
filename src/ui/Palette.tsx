/**
 * Paleta de peças (Sprint 3). Cada botão adiciona uma peça nova ao canvas.
 * Desabilitada em execução (grafo estruturalmente imutável).
 */
import { useTranslation } from 'react-i18next';
import { criarPeca } from '../domain/factory';
import type { Acao } from '../state/store';
import type { TipoPeca } from '../domain/types';

const PECAS: { tipo: TipoPeca; icone: string }[] = [
  { tipo: 'reservatorio', icone: '🛢️' },
  { tipo: 'tubo', icone: '━' },
  { tipo: 'bomba', icone: '⚙️' },
  { tipo: 'fonte', icone: '🚰' },
  { tipo: 'consumo', icone: '🕳️' },
  { tipo: 'sensor', icone: '📡' },
  { tipo: 'juncao', icone: '⌥' },
  { tipo: 'quadro', icone: '🎛️' },
];

interface Props {
  dispatch: React.Dispatch<Acao>;
  desabilitado: boolean;
}

export function Palette({ dispatch, desabilitado }: Props) {
  const { t } = useTranslation();
  return (
    <div className="panel palette">
      <h3>{t('palette.titulo')}</h3>
      {PECAS.map(({ tipo, icone }) => {
        const rotulo = t(`pecas.${tipo}`);
        return (
        <button
          key={tipo}
          disabled={desabilitado}
          aria-label={t('palette.adicionar', { nome: rotulo })}
          onClick={() => {
            // Posição inicial escalonada para não sobrepor peças novas.
            const x = 120 + Math.round((Date.now() % 5) * 40);
            dispatch({ tipo: 'ADD_PECA', peca: criarPeca(tipo, x, 120) });
          }}
        >
          <span aria-hidden style={{ marginRight: 8 }}>
            {icone}
          </span>
          {rotulo}
        </button>
        );
      })}
    </div>
  );
}
