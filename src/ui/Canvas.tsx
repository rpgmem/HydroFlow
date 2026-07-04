/**
 * Canvas do editor (Sprint 3). react-konva com:
 *  - arrastar peças (modo edição)
 *  - criar conexões arrastando da alça de saída de uma peça até outra (N8N-like)
 *  - selecionar e excluir conexões
 *  - visualização de níveis e vazões (modo execução)
 */
import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Line, Arrow } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { PecaView } from './PecaView';
import { criarConexao } from '../domain/factory';
import type { Acao, EstadoApp } from '../state/store';

interface Props {
  estado: EstadoApp;
  dispatch: React.Dispatch<Acao>;
  largura: number;
  altura: number;
}

export function Canvas({ estado, dispatch, largura, altura }: Props) {
  const emExecucao = estado.modo === 'execucao';
  const [conectando, setConectando] = useState<string | null>(null);
  const [ponteiro, setPonteiro] = useState<{ x: number; y: number } | null>(null);
  const conectandoRef = useRef<string | null>(null);
  conectandoRef.current = conectando;

  const pecaPorId = new Map(estado.projeto.pecas.map((p) => [p.id, p]));
  const centro = (id: string): { x: number; y: number } => {
    const p = pecaPorId.get(id);
    return p ? { x: p.x, y: p.y } : { x: 0, y: 0 };
  };

  const overflowSet = new Set(estado.overflow);
  const secoSet = new Set(estado.bombasASeco);
  const boiaFechadaSet = new Set(estado.boiasFechadas);

  // Tecla Delete/Backspace exclui a conexão selecionada (fora de execução).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (emExecucao) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && estado.conexaoSelecionada) {
        dispatch({ tipo: 'REMOVER_CONEXAO', id: estado.conexaoSelecionada });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [emExecucao, estado.conexaoSelecionada, dispatch]);

  const iniciarConexao = (id: string): void => {
    if (emExecucao) return;
    setConectando(id);
    setPonteiro(centro(id));
  };

  const terminarConexao = (id: string): void => {
    const from = conectandoRef.current;
    if (from && from !== id && !emExecucao) {
      dispatch({ tipo: 'ADD_CONEXAO', conexao: criarConexao(from, id) });
    }
    setConectando(null);
    setPonteiro(null);
  };

  const onStageMouseMove = (e: KonvaEventObject<MouseEvent>): void => {
    if (!conectandoRef.current) return;
    const pos = e.target.getStage()?.getPointerPosition();
    if (pos) setPonteiro({ x: pos.x, y: pos.y });
  };

  const onStageMouseUp = (): void => {
    // Solto no vazio → cancela (se soltou sobre uma peça, o Group já tratou).
    setConectando(null);
    setPonteiro(null);
  };

  const onStageClick = (e: KonvaEventObject<MouseEvent>): void => {
    // Clique no fundo vazio limpa a seleção.
    if (e.target === e.target.getStage()) {
      dispatch({ tipo: 'SELECIONAR', id: null });
    }
  };

  const hint = emExecucao
    ? null
    : conectando
      ? `Conectando a partir de "${rotuloDe(pecaPorId.get(conectando))}" — solte sobre a peça de destino`
      : 'Arraste do ponto ciano (saída) de uma peça até outra para conectar. Clique numa linha para selecioná-la e apague com Delete.';

  return (
    <div className="canvas-wrap" data-testid="canvas">
      {hint && <div className="hint">{hint}</div>}

      {!emExecucao && estado.conexaoSelecionada && (
        <button
          className="danger excluir-conexao"
          onClick={() =>
            dispatch({ tipo: 'REMOVER_CONEXAO', id: estado.conexaoSelecionada! })
          }
        >
          ✕ Excluir conexão (Del)
        </button>
      )}

      <Stage
        width={largura}
        height={altura}
        onMouseMove={onStageMouseMove}
        onMouseUp={onStageMouseUp}
        onClick={onStageClick}
        onTap={onStageClick}
      >
        {/* Conexões desenhadas atrás das peças. */}
        <Layer>
          {estado.projeto.conexoes.map((c) => {
            const a = centro(c.origem);
            const b = centro(c.destino);
            const q = Math.abs(estado.vazoes[c.origem] ?? estado.vazoes[c.destino] ?? 0);
            const ativa = emExecucao && q > 1e-6;
            const sel = estado.conexaoSelecionada === c.id;
            // "Formigas marchando": o traço desloca com o tempo de simulação,
            // dando uma indicação de fluxo constante enquanto está rodando.
            const marcha = -(estado.tempo * 40) % 16;
            return (
              <Arrow
                key={c.id}
                points={[a.x, a.y, b.x, b.y]}
                stroke={sel ? '#f87171' : ativa ? '#22d3ee' : '#4a5f73'}
                fill={sel ? '#f87171' : ativa ? '#22d3ee' : '#4a5f73'}
                strokeWidth={sel ? 3.5 : ativa ? 3 : 1.5}
                dash={ativa ? [10, 6] : undefined}
                dashOffset={ativa ? marcha : 0}
                hitStrokeWidth={14}
                pointerLength={8}
                pointerWidth={8}
                onClick={() =>
                  !emExecucao && dispatch({ tipo: 'SELECIONAR_CONEXAO', id: c.id })
                }
                onTap={() =>
                  !emExecucao && dispatch({ tipo: 'SELECIONAR_CONEXAO', id: c.id })
                }
              />
            );
          })}
          {/* Linha temporária durante o arraste de conexão. */}
          {conectando && ponteiro && (
            <Line
              points={[centro(conectando).x, centro(conectando).y, ponteiro.x, ponteiro.y]}
              stroke="#22d3ee"
              strokeWidth={2}
              dash={[6, 4]}
              listening={false}
            />
          )}
        </Layer>

        {/* Peças por cima. */}
        <Layer>
          {estado.projeto.pecas.map((peca) => (
            <PecaView
              key={peca.id}
              peca={peca}
              selecionada={estado.selecionada === peca.id}
              emExecucao={emExecucao}
              vazao={estado.vazoes[peca.id]}
              overflow={overflowSet.has(peca.id)}
              aSeco={secoSet.has(peca.id)}
              boiaFechada={boiaFechadaSet.has(peca.id)}
              sensorEstado={emExecucao ? estado.sensores[peca.id] : undefined}
              onSelect={() => dispatch({ tipo: 'SELECIONAR', id: peca.id })}
              onMove={(x, y) => dispatch({ tipo: 'MOVER_PECA', id: peca.id, x, y })}
              onStartConnection={iniciarConexao}
              onEndConnection={terminarConexao}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}

function rotuloDe(p: { id: string; rotulo?: string } | undefined): string {
  if (!p) return '';
  return p.rotulo && p.rotulo.trim() ? p.rotulo : p.id;
}
