// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sparkline } from './Sparkline';

describe('Sparkline', () => {
  it('pede para coletar quando há menos de 2 pontos', () => {
    const { container } = render(<Sparkline dados={[1]} titulo="Nível" unidade="m" />);
    expect(screen.getByText(/coletando/i)).toBeTruthy();
    expect(container.querySelector('polyline')).toBeNull();
  });

  it('desenha a curva com valor atual e faixa mín–máx', () => {
    const { container } = render(<Sparkline dados={[1, 3, 2]} titulo="Nível" unidade="m" />);
    expect(screen.getByText('Nível')).toBeTruthy();
    expect(screen.getByText('2.00 m')).toBeTruthy(); // último valor
    expect(screen.getByText(/mín 1\.00/)).toBeTruthy();
    expect(screen.getByText(/máx 3\.00/)).toBeTruthy();
    const poly = container.querySelector('polyline');
    expect(poly).not.toBeNull();
    expect(poly!.getAttribute('points')!.split(' ')).toHaveLength(3); // 3 pontos
  });

  it('mostra a linha do zero quando a série cruza zero (refluxo)', () => {
    const { container } = render(<Sparkline dados={[-1, 2]} titulo="Vazão" unidade="L/s" />);
    // uma <line> tracejada marca o zero
    expect(container.querySelector('line')).not.toBeNull();
  });
});
