/**
 * Desenho de uma peça no canvas. Cada peça é um Group arrastável.
 * Reservatórios mostram o nível de líquido proporcional à alturaMaxima.
 *
 * Conexão deliberada (estilo N8N): cada peça tem uma alça de saída (o ponto à direita). O usuário arrasta a partir dela até outra peça para criar a aresta —
 * clicar no corpo apenas seleciona. Isso evita conexões acidentais.
 */
import { Group, Rect, Circle, Line, Text, Wedge, Ellipse } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import {
  isBomba,
  isReservatorio,
  isTubo,
  type Peca,
  type PropsBomba,
  type PropsReservatorio,
  type PropsTubo,
  type Unidades,
} from '../domain/types';

import { exibirVazao } from '../domain/unidades';
import { tamanhoPeca, GRADE } from './pecaGeom';

interface Props {
  peca: Peca;
  selecionada: boolean;
  emExecucao: boolean;
  vazao: number | undefined;
  /** Unidade de EXIBIÇÃO (a vazão chega em SI e é convertida no rótulo). */
  unidades: Unidades;
  overflow: boolean;
  aSeco: boolean;
  boiaFechada: boolean;
  /** Tubo ladrão em transbordo neste tick. */
  ladraoAtivo: boolean;
  /** Tubo com velocidade acima da recomendada (subdimensionado) neste tick. */
  tuboVeloz: boolean;
  /** Tubo com risco de golpe de aríete (sobrepressão de Joukowsky acima do teto). */
  golpeAriete: boolean;
  /** Bomba com risco de cavitação (NPSH disponível abaixo do requerido) neste tick. */
  cavitando: boolean;
  /** Válvula de alívio descarregando (pressão acima do setpoint) neste tick. */
  aliviando: boolean;
  /** Consumo cuja demanda excede a vazão da bomba (déficit) neste tick. */
  consumoInsuficiente: boolean;
  /** Modo impressão: rótulos em cor escura (legíveis sobre fundo branco). */
  temaClaro?: boolean;
  /** Decisão corrente do sensor ('ligar'|'desligar'|'manter'), se em execução. */
  sensorEstado?: string;
  /** Bomba: revezamento EFETIVO (do quadro se regida; senão o da própria bomba). */
  revezamentoEfetivo?: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onStartConnection: (id: string) => void;
  onEndConnection: (id: string) => void;
  /** Hover para o tooltip: reporta id + posição na tela (ou null ao sair). */
  onHover?: (info: { id: string; x: number; y: number } | null) => void;
}

// Cores de estado. Registro e boia: verde = aberto (deixa passar), vermelho = fechado. O ladrão em espera usa âmbar (não é uma boia — só sinaliza o dreno).
const COR_ABERTO = '#34d399';
const COR_FECHADO = '#f87171';
const COR_BOIA_ABERTA = '#34d399'; // boia aberta = verde (deixa passar)
const COR_AMBAR = '#fbbf24'; // ladrão em espera / sensor em banda morta

// Sensor: verde = atuando p/ ligar, vermelho = atuando p/ desligar, amarelo = esperando (banda morta). Sem simulação usa a cor padrão do sensor.
const COR_SENSOR: Record<string, string> = {
  ligar: '#34d399',
  desligar: '#f87171',
  manter: COR_AMBAR,
};

// Cor base de cada tipo. Bomba (violeta) e junção (teal) ganham cores próprias para se distinguirem à primeira vista, além da forma (círculo/hexágono).
const COR: Record<Peca['tipo'], string> = {
  reservatorio: '#1e3a52',
  tubo: '#8aa0b2',
  bomba: '#7c5cff',
  fonte: '#2b6cb0',
  consumo: '#5a3d2b',
  sensor: '#3b3b6d',
  juncao: '#0d9488',
  quadro: '#e0863b',
  alivio: '#7a4a52',
};

export function PecaView({
  peca,
  selecionada,
  emExecucao,
  vazao,
  unidades,
  overflow,
  aSeco,
  boiaFechada,
  ladraoAtivo,
  tuboVeloz,
  golpeAriete,
  cavitando,
  aliviando,
  consumoInsuficiente,
  temaClaro,
  sensorEstado,
  revezamentoEfetivo,
  onSelect,
  onMove,
  onStartConnection,
  onEndConnection,
  onHover,
}: Props) {
  const { w, h } = tamanhoPeca(peca.tipo);
  const borda = selecionada ? '#38bdf8' : '#0d1620';
  const larguraBorda = selecionada ? 2.5 : 1;

  const handleDragEnd = (e: KonvaEventObject<DragEvent>): void => {
    // Snap à grade: encaixa o centro da peça no múltiplo de GRADE mais próximo, ajudando o alinhamento em colunas/linhas (as colunas do exemplo, múltiplas
    // de 120, permanecem intactas — 120 é múltiplo da grade).
    const gx = Math.round(e.target.x() / GRADE) * GRADE;
    const gy = Math.round(e.target.y() / GRADE) * GRADE;
    onMove(gx, gy); // o estado atualiza → o Group re-renderiza já encaixado

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
      onMouseEnter={(e) => {
        const pos = e.target.getStage()?.getPointerPosition();
        if (pos) onHover?.({ id: peca.id, x: pos.x, y: pos.y });
      }}
      onMouseMove={(e) => {
        const pos = e.target.getStage()?.getPointerPosition();
        if (pos) onHover?.({ id: peca.id, x: pos.x, y: pos.y });
      }}
      onMouseLeave={() => onHover?.(null)}
      name={`peca-${peca.id}`}
    >
      {isReservatorio(peca) ? (
        <Reservatorio props={peca.props} w={w} h={h} borda={borda} larguraBorda={larguraBorda} overflow={overflow} />
      ) : isBomba(peca) ? (
        <BombaView props={peca.props} w={w} borda={borda} larguraBorda={larguraBorda} aSeco={aSeco} cavitando={cavitando} revezamento={revezamentoEfetivo ?? peca.props.revezamento ?? false} />
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
          golpeAriete={golpeAriete}
        />
      ) : peca.tipo === 'sensor' ? (
        // Sensor = losango (instrumento/medição) — distinto do círculo da bomba.
        // Cor: verde liga, vermelho desliga, amarelo espera; padrão sem simulação.
        <Line
          closed
          points={[0, -h / 2, w / 2, 0, 0, h / 2, -w / 2, 0]}
          fill={sensorEstado ? (COR_SENSOR[sensorEstado] ?? COR.sensor) : COR.sensor}
          stroke={borda}
          strokeWidth={larguraBorda}
        />
      ) : peca.tipo === 'juncao' ? (
        // Junção = hexágono (evoca uma luva/porca de tubo — peça de conexão).
        // Distinto do círculo (bomba) e do losango (sensor).
        <Line closed points={hexagono(w / 2)} fill={COR.juncao} stroke={borda} strokeWidth={larguraBorda} />
      ) : peca.tipo === 'quadro' ? (
        // Quadro de comandos = painel retangular com "luzes" (MCC). Distinto dos demais pela forma larga + fileira de indicadores no topo.
        <>
          <Rect x={-w / 2} y={-h / 2} width={w} height={h} cornerRadius={3} fill={COR.quadro} stroke={borda} strokeWidth={larguraBorda} />
          {[-1, 0, 1].map((i) => (
            <Circle key={i} x={i * 11} y={-h / 2 + 8} radius={3} fill="#fff3e0" stroke="#0d1620" strokeWidth={0.5} />
          ))}
        </>
      ) : peca.tipo === 'consumo' ? (
        // Triângulo apontando para baixo (dreno/saída). Laranja quando em déficit (a bomba que o alimenta não acompanha a demanda).
        <Line
          closed
          points={[-w / 2, -h / 2, w / 2, -h / 2, 0, h / 2]}
          fill={consumoInsuficiente ? '#f59e0b' : COR.consumo}
          stroke={consumoInsuficiente ? COR_FECHADO : borda}
          strokeWidth={consumoInsuficiente ? 2 : larguraBorda}
        />
      ) : peca.tipo === 'alivio' ? (
        // Válvula de alívio = pentágono (forma própria, distinta dos demais).
        // Fica VERMELHO quando está descarregando.
        <Line
          closed
          points={pentagono(w / 2)}
          fill={aliviando ? '#ef4444' : COR.alivio}
          stroke={aliviando ? COR_FECHADO : borda}
          strokeWidth={aliviando ? 2 : larguraBorda}
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
        text={rotulo(peca, vazao, unidades)}
        fontSize={11}
        fill={temaClaro ? '#0d1f2b' : '#cfe0ee'}
        align="center"
        width={Math.max(w, 90)}
        offsetX={Math.max(w, 90) / 2}
        y={h / 2 + 4}
      />

      {/* Alça de saída para iniciar conexões (só em edição). O quadro de comandos 
          liga por associação (props), não por setas — não tem alça. */}
      {!emExecucao && peca.tipo !== 'quadro' && (
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
 *  - boia → círculo verde (aberta) / vermelho (fechada).
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
  golpeAriete,
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
  golpeAriete: boolean;
}) {
  const fluindo = vazao !== undefined && Math.abs(vazao) > 1e-9;
  const registroFechado = props.registro !== undefined && !props.registro.aberto;
  // Prioridade de cor: golpe de aríete/risco de sobrepressão (vermelho) > ladrão transbordando (laranja) > velocidade acima da recomendada/subdimensionado (rosa) > fluindo normal (azul) > repouso (cinza).
  const corTubo =
    golpeAriete
      ? '#dc2626'
      : props.ladrao && ladraoAtivo
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
          fill={ladraoAtivo ? '#f59e0b' : COR_AMBAR}
          stroke="#0d1620"
          strokeWidth={1}
        />
      ) : props.boia ? (
        // Boia = círculo (float). Verde aberta / vermelho fechada.
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
 * Bomba. Simples: um círculo. Em REVEZAMENTO: um círculo dividido ao meio com as metades "1" (esquerda) e "2" (direita) — ao ligar, a metade que assumiu
 * acende e a outra fica apagada; desligada, ambas apagadas.
 */
function BombaView({
  props,
  w,
  borda,
  larguraBorda,
  aSeco,
  cavitando,
  revezamento,
}: {
  props: PropsBomba;
  w: number;
  borda: string;
  larguraBorda: number;
  aSeco: boolean;
  /** Risco de cavitação (NPSH disponível < requerido): destaca a bomba em âmbar. */
  cavitando: boolean;
  /** Revezamento EFETIVO (do quadro se regida; senão o da própria bomba). */
  revezamento: boolean;
}) {
  const r = w / 2;
  const ligada = props.ligada ?? false;
  const ativa = props.unidadeAtiva === 2 ? 2 : 1;
  // Unidade que está de fato rodando agora (bomba única = sempre a "1").
  const ativoAgora = (n: 1 | 2): boolean => ligada && (revezamento ? ativa === n : n === 1);
  // Número: BRANCO vivo e maior quando essa unidade roda; senão apagado mas
  // LEGÍVEL — aparece no editor também (antes a bomba única não exibia número).
  const corNum = (n: 1 | 2): string => (ativoAgora(n) ? '#ffffff' : '#93a7b8');
  const tamNum = (n: 1 | 2): number => (ativoAgora(n) ? 14 : 11);

  if (!revezamento) {
    // Bomba única: círculo + número "1" centralizado (identifica a unidade).
    return (
      <>
        <Circle radius={r} fill={aSeco ? '#5b2b2b' : cavitando ? '#8a5a00' : COR.bomba} stroke={borda} strokeWidth={larguraBorda} />
        <Text text="1" fontSize={tamNum(1)} fontStyle="bold" fill={corNum(1)} x={-r} y={-tamNum(1) / 2} width={w} align="center" />
      </>
    );
  }
  // Metade acende só quando é a ativa E a bomba está ligada; a seco pinta de vermelho escuro (está tentando rodar sem água).
  const corMetade = (n: 1 | 2): string => (ativoAgora(n) ? (aSeco ? '#8a3535' : cavitando ? '#c68a00' : '#38bdf8') : COR.bomba);
  return (
    <>
      {/* Metade esquerda = unidade 1; direita = unidade 2. Os dois wedges de 180°
          já desenham o contorno do círculo e o divisor vertical. */}
      <Wedge radius={r} angle={180} rotation={90} fill={corMetade(1)} stroke={borda} strokeWidth={larguraBorda} />
      <Wedge radius={r} angle={180} rotation={-90} fill={corMetade(2)} stroke={borda} strokeWidth={larguraBorda} />
      <Text text="1" fontSize={tamNum(1)} fontStyle="bold" fill={corNum(1)} x={-r} y={-tamNum(1) / 2} width={r} align="center" />
      <Text text="2" fontSize={tamNum(2)} fontStyle="bold" fill={corNum(2)} x={0} y={-tamNum(2) / 2} width={r} align="center" />
    </>
  );
}

/** Vértices de um hexágono regular de "topo plano" com circunraio R (center→lado). */
function hexagono(R: number): number[] {
  const hx = R / 2; // meia-largura da aresta de topo/base
  const hy = (R * Math.sqrt(3)) / 2; // meia-altura
  return [-hx, -hy, hx, -hy, R, 0, hx, hy, -hx, hy, -R, 0];
}

/** Pentágono regular com o vértice apontando para CIMA (circunraio R). */
function pentagono(R: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 5; i++) {
    const a = ((-90 + i * 72) * Math.PI) / 180;
    pts.push(R * Math.cos(a), R * Math.sin(a));
  }
  return pts;
}

function rotulo(peca: Peca, vazao: number | undefined, unidades: Unidades): string {
  const nome = peca.rotulo && peca.rotulo.trim() ? peca.rotulo : peca.id;
  const base = `${icone(peca.tipo)} ${nome}`;
  if (vazao !== undefined && Math.abs(vazao) > 1e-6) {
    return `${base}\nQ=${exibirVazao(vazao, unidades).toFixed(2)}`;
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
    quadro: '🎛️',
    alivio: '⬠',
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
  // Cilindro (tanque) vs retangular (caixa) ganham silhuetas distintas: o cilindro tem cantos arredondados e uma boca elíptica no topo; a caixa é
  // angulosa (cantos retos). A água segue o mesmo raio de canto na base.
  const cil = props.formato === 'cilindro';
  const raioCanto = cil ? 14 : 2;
  return (
    <>
      <Rect x={-w / 2} y={-h / 2} width={w} height={h} cornerRadius={raioCanto} fill={COR.reservatorio} stroke={borda} strokeWidth={larguraBorda} />
      <Rect
        x={-w / 2}
        y={h / 2 - alturaAgua}
        width={w}
        height={alturaAgua}
        cornerRadius={[0, 0, raioCanto, raioCanto]}
        fill={overflow ? '#3ba3ff' : '#2b8fe0'}
        opacity={0.85}
      />
      {cil ? (
        // Boca do tanque (elipse) — dá o ar de cilindro visto de lado.
        <Ellipse x={0} y={-h / 2} radiusX={w / 2} radiusY={5} stroke="#6b8299" strokeWidth={1} />
      ) : (
        // Linha de topo (alturaMaxima) — silhueta reta da caixa.
        <Line points={[-w / 2, -h / 2, w / 2, -h / 2]} stroke="#6b8299" strokeWidth={1} dash={[4, 3]} />
      )}
    </>
  );
}
