/**
 * Sparkline: mini-gráfico da série temporal de uma peça (nível ou vazão),
 * acumulada durante a execução. Sem eixos — só a curva, o valor atual e a
 * faixa min–máx, para caber no inspetor.
 */
interface Props {
  dados: number[];
  titulo: string;
  unidade: string;
}

const W = 208;
const H = 46;
const PAD = 3;

export function Sparkline({ dados, titulo, unidade }: Props) {
  if (dados.length < 2) {
    return (
      <p className="telemetry" style={{ margin: '2px 0 0' }}>
        {titulo}: coletando… (execute a simulação)
      </p>
    );
  }
  let min = Math.min(...dados);
  let max = Math.max(...dados);
  if (max - min < 1e-9) {
    // série constante: dá uma folga para não virar uma linha colada na borda.
    min -= 1;
    max += 1;
  }
  const x = (i: number): number => PAD + (i / (dados.length - 1)) * (W - 2 * PAD);
  const y = (v: number): number => PAD + (1 - (v - min) / (max - min)) * (H - 2 * PAD);
  const pontos = dados.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  // Linha do zero, quando a faixa cruza zero (útil para vazão com refluxo).
  const zeroY = min < 0 && max > 0 ? y(0) : null;
  const atual = dados[dados.length - 1]!;
  return (
    <div className="sparkline">
      <div className="spark-head">
        <span>{titulo}</span>
        <strong>
          {atual.toFixed(2)} {unidade}
        </strong>
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {zeroY !== null && (
          <line x1={0} x2={W} y1={zeroY} y2={zeroY} stroke="#4a5f73" strokeWidth={1} strokeDasharray="3 3" />
        )}
        <polyline points={pontos} fill="none" stroke="#22d3ee" strokeWidth={1.5} />
        <circle cx={x(dados.length - 1)} cy={y(atual)} r={2} fill="#22d3ee" />
      </svg>
      <div className="spark-faixa">
        <span>mín {min.toFixed(2)}</span>
        <span>máx {max.toFixed(2)}</span>
      </div>
    </div>
  );
}
