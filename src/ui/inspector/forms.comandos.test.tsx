// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BombaForm, ConsumoForm, QuadroForm, SensorForm, TuboForm } from './forms';
import { projetoVazio } from '../../domain/factory';
import type { Peca, ProjetoSimulacao, PropsQuadro, PropsSensor } from '../../domain/types';
import type { UniLabel } from './campos';

const u: UniLabel = { comp: 'm', vazao: 'L/s' };
const noop = (): void => {};
const proj = (pecas: Peca[] = []): ProjetoSimulacao => ({
  ...projetoVazio(),
  unidades: { volume: 'm3', comprimento: 'm' },
  pecas,
});
const dis = (nome: string): boolean => (screen.getByLabelText(nome) as HTMLInputElement).disabled;

// Em execução, os COMANDOS de operação ficam ativos e o resto (estrutura/
// dimensionamento) fica desabilitado campo a campo.
describe('inspetor em execução — comandos ativos, estrutura travada', () => {
  it('tubo: registro (comando) ativo; diâmetro (estrutura) travado', () => {
    render(<TuboForm props={{ diametro: 100 }} emExecucao upd={noop} u={u} unidades={proj().unidades} atrito={false} velRef={3} />);
    expect(dis('Registro aberto')).toBe(false);
    expect(dis('Diâmetro interno')).toBe(true);
  });

  it('bomba: modo (comando) ativo; vazão nominal (estrutura) travada', () => {
    const b: Peca = { id: 'P', tipo: 'bomba', x: 0, y: 0, props: { vazaoNominal: 10, sensores: [], ligada: false } };
    render(<BombaForm props={b.props as never} emExecucao upd={noop} u={u} projeto={proj([b])} pecaId="P" dispatch={vi.fn()} />);
    expect(dis('Controle da bomba')).toBe(false);
    expect(dis('Vazão nominal')).toBe(true);
  });

  it('consumo: saída (comando) ativa; vazão (estrutura) travada', () => {
    render(<ConsumoForm props={{ vazaoDemanda: 5, perfil: 'fixo' }} emExecucao upd={noop} u={u} />);
    expect(dis('Saída aberta')).toBe(false);
    expect(dis('Vazão de saída')).toBe(true);
  });

  it('sensor: habilitar (comando) ativo; reverso (estrutura) travado', () => {
    const s: Peca = { id: 'S', tipo: 'sensor', x: 0, y: 0, props: { bombasAlvo: [] } as PropsSensor };
    render(<SensorForm props={s.props as PropsSensor} emExecucao projeto={proj([s])} upd={noop} u={u} pecaId="S" dispatch={vi.fn()} />);
    expect(dis('Sensor habilitado')).toBe(false);
    expect(dis('Sensor reverso (corte por nível baixo)')).toBe(true);
  });

  it('quadro: modo do canal (comando) ativo; lógica (estrutura) travada', () => {
    const q: PropsQuadro = { canais: [{ bomba: 'P', modo: 'auto' }], sensores: ['S'], logica: 'OU' };
    const pecas: Peca[] = [
      { id: 'P', tipo: 'bomba', rotulo: 'P', x: 0, y: 0, props: { vazaoNominal: 10, sensores: [], ligada: false } },
      { id: 'S', tipo: 'sensor', rotulo: 'S', x: 0, y: 0, props: { bombasAlvo: [] } as PropsSensor },
      { id: 'Q', tipo: 'quadro', x: 0, y: 0, props: q },
    ];
    render(<QuadroForm props={q} emExecucao upd={noop} u={u} projeto={proj(pecas)} dispatch={vi.fn()} />);
    expect(dis('Modo')).toBe(false);
    expect(dis('Lógica entre os sensores')).toBe(true);
  });
});
