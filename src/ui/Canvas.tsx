/**
 * Canvas do editor (Sprint 3). react-konva com:
 *  - arrastar peças (modo edição)
 *  - criar conexões clicando em duas peças (com feedback visual)
 *  - visualização de níveis e vazões (modo execução)
 */
import { useState } from 'react';
import { Stage, Layer, Line, Arrow } from 'react-konva';
import { PecaView } from './PecaView';
import { criarConexao } from '../domain/factory';
import type { Acao, EstadoApp } from '../state/store';
import type { Peca } from '../domain/types';

interface Props {
  estado: EstadoApp;
  dispatch: React.Dispatch<Acao>;
  largura: number;
  altura: number;
}

export function Canvas({ estado, dispatch, largura, altura }: Props) {
  const emExecucao = estado.modo === 'execucao';
  const [origemConexao, setOrigemConexao] = useState<string | null>(null);

  const pecaPorId = new Map(estado.projeto.pecas.map((p) => [p.id, p]));
  const centro = (id: string): { x: number; y: number } => {
    const p = pecaPorId.get(id);
    return p ? { x: p.x, y: p.y } : { x: 0, y: 0 };
  };

  const overflowSet = new Set(estado.overflow);
  const secoSet = new Set(estado.bombasASeco);

  const clicarPeca = (peca: Peca): void => {
    if (emExecucao) {
      dispatch({ tipo: 'SELECIONAR', id: peca.id });
      return;
    }
    if (origemConexao === null) {
      dispatch({ tipo: 'SELECIONAR', id: peca.id });
      setOrigemConexao(peca.id);
    } else if (origemConexao === peca.id) {
      setOrigemConexao(null); // clicar de novo cancela
    } else {
      dispatch({
        tipo: 'ADD_CONEXAO',
        conexao: criarConexao(origemConexao, peca.id),
      });
      setOrigemConexao(null);
    }
  };

  return (
    <div className="canvas-wrap" data-testid="canvas">
      {!emExecucao && (
        <div className="hint">
          {origemConexao
            ? `Conectando a partir de "${origemConexao}" — clique no destino (ou nele mesmo p/ cancelar)`
            : 'Clique numa peça para selecionar; clique em outra para conectar. Arraste para mover.'}
        </div>
      )}
      <Stage width={largura} height={altura}>
        {/* Conexões desenhadas atrás das peças. */}
        <Layer>
          {estado.projeto.conexoes.map((c) => {
            const a = centro(c.origem);
            const b = centro(c.destino);
            const q = Math.abs(estado.vazoes[c.origem] ?? estado.vazoes[c.destino] ?? 0);
            const ativa = emExecucao && q > 1e-6;
            return (
              <Arrow
                key={c.id}
                points={[a.x, a.y, b.x, b.y]}
                stroke={ativa ? '#22d3ee' : '#4a5f73'}
                fill={ativa ? '#22d3ee' : '#4a5f73'}
                strokeWidth={ativa ? 3 : 1.5}
                pointerLength={8}
                pointerWidth={8}
                onClick={() => !emExecucao && dispatch({ tipo: 'REMOVER_CONEXAO', id: c.id })}
              />
            );
          })}
          {/* Realce da origem de conexão pendente. */}
          {origemConexao && (
            <Line
              points={[centro(origemConexao).x, centro(origemConexao).y, centro(origemConexao).x, centro(origemConexao).y]}
              stroke="#38bdf8"
            />
          )}
        </Layer>

        {/* Peças por cima. */}
        <Layer>
          {estado.projeto.pecas.map((peca) => (
            <PecaView
              key={peca.id}
              peca={peca}
              selecionada={estado.selecionada === peca.id || origemConexao === peca.id}
              emExecucao={emExecucao}
              vazao={estado.vazoes[peca.id]}
              overflow={overflowSet.has(peca.id)}
              aSeco={secoSet.has(peca.id)}
              onSelect={() => clicarPeca(peca)}
              onMove={(x, y) => dispatch({ tipo: 'MOVER_PECA', id: peca.id, x, y })}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
