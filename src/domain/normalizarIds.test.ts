import { describe, it, expect } from 'vitest';
import { normalizarIds, rotulosDuplicados, slugId } from './normalizarIds';
import type { ProjetoSimulacao } from './types';

describe('slugId', () => {
  it('remove acentos, baixa a caixa e troca não-alfanumérico por _', () => {
    expect(slugId('Concessionária')).toBe('concessionaria');
    expect(slugId('Inferior (75.000 L)')).toBe('inferior_75_000_l');
    expect(slugId('Recalque → C2')).toBe('recalque_c2');
    expect(slugId('Bomba Incêndio')).toBe('bomba_incendio');
  });
  it('cai no fallback quando não sobra nada', () => {
    expect(slugId('')).toBe('peca');
    expect(slugId('★—★')).toBe('peca');
  });
});

const proj = (pecas: ProjetoSimulacao['pecas'], conexoes: ProjetoSimulacao['conexoes'] = []): ProjetoSimulacao => ({
  nome: 't',
  versao: '1.0.0',
  unidades: { volume: 'litros', comprimento: 'm' },
  configuracaoSimulacao: { dt: 0.1, g: 9.81 },
  pecas,
  conexoes,
});

describe('rotulosDuplicados', () => {
  it('acha rótulos repetidos (ignora caixa/espaços; vazio não conta)', () => {
    const p = proj([
      { id: 'a', tipo: 'bomba', x: 0, y: 0, rotulo: 'Bomba', props: { vazaoNominal: 1, sensores: [] } },
      { id: 'b', tipo: 'bomba', x: 0, y: 0, rotulo: ' bomba ', props: { vazaoNominal: 1, sensores: [] } },
      { id: 'c', tipo: 'juncao', x: 0, y: 0, rotulo: '', props: {} },
      { id: 'd', tipo: 'juncao', x: 0, y: 0, rotulo: '', props: {} },
    ]);
    expect(rotulosDuplicados(p)).toEqual(['Bomba']);
  });
  it('sem duplicados retorna vazio', () => {
    const p = proj([
      { id: 'a', tipo: 'juncao', x: 0, y: 0, rotulo: 'Um', props: {} },
      { id: 'b', tipo: 'juncao', x: 0, y: 0, rotulo: 'Dois', props: {} },
    ]);
    expect(rotulosDuplicados(p)).toEqual([]);
  });
});

describe('normalizarIds', () => {
  it('reescreve ids pelo rótulo e atualiza todas as referências', () => {
    const p = proj(
      [
        { id: 's1', tipo: 'sensor', x: 0, y: 0, rotulo: 'Boia Sup', props: { bombasAlvo: ['b1'], nivelMinimo: 1, nivelMaximo: 4 } },
        { id: 'b1', tipo: 'bomba', x: 0, y: 0, rotulo: 'Bomba Recalque', props: { vazaoNominal: 5, sensores: ['s1'] } },
        { id: 'q1', tipo: 'quadro', x: 0, y: 0, rotulo: 'Quadro A', props: { canais: [{ bomba: 'b1', modo: 'auto', sensores: ['s1'] }], sensores: ['s1'] } },
      ],
      [{ id: 'c1', origem: 's1', destino: 'b1' }],
    );
    const r = normalizarIds(p);
    const ids = r.pecas.map((x) => x.id);
    expect(ids).toEqual(['boia_sup', 'bomba_recalque', 'quadro_a']);
    // Referências remapeadas:
    expect((r.pecas[0]!.props as { bombasAlvo: string[] }).bombasAlvo).toEqual(['bomba_recalque']);
    expect((r.pecas[1]!.props as { sensores: string[] }).sensores).toEqual(['boia_sup']);
    const q = r.pecas[2]!.props as { canais: { bomba: string; sensores?: string[] }[]; sensores?: string[] };
    expect(q.canais[0]!.bomba).toBe('bomba_recalque');
    expect(q.canais[0]!.sensores).toEqual(['boia_sup']);
    expect(q.sensores).toEqual(['boia_sup']);
    expect(r.conexoes[0]).toMatchObject({ origem: 'boia_sup', destino: 'bomba_recalque' });
  });

  it('desambigua slugs colidentes com sufixo _2', () => {
    const p = proj([
      { id: 'a', tipo: 'juncao', x: 0, y: 0, rotulo: 'Nó A', props: {} },
      { id: 'b', tipo: 'juncao', x: 0, y: 0, rotulo: 'Nó-A', props: {} },
    ]);
    expect(normalizarIds(p).pecas.map((x) => x.id)).toEqual(['no_a', 'no_a_2']);
  });

  it('sem mudanças devolve a MESMA referência (no-op)', () => {
    const p = proj([{ id: 'no_a', tipo: 'juncao', x: 0, y: 0, rotulo: 'no_a', props: {} }]);
    expect(normalizarIds(p)).toBe(p);
  });
});
