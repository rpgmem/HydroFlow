/**
 * Paleta de peças. Cada botão adiciona uma peça nova ao canvas.
 * Desabilitada em execução (grafo estruturalmente imutável).
 */
import { useTranslation } from 'react-i18next';
import { criarPeca } from '../domain/factory';
import type { Acao } from '../state/store';
import type { Peca, TipoPeca } from '../domain/types';

const PECAS: { tipo: TipoPeca; icone: string }[] = [
  { tipo: 'reservatorio', icone: '🛢️' },
  { tipo: 'tubo', icone: '━' },
  { tipo: 'bomba', icone: '⚙️' },
  { tipo: 'fonte', icone: '🚰' },
  { tipo: 'consumo', icone: '🕳️' },
  { tipo: 'sensor', icone: '📡' },
  { tipo: 'juncao', icone: '⌥' },
  { tipo: 'quadro', icone: '🎛️' },
  { tipo: 'alivio', icone: '🔺' },
];

interface Props {
  dispatch: React.Dispatch<Acao>;
  desabilitado: boolean;
  /** Peças atuais — usadas para numerar o nome da peça nova (ex.: "Sensor 2"). */
  pecas: Peca[];
}

export function Palette({ dispatch, desabilitado, pecas }: Props) {
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
            // Nome amigável automático: "<Tipo> <n>" (n = quantas já existem + 1),
            // para a peça nascer nomeada em vez de mostrar o id cru.
            const n = pecas.filter((p) => p.tipo === tipo).length + 1;
            const nova = criarPeca(tipo, x, 120);
            dispatch({ tipo: 'ADD_PECA', peca: { ...nova, rotulo: `${rotulo} ${n}` } });
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
