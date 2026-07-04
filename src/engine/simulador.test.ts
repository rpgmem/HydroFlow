import { describe, it, expect, beforeEach } from 'vitest';
import { tick, rodarTicks } from './simulador';
import { arbitrarBomba, avaliarSensor } from './arbitragem';
import {
  criarConexao,
  projetoVazio,
  _resetContadorIds,
} from '../domain/factory';
import type {
  Peca,
  ProjetoSimulacao,
  PropsBomba,
  PropsFonte,
  PropsReservatorio,
  PropsSensor,
  PropsTubo,
} from '../domain/types';

beforeEach(() => _resetContadorIds());

// --- Construtores enxutos para topologias de teste -------------------------

function res(id: string, over: Partial<PropsReservatorio>): Peca {
  const props: PropsReservatorio = {
    formato: 'retangular',
    largura: 10,
    comprimento: 10, // área = 100
    alturaMaxima: 5,
    cotaBase: 0,
    nivel: 0,
    ...over,
  };
  return { id, tipo: 'reservatorio', x: 0, y: 0, props };
}
function tubo(id: string, over: Partial<PropsTubo> = {}): Peca {
  return { id, tipo: 'tubo', x: 0, y: 0, props: { diametro: 0.1, ...over } };
}
function bomba(id: string, over: Partial<PropsBomba> = {}): Peca {
  return {
    id,
    tipo: 'bomba',
    x: 0,
    y: 0,
    props: { vazaoNominal: 10, sensores: [], ligada: false, ...over },
  };
}
function fonte(id: string, over: Partial<PropsFonte> = {}): Peca {
  return { id, tipo: 'fonte', x: 0, y: 0, props: { vazaoFixa: 5, ...over } };
}
function sensor(id: string, over: Partial<PropsSensor>): Peca {
  return {
    id,
    tipo: 'sensor',
    x: 0,
    y: 0,
    props: { bombaAlvo: '', ...over } as PropsSensor,
  };
}
function projeto(pecas: Peca[], conexoes = projetoVazio().conexoes): ProjetoSimulacao {
  return { ...projetoVazio(), pecas, conexoes };
}

// ===========================================================================
// Vazão por Δh e diâmetro (Torricelli)
// ===========================================================================
describe('vazão por gravidade em tubo', () => {
  it('segue Q = A·√(2·g·Δh) com Δh = carga total', () => {
    const p = projeto(
      [
        res('A', { cotaBase: 10, nivel: 2 }), // carga 12
        res('B', { cotaBase: 0, nivel: 0 }), // carga 0
        tubo('T', { diametro: 0.1 }),
      ],
      [criarConexao('A', 'T'), criarConexao('T', 'B')],
    );
    const g = p.configuracaoSimulacao.g;
    const deltaH = 12;
    const area = Math.PI * 0.05 ** 2;
    const esperado = area * Math.sqrt(2 * g * deltaH);

    const r = tick(p);
    expect(r.vazoes['T']).toBeCloseTo(esperado, 6);
    // B recebeu volume Q·dt → nível sobe.
    const b = r.projeto.pecas.find((x) => x.id === 'B')!.props as PropsReservatorio;
    expect(b.nivel!).toBeGreaterThan(0);
  });

  it('escala com o quadrado do diâmetro (área)', () => {
    const mk = (d: number) =>
      tick(
        projeto(
          [res('A', { cotaBase: 5, nivel: 0 }), res('B', {}), tubo('T', { diametro: d })],
          [criarConexao('A', 'T'), criarConexao('T', 'B')],
        ),
      ).vazoes['T']!;
    expect(mk(0.2)).toBeCloseTo(mk(0.1) * 4, 6); // diâmetro 2x → vazão 4x
  });

  it('não flui sem desnível (Δh = 0)', () => {
    const r = tick(
      projeto(
        [res('A', { cotaBase: 0, nivel: 3 }), res('B', { cotaBase: 0, nivel: 3 }), tubo('T')],
        [criarConexao('A', 'T'), criarConexao('T', 'B')],
      ),
    );
    expect(r.vazoes['T']).toBe(0);
  });

  it('registro fechado interrompe o fluxo', () => {
    const r = tick(
      projeto(
        [res('A', { cotaBase: 5, nivel: 0 }), res('B', {}), tubo('T', { registro: { aberto: false } })],
        [criarConexao('A', 'T'), criarConexao('T', 'B')],
      ),
    );
    expect(r.vazoes['T']).toBe(0);
  });

  it('checkValve impede refluxo quando Δh < 0', () => {
    const r = tick(
      projeto(
        [res('A', { cotaBase: 0, nivel: 0 }), res('B', { cotaBase: 5, nivel: 0 }), tubo('T', { checkValve: true })],
        [criarConexao('A', 'T'), criarConexao('T', 'B')],
      ),
    );
    expect(r.vazoes['T']).toBe(0); // sem check valve fluiria de B para A
  });
});

// ===========================================================================
// Bomba com/sem curva
// ===========================================================================
describe('bomba', () => {
  it('entrega vazaoNominal sem curva, sentido forçado', () => {
    const r = tick(
      projeto(
        [res('A', { nivel: 5 }), res('B', { cotaBase: 10, nivel: 0 }), bomba('P', { ligada: true })],
        [criarConexao('A', 'P'), criarConexao('P', 'B')],
      ),
    );
    expect(r.vazoes['P']).toBe(10); // sobe mesmo contra a gravidade
  });

  it('reduz vazão pela curva vazaoNominal - k·Δh_lift', () => {
    const r = tick(
      projeto(
        [
          res('A', { cotaBase: 0, nivel: 5 }), // carga 5
          res('B', { cotaBase: 10, nivel: 0 }), // carga 10 → lift 5
          bomba('P', { ligada: true, vazaoNominal: 10, curva: { k: 1 } }),
        ],
        [criarConexao('A', 'P'), criarConexao('P', 'B')],
      ),
    );
    expect(r.vazoes['P']).toBeCloseTo(5, 6); // 10 - 1·5
  });

  it('nunca gera vazão negativa (curva satura em 0)', () => {
    const r = tick(
      projeto(
        [res('A', { nivel: 5 }), res('B', { cotaBase: 100, nivel: 0 }), bomba('P', { ligada: true, curva: { k: 1 } })],
        [criarConexao('A', 'P'), criarConexao('P', 'B')],
      ),
    );
    expect(r.vazoes['P']).toBe(0);
  });

  it('divide a vazão nominal igualmente entre múltiplas saídas', () => {
    const r = tick(
      projeto(
        [res('A', { nivel: 5 }), res('B', {}), res('C', {}), bomba('P', { ligada: true, vazaoNominal: 8 })],
        [criarConexao('A', 'P'), criarConexao('P', 'B'), criarConexao('P', 'C')],
      ),
    );
    expect(r.vazoes['P']).toBeCloseTo(8, 9); // total preservado
    const dt = 0.1;
    const b = r.projeto.pecas.find((x) => x.id === 'B')!.props as PropsReservatorio;
    const c = r.projeto.pecas.find((x) => x.id === 'C')!.props as PropsReservatorio;
    expect(b.nivel!).toBeCloseTo((4 * dt) / 100, 9); // 8/2 = 4 para cada
    expect(c.nivel!).toBeCloseTo((4 * dt) / 100, 9);
  });

  it('respeita vazaoAlocada por saída quando informada', () => {
    const r = tick(
      projeto(
        [res('A', { nivel: 5 }), res('B', {}), res('C', {}), bomba('P', { ligada: true, vazaoNominal: 10 })],
        [
          criarConexao('A', 'P'),
          criarConexao('P', 'B', { vazaoAlocada: 3 }),
          criarConexao('P', 'C', { vazaoAlocada: 6 }),
        ],
      ),
    );
    expect(r.vazoes['P']).toBeCloseTo(9, 9); // 3 + 6
  });

  it('registro fechado num cano de recalque em série interrompe a bomba', () => {
    const p = projeto(
      [res('A', { nivel: 5 }), res('B', {}), bomba('P', { ligada: true }), tubo('rec', { registro: { aberto: false } })],
      [criarConexao('A', 'P'), criarConexao('P', 'rec'), criarConexao('rec', 'B')],
    );
    expect(tick(p).vazoes['P']).toBe(0); // registro fechado ⇒ bomba não empurra
    // Abrindo o registro, volta a fluir.
    (p.pecas.find((x) => x.id === 'rec')!.props as PropsTubo).registro = { aberto: true };
    expect(tick(p).vazoes['P']).toBeGreaterThan(0);
  });

  it('registro fechado no cano de sucção impede a bomba', () => {
    const r = tick(
      projeto(
        [res('A', { nivel: 5 }), res('B', {}), bomba('P', { ligada: true }), tubo('suc', { registro: { aberto: false } })],
        [criarConexao('A', 'suc'), criarConexao('suc', 'P'), criarConexao('P', 'B')],
      ),
    );
    expect(r.vazoes['P']).toBe(0);
  });
});

// ===========================================================================
// Fonte com múltiplos destinos
// ===========================================================================
describe('fonte', () => {
  it('divide a vazão entre destinos conforme vazaoAlocada', () => {
    const r = tick(
      projeto(
        [fonte('F', { vazaoFixa: 10 }), res('B', {}), res('C', {})],
        [
          criarConexao('F', 'B', { vazaoAlocada: 3 }),
          criarConexao('F', 'C', { vazaoAlocada: 7 }),
        ],
      ),
    );
    const dt = 0.1;
    const b = r.projeto.pecas.find((x) => x.id === 'B')!.props as PropsReservatorio;
    const c = r.projeto.pecas.find((x) => x.id === 'C')!.props as PropsReservatorio;
    // área 100 → nível = volume/100 = (Q·dt)/100
    expect(b.nivel!).toBeCloseTo((3 * dt) / 100, 9);
    expect(c.nivel!).toBeCloseTo((7 * dt) / 100, 9);
  });

  it('destino único usa vazaoFixa', () => {
    const r = tick(
      projeto([fonte('F', { vazaoFixa: 8 }), res('B', {})], [criarConexao('F', 'B')]),
    );
    expect(r.vazoes['F']).toBe(8);
  });
});

// ===========================================================================
// Overflow
// ===========================================================================
describe('overflow', () => {
  it('clampa na alturaMaxima e reporta o transbordo sem travar', () => {
    const r = tick(
      projeto(
        [fonte('F', { vazaoFixa: 100000 }), res('B', { alturaMaxima: 5 })],
        [criarConexao('F', 'B')],
      ),
    );
    const b = r.projeto.pecas.find((x) => x.id === 'B')!.props as PropsReservatorio;
    expect(b.nivel!).toBeCloseTo(5, 9); // clampa exatamente na alturaMaxima
    expect(r.overflow).toContain('B');
  });
});

// ===========================================================================
// Proteção contra bomba a seco
// ===========================================================================
describe('bomba a seco', () => {
  it('desliga a bomba quando o reservatório de origem está vazio', () => {
    const r = tick(
      projeto(
        [res('A', { nivel: 0 }), res('B', {}), bomba('P', { ligada: true })],
        [criarConexao('A', 'P'), criarConexao('P', 'B')],
      ),
    );
    expect(r.vazoes['P']).toBe(0);
    expect(r.bombasASeco).toContain('P');
    const p = r.projeto.pecas.find((x) => x.id === 'P')!.props as PropsBomba;
    expect(p.ligada).toBe(false);
  });

  it('respeita um limiar de proteção a seco configurável', () => {
    const r = tick(
      projeto(
        [res('A', { nivel: 0.5 }), res('B', {}), bomba('P', { ligada: true, protecaoSeco: 1 })],
        [criarConexao('A', 'P'), criarConexao('P', 'B')],
      ),
    );
    expect(r.bombasASeco).toContain('P'); // 0.5 ≤ 1 → desliga antes de esvaziar
    expect(r.vazoes['P']).toBe(0);
  });
});

// ===========================================================================
// Boia (válvula de nível) num tubo entre a fonte e o reservatório
// ===========================================================================
describe('boia em tubo alimentado por fonte', () => {
  const cenario = (nivelDestino: number) =>
    projeto(
      [
        fonte('F', { vazaoFixa: 5 }),
        tubo('T', { boia: { nivelMinimo: 0, nivelMaximo: 2 } }),
        res('B', { nivel: nivelDestino }),
      ],
      [criarConexao('F', 'T'), criarConexao('T', 'B')],
    );

  it('boia fecha o abastecimento quando o destino atinge o máximo', () => {
    const r = tick(cenario(3)); // 3 ≥ máximo 2 → fecha
    expect(r.vazoes['F']).toBe(0);
    const b = r.projeto.pecas.find((x) => x.id === 'B')!.props as PropsReservatorio;
    expect(b.nivel!).toBeCloseTo(3, 9); // nem enche nem drena
  });

  it('boia aberta deixa a fonte abastecer normalmente', () => {
    const r = tick(cenario(0.5)); // abaixo do máximo → abre
    expect(r.vazoes['F']).toBe(5);
    const b = r.projeto.pecas.find((x) => x.id === 'B')!.props as PropsReservatorio;
    expect(b.nivel!).toBeGreaterThan(0.5); // encheu
  });

  it('tubo alimentado por fonte não drena o reservatório por conta própria', () => {
    // Sem a fonte empurrando (fonte fechada por boia cheia), o reservatório
    // não pode perder água pelo tubo de montante.
    const r = tick(cenario(3));
    expect(r.vazoes['T']).toBe(0);
  });
});

// ===========================================================================
// Ponto de consumo (saída de água sem destino)
// ===========================================================================
describe('consumo', () => {
  it('retira a vazão de demanda do reservatório de origem e descarta', () => {
    const r = tick(
      projeto(
        [res('A', { nivel: 2 }), { id: 'C', tipo: 'consumo', x: 0, y: 0, props: { vazaoDemanda: 5, aberto: true } }],
        [criarConexao('A', 'C')],
      ),
    );
    expect(r.vazoes['C']).toBe(5);
    const a = r.projeto.pecas.find((x) => x.id === 'A')!.props as PropsReservatorio;
    // área 100, volume 200 - 5·0.1 = 199.5 → nível 1.995
    expect(a.nivel!).toBeCloseTo(1.995, 9);
  });

  it('não retira nada quando a saída está fechada', () => {
    const r = tick(
      projeto(
        [res('A', { nivel: 2 }), { id: 'C', tipo: 'consumo', x: 0, y: 0, props: { vazaoDemanda: 5, aberto: false } }],
        [criarConexao('A', 'C')],
      ),
    );
    expect(r.vazoes['C']).toBe(0);
  });

  it('não drena abaixo de zero (limitado pelo volume disponível)', () => {
    const r = tick(
      projeto(
        [res('A', { nivel: 0.001 }), { id: 'C', tipo: 'consumo', x: 0, y: 0, props: { vazaoDemanda: 1000, aberto: true } }],
        [criarConexao('A', 'C')],
      ),
    );
    const a = r.projeto.pecas.find((x) => x.id === 'A')!.props as PropsReservatorio;
    expect(a.nivel!).toBeGreaterThanOrEqual(0);
  });
});

// ===========================================================================
// Arbitragem multi-sensor
// ===========================================================================
describe('arbitragem de bombas', () => {
  it('desligar tem prioridade absoluta sobre ligar', () => {
    expect(arbitrarBomba(['ligar', 'desligar'], true)).toBe(false);
    expect(arbitrarBomba(['ligar', 'ligar'], false)).toBe(true); // OR
    expect(arbitrarBomba(['manter'], true)).toBe(true); // mantém estado
    expect(arbitrarBomba([], false)).toBe(false);
  });

  it('sensor pede ligar abaixo do mínimo e desligar acima do máximo', () => {
    const s: PropsSensor = { bombaAlvo: 'P', nivelMinimo: 1, nivelMaximo: 4 };
    expect(avaliarSensor(s, 0.5, 0)).toBe('ligar');
    expect(avaliarSensor(s, 4.5, 0)).toBe('desligar');
    expect(avaliarSensor(s, 2, 0)).toBe('manter'); // banda morta (histerese)
  });

  it('integração: um sensor mandando desligar vence outro mandando ligar', () => {
    const r = tick(
      projeto(
        [
          res('BAIXO', { nivel: 0.5 }), // sensor pede LIGAR
          res('CHEIO', { nivel: 4.5 }), // sensor pede DESLIGAR
          res('DEST', {}),
          bomba('P', { ligada: true }),
          sensor('S1', { bombaAlvo: 'P', nivelMinimo: 1, nivelMaximo: 4 }),
          sensor('S2', { bombaAlvo: 'P', nivelMinimo: 1, nivelMaximo: 4 }),
        ],
        [
          criarConexao('BAIXO', 'P'),
          criarConexao('P', 'DEST'),
          criarConexao('S1', 'BAIXO'),
          criarConexao('S2', 'CHEIO'),
        ],
      ),
    );
    const p = r.projeto.pecas.find((x) => x.id === 'P')!.props as PropsBomba;
    expect(p.ligada).toBe(false);
    expect(r.vazoes['P']).toBe(0);
  });
});

// ===========================================================================
// Controle de velocidade (N ticks)
// ===========================================================================
describe('rodarTicks', () => {
  it('encadeia estado e acumula tempo', () => {
    const p = projeto([fonte('F', { vazaoFixa: 10 }), res('B', {})], [criarConexao('F', 'B')]);
    const r = rodarTicks(p, 5);
    expect(r.tempo).toBeCloseTo(0.5, 9); // 5 · dt(0.1)
    const b = r.projeto.pecas.find((x) => x.id === 'B')!.props as PropsReservatorio;
    expect(b.nivel!).toBeCloseTo((10 * 0.5) / 100, 9);
  });
});
