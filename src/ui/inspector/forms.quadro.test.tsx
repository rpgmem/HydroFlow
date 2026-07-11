// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuadroForm, SensorForm } from './forms';
import { projetoVazio } from '../../domain/factory';
import type { Peca, ProjetoSimulacao, PropsQuadro, PropsSensor, CanalQuadro } from '../../domain/types';
import type { UniLabel } from './campos';

const u: UniLabel = { comp: 'm', vazao: 'L/s' };

function projetoComQuadro(quadro: PropsQuadro): ProjetoSimulacao {
  const pecas: Peca[] = [
    { id: 'P', tipo: 'bomba', rotulo: 'Bomba P', x: 0, y: 0, props: { vazaoNominal: 10, sensores: [], ligada: false } },
    {
      id: 'S',
      tipo: 'sensor',
      rotulo: 'Boia S',
      x: 0,
      y: 0,
      props: { bombasAlvo: [], nivelMinimo: 1, nivelMaximo: 4 } as PropsSensor,
    },
    { id: 'Q', tipo: 'quadro', x: 0, y: 0, props: quadro },
  ];
  return { ...projetoVazio(), unidades: { volume: 'm3', comprimento: 'm' }, pecas };
}

describe('QuadroForm — controle centralizado (MCC)', () => {
  it('mostra lógica E/OU, sensores-membro e revezamento por bomba', () => {
    const projeto = projetoComQuadro({
      canais: [{ bomba: 'P', modo: 'auto', sensores: ['S'], revezamento: true }],
      sensores: ['S'],
      logica: 'E',
    });
    const dispatch = vi.fn();
    render(
      <QuadroForm
        props={(projeto.pecas.find((p) => p.id === 'Q')!.props) as PropsQuadro}
        emExecucao={false}
        upd={() => {}}
        u={u}
        projeto={projeto}
        dispatch={dispatch}
      />,
    );

    // Lógica padrão entre sensores (valor E).
    const logica = screen.getByLabelText('Lógica padrão entre sensores') as HTMLSelectElement;
    expect(logica.value).toBe('E');

    // Bloco do sensor-membro editável aqui (níveis) — grava no próprio sensor.
    const nivelMin = screen.getByLabelText('Nível mínimo (liga)');
    fireEvent.change(nivelMin, { target: { value: '2' } });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'ATUALIZAR_PROPS', id: 'S' }));

    // Sensor-membro presente na sequência do canal (botão de remover disponível).
    expect(screen.getByLabelText('Tirar Boia S da sequência')).toBeTruthy();

    // Revezamento controlado pelo quadro + seletor de unidade (revezamento ligado).
    expect(screen.getByLabelText('Bomba dupla (revezamento)')).toBeTruthy();
    expect(screen.getByLabelText('Unidade ativa')).toBeTruthy();
  });

  it('quadro sem bombas e sem sensores mostra o aviso de vazio', () => {
    const projeto = projetoComQuadro({ canais: [] });
    render(
      <QuadroForm
        props={{ canais: [] }}
        emExecucao={false}
        upd={() => {}}
        u={u}
        projeto={projeto}
        dispatch={vi.fn()}
      />,
    );
    expect(screen.getByText(/Nenhuma bomba ou boia associada/)).toBeTruthy();
  });
});

describe('SensorForm — aviso de boia "solta" no quadro', () => {
  const cenario = (canal: CanalQuadro): ProjetoSimulacao => {
    const pecas: Peca[] = [
      { id: 'P', tipo: 'bomba', rotulo: 'P', x: 0, y: 0, props: { vazaoNominal: 10, sensores: [], ligada: false } },
      { id: 'S', tipo: 'sensor', rotulo: 'Boia S', x: 0, y: 0, props: { bombasAlvo: [] } as PropsSensor },
      { id: 'Q', tipo: 'quadro', x: 0, y: 0, props: { canais: [canal], sensores: ['S'] } },
    ];
    return { ...projetoVazio(), unidades: { volume: 'm3', comprimento: 'm' }, pecas };
  };
  const render_ = (projeto: ProjetoSimulacao) =>
    render(
      <SensorForm
        props={projeto.pecas.find((p) => p.id === 'S')!.props as PropsSensor}
        emExecucao={false}
        projeto={projeto}
        upd={() => {}}
        u={u}
        pecaId="S"
        dispatch={vi.fn()}
      />,
    );

  it('avisa quando a boia é membro mas nenhuma bomba a segue', () => {
    // Canal em 'manual' → não segue sensor nenhum → S fica solta.
    render_(cenario({ bomba: 'P', modo: 'manual' }));
    expect(screen.getByText(/Nenhuma bomba deste quadro segue esta boia/)).toBeTruthy();
  });

  it('não avisa quando a boia é seguida por uma bomba (canal auto)', () => {
    render_(cenario({ bomba: 'P', modo: 'auto', sensores: ['S'] }));
    expect(screen.queryByText(/Nenhuma bomba deste quadro segue esta boia/)).toBeNull();
  });
});
