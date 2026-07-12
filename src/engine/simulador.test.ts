import { describe, it, expect, beforeEach } from 'vitest';
import { tick, rodarTicks } from './simulador';
import { areaTuboM2, vazaoMaxRecomendadaM3, velocidadeTuboMs } from './geometria';
import { arbitrarBomba, avaliarSensor, avaliarSequencia } from './arbitragem';
import {
  criarConexao,
  projetoVazio,
  _resetContadorIds,
} from '../domain/factory';
import { serializarProjeto } from '../domain/schema';
import type {
  CanalQuadro,
  Peca,
  ProjetoSimulacao,
  PropsBomba,
  PropsConsumo,
  PropsFonte,
  PropsReservatorio,
  PropsSensor,
  PropsTubo,
} from '../domain/types';

function consumo(id: string, props: PropsConsumo): Peca {
  return { id, tipo: 'consumo', x: 0, y: 0, props };
}

beforeEach(() => _resetContadorIds());

// --- Construtores enxutos para topologias de teste -------------------------

function res(id: string, over: Partial<PropsReservatorio> & { cota?: number }): Peca {
  const { cota, ...rest } = over;
  const props: PropsReservatorio = {
    formato: 'retangular',
    largura: 10,
    comprimento: 10, // área = 100
    alturaMaxima: 5,
    nivel: 0,
    ...rest,
  };
  return { id, tipo: 'reservatorio', x: 0, y: 0, cota: cota ?? 0, props };
}
function tubo(id: string, over: Partial<PropsTubo> = {}): Peca {
  // diâmetro em MILÍMETROS (100 mm = 0,1 m).
  return { id, tipo: 'tubo', x: 0, y: 0, props: { diametro: 100, ...over } };
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
  return { id, tipo: 'fonte', x: 0, y: 0, props: { gerador: { perfil: 'fixo', vazao: 5 }, ...over } };
}
function sensor(id: string, over: Partial<PropsSensor>): Peca {
  return {
    id,
    tipo: 'sensor',
    x: 0,
    y: 0,
    props: { bombasAlvo: [], ...over } as PropsSensor,
  };
}
function projeto(pecas: Peca[], conexoes = projetoVazio().conexoes): ProjetoSimulacao {
  // Testes em m³ + m → fatores de unidade 1 (física direta em SI).
  return {
    ...projetoVazio(),
    unidades: { volume: 'm3', comprimento: 'm' },
    pecas,
    conexoes,
  };
}

// ===========================================================================
// Vazão por Δh e diâmetro (Torricelli)
// ===========================================================================
describe('vazão por gravidade em tubo', () => {
  it('segue Q = A·√(2·g·Δh) com Δh = carga total', () => {
    const p = projeto(
      [
        res('A', { cota: 10, nivel: 2 }), // carga 12
        res('B', { cota: 0, nivel: 0 }), // carga 0
        tubo('T', { diametro: 100 }), // 100 mm = 0,1 m
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
          [res('A', { cota: 5, nivel: 2 }), res('B', {}), tubo('T', { diametro: d })],
          [criarConexao('A', 'T'), criarConexao('T', 'B')],
        ),
      ).vazoes['T']!;
    expect(mk(200)).toBeCloseTo(mk(100) * 4, 6); // diâmetro 2x → vazão 4x
  });

  it('não flui sem desnível (Δh = 0)', () => {
    const r = tick(
      projeto(
        [res('A', { cota: 0, nivel: 3 }), res('B', { cota: 0, nivel: 3 }), tubo('T')],
        [criarConexao('A', 'T'), criarConexao('T', 'B')],
      ),
    );
    expect(r.vazoes['T']).toBe(0);
  });

  it('registro fechado interrompe o fluxo', () => {
    const r = tick(
      projeto(
        [res('A', { cota: 5, nivel: 0 }), res('B', {}), tubo('T', { registro: { aberto: false } })],
        [criarConexao('A', 'T'), criarConexao('T', 'B')],
      ),
    );
    expect(r.vazoes['T']).toBe(0);
  });

  it('checkValve impede refluxo quando Δh < 0', () => {
    const p = () =>
      projeto(
        // B (com água) mais alto que A → sem check valve refluiria B→A.
        [res('A', { cota: 0, nivel: 0 }), res('B', { cota: 5, nivel: 2 }), tubo('T', { checkValve: true })],
        [criarConexao('A', 'T'), criarConexao('T', 'B')],
      );
    expect(tick(p()).vazoes['T']).toBe(0); // check valve bloqueia o refluxo
    // Sem check valve, o refluxo B→A acontece (B tem água).
    const semCv = p();
    (semCv.pecas.find((x) => x.id === 'T')!.props as PropsTubo).checkValve = false;
    expect(tick(semCv).vazoes['T']).toBeLessThan(0); // sinal negativo = refluxo
  });

  it('reservatório vazio não escoa pelo tubo, mesmo elevado (sem vazão fantasma)', () => {
    // A vazio mas elevado (carga positiva pela cota) não deve gerar fluxo.
    const r = tick(
      projeto(
        [res('A', { cota: 10, nivel: 0 }), res('B', { cota: 0, nivel: 0 }), tubo('T', { diametro: 200 })],
        [criarConexao('A', 'T'), criarConexao('T', 'B')],
      ),
    );
    expect(r.vazoes['T']).toBe(0);
    const b = r.projeto.pecas.find((x) => x.id === 'B')!.props as PropsReservatorio;
    expect(b.nivel ?? 0).toBe(0); // B não recebeu nada
  });
});

// ===========================================================================
// Golpe de aríete (indicador de risco permanente)
// ===========================================================================
describe('golpe de aríete (risco)', () => {
  const cenario = (over = {}) =>
    tick(
      projeto(
        [res('A', { cota: 10, nivel: 5 }), res('B', {}), tubo('T', { diametro: 100, ...over })],
        [criarConexao('A', 'T'), criarConexao('T', 'B')],
      ),
    );
  it('sinaliza tubo cuja parada súbita superaria o teto de pressão', () => {
    const r = cenario();
    expect(r.vazoes['T']!).toBeGreaterThan(0); // há fluxo (v alto por Torricelli)
    expect(r.golpeAriete).toContain('T'); // ΔP = ρ·a·v > 1000 kPa (PN10 padrão)
  });
  it('respeita a pressão nominal do tubo (teto alto → sem alerta)', () => {
    expect(cenario({ pressaoNominal: 1e7 }).golpeAriete).not.toContain('T');
  });
  it('sem fluxo, sem risco', () => {
    const r = tick(
      projeto(
        [res('A', { cota: 0, nivel: 3 }), res('B', { cota: 0, nivel: 3 }), tubo('T')],
        [criarConexao('A', 'T'), criarConexao('T', 'B')],
      ),
    );
    expect(r.golpeAriete).toHaveLength(0);
  });
});

// ===========================================================================
// Tubos em série (uma cadeia carrega UM fluxo, limitado pelo gargalo)
// ===========================================================================
describe('tubos em série entre reservatórios', () => {
  const perdaOrigem = (nivelInicial: number, r: ReturnType<typeof tick>): number =>
    nivelInicial - (r.projeto.pecas.find((x) => x.id === 'R1')!.props as PropsReservatorio).nivel!;

  it('dois tubos em série drenam IGUAL a um único (não dobram)', () => {
    const um = tick(
      projeto(
        [res('R1', { cota: 5, nivel: 3 }), res('R2', {}), tubo('T', { diametro: 100 })],
        [criarConexao('R1', 'T'), criarConexao('T', 'R2')],
      ),
    );
    const serie = tick(
      projeto(
        [res('R1', { cota: 5, nivel: 3 }), res('R2', {}), tubo('A', { diametro: 100 }), tubo('B', { diametro: 100 })],
        [criarConexao('R1', 'A'), criarConexao('A', 'B'), criarConexao('B', 'R2')],
      ),
    );
    expect(perdaOrigem(3, serie)).toBeCloseTo(perdaOrigem(3, um), 9);
  });

  it('com diâmetros diferentes, o cano mais estreito limita (independe da ordem)', () => {
    const soEstreito = tick(
      projeto(
        [res('R1', { cota: 5, nivel: 3 }), res('R2', {}), tubo('T', { diametro: 60 })],
        [criarConexao('R1', 'T'), criarConexao('T', 'R2')],
      ),
    ).vazoes['T']!;
    const cenario = (dA: number, dB: number) =>
      tick(
        projeto(
          [res('R1', { cota: 5, nivel: 3 }), res('R2', {}), tubo('A', { diametro: dA }), tubo('B', { diametro: dB })],
          [criarConexao('R1', 'A'), criarConexao('A', 'B'), criarConexao('B', 'R2')],
        ),
      );
    const largoEstreito = cenario(150, 60);
    const estreitoLargo = cenario(60, 150);
    expect(largoEstreito.vazoes['A']).toBeCloseTo(soEstreito, 9); // limitado pelos 60 mm
    expect(estreitoLargo.vazoes['A']).toBeCloseTo(soEstreito, 9); // idem, ordem inversa
    expect(largoEstreito.vazoes['A']).toBeCloseTo(largoEstreito.vazoes['B']!, 9); // cadeia toda igual
  });

  it('registro fechado no meio quebra a cadeia (sem fluxo)', () => {
    const r = tick(
      projeto(
        [res('R1', { cota: 5, nivel: 3 }), res('R2', {}), tubo('A', { diametro: 100 }), tubo('B', { diametro: 100, registro: { aberto: false } })],
        [criarConexao('R1', 'A'), criarConexao('A', 'B'), criarConexao('B', 'R2')],
      ),
    );
    expect(perdaOrigem(3, r)).toBeCloseTo(0, 9);
    expect(r.vazoes['A'] ?? 0).toBe(0);
  });
});

// ===========================================================================
// Junção divide (bifurca) e soma (une) a vazão, conservando massa
// ===========================================================================
describe('junção divide e soma vazão', () => {
  const juncao = (id: string, diametro?: number): Peca => ({
    id,
    tipo: 'juncao',
    x: 0,
    y: 0,
    props: diametro ? { diametro } : {},
  });
  const nivelDe = (r: ReturnType<typeof tick>, id: string): number =>
    (r.projeto.pecas.find((x) => x.id === id)!.props as PropsReservatorio).nivel ?? 0;

  it('junção com diâmetro estrangula o fluxo (gargalo no nó)', () => {
    const cenario = (jdiam?: number) =>
      tick(
        projeto(
          [res('R1', { cota: 5, nivel: 3 }), res('R2', {}), tubo('t1', { diametro: 100 }), juncao('J', jdiam), tubo('t2', { diametro: 100 })],
          [criarConexao('R1', 't1'), criarConexao('t1', 'J'), criarConexao('J', 't2'), criarConexao('t2', 'R2')],
        ),
      );
    const semDiam = 3 - nivelDe(cenario(undefined), 'R1');
    const estreita = 3 - nivelDe(cenario(20), 'R1'); // junção DN20 vira o gargalo
    expect(estreita).toBeGreaterThan(0);
    expect(estreita).toBeLessThan(semDiam * 0.2); // (20/100)² ≈ 4% da área
  });

  it('bifurcação: os dois destinos enchem e a massa conserva', () => {
    const r = tick(
      projeto(
        [
          res('R1', { cota: 10, nivel: 5 }),
          res('R2', { nivel: 0 }),
          res('R3', { nivel: 0 }),
          tubo('tin'),
          juncao('J'),
          tubo('t2'),
          tubo('t3'),
        ],
        [
          criarConexao('R1', 'tin'),
          criarConexao('tin', 'J'),
          criarConexao('J', 't2'),
          criarConexao('t2', 'R2'),
          criarConexao('J', 't3'),
          criarConexao('t3', 'R3'),
        ],
      ),
    );
    const g2 = nivelDe(r, 'R2');
    const g3 = nivelDe(r, 'R3');
    expect(g2).toBeGreaterThan(1e-9);
    expect(g3).toBeGreaterThan(1e-9);
    expect(5 - nivelDe(r, 'R1')).toBeCloseTo(g2 + g3, 8); // massa conservada
  });

  it('união: as duas origens esvaziam e somam no destino', () => {
    const r = tick(
      projeto(
        [
          res('R1', { cota: 10, nivel: 5 }),
          res('R2', { cota: 10, nivel: 5 }),
          res('R3', { nivel: 0 }),
          tubo('t1'),
          tubo('t2'),
          juncao('J'),
          tubo('tout'),
        ],
        [
          criarConexao('R1', 't1'),
          criarConexao('t1', 'J'),
          criarConexao('R2', 't2'),
          criarConexao('t2', 'J'),
          criarConexao('J', 'tout'),
          criarConexao('tout', 'R3'),
        ],
      ),
    );
    const p1 = 5 - nivelDe(r, 'R1');
    const p2 = 5 - nivelDe(r, 'R2');
    expect(p1).toBeGreaterThan(1e-9);
    expect(p2).toBeGreaterThan(1e-9);
    expect(p1 + p2).toBeCloseTo(nivelDe(r, 'R3'), 8); // massa conservada
  });

  it('ramo com registro fechado é zerado; o aberto leva tudo (massa conserva)', () => {
    const r = tick(
      projeto(
        [
          res('R1', { cota: 10, nivel: 5 }),
          res('R2', { nivel: 0 }),
          res('R3', { nivel: 0 }),
          tubo('tin'),
          juncao('J'),
          tubo('t2'),
          tubo('t3', { registro: { aberto: false } }),
        ],
        [
          criarConexao('R1', 'tin'),
          criarConexao('tin', 'J'),
          criarConexao('J', 't2'),
          criarConexao('t2', 'R2'),
          criarConexao('J', 't3'),
          criarConexao('t3', 'R3'),
        ],
      ),
    );
    expect(nivelDe(r, 'R3')).toBeCloseTo(0, 12); // ramo fechado: zerado
    expect(r.vazoes['t3'] ?? 0).toBe(0);
    expect(nivelDe(r, 'R2')).toBeGreaterThan(1e-9); // ramo aberto leva tudo
    expect(5 - nivelDe(r, 'R1')).toBeCloseTo(nivelDe(r, 'R2'), 8); // massa conservada
  });

  it('bifurcação com diâmetros diferentes: o ramo mais largo leva mais', () => {
    const r = tick(
      projeto(
        [
          res('R1', { cota: 10, nivel: 5 }),
          res('R2', { nivel: 0 }),
          res('R3', { nivel: 0 }),
          tubo('tin', { diametro: 200 }),
          juncao('J'),
          tubo('t2', { diametro: 100 }),
          tubo('t3', { diametro: 50 }),
        ],
        [
          criarConexao('R1', 'tin'),
          criarConexao('tin', 'J'),
          criarConexao('J', 't2'),
          criarConexao('t2', 'R2'),
          criarConexao('J', 't3'),
          criarConexao('t3', 'R3'),
        ],
      ),
    );
    expect(nivelDe(r, 'R2')).toBeGreaterThan(nivelDe(r, 'R3')); // 100 mm leva mais que 50 mm
  });
});

// ===========================================================================
// Terminais (consumo/fonte/bomba) na REDE de junções + refluxo
// ===========================================================================
describe('terminal na rede de junções', () => {
  const juncao = (id: string): Peca => ({ id, tipo: 'juncao', x: 0, y: 0, props: {} });
  const nivelDe = (r: ReturnType<typeof tick>, id: string): number =>
    (r.projeto.pecas.find((x) => x.id === id)!.props as PropsReservatorio).nivel ?? 0;

  it('consumo puxando de uma união reflui o ramo alto para o ramo baixo', () => {
    // R_sup (alto) e R_meio (baixo) unem em J; um consumo pequeno puxa de J. O R_sup fornece MAIS que o consumo → o excedente reflui J→R_meio, enchendo o
    // ramo baixo CONTRA a seta (R_meio→t_meio→J). Deve marcar t_meio como refluxo.
    const r = tick(
      projeto(
        [
          res('R_sup', { cota: 10, nivel: 5 }), // carga 15 m
          res('R_meio', { cota: 0, nivel: 1 }), // carga 1 m
          juncao('J'),
          tubo('t_sup'),
          tubo('t_meio'),
          { id: 'C', tipo: 'consumo', x: 0, y: 0, props: { gerador: { perfil: 'fixo', vazao: 0.05 }, aberto: true } },
        ],
        [
          criarConexao('R_sup', 't_sup'),
          criarConexao('t_sup', 'J'),
          criarConexao('R_meio', 't_meio'),
          criarConexao('t_meio', 'J'),
          criarConexao('J', 'C'),
        ],
      ),
    );
    expect(r.refluxos).toContain('t_meio'); // fluindo contra a seta (J→R_meio)
    expect(nivelDe(r, 'R_meio')).toBeGreaterThan(1); // ramo baixo é INUNDADO
    expect(nivelDe(r, 'R_sup')).toBeLessThan(5); // ramo alto esvazia
    expect(r.vazoes['C']).toBeCloseTo(0.05, 6); // consumo recebe sua demanda
    // Massa: o que sai do R_sup = consumo + o que entra no R_meio.
    const saiuSup = (5 - nivelDe(r, 'R_sup')) * 100; // Δvolume (área 100)
    const entrouMeio = (nivelDe(r, 'R_meio') - 1) * 100;
    const consumido = 0.05 * r.projeto.configuracaoSimulacao.dt;
    expect(saiuSup).toBeCloseTo(consumido + entrouMeio, 6);
  });

  it('tubo entre junção e consumo marca o SENTIDO NORMAL (não é refluxo)', () => {
    // Consumo puxa da junção POR UM TUBO (como o "registro de consumo" do exemplo): a água vai J→tubo→consumo, no sentido da seta. A telemetria do run de terminal
    // invertia o sinal e pintava esse tubo de refluxo (violeta) sem ser — regressão do sinal, agora corrigida.
    const r = tick(
      projeto(
        [
          res('R_sup', { cota: 10, nivel: 5 }),
          juncao('J'),
          tubo('t_sup'),
          tubo('t_cons'), // tubo entre a junção e o consumo
          { id: 'C', tipo: 'consumo', x: 0, y: 0, props: { gerador: { perfil: 'fixo', vazao: 0.05 }, aberto: true } },
        ],
        [
          criarConexao('R_sup', 't_sup'),
          criarConexao('t_sup', 'J'),
          criarConexao('J', 't_cons'),
          criarConexao('t_cons', 'C'),
        ],
      ),
    );
    expect(r.vazoes['t_cons']).toBeGreaterThan(0); // sentido normal J→consumo (a favor da seta)
    expect(r.refluxos).not.toContain('t_cons'); // não é refluxo
    expect(r.vazoes['C']).toBeCloseTo(0.05, 6); // consumo recebe sua demanda
  });

  it('sem refluxo quando o consumo excede o que o ramo alto entrega', () => {
    // Consumo grande: os DOIS ramos alimentam a junção normalmente (nenhum reflui).
    const r = tick(
      projeto(
        [
          res('R_sup', { cota: 10, nivel: 5 }),
          res('R_meio', { cota: 10, nivel: 5 }),
          juncao('J'),
          tubo('t_sup'),
          tubo('t_meio'),
          { id: 'C', tipo: 'consumo', x: 0, y: 0, props: { gerador: { perfil: 'fixo', vazao: 100 }, aberto: true } },
        ],
        [
          criarConexao('R_sup', 't_sup'),
          criarConexao('t_sup', 'J'),
          criarConexao('R_meio', 't_meio'),
          criarConexao('t_meio', 'J'),
          criarConexao('J', 'C'),
        ],
      ),
    );
    expect(r.refluxos).toHaveLength(0);
    expect(nivelDe(r, 'R_sup')).toBeLessThan(5); // ambos esvaziam
    expect(nivelDe(r, 'R_meio')).toBeLessThan(5);
  });

  it('reservatório vazio na união não fornece (sem fluxo fantasma)', () => {
    // R_sup está VAZIO (nível 0) mas com cota alta (10). O solver não pode usar a cota de fundo como carga e empurrar água que não existe: o superior vazio
    // não fornece, então não há refluxo para o meio nem dreno do tanque vazio.
    const r = tick(
      projeto(
        [
          res('R_sup', { cota: 10, nivel: 0 }), // vazio, cota alta
          res('R_meio', { cota: 0, nivel: 3 }),
          juncao('J'),
          tubo('t_sup'),
          tubo('t_meio'),
          { id: 'C', tipo: 'consumo', x: 0, y: 0, props: { gerador: { perfil: 'fixo', vazao: 0.02 }, aberto: true } },
        ],
        [
          criarConexao('R_sup', 't_sup'),
          criarConexao('t_sup', 'J'),
          criarConexao('R_meio', 't_meio'),
          criarConexao('t_meio', 'J'),
          criarConexao('J', 'C'),
        ],
      ),
    );
    expect(r.refluxos).toHaveLength(0); // nada reflui para o meio
    expect(nivelDe(r, 'R_sup')).toBe(0); // vazio continua vazio (não fornece nem dá fantasma)
    expect(nivelDe(r, 'R_meio')).toBeLessThan(3); // meio alimenta o consumo (só perde)
    expect(Math.abs(r.vazoes['t_sup'] ?? 0)).toBe(0); // aresta do superior vazio: sem vazão
  });

  it('reservatório não fornece por uma tomada acima do seu nível (rede)', () => {
    // R_sup tem carga alta (cota 10 + nível 2), mas a saída para a rede é uma tomada em 4 — acima do nível 2. Sem água acima do bocal, não pode fornecer:
    // a aresta fica em 0 (nada de fluxo/refluxo fantasma para o meio).
    const r = tick(
      projeto(
        [
          res('R_sup', { cota: 10, nivel: 2 }),
          res('R_meio', { cota: 0, nivel: 3 }),
          juncao('J'),
          tubo('t_sup', { alturaEntrada: 4 }), // tomada alta no lado do R_sup
          tubo('t_meio'),
          { id: 'C', tipo: 'consumo', x: 0, y: 0, props: { gerador: { perfil: 'fixo', vazao: 0.02 }, aberto: true } },
        ],
        [
          criarConexao('R_sup', 't_sup'),
          criarConexao('t_sup', 'J'),
          criarConexao('R_meio', 't_meio'),
          criarConexao('t_meio', 'J'),
          criarConexao('J', 'C'),
        ],
      ),
    );
    expect(Math.abs(r.vazoes['t_sup'] ?? 0)).toBeLessThan(1e-6); // abaixo da tomada: não fornece
    expect(nivelDe(r, 'R_sup')).toBe(2); // intocado
    expect(nivelDe(r, 'R_meio')).toBeLessThan(3); // o meio alimenta o consumo
    expect(r.refluxos).toHaveLength(0);
  });

  it('conserva massa ao longo do tempo mesmo com o ramo alto esvaziando', () => {
    // Regressão do fluxo fantasma: o superior (pequeno) esvazia refluindo pela União para o meio enquanto alimenta o consumo. Ao esvaziar, o dreno do
    // superior é limitado pelo volume — o que ENTRA no meio precisa cair junto, senão surge água do nada. Somando tudo: o ganho líquido dos reservatórios
    // deve igualar −(consumido), sem fonte no cenário.
    let proj: ProjetoSimulacao = {
      ...projetoVazio(),
      unidades: { volume: 'm3', comprimento: 'm' },
      pecas: [
        res('R_sup', { cota: 10, nivel: 2, largura: 1, comprimento: 1 }), // pequeno, alto
        res('R_meio', { cota: 0, nivel: 1 }),
        juncao('J'),
        tubo('t_sup'),
        tubo('t_meio'),
        { id: 'C', tipo: 'consumo', x: 0, y: 0, props: { gerador: { perfil: 'fixo', vazao: 0.03 }, aberto: true } },
      ],
      conexoes: [
        criarConexao('R_sup', 't_sup'),
        criarConexao('t_sup', 'J'),
        criarConexao('R_meio', 't_meio'),
        criarConexao('t_meio', 'J'),
        criarConexao('J', 'C'),
      ],
    };
    const volDe = (p: ProjetoSimulacao): number => {
      const rsup = p.pecas.find((x) => x.id === 'R_sup')!.props as PropsReservatorio;
      const rmeio = p.pecas.find((x) => x.id === 'R_meio')!.props as PropsReservatorio;
      return 1 * (rsup.nivel ?? 0) + 100 * (rmeio.nivel ?? 0); // áreas 1 e 100
    };
    const dt = proj.configuracaoSimulacao.dt;
    const volInicial = volDe(proj);
    let consumido = 0;
    let t = 0;
    for (let i = 0; i < 400; i++) {
      const r = tick(proj, t);
      consumido += (r.vazoes['C'] ?? 0) * dt;
      proj = r.projeto;
      t = r.tempo;
    }
    // Sem fonte: a variação de volume dos reservatórios = −(consumido de fato).
    // O consumido "de fato" pode ser menor que a demanda quando o superior seca, então checamos a conservação com o volume que realmente saiu do sistema.
    const perdaReservatorios = volInicial - volDe(proj);
    expect(perdaReservatorios).toBeGreaterThan(0);
    expect(perdaReservatorios).toBeLessThanOrEqual(consumido + 1e-6); // nunca perde MAIS que o consumido (sem sumiço)
    expect(perdaReservatorios).toBeGreaterThan(consumido - 0.05); // e não some água a granel
  });

  it('fonte ligada a uma junção abastece o reservatório da rede', () => {
    const r = tick(
      projeto(
        [
          res('R', { nivel: 0 }),
          juncao('J'),
          tubo('tout'),
          fonte('F', { gerador: { perfil: 'fixo', vazao: 3 } }),
        ],
        [
          criarConexao('F', 'J'),
          criarConexao('J', 'tout'),
          criarConexao('tout', 'R'),
        ],
      ),
    );
    expect(nivelDe(r, 'R')).toBeGreaterThan(0); // fonte injeta na junção → enche R
    const entrou = nivelDe(r, 'R') * 100;
    expect(entrou).toBeCloseTo(3 * r.projeto.configuracaoSimulacao.dt, 6); // vazão da fonte
  });

  it('anota a vazão no cano de sucção da bomba na rede (não fica zerado)', () => {
    // Bomba que descarrega numa JUNÇÃO (como no exemplo): os canos de sucção ficam fora da rede da junção — antes apareciam zerados mesmo com a bomba
    // ligada. Agora carregam a vazão entregue.
    const r = tick(
      projeto(
        [
          res('inf', { nivel: 5 }),
          res('sup', { cota: 5, nivel: 0 }),
          tubo('succao'),
          bomba('P', { ligada: true, vazaoNominal: 10 }),
          juncao('J'),
          tubo('rec'),
        ],
        [
          criarConexao('inf', 'succao'),
          criarConexao('succao', 'P'),
          criarConexao('P', 'J'),
          criarConexao('J', 'rec'),
          criarConexao('rec', 'sup'),
        ],
      ),
    );
    expect(r.vazoes['P']).toBeGreaterThan(0); // a bomba entrega
    expect(r.vazoes['succao']).toBeGreaterThan(0); // a sucção NÃO fica zerada
    expect(r.vazoes['succao']).toBeCloseTo(r.vazoes['P']!, 6); // = vazão entregue
  });

  it('ponto de operação: cano restritivo (recalque/sucção) reduz a vazão da bomba', () => {
    // Bomba (curva inclinada) sucção `inf`→ descarrega na junção J → recalque `rec` → `sup`. Com o atrito ligado, um cano de RECALQUE ou de SUCÇÃO mais
    // restritivo (longo) sobe a perda de carga do sistema e a bomba encontra o ponto de operação numa vazão MENOR — a curva da bomba ∩ a curva do sistema.
    const cenario = (atrito: boolean, compRec: number, compSuc: number) =>
      tick({
        ...projeto(
          [
            res('inf', { nivel: 5 }),
            res('sup', { cota: 8, nivel: 0 }),
            tubo('succao', { diametro: 100, comprimento: compSuc }),
            // curva inclinada: kEff = vazaoNominal/alturaNominal = 30/20 = 1,5.
            bomba('P', { ligada: true, vazaoNominal: 30, alturaNominal: 20 }),
            juncao('J'),
            tubo('rec', { diametro: 100, comprimento: compRec }),
          ],
          [
            criarConexao('inf', 'succao'),
            criarConexao('succao', 'P'),
            criarConexao('P', 'J'),
            criarConexao('J', 'rec'),
            criarConexao('rec', 'sup'),
          ],
        ),
        configuracaoSimulacao: { dt: 0.1, g: 9.81, atrito },
      });

    const curto = cenario(true, 1, 1); // recalque/sucção curtos → pouca perda
    const recLongo = cenario(true, 200, 1); // recalque longo → mais perda
    const sucLongo = cenario(true, 1, 200); // sucção longa → mais perda
    expect(curto.vazoes['P']).toBeGreaterThan(0);
    // Recalque restritivo reduz a vazão entregue pela bomba.
    expect(recLongo.vazoes['P']).toBeLessThan(curto.vazoes['P']!);
    // Sucção restritiva também (o atrito da sucção entra no ponto de operação).
    expect(sucLongo.vazoes['P']).toBeLessThan(curto.vazoes['P']!);
    // A sucção sempre carrega a mesma vazão que a bomba entrega.
    expect(recLongo.vazoes['succao']).toBeCloseTo(recLongo.vazoes['P']!, 6);

    // Sem atrito, o comprimento é ignorado: a vazão não muda com o recalque longo.
    const semCurto = cenario(false, 1, 1);
    const semLongo = cenario(false, 200, 1);
    expect(semLongo.vazoes['P']).toBeCloseTo(semCurto.vazoes['P']!, 6);
  });
});

// ===========================================================================
// Altura de conexão do tubo (tomada em altura nas pontas)
// ===========================================================================
describe('altura de conexão do tubo', () => {
  it('tomada de entrada em altura só drena a água acima do bocal (para nesse nível)', () => {
    const p = projeto(
      // A (tanque pequeno) → tubo (entrada a 2 m) → ambiente. Drena de 4 até ~2.
      [res('A', { largura: 1, comprimento: 1, cota: 0, nivel: 4, alturaMaxima: 5 }), tubo('T', { diametro: 200, alturaEntrada: 2 })],
      [criarConexao('A', 'T')],
    );
    const r = rodarTicks(p, 3000);
    const a = r.projeto.pecas.find((x) => x.id === 'A')!.props as PropsReservatorio;
    expect(a.nivel!).toBeGreaterThan(1.9);
    expect(a.nivel!).toBeLessThan(2.1); // parou na altura da tomada, não esvaziou
  });

  it('bocal alto no destino exige carga: não empurra acima da superfície da origem', () => {
    const r = tick(
      projeto(
        [
          res('A', { cota: 0, nivel: 3 }),
          res('B', { cota: 0, nivel: 0, alturaMaxima: 10 }),
          tubo('T', { diametro: 200, alturaSaida: 5 }), // bocal do destino na elevação 5
        ],
        [criarConexao('A', 'T'), criarConexao('T', 'B')],
      ),
    );
    expect(r.vazoes['T']).toBe(0); // superfície de A (3) abaixo do bocal do destino (5)
  });

  it('com bocais no fundo (0) o comportamento é o de sempre', () => {
    const semAltura = tick(
      projeto(
        [res('A', { cota: 5, nivel: 2 }), res('B', {}), tubo('T', { diametro: 100 })],
        [criarConexao('A', 'T'), criarConexao('T', 'B')],
      ),
    ).vazoes['T'];
    const comAltura0 = tick(
      projeto(
        [res('A', { cota: 5, nivel: 2 }), res('B', {}), tubo('T', { diametro: 100, alturaEntrada: 0, alturaSaida: 0 })],
        [criarConexao('A', 'T'), criarConexao('T', 'B')],
      ),
    ).vazoes['T'];
    expect(comAltura0).toBeCloseTo(semAltura!, 9);
  });
});

// ===========================================================================
// Bomba com/sem curva
// ===========================================================================
describe('bomba', () => {
  it('entrega vazaoNominal sem curva, sentido forçado', () => {
    const r = tick(
      projeto(
        [res('A', { nivel: 5 }), res('B', { cota: 10, nivel: 0 }), bomba('P', { ligada: true })],
        [criarConexao('A', 'P'), criarConexao('P', 'B')],
      ),
    );
    expect(r.vazoes['P']).toBe(10); // sobe mesmo contra a gravidade
  });

  it('reduz vazão pela curva vazaoNominal - k·Δh_lift', () => {
    const r = tick(
      projeto(
        [
          res('A', { cota: 0, nivel: 5 }), // carga 5
          res('B', { cota: 10, nivel: 0 }), // carga 10 → lift 5
          bomba('P', { ligada: true, vazaoNominal: 10, curva: { k: 1 } }),
        ],
        [criarConexao('A', 'P'), criarConexao('P', 'B')],
      ),
    );
    expect(r.vazoes['P']).toBeCloseTo(5, 6); // 10 - 1·5
  });

  it('altura nominal deriva a curva (a altura de recalque reduz a vazão sozinha)', () => {
    const r = tick(
      projeto(
        [
          res('A', { cota: 0, nivel: 5 }), // carga 5
          res('B', { cota: 10, nivel: 0 }), // carga 10 → lift 5
          // alturaNominal 20 → k = 10/20 = 0,5; lift 5 → Q = 10·(1 − 5/20) = 7,5.
          bomba('P', { ligada: true, vazaoNominal: 10, alturaNominal: 20 }),
        ],
        [criarConexao('A', 'P'), criarConexao('P', 'B')],
      ),
    );
    expect(r.vazoes['P']).toBeCloseTo(7.5, 6);
  });

  it('altura nominal tem precedência sobre curva.k explícita', () => {
    const r = tick(
      projeto(
        [
          res('A', { cota: 0, nivel: 5 }),
          res('B', { cota: 10, nivel: 0 }), // lift 5
          bomba('P', { ligada: true, vazaoNominal: 10, alturaNominal: 20, curva: { k: 5 } }),
        ],
        [criarConexao('A', 'P'), criarConexao('P', 'B')],
      ),
    );
    // Usa a alturaNominal (Q=7,5), não o curva.k=5 (que daria 10−25 → 0).
    expect(r.vazoes['P']).toBeCloseTo(7.5, 6);
  });

  it('ponto de operação: com atrito, sucção e recalque restritivos reduzem a vazão', () => {
    // Bomba direta A→P→B (sem junção). Com o atrito ligado, um cano de SUCÇÃO ou de RECALQUE mais restritivo (longo) sobe a perda de carga e a bomba opera
    // numa vazão MENOR que a puramente estática (curva ∩ sistema).
    const cenario = (atrito: boolean, compSuc: number, compRec: number) =>
      tick({
        ...projeto(
          [
            res('A', { cota: 0, nivel: 5 }), // carga 5
            res('B', { cota: 10, nivel: 0 }), // carga 10 → lift 5
            tubo('suc', { diametro: 100, comprimento: compSuc }),
            bomba('P', { ligada: true, vazaoNominal: 30, alturaNominal: 20 }), // k=1,5
            tubo('rec', { diametro: 100, comprimento: compRec }),
          ],
          [criarConexao('A', 'suc'), criarConexao('suc', 'P'), criarConexao('P', 'rec'), criarConexao('rec', 'B')],
        ),
        configuracaoSimulacao: { dt: 0.1, g: 9.81, atrito },
      });

    // Sem atrito: só a altura estática (lift 5) → Q = 30·(1 − 5/20) = 22,5.
    expect(cenario(false, 1, 1).vazoes['P']).toBeCloseTo(22.5, 6);
    // Sem atrito o comprimento é irrelevante.
    expect(cenario(false, 500, 500).vazoes['P']).toBeCloseTo(22.5, 6);

    const curto = cenario(true, 1, 1).vazoes['P']!;
    expect(curto).toBeGreaterThan(0);
    expect(curto).toBeLessThan(22.5); // até o cano curto tem alguma perda
    // Recalque restritivo reduz a entrega (pergunta: cano de saída limita a bomba).
    expect(cenario(true, 1, 300).vazoes['P']).toBeLessThan(curto);
    // Sucção restritiva também (pergunta: cano de entrada limita a bomba).
    expect(cenario(true, 300, 1).vazoes['P']).toBeLessThan(curto);
  });

  it('nunca gera vazão negativa (curva satura em 0)', () => {
    const r = tick(
      projeto(
        [res('A', { nivel: 5 }), res('B', { cota: 100, nivel: 0 }), bomba('P', { ligada: true, curva: { k: 1 } })],
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

  it('manda a vazão cheia pela saída aberta quando a outra está fechada', () => {
    const r = tick(
      projeto(
        [
          res('A', { nivel: 5 }),
          res('B', {}),
          res('C', {}),
          bomba('P', { ligada: true, vazaoNominal: 8 }),
          tubo('rec_b', { registro: { aberto: false } }), // saída para B fechada
          tubo('rec_c', { registro: { aberto: true } }),
        ],
        [
          criarConexao('A', 'P'),
          criarConexao('P', 'rec_b'),
          criarConexao('rec_b', 'B'),
          criarConexao('P', 'rec_c'),
          criarConexao('rec_c', 'C'),
        ],
      ),
    );
    // C (única saída aberta) recebe os 8 inteiros — a saída fechada não
    // desperdiça metade da vazão.
    expect(r.vazoes['P']).toBeCloseTo(8, 9);
    const b = r.projeto.pecas.find((x) => x.id === 'B')!.props as PropsReservatorio;
    const c = r.projeto.pecas.find((x) => x.id === 'C')!.props as PropsReservatorio;
    expect(b.nivel ?? 0).toBe(0); // B não recebe nada
    expect(c.nivel!).toBeCloseTo((8 * 0.1) / 100, 9);
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

  describe('modo de controle (Automático / Ligado / Desligado)', () => {
    it("'desligado' força a bomba parada mesmo com sensor pedindo ligar", () => {
      const r = tick(
        projeto(
          [
            res('A', { nivel: 5 }),
            res('B', { nivel: 0 }),
            bomba('P', { ligada: true, modoControle: 'desligado' }),
            sensor('S', { bombasAlvo: ['P'], nivelMinimo: 3, nivelMaximo: 4 }),
          ],
          [criarConexao('A', 'P'), criarConexao('P', 'B'), criarConexao('S', 'B')],
        ),
      );
      expect(r.vazoes['P']).toBe(0);
      expect((r.projeto.pecas.find((x) => x.id === 'P')!.props as PropsBomba).ligada).toBe(false);
    });

    it("'ligado' força a bomba a funcionar sem sensor", () => {
      const r = tick(
        projeto(
          [res('A', { nivel: 5 }), res('B', {}), bomba('P', { modoControle: 'ligado', vazaoNominal: 8 })],
          [criarConexao('A', 'P'), criarConexao('P', 'B')],
        ),
      );
      expect(r.vazoes['P']).toBeCloseTo(8, 9);
    });

    it("'ligado' com a origem vazia roda a seco (vazão 0 + alerta)", () => {
      const r = tick(
        projeto(
          [res('A', { nivel: 0 }), res('B', {}), bomba('P', { modoControle: 'ligado' })],
          [criarConexao('A', 'P'), criarConexao('P', 'B')],
        ),
      );
      expect(r.vazoes['P']).toBe(0);
      expect(r.bombasASeco).toContain('P'); // rodando a seco (origem vazia)
    });
  });

  describe('bomba empurrando para consumo', () => {
    // A(reservatório) → suc → P(bomba) → C(consumo)
    const cenario = (demanda: number, ligada: boolean, vazaoNominal = 10) =>
      projeto(
        [
          res('A', { nivel: 5 }),
          tubo('suc', {}),
          bomba('P', { ligada, vazaoNominal }),
          { id: 'C', tipo: 'consumo', x: 0, y: 0, props: { gerador: { perfil: 'fixo', vazao: demanda }, aberto: true } },
        ],
        [criarConexao('A', 'suc'), criarConexao('suc', 'P'), criarConexao('P', 'C')],
      );

    it('demanda < vazão da bomba → entrega a demanda', () => {
      const r = tick(cenario(3, true, 10));
      expect(r.vazoes['P']).toBeCloseTo(3, 9);
      expect(r.consumoInsuficiente).not.toContain('C');
    });

    it('demanda > vazão da bomba → entrega a vazão da bomba e alerta déficit', () => {
      const r = tick(cenario(25, true, 10));
      expect(r.vazoes['P']).toBeCloseTo(10, 9); // a bomba não acompanha
      expect(r.consumoInsuficiente).toContain('C');
    });

    it('consumo 0 → a bomba não empurra nada (nem drena a origem)', () => {
      const r = tick(cenario(0, true));
      expect(r.vazoes['P']).toBe(0);
      const a = r.projeto.pecas.find((x) => x.id === 'A')!.props as PropsReservatorio;
      expect(a.nivel!).toBeCloseTo(5, 9); // origem intacta
    });

    it('bomba desligada não drena a origem pelo cano de sucção', () => {
      const r = tick(cenario(5, false));
      expect(r.vazoes['P']).toBe(0);
      const a = r.projeto.pecas.find((x) => x.id === 'A')!.props as PropsReservatorio;
      expect(a.nivel!).toBeCloseTo(5, 9);
    });
  });
});

// ===========================================================================
// Fonte com múltiplos destinos
// ===========================================================================
describe('fonte', () => {
  it('divide a vazão entre destinos conforme vazaoAlocada', () => {
    const r = tick(
      projeto(
        [fonte('F', { gerador: { perfil: 'fixo', vazao: 10 } }), res('B', {}), res('C', {})],
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
      projeto([fonte('F', { gerador: { perfil: 'fixo', vazao: 8 } }), res('B', {})], [criarConexao('F', 'B')]),
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
        [fonte('F', { gerador: { perfil: 'fixo', vazao: 100000 } }), res('B', { alturaMaxima: 5 })],
        [criarConexao('F', 'B')],
      ),
    );
    const b = r.projeto.pecas.find((x) => x.id === 'B')!.props as PropsReservatorio;
    expect(b.nivel!).toBeCloseTo(5, 9); // clampa exatamente na alturaMaxima
    expect(r.overflow).toContain('B');
  });
});

// ===========================================================================
// Rodando a seco (origem vazia) — sem proteção automática; alerta/log
// ===========================================================================
describe('bomba rodando a seco', () => {
  it('origem vazia com a bomba ligada → vazão 0 e alerta (a bomba não se desliga)', () => {
    const r = tick(
      projeto(
        [res('A', { nivel: 0 }), res('B', {}), bomba('P', { ligada: true })],
        [criarConexao('A', 'P'), criarConexao('P', 'B')],
      ),
    );
    expect(r.vazoes['P']).toBe(0); // sem água → não move nada (sem fantasma)
    expect(r.bombasASeco).toContain('P'); // sinaliza rodando a seco (para log/UI)
    const p = r.projeto.pecas.find((x) => x.id === 'P')!.props as PropsBomba;
    expect(p.ligada).toBe(true); // NÃO desliga sozinha — proteção é via sensor reverso
  });

  it('com água na origem, a bomba funciona e não sinaliza a seco', () => {
    const r = tick(
      projeto(
        [res('A', { nivel: 3 }), res('B', {}), bomba('P', { ligada: true, vazaoNominal: 5 })],
        [criarConexao('A', 'P'), criarConexao('P', 'B')],
      ),
    );
    expect(r.vazoes['P']).toBeCloseTo(5, 9);
    expect(r.bombasASeco).not.toContain('P');
  });
});

// ===========================================================================
// Boia (válvula de nível) num tubo entre a fonte e o reservatório
// ===========================================================================
describe('boia em tubo alimentado por fonte', () => {
  const cenario = (nivelDestino: number) =>
    projeto(
      [
        fonte('F', { gerador: { perfil: 'fixo', vazao: 5 } }),
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

  it('atribui a vazão ao cano atravessado pela fonte (para animar o fluxo)', () => {
    const r = tick(cenario(0.5)); // fluindo
    expect(r.vazoes['T']).toBe(5); // o tubo reporta a vazão que a fonte empurra
  });

  it('tubo alimentado por fonte não drena o reservatório por conta própria', () => {
    // Sem a fonte empurrando (fonte fechada por boia cheia), o reservatório
    // não pode perder água pelo tubo de montante.
    const r = tick(cenario(3));
    expect(r.vazoes['T']).toBe(0);
  });
});

// ===========================================================================
// Boia (válvula de nível) num tubo ENTRE reservatórios (fluxo por gravidade)
// ===========================================================================
describe('boia em tubo entre reservatórios', () => {
  const cenario = (nivelB: number) =>
    projeto(
      [
        res('A', { cota: 10, nivel: 5 }), // alto e cheio
        tubo('T', { diametro: 100, boia: { nivelMinimo: 1, nivelMaximo: 2 } }),
        res('B', { cota: 0, nivel: nivelB, alturaMaxima: 5 }),
      ],
      [criarConexao('A', 'T'), criarConexao('T', 'B')],
    );

  it('fecha o tubo quando o destino atinge o máximo', () => {
    expect(tick(cenario(2)).vazoes['T']).toBe(0); // 2 ≥ máximo
    expect(tick(cenario(0)).vazoes['T']).toBeGreaterThan(0); // vazio → flui
  });

  it('não deixa o destino ultrapassar o nível da boia ao longo do tempo', () => {
    const r = rodarTicks(cenario(0), 500);
    const b = r.projeto.pecas.find((x) => x.id === 'B')!.props as PropsReservatorio;
    expect(b.nivel!).toBeLessThanOrEqual(2.05); // segurou perto do máximo (2)
  });

  it('reporta a boia como fechada quando o destino está cheio (para a UI)', () => {
    expect(tick(cenario(3)).boiasFechadas).toContain('T'); // 3 ≥ máximo
    expect(tick(cenario(0)).boiasFechadas).not.toContain('T'); // vazio → aberta
  });
});

describe('sensor reverso (corte por nível baixo, protege a origem)', () => {
  it('desliga no mínimo e liga no máximo (invertido do normal)', () => {
    const s: PropsSensor = { bombasAlvo: ['P'], nivelMinimo: 2, nivelMaximo: 4, reversa: true };
    expect(avaliarSensor(s, 1, 0)).toBe('desligar'); // baixo → desliga (protege)
    expect(avaliarSensor(s, 5, 0)).toBe('ligar'); // alto → libera
    expect(avaliarSensor(s, 3, 0)).toBe('manter'); // banda morta
  });

  it('a bomba respeita sensor normal e reverso ao mesmo tempo (desligar vence)', () => {
    // Sensor normal no destino pede LIGAR; sensor reverso na origem (baixa) pede
    // DESLIGAR → a bomba fica desligada (protege a origem de esvaziar).
    const cenario = (nivelOrigem: number) =>
      projeto(
        [
          res('ORIG', { nivel: nivelOrigem }),
          res('DEST', { nivel: 0 }), // baixo → sensor normal quer ligar
          bomba('P', { ligada: true, vazaoNominal: 5 }),
          sensor('SN', { bombasAlvo: ['P'], nivelMinimo: 3, nivelMaximo: 6 }), // normal no destino
          sensor('SR', { bombasAlvo: ['P'], nivelMinimo: 2, nivelMaximo: 4, reversa: true }), // reverso na origem
        ],
        [
          criarConexao('ORIG', 'P'),
          criarConexao('P', 'DEST'),
          criarConexao('SN', 'DEST'),
          criarConexao('SR', 'ORIG'),
        ],
      );
    // Origem cheia (5): reverso libera, normal liga → bomba puxa.
    expect(tick(cenario(5)).vazoes['P']).toBeCloseTo(5, 9);
    // Origem no mínimo (1): reverso desliga (vence) → bomba parada.
    expect(tick(cenario(1)).vazoes['P']).toBe(0);
  });
});

describe('um sensor controla várias bombas', () => {
  it('a decisão do sensor chega a todas as bombas em bombasAlvo', () => {
    const r = tick(
      projeto(
        [
          res('A', { nivel: 5 }),
          res('B', {}),
          res('C', {}),
          bomba('P1', { ligada: false, vazaoNominal: 4 }),
          bomba('P2', { ligada: false, vazaoNominal: 6 }),
          res('D', { nivel: 0 }), // baixo → sensor pede ligar
          sensor('S', { bombasAlvo: ['P1', 'P2'], nivelMinimo: 1, nivelMaximo: 4 }),
        ],
        [
          criarConexao('A', 'P1'),
          criarConexao('P1', 'B'),
          criarConexao('A', 'P2'),
          criarConexao('P2', 'C'),
          criarConexao('S', 'D'),
        ],
      ),
    );
    expect(r.vazoes['P1']).toBeCloseTo(4, 9); // ambas ligaram pelo mesmo sensor
    expect(r.vazoes['P2']).toBeCloseTo(6, 9);
  });
});

describe('quadro de comandos (MCC)', () => {
  const quadro = (id: string, canais: CanalQuadro[], sensores: string[] = [], logica?: 'E' | 'OU'): Peca => ({ id, tipo: 'quadro', x: 0, y: 0, props: { canais, sensores, logica } });
  const estaLigada = (r: ReturnType<typeof tick>, id: string): boolean | undefined =>
    (r.projeto.pecas.find((p) => p.id === id)!.props as PropsBomba).ligada;
  // Reservatório D no fundo (nível 0 < mín 1) → sensor normal S pede LIGAR.
  const cenario = (canais: CanalQuadro[], extraBomba: Partial<PropsBomba> = {}) =>
    tick(
      projeto(
        [
          res('D', { nivel: 0 }),
          sensor('S', { bombasAlvo: [], nivelMinimo: 1, nivelMaximo: 4 }),
          bomba('P', { ligada: false, ...extraBomba }),
          quadro('Q', canais),
        ],
        [criarConexao('S', 'D')],
      ),
    );

  it('modo manual liga a bomba', () => {
    expect(estaLigada(cenario([{ bomba: 'P', modo: 'manual' }]), 'P')).toBe(true);
  });

  it('modo desligado desliga, mesmo com a boia pedindo ligar', () => {
    expect(estaLigada(cenario([{ bomba: 'P', modo: 'desligado', sensor: 'S' }]), 'P')).toBe(false);
  });

  it('modo auto segue a boia escolhida', () => {
    expect(estaLigada(cenario([{ bomba: 'P', modo: 'auto', sensor: 'S' }]), 'P')).toBe(true);
  });

  it('o quadro sobrepõe o modoControle direto da bomba', () => {
    // modoControle 'desligado', mas o quadro manda 'manual' → o quadro vence.
    expect(estaLigada(cenario([{ bomba: 'P', modo: 'manual' }], { modoControle: 'desligado' }), 'P')).toBe(true);
  });

  it('sensor sob o quadro deixa de acionar bombas pelo bombasAlvo direto', () => {
    // S rege P1 pelo quadro (auto) e ainda lista P2 em bombasAlvo; como está sob o
    // quadro, o vínculo direto S→P2 fica inativo → P2 não liga.
    const r = tick(
      projeto(
        [
          res('D', { nivel: 0 }),
          sensor('S', { bombasAlvo: ['P2'], nivelMinimo: 1, nivelMaximo: 4 }),
          bomba('P1', { ligada: false }),
          bomba('P2', { ligada: false }),
          quadro('Q', [{ bomba: 'P1', modo: 'auto', sensor: 'S' }], ['S']),
        ],
        [criarConexao('S', 'D')],
      ),
    );
    expect(estaLigada(r, 'P1')).toBe(true); // regida pelo quadro
    expect(estaLigada(r, 'P2')).toBe(false); // S é membro do quadro → vínculo direto inativo
  });

  // Dois sensores no canal auto, combinados pela lógica do quadro. S1 sempre pede ligar (D1 no fundo); S2 varia com o nível de D2 (banda morta em n2=3).
  const doisSensores = (logica: 'E' | 'OU', n2: number) =>
    tick(
      projeto(
        [
          res('D1', { nivel: 0 }),
          res('D2', { nivel: n2 }),
          sensor('S1', { bombasAlvo: [], nivelMinimo: 1, nivelMaximo: 4 }),
          sensor('S2', { bombasAlvo: [], nivelMinimo: 1, nivelMaximo: 4 }),
          bomba('P', { ligada: false }),
          quadro(
            'Q',
            [{ bomba: 'P', modo: 'auto', sensores: ['S1', 'S2'] }],
            ['S1', 'S2'],
            logica,
          ),
        ],
        [criarConexao('S1', 'D1'), criarConexao('S2', 'D2')],
      ),
    );

  it('lógica E: um desligar ativo derruba; banda morta (manter) é neutra', () => {
    expect(estaLigada(doisSensores('E', 0), 'P')).toBe(true); // ambos pedem ligar
    expect(estaLigada(doisSensores('E', 5), 'P')).toBe(false); // S2 pede desligar → E derruba S2 em banda morta (manter) não tem opinião ativa → não conta: S1 ligar vence.
    expect(estaLigada(doisSensores('E', 3), 'P')).toBe(true);
  });

  it('lógica OU: basta um sensor pedir ligar', () => {
    expect(estaLigada(doisSensores('OU', 3), 'P')).toBe(true); // S1 pede ligar (S2 neutro)
  });

  // Três sensores com operadores por gap: S1 sempre pede ligar (D1 no fundo), S2 idem (D2 no fundo), S3 pede desligar (D3 cheio). Só a ORDEM dos operadores
  // muda o resultado → prova a avaliação sequencial esquerda→direita.
  const tresSensores = (operadores: ('E' | 'OU')[]) =>
    tick(
      projeto(
        [
          res('D1', { nivel: 0 }),
          res('D2', { nivel: 0 }),
          res('D3', { nivel: 5 }),
          sensor('S1', { bombasAlvo: [], nivelMinimo: 1, nivelMaximo: 4 }),
          sensor('S2', { bombasAlvo: [], nivelMinimo: 1, nivelMaximo: 4 }),
          sensor('S3', { bombasAlvo: [], nivelMinimo: 1, nivelMaximo: 4 }),
          bomba('P', { ligada: false }),
          {
            id: 'Q',
            tipo: 'quadro',
            x: 0,
            y: 0,
            props: {
              canais: [{ bomba: 'P', modo: 'auto', sensores: ['S1', 'S2', 'S3'], operadores }],
              sensores: ['S1', 'S2', 'S3'],
            },
          } as Peca,
        ],
        [criarConexao('S1', 'D1'), criarConexao('S2', 'D2'), criarConexao('S3', 'D3')],
      ),
    );

  it('avaliação sequencial: a ordem dos operadores importa (E→OU vs OU→E)', () => {
    // b = [ligar, ligar, desligar] = [T, T, F]:
    //  ['E','OU']  = (T E T) OU F = T  → liga
    //  ['OU','E']  = (T OU T) E F = F  → não liga
    expect(estaLigada(tresSensores(['E', 'OU']), 'P')).toBe(true);
    expect(estaLigada(tresSensores(['OU', 'E']), 'P')).toBe(false);
  });

  it('desligar é expressão pura (sem precedência) — atrás de OU não vence', () => {
    // ['OU','OU'] = T OU T OU F = T → o desligar do S3 NÃO derruba a bomba.
    expect(estaLigada(tresSensores(['OU', 'OU']), 'P')).toBe(true);
    // ['E','E'] = T E T E F = F → aí sim o desligar (atrás de E) segura.
    expect(estaLigada(tresSensores(['E', 'E']), 'P')).toBe(false);
  });

  it('boia-membro sem seleção no canal é seguida (reversa protege a origem)', () => {
    // S (reversa) é MEMBRO do quadro, mas o canal não marcou sensor nenhum. Antes, a bomba caía na demanda e ignorava o 'desligar' da reversa (origem vazia).
    // Agora o canal sem seleção segue TODOS os membros → o desligar tem precedência.
    const r = tick(
      projeto(
        [
          res('A', { nivel: 0 }), // origem vazia → reversa pede DESLIGAR
          sensor('S', { reversa: true, nivelMinimo: 1, nivelMaximo: 4 }),
          bomba('P', { ligada: true }),
          consumo('C', { gerador: { perfil: 'fixo', vazao: 5 }, aberto: true }),
          quadro('Q', [{ bomba: 'P', modo: 'auto' }], ['S'], 'E'), // canal SEM sensores
        ],
        [criarConexao('S', 'A'), criarConexao('P', 'C')],
      ),
    );
    expect(r.sensores['S']).toBe('desligar');
    expect(estaLigada(r, 'P')).toBe(false); // membro reverso respeitado (não caiu na demanda)
  });

  it('canal sem sensores e quadro sem membros → aciona por demanda', () => {
    // Sem sensor algum no quadro, o 'auto' continua sendo demanda-driven.
    const comDemanda = (dem: number) =>
      tick(
        projeto(
          [
            res('A', { nivel: 5 }),
            bomba('P', { ligada: false, vazaoNominal: 5 }),
            consumo('C', { gerador: { perfil: 'fixo', vazao: dem }, aberto: true }),
            quadro('Q', [{ bomba: 'P', modo: 'auto' }]), // sem membros
          ],
          [criarConexao('A', 'P'), criarConexao('P', 'C')],
        ),
      );
    expect(estaLigada(comDemanda(3), 'P')).toBe(true);
    expect(estaLigada(comDemanda(0), 'P')).toBe(false);
  });

  it('sensor desabilitado (ativo=false) não emite decisão', () => {
    // S pediria LIGAR (D no fundo), mas está desabilitado no painel → não liga.
    const r = tick(
      projeto(
        [
          res('D', { nivel: 0 }),
          sensor('S', { bombasAlvo: [], nivelMinimo: 1, nivelMaximo: 4, ativo: false }),
          bomba('P', { ligada: false }),
          quadro('Q', [{ bomba: 'P', modo: 'auto', sensores: ['S'] }], ['S']),
        ],
        [criarConexao('S', 'D')],
      ),
    );
    expect(estaLigada(r, 'P')).toBe(false);
    expect(r.sensores['S']).toBeUndefined(); // desabilitado → sem decisão
  });

  it('auto sem sensor: liga só quando há consumo (demanda) à jusante', () => {
    const comDemanda = (dem: number) =>
      tick(
        projeto(
          [
            res('A', { nivel: 5 }),
            bomba('P', { ligada: false, vazaoNominal: 5 }),
            consumo('C', { gerador: { perfil: 'fixo', vazao: dem }, aberto: true }),
            quadro('Q', [{ bomba: 'P', modo: 'auto' }]),
          ],
          [criarConexao('A', 'P'), criarConexao('P', 'C')],
        ),
      );
    expect(estaLigada(comDemanda(3), 'P')).toBe(true); // consumo pedindo → liga
    expect(estaLigada(comDemanda(0), 'P')).toBe(false); // sem demanda → não liga
  });

  it('revezamento e unidade ativa são controlados pelo quadro', () => {
    const unidadeAtiva = (r: ReturnType<typeof tick>, id: string): 1 | 2 | undefined =>
      (r.projeto.pecas.find((p) => p.id === id)!.props as PropsBomba).unidadeAtiva;
    const comCanal = (canal: CanalQuadro) =>
      tick(
        projeto(
          [
            res('A', { nivel: 5 }),
            res('B', {}),
            bomba('P', { ligada: false, vazaoNominal: 5 }),
            quadro('Q', [canal]),
          ],
          [criarConexao('A', 'P'), criarConexao('P', 'B')],
        ),
      );
    // Unidade forçada = 2 → fica na 2 (não alterna).
    expect(unidadeAtiva(comCanal({ bomba: 'P', modo: 'manual', revezamento: true, unidade: 2 }), 'P')).toBe(2);
    // Sem unidade forçada → alterna no acionamento (undefined → 1).
    expect(unidadeAtiva(comCanal({ bomba: 'P', modo: 'manual', revezamento: true }), 'P')).toBe(1);
    // Sem revezamento → bomba única (unidadeAtiva indefinida).
    expect(unidadeAtiva(comCanal({ bomba: 'P', modo: 'manual' }), 'P')).toBeUndefined();
  });
});

describe('bomba dupla em revezamento', () => {
  it('alterna a metade ativa a cada acionamento (borda de subida)', () => {
    const uni = (proj: ProjetoSimulacao): 1 | 2 | undefined =>
      (proj.pecas.find((x) => x.id === 'P')!.props as PropsBomba).unidadeAtiva;
    const setModo = (proj: ProjetoSimulacao, modo: 'ligado' | 'desligado'): ProjetoSimulacao => {
      (proj.pecas.find((x) => x.id === 'P')!.props as PropsBomba).modoControle = modo;
      return proj;
    };

    // Desligada de início → sem acionamento, sem unidade ativa.
    let r = tick(
      projeto(
        [res('A', { nivel: 5 }), res('B', {}), bomba('P', { revezamento: true, modoControle: 'desligado', vazaoNominal: 5 })],
        [criarConexao('A', 'P'), criarConexao('P', 'B')],
      ),
    );
    expect(uni(r.projeto)).toBeUndefined();

    // 1º acionamento → unidade 1.
    r = tick(setModo(r.projeto, 'ligado'));
    expect(uni(r.projeto)).toBe(1);
    // Permanece ligada (não é borda) → não alterna.
    r = tick(r.projeto);
    expect(uni(r.projeto)).toBe(1);

    // Desliga (queda de borda não alterna).
    r = tick(setModo(r.projeto, 'desligado'));
    expect(uni(r.projeto)).toBe(1);

    // 2º acionamento → unidade 2 (a que rodou por último descansa).
    r = tick(setModo(r.projeto, 'ligado'));
    expect(uni(r.projeto)).toBe(2);

    // Desliga e liga de novo → volta para a unidade 1.
    r = tick(setModo(r.projeto, 'desligado'));
    r = tick(setModo(r.projeto, 'ligado'));
    expect(uni(r.projeto)).toBe(1);
  });

  it('export limpa a unidade ativa (estado transitório)', () => {
    const p = projeto(
      [res('A', { nivel: 5 }), res('B', {}), bomba('P', { revezamento: true, modoControle: 'ligado' })],
      [criarConexao('A', 'P'), criarConexao('P', 'B')],
    );
    const r = tick(p);
    expect(uniDe(r.projeto, 'P')).toBe(1); // rodou → unidade definida
    const texto = serializarProjeto(r.projeto);
    const bombaSerializada = JSON.parse(texto).pecas.find((x: { id: string }) => x.id === 'P');
    expect(bombaSerializada.props.unidadeAtiva).toBeUndefined();
    expect(bombaSerializada.props.revezamento).toBe(true); // config permanece
  });
});

function uniDe(proj: ProjetoSimulacao, id: string): 1 | 2 | undefined {
  return (proj.pecas.find((x) => x.id === id)!.props as PropsBomba).unidadeAtiva;
}

// ===========================================================================
// Tubo ladrão (dreno de transbordo)
// ===========================================================================
describe('tubo ladrão', () => {
  it('só escoa quando o nível de origem passa do nível de acionamento', () => {
    const acima = tick(
      projeto(
        [res('A', { cota: 0, nivel: 3, alturaMaxima: 6 }), tubo('L', { ladrao: { nivel: 2 } })],
        [criarConexao('A', 'L')],
      ),
    );
    expect(acima.vazoes['L']).toBeGreaterThan(0);
    expect(acima.ladroesAtivos).toContain('L');

    const abaixo = tick(
      projeto(
        [res('A', { cota: 0, nivel: 1.5, alturaMaxima: 6 }), tubo('L', { ladrao: { nivel: 2 } })],
        [criarConexao('A', 'L')],
      ),
    );
    expect(abaixo.vazoes['L']).toBe(0);
    expect(abaixo.ladroesAtivos).not.toContain('L');
  });

  it('segura o reservatório perto do nível de ladrão (autolimitante)', () => {
    const p = projeto(
      [
        fonte('F', { gerador: { perfil: 'fixo', vazao: 0.02 } }),
        res('A', { nivel: 3, alturaMaxima: 6 }),
        tubo('L', { diametro: 150, ladrao: { nivel: 3 } }),
      ],
      [criarConexao('F', 'A'), criarConexao('A', 'L')],
    );
    const r = rodarTicks(p, 300);
    const a = r.projeto.pecas.find((x) => x.id === 'A')!.props as PropsReservatorio;
    expect(a.nivel!).toBeGreaterThanOrEqual(3);
    expect(a.nivel!).toBeLessThan(3.5); // ladrão drenou o excedente
  });
});

// ===========================================================================
// Ponto de consumo (saída de água sem destino)
// ===========================================================================
describe('consumo', () => {
  it('retira a vazão de demanda do reservatório de origem e descarta', () => {
    const r = tick(
      projeto(
        [res('A', { nivel: 2 }), { id: 'C', tipo: 'consumo', x: 0, y: 0, props: { gerador: { perfil: 'fixo', vazao: 5 }, aberto: true } }],
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
        [res('A', { nivel: 2 }), { id: 'C', tipo: 'consumo', x: 0, y: 0, props: { gerador: { perfil: 'fixo', vazao: 5 }, aberto: false } }],
        [criarConexao('A', 'C')],
      ),
    );
    expect(r.vazoes['C']).toBe(0);
  });

  it('não drena abaixo de zero (limitado pelo volume disponível)', () => {
    const r = tick(
      projeto(
        [res('A', { nivel: 0.001 }), { id: 'C', tipo: 'consumo', x: 0, y: 0, props: { gerador: { perfil: 'fixo', vazao: 1000 }, aberto: true } }],
        [criarConexao('A', 'C')],
      ),
    );
    const a = r.projeto.pecas.find((x) => x.id === 'A')!.props as PropsReservatorio;
    expect(a.nivel!).toBeGreaterThanOrEqual(0);
  });

  it('estrangula a saída pela capacidade do cano no caminho (realismo)', () => {
    const r = tick(
      projeto(
        [
          res('A', { cota: 0, nivel: 1 }),
          tubo('T', { diametro: 5 }), // cano fino: 5 mm
          { id: 'C', tipo: 'consumo', x: 0, y: 0, props: { gerador: { perfil: 'fixo', vazao: 1000 }, aberto: true } },
        ],
        [criarConexao('A', 'T'), criarConexao('T', 'C')],
      ),
    );
    // capacidade do cano de 5 mm com carga de 1 m (Torricelli), não a demanda 1000
    const area = Math.PI * (0.005 / 2) ** 2;
    const cap = area * Math.sqrt(2 * 9.81 * 1);
    expect(r.vazoes['C']).toBeCloseTo(cap, 9);
    expect(r.vazoes['C']).toBeLessThan(1); // muito abaixo da demanda
  });

  it('demanda 0 com cano no caminho NÃO drena o reservatório (o cano não vira ralo)', () => {
    const r = tick(
      projeto(
        [
          res('A', { nivel: 4 }),
          tubo('T', { diametro: 200 }),
          consumo('C', { gerador: { perfil: 'fixo', vazao: 0 }, aberto: true }),
        ],
        [criarConexao('A', 'T'), criarConexao('T', 'C')],
      ),
    );
    expect(r.vazoes['C']).toBe(0);
    expect(r.vazoes['T'] ?? 0).toBe(0); // cano reivindicado pelo consumo, sem ralo
    const a = r.projeto.pecas.find((x) => x.id === 'A')!.props as PropsReservatorio;
    expect(a.nivel!).toBeCloseTo(4, 9); // nível intacto
  });

  it('saída fechada com cano no caminho também não drena o reservatório', () => {
    const r = tick(
      projeto(
        [
          res('A', { nivel: 4 }),
          tubo('T', { diametro: 200 }),
          consumo('C', { gerador: { perfil: 'fixo', vazao: 5 }, aberto: false }),
        ],
        [criarConexao('A', 'T'), criarConexao('T', 'C')],
      ),
    );
    expect(r.vazoes['T'] ?? 0).toBe(0);
    const a = r.projeto.pecas.find((x) => x.id === 'A')!.props as PropsReservatorio;
    expect(a.nivel!).toBeCloseTo(4, 9);
  });

  it('perfil senoidal varia entre mínimo e máximo ao longo do tempo', () => {
    const mk = (t: number) =>
      tick(
        projeto(
          [
            res('A', { nivel: 5 }),
            consumo('C', {
              gerador: { perfil: 'senoidal', min: 1, max: 3, periodo: 4 },
              aberto: true,
            }),
          ],
          [criarConexao('A', 'C')],
        ),
        t,
      ).vazoes['C']!;
    expect(mk(0)).toBeCloseTo(2, 6); // meio (sin 0)
    expect(mk(1)).toBeCloseTo(3, 6); // máximo (sin π/2)
    expect(mk(3)).toBeCloseTo(1, 6); // mínimo (sin 3π/2)
  });

  it('perfil trapezoidal (retangular) liga/desliga conforme o duty', () => {
    const mk = (t: number) =>
      tick(
        projeto(
          [
            res('A', { nivel: 5 }),
            consumo('C', {
              // Retangular com duty 30%: alto 0.3, baixo 0.7 (subida/descida 0).
              gerador: { perfil: 'trapezoidal', min: 0, max: 5, periodo: 10, subida: 0, alto: 0.3, descida: 0, baixo: 0.7 },
              aberto: true,
            }),
          ],
          [criarConexao('A', 'C')],
        ),
        t,
      ).vazoes['C']!;
    expect(mk(0)).toBe(5); // fase 0 < 0.3 → ligado
    expect(mk(2)).toBe(5); // fase 0.2 < 0.3 → ligado
    expect(mk(5)).toBe(0); // fase 0.5 ≥ 0.3 → desligado
    expect(mk(9)).toBe(0); // fase 0.9 → desligado
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

  it('avaliarSequencia: dobra esquerda→direita, expressão pura', () => {
    // As 4 combinações de [T,T,F] com dois operadores.
    const seq = (ops: ('E' | 'OU')[]) => avaliarSequencia(['ligar', 'ligar', 'desligar'], ops, 'OU', false);
    expect(seq(['E', 'E'])).toBe(false); // T E T E F
    expect(seq(['E', 'OU'])).toBe(true); // (T E T) OU F
    expect(seq(['OU', 'E'])).toBe(false); // (T OU T) E F
    expect(seq(['OU', 'OU'])).toBe(true); // T OU T OU F
  });

  it('avaliarSequencia: sem decisão (undefined) é pulada, mantendo o operador seguinte', () => {
    // Meio ausente: usa o operador que antecede a PRÓXIMA decisão presente.
    expect(avaliarSequencia(['ligar', undefined, 'desligar'], ['E', 'OU'], 'E', false)).toBe(true); // T OU F
    expect(avaliarSequencia(['ligar', undefined, 'desligar'], ['E', 'E'], 'OU', false)).toBe(false); // T E F
  });

  it('avaliarSequencia: operador faltante cai no padrão; vazio mantém estado', () => {
    expect(avaliarSequencia(['ligar', 'desligar'], [], 'E', false)).toBe(false); // T E F
    expect(avaliarSequencia(['ligar', 'desligar'], [], 'OU', false)).toBe(true); // T OU F
    expect(avaliarSequencia([], [], 'OU', true)).toBe(true); // ninguém decide → mantém
    expect(avaliarSequencia(['manter', 'manter'], ['OU'], 'OU', true)).toBe(true); // manter = estado anterior
  });

  it('sensor pede ligar abaixo do mínimo e desligar acima do máximo', () => {
    const s: PropsSensor = { bombasAlvo: ['P'], nivelMinimo: 1, nivelMaximo: 4 };
    expect(avaliarSensor(s, 0.5, 0)).toBe('ligar');
    expect(avaliarSensor(s, 4.5, 0)).toBe('desligar');
    expect(avaliarSensor(s, 2, 0)).toBe('manter'); // banda morta (histerese)
  });

  it('ignora ultimaTroca no futuro (obsoleto de execução exportada e recarregada)', () => {
    // Projeto exportado durante um run guardou ultimaTroca=16696; ao recarregar, o tempo volta a 0. O delay NÃO deve congelar o sensor até o relógio chegar
    // lá — ele decide normalmente pelo nível.
    const s: PropsSensor = { bombasAlvo: ['P'], nivelMinimo: 3, nivelMaximo: 5.5, delay: 10, ultimaTroca: 16696 };
    expect(avaliarSensor(s, 2, 0)).toBe('ligar'); // nível 2 < mínimo → liga já em t=0
    // Com ultimaTroca no passado dentro da janela, o delay volta a valer.
    expect(avaliarSensor(s, 2, 16700)).toBe('manter'); // 16700-16696=4 < 10
    expect(avaliarSensor(s, 2, 16710)).toBe('ligar'); // 14 ≥ 10 → libera
  });

  it('expõe a decisão corrente de cada sensor (para a UI colorir)', () => {
    const r = tick(
      projeto(
        [
          res('BAIXO', { nivel: 0.5 }),
          res('CHEIO', { nivel: 4.5 }),
          res('MEIO', { nivel: 2 }),
          bomba('P', { ligada: true }),
          sensor('SL', { bombasAlvo: ['P'], nivelMinimo: 1, nivelMaximo: 4 }),
          sensor('SD', { bombasAlvo: ['P'], nivelMinimo: 1, nivelMaximo: 4 }),
          sensor('SM', { bombasAlvo: ['P'], nivelMinimo: 1, nivelMaximo: 4 }),
        ],
        [
          criarConexao('SL', 'BAIXO'),
          criarConexao('SD', 'CHEIO'),
          criarConexao('SM', 'MEIO'),
        ],
      ),
    );
    expect(r.sensores['SL']).toBe('ligar'); // nível baixo
    expect(r.sensores['SD']).toBe('desligar'); // nível alto
    expect(r.sensores['SM']).toBe('manter'); // banda morta
  });

  it('integração: um sensor mandando desligar vence outro mandando ligar', () => {
    const r = tick(
      projeto(
        [
          res('BAIXO', { nivel: 0.5 }), // sensor pede LIGAR
          res('CHEIO', { nivel: 4.5 }), // sensor pede DESLIGAR
          res('DEST', {}),
          bomba('P', { ligada: true }),
          sensor('S1', { bombasAlvo: ['P'], nivelMinimo: 1, nivelMaximo: 4 }),
          sensor('S2', { bombasAlvo: ['P'], nivelMinimo: 1, nivelMaximo: 4 }),
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
// Velocidade / vazão recomendada (dimensionamento de tubos)
// ===========================================================================
describe('vazão/velocidade máxima recomendada', () => {
  it('vazão recomendada = área × 3 m/s (≈ tabela de bitolas)', () => {
    const q = vazaoMaxRecomendadaM3(97.8); // DN110, interno 97,8 mm
    expect(q).toBeCloseTo(areaTuboM2(97.8) * 3, 12);
    expect(q * 1000).toBeCloseTo(22.5, 1); // ~22,5 L/s (tabela: 22,53)
  });

  it('velocidade = Q/área (0 quando sem fluxo)', () => {
    expect(velocidadeTuboMs(areaTuboM2(50) * 2, 50)).toBeCloseTo(2, 9);
    expect(velocidadeTuboMs(0, 50)).toBe(0);
  });
});

describe('alerta de tubo subdimensionado (v > 3 m/s)', () => {
  it('sinaliza o tubo estreito e ignora o bem dimensionado (mesma vazão de bomba)', () => {
    const cenario = (diam: number) =>
      projeto(
        [
          res('A', { nivel: 5 }),
          res('B', {}),
          bomba('P', { ligada: true, vazaoNominal: 0.05 }), // 0,05 m³/s = 50 L/s
          tubo('rec', { diametro: diam }),
        ],
        [criarConexao('A', 'P'), criarConexao('P', 'rec'), criarConexao('rec', 'B')],
      );
    // DN60 (Ø60): 0,05 m³/s → v ≈ 17,7 m/s → subdimensionado.
    expect(tick(cenario(60)).tubosVelozes).toContain('rec');
    // Ø300 mm: v ≈ 0,7 m/s → dentro do recomendado.
    expect(tick(cenario(300)).tubosVelozes).not.toContain('rec');
  });

  it('respeita a velocidade de referência configurável', () => {
    // Ø300 a ~0,7 m/s: dentro do padrão (3), mas subdimensionado se o limite cair.
    const base = projeto(
      [
        res('A', { nivel: 5 }),
        res('B', {}),
        bomba('P', { ligada: true, vazaoNominal: 0.05 }),
        tubo('rec', { diametro: 300 }),
      ],
      [criarConexao('A', 'P'), criarConexao('P', 'rec'), criarConexao('rec', 'B')],
    );
    expect(tick(base).tubosVelozes).not.toContain('rec'); // padrão 3 m/s
    const restrito = { ...base, configuracaoSimulacao: { ...base.configuracaoSimulacao, velocidadeRef: 0.5 } };
    expect(tick(restrito).tubosVelozes).toContain('rec'); // limite 0,5 m/s → sinaliza
  });
});

// ===========================================================================
// Perda de carga por atrito (Hazen-Williams) — opção ligável
// ===========================================================================
describe('perda de carga (atrito, Hazen-Williams)', () => {
  const build = (atrito: boolean, comprimento?: number): ProjetoSimulacao => ({
    ...projetoVazio(),
    unidades: { volume: 'm3', comprimento: 'm' },
    configuracaoSimulacao: { dt: 0.1, g: 9.81, atrito },
    pecas: [
      res('A', { cota: 10, nivel: 5 }),
      res('B', { nivel: 0 }),
      tubo('t', comprimento !== undefined ? { comprimento } : {}),
    ],
    conexoes: [criarConexao('A', 't'), criarConexao('t', 'B')],
  });

  it('desligado por padrão: mantém o Torricelli puro', () => {
    const semFlag = tick({ ...build(false) }).vazoes['t'];
    // sem atrito, a vazão é a de Torricelli (área × √(2gΔh)); Δh = 15 m.
    const esperado = areaTuboM2(100) * Math.sqrt(2 * 9.81 * 15);
    expect(semFlag).toBeCloseTo(esperado, 6);
  });

  it('ligado, reduz a vazão frente ao Torricelli', () => {
    const sem = tick(build(false)).vazoes['t']!;
    const com = tick(build(true)).vazoes['t']!;
    expect(com).toBeGreaterThan(0);
    expect(com).toBeLessThan(sem); // o atrito só reduz
  });

  it('tubo mais longo perde mais carga (menos vazão)', () => {
    const curto = tick(build(true, 1)).vazoes['t']!;
    const longo = tick(build(true, 200)).vazoes['t']!;
    expect(longo).toBeLessThan(curto);
    expect(longo).toBeGreaterThan(0);
  });
});

// ===========================================================================
// Controle de velocidade (N ticks)
// ===========================================================================
describe('rodarTicks', () => {
  it('encadeia estado e acumula tempo', () => {
    const p = projeto([fonte('F', { gerador: { perfil: 'fixo', vazao: 10 } }), res('B', {})], [criarConexao('F', 'B')]);
    const r = rodarTicks(p, 5);
    expect(r.tempo).toBeCloseTo(0.5, 9); // 5 · dt(0.1)
    const b = r.projeto.pecas.find((x) => x.id === 'B')!.props as PropsReservatorio;
    expect(b.nivel!).toBeCloseTo((10 * 0.5) / 100, 9);
  });
});
