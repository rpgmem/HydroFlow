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
const ausente = (nome: string): boolean => screen.queryByLabelText(nome) === null;

// Em execução, os COMANDOS de operação ficam ativos e o resto (estrutura/dimensionamento) fica OCULTO (não só desabilitado), deixando o inspetor enxuto.
describe('inspetor em execução — comandos ativos, estrutura oculta', () => {
  it('tubo: registro (comando) ativo; diâmetro (estrutura) oculto', () => {
    render(<TuboForm props={{ diametro: 100 }} emExecucao upd={noop} u={u} unidades={proj().unidades} atrito={false} modeloAtrito="hazen-williams" velRef={3} temperaturaC={20} limiteGolpeKPa={1000} />);
    expect(dis('Registro aberto')).toBe(false);
    expect(ausente('Diâmetro interno')).toBe(true);
  });

  it('bomba: modo (comando) ativo; vazão nominal (estrutura) oculta', () => {
    const b: Peca = { id: 'P', tipo: 'bomba', x: 0, y: 0, props: { vazaoNominal: 10, sensores: [], ligada: false } };
    render(<BombaForm props={b.props as never} emExecucao upd={noop} u={u} projeto={proj([b])} pecaId="P" dispatch={vi.fn()} />);
    expect(dis('Controle da bomba')).toBe(false);
    expect(ausente('Vazão nominal')).toBe(true);
  });

  it('consumo: saída (comando) ativa; vazão (estrutura) oculta', () => {
    render(<ConsumoForm props={{ gerador: { perfil: 'fixo', vazao: 5 }, aberto: true }} emExecucao upd={noop} u={u} unidades={proj().unidades} />);
    expect(dis('Saída aberta')).toBe(false);
    expect(ausente('Vazão constante')).toBe(true);
  });

  it('sensor: habilitar (comando) ativo; reverso (estrutura) oculto', () => {
    const s: Peca = { id: 'S', tipo: 'sensor', x: 0, y: 0, props: { bombasAlvo: [] } as PropsSensor };
    render(<SensorForm props={s.props as PropsSensor} emExecucao projeto={proj([s])} upd={noop} u={u} pecaId="S" dispatch={vi.fn()} />);
    expect(dis('Sensor habilitado')).toBe(false);
    expect(ausente('Sensor reverso (corte por nível baixo)')).toBe(true);
  });

  it('quadro: modo do canal (comando) ativo; sequência (estrutura) travada', () => {
    const q: PropsQuadro = { canais: [{ bomba: 'P', modo: 'auto' }], sensores: ['S'], logica: 'OU' };
    const pecas: Peca[] = [
      { id: 'P', tipo: 'bomba', rotulo: 'P', x: 0, y: 0, props: { vazaoNominal: 10, sensores: [], ligada: false } },
      { id: 'S', tipo: 'sensor', rotulo: 'S', x: 0, y: 0, props: { bombasAlvo: [] } as PropsSensor },
      { id: 'Q', tipo: 'quadro', x: 0, y: 0, props: q },
    ];
    render(<QuadroForm props={q} emExecucao upd={noop} u={u} projeto={proj(pecas)} dispatch={vi.fn()} />);
    expect(dis('Modo')).toBe(false);
    // Editar a sequência de sensores é estrutura → travado na execução.
    expect(dis('+ adicionar sensor à sequência')).toBe(true);
  });
});
