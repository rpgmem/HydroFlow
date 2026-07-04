/**
 * Paleta de peças (Sprint 3). Cada botão adiciona uma peça nova ao canvas.
 * Desabilitada em execução (grafo estruturalmente imutável).
 */
import { criarPeca } from '../domain/factory';
import type { Acao } from '../state/store';
import type { TipoPeca } from '../domain/types';

const PECAS: { tipo: TipoPeca; rotulo: string; icone: string }[] = [
  { tipo: 'reservatorio', rotulo: 'Reservatório', icone: '🛢️' },
  { tipo: 'tubo', rotulo: 'Tubo', icone: '━' },
  { tipo: 'bomba', rotulo: 'Bomba', icone: '⚙️' },
  { tipo: 'fonte', rotulo: 'Fonte', icone: '🚰' },
  { tipo: 'consumo', rotulo: 'Consumo', icone: '🕳️' },
  { tipo: 'sensor', rotulo: 'Sensor', icone: '📡' },
  { tipo: 'juncao', rotulo: 'Junção', icone: '⌥' },
];

interface Props {
  dispatch: React.Dispatch<Acao>;
  desabilitado: boolean;
}

export function Palette({ dispatch, desabilitado }: Props) {
  return (
    <div className="panel palette">
      <h3>Peças</h3>
      {PECAS.map(({ tipo, rotulo, icone }) => (
        <button
          key={tipo}
          disabled={desabilitado}
          aria-label={`Adicionar ${rotulo}`}
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
      ))}
    </div>
  );
}
