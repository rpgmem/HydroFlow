import { describe, it, expect } from 'vitest';
import {
  carregarProjetoDeTexto,
  validarProjeto,
  versaoCompativel,
  serializarProjeto,
} from './schema';
import { SCHEMA_VERSION, type ProjetoSimulacao } from './types';

function projetoMinimo(): ProjetoSimulacao {
  return {
    nome: 'Teste',
    versao: SCHEMA_VERSION,
    unidades: { volume: 'litros', comprimento: 'm' },
    configuracaoSimulacao: { dt: 0.1, g: 9.81 },
    pecas: [
      {
        id: 'r1',
        tipo: 'reservatorio',
        x: 0,
        y: 0,
        cota: 0,
        props: {
          formato: 'cilindro',
          raio: 1,
          alturaMaxima: 5,
          nivel: 2,
        },
      },
    ],
    conexoes: [],
  };
}

describe('versaoCompativel', () => {
  it('aceita a versão atual', () => {
    expect(versaoCompativel(SCHEMA_VERSION).compativel).toBe(true);
  });

  it('aceita mesmo MAJOR com MINOR diferente', () => {
    expect(versaoCompativel('1.99.0').compativel).toBe(true);
  });

  it('recusa MAJOR diferente', () => {
    expect(versaoCompativel('2.0.0').compativel).toBe(false);
  });

  it('recusa versão não numérica (fallback de versão desconhecida)', () => {
    const r = versaoCompativel('banana');
    expect(r.compativel).toBe(false);
    expect(r.motivo).toContain('não reconhecida');
  });
});

describe('parsing de schema válido', () => {
  it('carrega um projeto bem formado', () => {
    const r = carregarProjetoDeTexto(JSON.stringify(projetoMinimo()));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.projeto.nome).toBe('Teste');
      expect(r.projeto.pecas).toHaveLength(1);
      expect(r.avisos).toHaveLength(0);
    }
  });

  it('emite aviso ao migrar MINOR antiga do mesmo MAJOR', () => {
    const p = { ...projetoMinimo(), versao: '1.0.0-old' };
    // '1.0.0-old' tem major 1 → compatível, mas != SCHEMA_VERSION → aviso
    const r = validarProjeto(p);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.avisos.length).toBeGreaterThan(0);
  });

  it('migra 1.1.0 → 1.2.0: converte magnitudes de exibição para SI', () => {
    // Projeto salvo em litros/m (exibição): a vazão vem em L/s e deve virar m³/s; comprimentos em m ficam iguais (kL=1). Diâmetro (mm) não converte.
    const antigo = {
      nome: 'Litros',
      versao: '1.1.0',
      unidades: { volume: 'litros', comprimento: 'm' },
      configuracaoSimulacao: { dt: 0.1, g: 9.81 },
      pecas: [
        { id: 'B', tipo: 'bomba', x: 0, y: 0, props: { vazaoNominal: 50, sensores: [] } },
        { id: 'R', tipo: 'reservatorio', x: 0, y: 0, cota: 3, props: { formato: 'cilindro', raio: 1.6, alturaMaxima: 9.5, nivel: 2.5 } },
        { id: 'F', tipo: 'fonte', x: 0, y: 0, props: { gerador: { perfil: 'senoidal', min: 2, max: 10, periodo: 60 } } },
        { id: 'T', tipo: 'tubo', x: 0, y: 0, props: { diametro: 97.8 } },
      ],
      conexoes: [{ id: 'c1', origem: 'F', destino: 'R', vazaoAlocada: 20 }],
    };
    const r = validarProjeto(antigo);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const byId = Object.fromEntries(r.projeto.pecas.map((p) => [p.id, p]));
    expect((byId.B!.props as { vazaoNominal: number }).vazaoNominal).toBeCloseTo(0.05); // 50 L/s → 0,05 m³/s
    expect(byId.R!.cota).toBeCloseTo(3); // comprimento em m → inalterado
    expect((byId.R!.props as { raio: number }).raio).toBeCloseTo(1.6);
    const g = (byId.F!.props as { gerador: { min: number; max: number; periodo: number } }).gerador;
    expect(g.min).toBeCloseTo(0.002); // vazão convertida
    expect(g.max).toBeCloseTo(0.01);
    expect(g.periodo).toBe(60); // tempo NÃO converte
    expect((byId.T!.props as { diametro: number }).diametro).toBe(97.8); // mm inalterado
    expect(r.projeto.conexoes[0]!.vazaoAlocada).toBeCloseTo(0.02); // 20 L/s → 0,02 m³/s
  });

  it('migra 1.0.0 (cm): comprimentos convertem para metros', () => {
    const antigo = {
      nome: 'Cm',
      versao: '1.0.0',
      unidades: { volume: 'm3', comprimento: 'cm' },
      configuracaoSimulacao: { dt: 0.1, g: 9.81 },
      pecas: [
        { id: 'R', tipo: 'reservatorio', x: 0, y: 0, props: { formato: 'cilindro', raio: 200, alturaMaxima: 500, cotaBase: 100, nivel: 250 } },
      ],
      conexoes: [],
    };
    const r = validarProjeto(antigo);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p0 = r.projeto.pecas[0]!;
    expect(p0.cota).toBeCloseTo(1); // 100 cm → 1 m (cotaBase migrada + convertida)
    expect((p0.props as { raio: number }).raio).toBeCloseTo(2); // 200 cm → 2 m
    expect((p0.props as { nivel: number }).nivel).toBeCloseTo(2.5); // 250 cm → 2,5 m
  });

  it('migra 1.0.0: props.cotaBase → peca.cota', () => {
    // Projeto no formato antigo: a elevação vinha dentro de props.cotaBase.
    const antigo = {
      nome: 'Antigo',
      versao: '1.0.0',
      unidades: { volume: 'litros', comprimento: 'm' },
      configuracaoSimulacao: { dt: 0.1, g: 9.81 },
      pecas: [
        {
          id: 'r1',
          tipo: 'reservatorio',
          x: 0,
          y: 0,
          props: { formato: 'cilindro', raio: 1, alturaMaxima: 5, cotaBase: 7.5, nivel: 2 },
        },
      ],
      conexoes: [],
    };
    const r = validarProjeto(antigo);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const p0 = r.projeto.pecas[0]!;
      expect(p0.cota).toBe(7.5);
      expect((p0.props as Record<string, unknown>).cotaBase).toBeUndefined();
    }
  });
});

describe('rejeição de schema malformado', () => {
  it('rejeita JSON sintaticamente inválido sem lançar', () => {
    const r = carregarProjetoDeTexto('{ isto não é json ');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros[0]?.mensagem).toContain('JSON inválido');
  });

  it('rejeita raiz que não é objeto', () => {
    expect(carregarProjetoDeTexto('42').ok).toBe(false);
    expect(carregarProjetoDeTexto('[]').ok).toBe(false);
    expect(carregarProjetoDeTexto('null').ok).toBe(false);
  });

  it('rejeita reservatório sem alturaMaxima', () => {
    const p = projetoMinimo();
    delete (p.pecas[0]!.props as Record<string, unknown>).alturaMaxima;
    const r = validarProjeto(p);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erros.some((e) => e.caminho.includes('alturaMaxima'))).toBe(true);
    }
  });

  it('rejeita tipo de peça desconhecido', () => {
    const p = projetoMinimo();
    (p.pecas[0] as { tipo: string }).tipo = 'ovni';
    const r = validarProjeto(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.some((e) => e.caminho.endsWith('.tipo'))).toBe(true);
  });

  it('rejeita dt <= 0', () => {
    const p = projetoMinimo();
    p.configuracaoSimulacao.dt = 0;
    const r = validarProjeto(p);
    expect(r.ok).toBe(false);
  });

  it('rejeita tubo com diâmetro não positivo', () => {
    const p = projetoMinimo();
    p.pecas.push({
      id: 't1',
      tipo: 'tubo',
      x: 1,
      y: 1,
      props: { diametro: 0 },
    });
    const r = validarProjeto(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.some((e) => e.caminho.includes('diametro'))).toBe(true);
  });

  it('não quebra com payload adversário aninhado', () => {
    const malicioso = JSON.stringify({
      versao: '1.0.0',
      nome: 'x',
      unidades: {},
      configuracaoSimulacao: { dt: 0.1, g: 9.81 },
      pecas: [{ id: 1, tipo: null, props: 'oops' }],
      conexoes: 'nope',
    });
    const r = carregarProjetoDeTexto(malicioso);
    expect(r.ok).toBe(false); // recusa graciosamente, sem throw
  });
});

describe('round-trip de serialização', () => {
  it('serializa e recarrega preservando os dados', () => {
    const original = projetoMinimo();
    const texto = serializarProjeto(original);
    const r = carregarProjetoDeTexto(texto);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.projeto.nome).toBe(original.nome);
      expect(r.projeto.versao).toBe(SCHEMA_VERSION);
      expect(r.projeto.pecas[0]?.id).toBe('r1');
    }
  });
});
