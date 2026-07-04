/**
 * Desenho de uma peça no canvas (Sprint 3). Cada peça é um Group arrastável.
 * Reservatórios mostram o nível de líquido proporcional à alturaMaxima.
 */
import { Group, Rect, Circle, Line, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import {
  isReservatorio,
  type Peca,
  type PropsReservatorio,
} from '../domain/types';

/** Metade da "pegada" de cada tipo, usada para desenhar e ancorar conexões. */
function tamanhoPeca(tipo: Peca['tipo']): { w: number; h: number } {
  switch (tipo) {
    case 'reservatorio':
      return { w: 64, h: 88 };
    case 'tubo':
      return { w: 76, h: 16 };
    case 'bomba':
      return { w: 46, h: 46 };
    case 'fonte':
      return { w: 48, h: 48 };
    case 'sensor':
      return { w: 30, h: 30 };
    case 'juncao':
      return { w: 26, h: 26 };
  }
}

interface Props {
  peca: Peca;
  selecionada: boolean;
  emExecucao: boolean;
  vazao: number | undefined;
  overflow: boolean;
  aSeco: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
}

const COR: Record<Peca['tipo'], string> = {
  reservatorio: '#1e3a52',
  tubo: '#8aa0b2',
  bomba: '#334a5e',
  fonte: '#2b6cb0',
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
  onSelect,
  onMove,
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
      name={`peca-${peca.id}`}
    >
      {isReservatorio(peca) ? (
        <Reservatorio props={peca.props} w={w} h={h} borda={borda} larguraBorda={larguraBorda} overflow={overflow} />
      ) : peca.tipo === 'bomba' ? (
        <Circle
          radius={w / 2}
          fill={aSeco ? '#5b2b2b' : COR.bomba}
          stroke={borda}
          strokeWidth={larguraBorda}
        />
      ) : peca.tipo === 'tubo' ? (
        <Rect
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          cornerRadius={4}
          fill={vazao && Math.abs(vazao) > 0 ? '#2b8fe0' : COR.tubo}
          stroke={borda}
          strokeWidth={larguraBorda}
        />
      ) : peca.tipo === 'sensor' || peca.tipo === 'juncao' ? (
        <Circle radius={w / 2} fill={COR[peca.tipo]} stroke={borda} strokeWidth={larguraBorda} />
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
        fill="#cfe0ee"
        align="center"
        width={Math.max(w, 80)}
        offsetX={Math.max(w, 80) / 2}
        y={h / 2 + 4}
      />
    </Group>
  );
}

function rotulo(peca: Peca, vazao: number | undefined): string {
  const base = `${icone(peca.tipo)} ${peca.id}`;
  if (vazao !== undefined && Math.abs(vazao) > 1e-6) {
    return `${base}\nQ=${vazao.toFixed(2)}`;
  }
  return base;
}

function icone(tipo: Peca['tipo']): string {
  return { reservatorio: '🛢️', tubo: '━', bomba: '⚙️', fonte: '🚰', sensor: '📡', juncao: '⌥' }[tipo];
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
