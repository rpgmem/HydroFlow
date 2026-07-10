/**
 * Legenda do canvas: explica as FORMAS das peças, os indicadores de válvula no
 * tubo e as CORES de estado usadas na simulação. Cartão recolhível (como o log).
 * As cores espelham as de PecaView/Canvas para a leitura bater com o desenho.
 */
import { useTranslation } from 'react-i18next';

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
      <circle r={9} fill="#7c5cff" stroke={stroke} />
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
        fill="#0d9488"
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

const PECAS: { forma: React.ReactNode; k: string }[] = [
  { forma: <FormaReservatorio />, k: 'pecas.reservatorio' },
  { forma: <FormaTubo />, k: 'pecas.tubo' },
  { forma: <FormaBomba />, k: 'legenda.bomba' },
  { forma: <FormaSensor />, k: 'legenda.sensor' },
  { forma: <FormaJuncao />, k: 'legenda.juncao' },
  { forma: <FormaFonte />, k: 'pecas.fonte' },
  { forma: <FormaConsumo />, k: 'pecas.consumo' },
];

const VALVULAS: { c: string; k: string }[] = [
  { c: '#34d399', k: 'legenda.registroAberto' },
  { c: '#f87171', k: 'legenda.registroFechado' },
  { c: '#fbbf24', k: 'legenda.ladraoEspera' },
  { c: '#f59e0b', k: 'legenda.ladraoTransbordo' },
];

const ESTADOS: { c: string; k: string }[] = [
  { c: '#22d3ee', k: 'legenda.fluxoLinha' },
  { c: '#2b8fe0', k: 'legenda.fluxoTubo' },
  { c: '#c084fc', k: 'legenda.refluxo' },
  { c: '#f43f5e', k: 'legenda.velocidade' },
  { c: '#5b2b2b', k: 'legenda.seco' },
  { c: '#f59e0b', k: 'legenda.deficit' },
];

const SENSOR: { c: string; k: string }[] = [
  { c: '#34d399', k: 'legenda.pedindoLigar' },
  { c: '#f87171', k: 'legenda.pedindoDesligar' },
  { c: '#fbbf24', k: 'legenda.espera' },
];

export function Legenda({ onFechar }: { onFechar: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="legenda-panel" role="dialog" aria-label={t('legenda.titulo')}>
      <div className="log-head">
        <strong>{t('legenda.titulo')}</strong>
        <button onClick={onFechar} aria-label={t('legenda.fechar')}>
          ✕
        </button>
      </div>

      <p className="leg-sec">{t('legenda.secPecas')}</p>
      <ul className="leg-lista">
        {PECAS.map((p) => (
          <li key={p.k}>
            {p.forma}
            <span>{t(p.k)}</span>
          </li>
        ))}
      </ul>

      <p className="leg-sec">{t('legenda.secValvulas')}</p>
      <ul className="leg-lista">
        {VALVULAS.map((v) => (
          <li key={v.k}>
            <Cor c={v.c} />
            <span>{t(v.k)}</span>
          </li>
        ))}
      </ul>

      <p className="leg-sec">{t('legenda.secEstados')}</p>
      <ul className="leg-lista">
        {ESTADOS.map((e) => (
          <li key={e.k}>
            <Cor c={e.c} />
            <span>{t(e.k)}</span>
          </li>
        ))}
      </ul>

      <p className="leg-sec">{t('legenda.secSensor')}</p>
      <ul className="leg-lista">
        {SENSOR.map((s) => (
          <li key={s.k}>
            <Cor c={s.c} />
            <span>{t(s.k)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
