/**
 * Desenho de uma peça no canvas (Sprint 3). Cada peça é um Group arrastável.
 * Reservatórios mostram o nível de líquido proporcional à alturaMaxima.
 *
 * Conexão deliberada (estilo N8N): cada peça tem uma alça de saída (o ponto à
 * direita). O usuário arrasta a partir dela até outra peça para criar a aresta —
 * clicar no corpo apenas seleciona. Isso evita conexões acidentais.
 */
import { Group, Rect, Circle, Line, Text, Wedge } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import {
  isBomba,
  isReservatorio,
  isTubo,
  type Peca,
  type PropsBomba,
  type PropsReservatorio,
  type PropsTubo,
} from '../domain/types';

import { tamanhoPeca } from './pecaGeom';

interface Props {
  peca: Peca;
  selecionada: boolean;
  emExecucao: boolean;
  vazao: number | undefined;
  overflow: boolean;
  aSeco: boolean;
  boiaFechada: boolean;
  /** Tubo ladrão em transbordo neste tick. */
  ladraoAtivo: boolean;
  /** Tubo com velocidade acima da recomendada (subdimensionado) neste tick. */
  tuboVeloz: boolean;
  /** Consumo cuja demanda excede a vazão da bomba (déficit) neste tick. */
  consumoInsuficiente: boolean;
  /** Modo impressão: rótulos em cor escura (legíveis sobre fundo branco). */
  temaClaro?: boolean;
  /** Decisão corrente do sensor ('ligar'|'desligar'|'manter'), se em execução. */
  sensorEstado?: string;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onStartConnection: (id: string) => void;
  onEndConnection: (id: string) => void;
}

// Cores de estado. Registro: verde = aberto, vermelho = fechado.
// Boia: amarelo = aberta (enchendo/atenção), vermelho = fechada (destino cheio).
const COR_ABERTO = '#34d399';
const COR_FECHADO = '#f87171';
const COR_BOIA_ABERTA = '#fbbf24';

// Sensor: verde = atuando p/ ligar, vermelho = atuando p/ desligar,
// amarelo = esperando (banda morta). Sem simulação usa a cor padrão do sensor.
const COR_SENSOR: Record<string, string> = {
  ligar: '#34d399',
  desligar: '#f87171',
  manter: '#fbbf24',
};

const COR: Record<Peca['tipo'], string> = {
  reservatorio: '#1e3a52',
  tubo: '#8aa0b2',
  bomba: '#334a5e',
  fonte: '#2b6cb0',
  consumo: '#5a3d2b',
  sensor: '#3b3b6d',
  juncao: '#44566a',
};

export function PecaView({
  peca,
  selecionada,
  emExecucao,
  vazao,
  overflow,
  aSeco,
  boiaFechada,
  ladraoAtivo,
  tuboVeloz,
  consumoInsuficiente,
  temaClaro,
  sensorEstado,
  onSelect,
  onMove,
  onStartConnection,
  onEndConnection,
}: Props) {
  const { w, h } = tamanhoPeca(peca.tipo);
  const borda = selecionada ? '#38bdf8' : '#0d1620';
  const larguraBorda = selecionada ? 2.5 : 1;

  const handleDragEnd = (e: KonvaEventObject<DragEvent>): void => {
    onMove(e.target.x(), e.target.y());
  };

  return (
    <Group
      x={peca.x}
      y={peca.y}
      draggable={!emExecucao}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={handleDragEnd}
      onMouseUp={() => onEndConnection(peca.id)}
      onTouchEnd={() => onEndConnection(peca.id)}
      name={`peca-${peca.id}`}
    >
      {isReservatorio(peca) ? (
        <Reservatorio props={peca.props} w={w} h={h} borda={borda} larguraBorda={larguraBorda} overflow={overflow} />
      ) : isBomba(peca) ? (
        <BombaView props={peca.props} w={w} borda={borda} larguraBorda={larguraBorda} aSeco={aSeco} />
      ) : isTubo(peca) ? (
        <TuboView
          props={peca.props}
          w={w}
          h={h}
          borda={borda}
          larguraBorda={larguraBorda}
          vazao={vazao}
          boiaFechada={boiaFechada}
          ladraoAtivo={ladraoAtivo}
          tuboVeloz={tuboVeloz}
        />
      ) : peca.tipo === 'sensor' ? (
        <Circle
          radius={w / 2}
          fill={sensorEstado ? (COR_SENSOR[sensorEstado] ?? COR.sensor) : COR.sensor}
          stroke={borda}
          strokeWidth={larguraBorda}
        />
      ) : peca.tipo === 'juncao' ? (
        <Circle radius={w / 2} fill={COR.juncao} stroke={borda} strokeWidth={larguraBorda} />
      ) : peca.tipo === 'consumo' ? (
        // Triângulo apontando para baixo (dreno/saída). Laranja quando em déficit
        // (a bomba que o alimenta não acompanha a demanda).
        <Line
          closed
          points={[-w / 2, -h / 2, w / 2, -h / 2, 0, h / 2]}
          fill={consumoInsuficiente ? '#f59e0b' : COR.consumo}
          stroke={consumoInsuficiente ? COR_FECHADO : borda}
          strokeWidth={consumoInsuficiente ? 2 : larguraBorda}
        />
      ) : (
        <Rect
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          cornerRadius={6}
          fill={COR.fonte}
          stroke={borda}
          strokeWidth={larguraBorda}
        />
      )}

      <Text
        text={rotulo(peca, vazao)}
        fontSize={11}
        fill={temaClaro ? '#0d1f2b' : '#cfe0ee'}
        align="center"
        width={Math.max(w, 90)}
        offsetX={Math.max(w, 90) / 2}
        y={h / 2 + 4}
      />

      {/* Alça de saída para iniciar conexões (só em edição). */}
      {!emExecucao && (
        <Circle
          x={w / 2 + 8}
          y={0}
          radius={6}
          fill="#22d3ee"
          stroke="#0d1620"
          strokeWidth={1}
          name={`port-out-${peca.id}`}
          onMouseDown={(e) => {
            e.cancelBubble = true; // não arrasta a peça
            onStartConnection(peca.id);
          }}
          onTouchStart={(e) => {
            e.cancelBubble = true;
            onStartConnection(peca.id);
          }}
        />
      )}
    </Group>
  );
}

/**
 * Tubo com indicador de válvula:
 *  - registro → quadrado verde (aberto) / vermelho (fechado);
 *  - boia → círculo amarelo (aberta) / vermelho (fechada).
 */
function TuboView({
  props,
  w,
  h,
  borda,
  larguraBorda,
  vazao,
  boiaFechada,
  ladraoAtivo,
  tuboVeloz,
}: {
  props: PropsTubo;
  w: number;
  h: number;
  borda: string;
  larguraBorda: number;
  vazao: number | undefined;
  boiaFechada: boolean;
  ladraoAtivo: boolean;
  tuboVeloz: boolean;
}) {
  const fluindo = vazao !== undefined && Math.abs(vazao) > 1e-9;
  const registroFechado = props.registro !== undefined && !props.registro.aberto;
  // Prioridade de cor: ladrão transbordando (laranja) > velocidade acima da
  // recomendada/subdimensionado (rosa) > fluindo normal (azul) > repouso (cinza).
  const corTubo =
    props.ladrao && ladraoAtivo
      ? '#f59e0b'
      : tuboVeloz
        ? '#f43f5e'
        : fluindo
          ? '#2b8fe0'
          : COR.tubo;
  return (
    <>
      <Rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        cornerRadius={4}
        fill={corTubo}
        stroke={borda}
        strokeWidth={larguraBorda}
      />
      {props.ladrao ? (
        // Ladrão = losango. Laranja aceso quando transbordando; âmbar em repouso.
        <Line
          closed
          points={[0, -6, 6, 0, 0, 6, -6, 0]}
          fill={ladraoAtivo ? '#f59e0b' : COR_BOIA_ABERTA}
          stroke="#0d1620"
          strokeWidth={1}
        />
      ) : props.boia ? (
        // Boia = círculo (float). Amarelo aberta / vermelho fechada.
        <Circle
          radius={6}
          fill={boiaFechada ? COR_FECHADO : COR_BOIA_ABERTA}
          stroke="#0d1620"
          strokeWidth={1}
        />
      ) : props.registro ? (
        // Registro = quadrado (manopla). Verde aberto / vermelho fechado.
        <Rect
          x={-5}
          y={-5}
          width={10}
          height={10}
          cornerRadius={2}
          fill={registroFechado ? COR_FECHADO : COR_ABERTO}
          stroke="#0d1620"
          strokeWidth={1}
        />
      ) : null}
    </>
  );
}

/**
 * Bomba. Simples: um círculo. Em REVEZAMENTO: um círculo dividido ao meio com
 * as metades "1" (esquerda) e "2" (direita) — ao ligar, a metade que assumiu
 * acende e a outra fica apagada; desligada, ambas apagadas.
 */
function BombaView({
  props,
  w,
  borda,
  larguraBorda,
  aSeco,
}: {
  props: PropsBomba;
  w: number;
  borda: string;
  larguraBorda: number;
  aSeco: boolean;
}) {
  const r = w / 2;
  if (!props.revezamento) {
    return <Circle radius={r} fill={aSeco ? '#5b2b2b' : COR.bomba} stroke={borda} strokeWidth={larguraBorda} />;
  }
  const ligada = props.ligada ?? false;
  const ativa = props.unidadeAtiva === 2 ? 2 : 1;
  // Metade acende só quando é a ativa E a bomba está ligada; a seco pinta de
  // vermelho escuro (está tentando rodar sem água).
  const corMetade = (n: 1 | 2): string =>
    ativa === n && ligada ? (aSeco ? '#8a3535' : '#38bdf8') : COR.bomba;
  return (
    <>
      {/* Metade esquerda = unidade 1; direita = unidade 2. Os dois wedges de 180°
          já desenham o contorno do círculo e o divisor vertical. */}
      <Wedge radius={r} angle={180} rotation={90} fill={corMetade(1)} stroke={borda} strokeWidth={larguraBorda} />
      <Wedge radius={r} angle={180} rotation={-90} fill={corMetade(2)} stroke={borda} strokeWidth={larguraBorda} />
      <Text text="1" fontSize={12} fontStyle="bold" fill="#e6edf3" x={-r} y={-6} width={r} align="center" />
      <Text text="2" fontSize={12} fontStyle="bold" fill="#e6edf3" x={0} y={-6} width={r} align="center" />
    </>
  );
}

function rotulo(peca: Peca, vazao: number | undefined): string {
  const nome = peca.rotulo && peca.rotulo.trim() ? peca.rotulo : peca.id;
  const base = `${icone(peca.tipo)} ${nome}`;
  if (vazao !== undefined && Math.abs(vazao) > 1e-6) {
    return `${base}\nQ=${vazao.toFixed(2)}`;
  }
  return base;
}

function icone(tipo: Peca['tipo']): string {
  return {
    reservatorio: '🛢️',
    tubo: '━',
    bomba: '⚙️',
    fonte: '🚰',
    consumo: '🕳️',
    sensor: '📡',
    juncao: '⌥',
  }[tipo];
}

function Reservatorio({
  props,
  w,
  h,
  borda,
  larguraBorda,
  overflow,
}: {
  props: PropsReservatorio;
  w: number;
  h: number;
  borda: string;
  larguraBorda: number;
  overflow: boolean;
}) {
  const frac = props.alturaMaxima > 0 ? Math.min(1, (props.nivel ?? 0) / props.alturaMaxima) : 0;
  const alturaAgua = h * frac;
  return (
    <>
      <Rect x={-w / 2} y={-h / 2} width={w} height={h} cornerRadius={4} fill={COR.reservatorio} stroke={borda} strokeWidth={larguraBorda} />
      <Rect
        x={-w / 2}
        y={h / 2 - alturaAgua}
        width={w}
        height={alturaAgua}
        cornerRadius={[0, 0, 4, 4]}
        fill={overflow ? '#3ba3ff' : '#2b8fe0'}
        opacity={0.85}
      />
      {/* linha de topo (alturaMaxima) */}
      <Line points={[-w / 2, -h / 2, w / 2, -h / 2]} stroke="#6b8299" strokeWidth={1} dash={[4, 3]} />
    </>
  );
}
