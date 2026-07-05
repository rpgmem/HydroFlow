/**
 * Canvas do editor (Sprint 3). react-konva com:
 *  - arrastar peças (modo edição)
 *  - criar conexões arrastando da alça de saída de uma peça até outra (N8N-like)
 *  - selecionar e excluir conexões
 *  - visualização de níveis e vazões (modo execução)
 *  - navegação: arrastar o fundo (pan), pinça/rolagem para zoom, e botões
 *    ＋ / － / ⤢ (ajustar) — essencial no mobile, onde o diagrama não cabe na tela.
 */
import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Line, Arrow } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Stage as KonvaStage } from 'konva/lib/Stage';
import { PecaView } from './PecaView';
import { criarConexao } from '../domain/factory';
import type { Acao, EstadoApp } from '../state/store';

interface Props {
  estado: EstadoApp;
  dispatch: React.Dispatch<Acao>;
  largura: number;
  altura: number;
}

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const clampZoom = (s: number): number => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, s));

export function Canvas({ estado, dispatch, largura, altura }: Props) {
  const emExecucao = estado.modo === 'execucao';
  const [conectando, setConectando] = useState<string | null>(null);
  const [ponteiro, setPonteiro] = useState<{ x: number; y: number } | null>(null);
  const conectandoRef = useRef<string | null>(null);
  conectandoRef.current = conectando;

  const stageRef = useRef<KonvaStage>(null);
  // Distância entre os dois dedos no gesto de pinça anterior (0 = sem gesto).
  const pinchRef = useRef(0);
  // Enquanto o usuário não mexer no zoom/pan, reenquadramos ao mudar o tamanho
  // (ex.: primeira medição real no mobile, rotação de tela).
  const usuarioMexeu = useRef(false);

  const pecaPorId = new Map(estado.projeto.pecas.map((p) => [p.id, p]));
  const centro = (id: string): { x: number; y: number } => {
    const p = pecaPorId.get(id);
    return p ? { x: p.x, y: p.y } : { x: 0, y: 0 };
  };

  const overflowSet = new Set(estado.overflow);
  const secoSet = new Set(estado.bombasASeco);
  const boiaFechadaSet = new Set(estado.boiasFechadas);
  const ladraoAtivoSet = new Set(estado.ladroesAtivos);
  const consumoDeficitSet = new Set(estado.consumoInsuficiente);

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

  // O pan (arrastar o fundo) é controlado imperativamente para não ser resetado
  // pelos re-renders da simulação. Desabilitado enquanto se cria uma conexão.
  useEffect(() => {
    stageRef.current?.draggable(!conectando);
  }, [conectando]);

  // Reenquadra automaticamente quando o diagrama não couber na área visível
  // (típico no mobile) — até o usuário assumir o controle do zoom/pan.
  useEffect(() => {
    if (usuarioMexeu.current || largura <= 0 || altura <= 0) return;
    const pcs = estado.projeto.pecas;
    if (pcs.length === 0) return;
    const b = limitesPecas(pcs);
    // Decide pelo tamanho CRU das peças (sem a margem de enquadramento), para o
    // desktop — onde tudo já cabe — não ficar reduzido à toa.
    if (b.rawW > largura || b.rawH > altura) ajustarView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [largura, altura, estado.projeto.pecas.length]);

  const iniciarConexao = (id: string): void => {
    if (emExecucao) return;
    conectandoRef.current = id; // síncrono: bloqueia o pan antes do dragstart
    stageRef.current?.draggable(false);
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
    // Posição do ponteiro em COORDENADAS DO CONTEÚDO (considera zoom/pan), para a
    // linha temporária alinhar com as peças mesmo com o canvas transformado.
    const pos = e.target.getStage()?.getRelativePointerPosition();
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

  const onStageDragStart = (e: KonvaEventObject<DragEvent>): void => {
    // Se um arraste de conexão começou, o fundo não deve panar junto.
    if (conectandoRef.current && e.target === stageRef.current) {
      e.target.stopDrag();
    }
  };

  const onStageDragEnd = (e: KonvaEventObject<DragEvent>): void => {
    // Pan do fundo (o próprio Stage) conta como interação → cessa o auto-fit.
    if (e.target === stageRef.current) usuarioMexeu.current = true;
  };

  // ---- Zoom (imperativo sobre o Stage) ---------------------------------
  const aplicarEscala = (novaEscala: number, centroTela: { x: number; y: number }): void => {
    const stage = stageRef.current;
    if (!stage) return;
    const escala = stage.scaleX();
    const s = clampZoom(novaEscala);
    // Ponto do conteúdo sob o centro do gesto — mantido fixo durante o zoom.
    const ponto = {
      x: (centroTela.x - stage.x()) / escala,
      y: (centroTela.y - stage.y()) / escala,
    };
    stage.scale({ x: s, y: s });
    stage.position({ x: centroTela.x - ponto.x * s, y: centroTela.y - ponto.y * s });
    stage.batchDraw();
  };

  const onWheel = (e: KonvaEventObject<WheelEvent>): void => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const p = stage?.getPointerPosition();
    if (!stage || !p) return;
    usuarioMexeu.current = true;
    const fator = e.evt.deltaY > 0 ? 1 / 1.1 : 1.1;
    aplicarEscala(stage.scaleX() * fator, p);
  };

  const zoomBotao = (fator: number): void => {
    const stage = stageRef.current;
    if (!stage) return;
    usuarioMexeu.current = true;
    aplicarEscala(stage.scaleX() * fator, { x: largura / 2, y: altura / 2 });
  };

  const ajustarView = (): void => {
    const stage = stageRef.current;
    if (!stage) return;
    const pcs = estado.projeto.pecas;
    if (pcs.length === 0) {
      stage.scale({ x: 1, y: 1 });
      stage.position({ x: 0, y: 0 });
      stage.batchDraw();
      return;
    }
    const b = limitesPecas(pcs);
    // Enquadra para caber; nunca amplia além de 1× (evita peças gigantes).
    const s = Math.min(1, clampZoom(Math.min(largura / b.w, altura / b.h)));
    stage.scale({ x: s, y: s });
    stage.position({
      x: (largura - b.w * s) / 2 - b.minX * s,
      y: (altura - b.h * s) / 2 - b.minY * s,
    });
    stage.batchDraw();
  };

  // ---- Pinça (dois dedos) ----------------------------------------------
  const onTouchMove = (e: KonvaEventObject<TouchEvent>): void => {
    const ts = e.evt.touches;
    if (ts.length < 2) return;
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    stage.draggable(false); // pausa o pan de um dedo durante a pinça
    const rect = stage.container().getBoundingClientRect();
    const p1 = { x: ts[0]!.clientX - rect.left, y: ts[0]!.clientY - rect.top };
    const p2 = { x: ts[1]!.clientX - rect.left, y: ts[1]!.clientY - rect.top };
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const centroTela = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    usuarioMexeu.current = true;
    if (pinchRef.current > 0) {
      aplicarEscala(stage.scaleX() * (dist / pinchRef.current), centroTela);
    }
    pinchRef.current = dist;
  };

  const onTouchEnd = (e: KonvaEventObject<TouchEvent>): void => {
    if (e.evt.touches.length < 2) {
      pinchRef.current = 0;
      stageRef.current?.draggable(!conectandoRef.current);
    }
    onStageMouseUp();
  };

  const hint = emExecucao
    ? null
    : conectando
      ? `Conectando a partir de "${rotuloDe(pecaPorId.get(conectando))}" — solte sobre a peça de destino`
      : 'Arraste do ponto ciano (saída) de uma peça até outra para conectar. Clique numa linha para selecioná-la e apague com Delete.';

  return (
    <div className="canvas-wrap" data-testid="canvas">
      {hint && <div className="hint">{hint}</div>}

      <div className="zoom-ctrls">
        <button aria-label="Aproximar" onClick={() => zoomBotao(1.2)}>
          ＋
        </button>
        <button aria-label="Afastar" onClick={() => zoomBotao(1 / 1.2)}>
          －
        </button>
        <button aria-label="Ajustar à tela" title="Ajustar à tela" onClick={ajustarView}>
          ⤢
        </button>
      </div>

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
        ref={stageRef}
        width={largura}
        height={altura}
        onMouseMove={onStageMouseMove}
        onMouseUp={onStageMouseUp}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
        onDragStart={onStageDragStart}
        onDragEnd={onStageDragEnd}
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
              ladraoAtivo={ladraoAtivoSet.has(peca.id)}
              consumoInsuficiente={consumoDeficitSet.has(peca.id)}
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

/**
 * Caixa envolvente das peças. `minX/minY/w/h` já incluem a margem usada pelo
 * enquadramento "ajustar"; `rawW/rawH` são as dimensões cruas (sem margem),
 * usadas só para decidir se o diagrama realmente não cabe na área visível.
 */
function limitesPecas(pcs: EstadoApp['projeto']['pecas']): {
  minX: number;
  minY: number;
  w: number;
  h: number;
  rawW: number;
  rawH: number;
} {
  const M = 90; // margem para acomodar rótulos e a "pegada" das peças
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pcs) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return {
    minX: minX - M,
    minY: minY - M,
    w: maxX - minX + 2 * M,
    h: maxY - minY + 2 * M,
    rawW: maxX - minX,
    rawH: maxY - minY,
  };
}

function rotuloDe(p: { id: string; rotulo?: string } | undefined): string {
  if (!p) return '';
  return p.rotulo && p.rotulo.trim() ? p.rotulo : p.id;
}
