/**
 * Legenda do canvas: explica as FORMAS das peças, os indicadores de válvula no
 * tubo e as CORES de estado usadas na simulação. Cartão recolhível (como o log).
 * As cores espelham as de PecaView/Canvas para a leitura bater com o desenho.
 */

// Glifos SVG pequenos (18×18) espelhando as formas do canvas.
function Swatch({ children }: { children: React.ReactNode }) {
  return (
    <svg width={18} height={18} viewBox="-11 -11 22 22" aria-hidden>
      {children}
    </svg>
  );
}

const stroke = '#0d1620';

function FormaReservatorio() {
  return (
    <Swatch>
      <rect x={-8} y={-9} width={16} height={18} rx={2} fill="#1e3a52" stroke={stroke} />
      <rect x={-8} y={1} width={16} height={8} rx={1} fill="#2b8fe0" />
    </Swatch>
  );
}
function FormaTubo() {
  return (
    <Swatch>
      <rect x={-10} y={-4} width={20} height={8} rx={2} fill="#8aa0b2" stroke={stroke} />
    </Swatch>
  );
}
function FormaBomba() {
  return (
    <Swatch>
      <circle r={9} fill="#334a5e" stroke={stroke} />
    </Swatch>
  );
}
function FormaSensor() {
  return (
    <Swatch>
      <polygon points="0,-9 9,0 0,9 -9,0" fill="#3b3b6d" stroke={stroke} />
    </Swatch>
  );
}
function FormaJuncao() {
  // hexágono de topo plano
  const R = 9;
  const hx = R / 2;
  const hy = (R * Math.sqrt(3)) / 2;
  return (
    <Swatch>
      <polygon
        points={`${-hx},${-hy} ${hx},${-hy} ${R},0 ${hx},${hy} ${-hx},${hy} ${-R},0`}
        fill="#44566a"
        stroke={stroke}
      />
    </Swatch>
  );
}
function FormaFonte() {
  return (
    <Swatch>
      <rect x={-9} y={-7} width={18} height={14} rx={4} fill="#2b6cb0" stroke={stroke} />
    </Swatch>
  );
}
function FormaConsumo() {
  return (
    <Swatch>
      <polygon points="-9,-7 9,-7 0,9" fill="#5a3d2b" stroke={stroke} />
    </Swatch>
  );
}

/** Bolinha de cor para a seção de estados. */
function Cor({ c }: { c: string }) {
  return <span className="leg-cor" style={{ background: c }} />;
}

const PECAS: { forma: React.ReactNode; nome: string }[] = [
  { forma: <FormaReservatorio />, nome: 'Reservatório' },
  { forma: <FormaTubo />, nome: 'Tubo' },
  { forma: <FormaBomba />, nome: 'Bomba (círculo)' },
  { forma: <FormaSensor />, nome: 'Sensor (losango)' },
  { forma: <FormaJuncao />, nome: 'Junção (hexágono)' },
  { forma: <FormaFonte />, nome: 'Fonte' },
  { forma: <FormaConsumo />, nome: 'Consumo' },
];

const VALVULAS: { c: string; nome: string }[] = [
  { c: '#34d399', nome: 'Registro aberto (▪)' },
  { c: '#f87171', nome: 'Registro/boia fechado' },
  { c: '#fbbf24', nome: 'Boia aberta / ladrão em espera' },
  { c: '#f59e0b', nome: 'Ladrão em transbordo' },
];

const ESTADOS: { c: string; nome: string }[] = [
  { c: '#22d3ee', nome: 'Fluxo (linha ativa)' },
  { c: '#2b8fe0', nome: 'Tubo com fluxo' },
  { c: '#c084fc', nome: 'Refluxo (contra a seta)' },
  { c: '#f43f5e', nome: 'Velocidade acima do recomendado' },
  { c: '#5b2b2b', nome: 'Bomba a seco' },
  { c: '#f59e0b', nome: 'Déficit de consumo / transbordo' },
];

const SENSOR: { c: string; nome: string }[] = [
  { c: '#34d399', nome: 'Pedindo ligar' },
  { c: '#f87171', nome: 'Pedindo desligar' },
  { c: '#fbbf24', nome: 'Em espera (banda morta)' },
];

export function Legenda({ onFechar }: { onFechar: () => void }) {
  return (
    <div className="legenda-panel" role="dialog" aria-label="Legenda">
      <div className="log-head">
        <strong>Legenda</strong>
        <button onClick={onFechar} aria-label="Fechar legenda">
          ✕
        </button>
      </div>

      <p className="leg-sec">Peças</p>
      <ul className="leg-lista">
        {PECAS.map((p) => (
          <li key={p.nome}>
            {p.forma}
            <span>{p.nome}</span>
          </li>
        ))}
      </ul>

      <p className="leg-sec">Válvulas no tubo</p>
      <ul className="leg-lista">
        {VALVULAS.map((v) => (
          <li key={v.nome}>
            <Cor c={v.c} />
            <span>{v.nome}</span>
          </li>
        ))}
      </ul>

      <p className="leg-sec">Cores de fluxo/estado</p>
      <ul className="leg-lista">
        {ESTADOS.map((e) => (
          <li key={e.nome}>
            <Cor c={e.c} />
            <span>{e.nome}</span>
          </li>
        ))}
      </ul>

      <p className="leg-sec">Sensor (na execução)</p>
      <ul className="leg-lista">
        {SENSOR.map((s) => (
          <li key={s.nome}>
            <Cor c={s.c} />
            <span>{s.nome}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
