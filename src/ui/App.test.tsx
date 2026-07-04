// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

// react-konva precisa de canvas — substituímos por DOM simples.
vi.mock('react-konva', () => import('./reactKonvaMock'));

import { App } from './App';
import { _resetContadorIds } from '../domain/factory';

beforeEach(() => _resetContadorIds());

/** Ids das peças atualmente no canvas (extraídos dos data-testid `peca-<id>`). */
function idsPecas(): string[] {
  return screen
    .queryAllByTestId(/^peca-/)
    .map((el) => el.getAttribute('data-testid')!.replace(/^peca-/, ''));
}

/** Adiciona uma peça pela paleta e devolve o id recém-criado. */
function adicionar(rotulo: string): string {
  const antes = new Set(idsPecas());
  fireEvent.click(screen.getByLabelText(`Adicionar ${rotulo}`));
  const novo = idsPecas().find((id) => !antes.has(id));
  if (!novo) throw new Error(`peça "${rotulo}" não foi adicionada`);
  return novo;
}

describe('editor — criação de peças (Sprint 3)', () => {
  it('adiciona uma peça ao clicar na paleta', () => {
    render(<App />);
    const antes = idsPecas().length;
    adicionar('Tubo');
    expect(idsPecas().length).toBe(antes + 1);
  });
});

describe('editor — conexão de peças (Sprint 3)', () => {
  it('cria uma conexão clicando em duas peças', () => {
    render(<App />);
    const arestasAntes = screen.queryAllByTestId('arrow').length;
    const a = adicionar('Fonte');
    const b = adicionar('Reservatório');
    fireEvent.click(screen.getByTestId(`peca-${a}`));
    fireEvent.click(screen.getByTestId(`peca-${b}`));
    const arestasDepois = screen.queryAllByTestId('arrow').length;
    expect(arestasDepois).toBe(arestasAntes + 1);
  });
});

describe('editor — movimentação de peças (Sprint 3)', () => {
  it('atualiza a posição no drag-end', () => {
    render(<App />);
    const id = adicionar('Bomba');
    expect(screen.getByTestId(`peca-${id}`).dataset.draggable).toBe('true');
    fireEvent.click(screen.getByTestId(`drag-peca-${id}`)); // simula drag → (400,260)
    expect(screen.getByTestId(`peca-${id}`).dataset.x).toBe('400');
    expect(screen.getByTestId(`peca-${id}`).dataset.y).toBe('260');
  });
});

describe('inspetor — edição de props (Sprint 3/4)', () => {
  it('edita uma propriedade da peça selecionada', () => {
    render(<App />);
    const id = adicionar('Reservatório');
    fireEvent.click(screen.getByTestId(`peca-${id}`));
    const altura = screen.getByLabelText('Altura máxima') as HTMLInputElement;
    fireEvent.change(altura, { target: { value: '12' } });
    expect((screen.getByLabelText('Altura máxima') as HTMLInputElement).value).toBe('12');
  });
});

describe('modo execução — validação e transição (Sprint 4)', () => {
  it('entra em execução com o projeto de exemplo válido', () => {
    render(<App />);
    fireEvent.click(screen.getByText('▶ Executar'));
    expect(screen.getByText('execucao')).toBeInTheDocument();
    // Em execução a paleta fica desabilitada (grafo imutável).
    expect(screen.getByLabelText('Adicionar Tubo')).toBeDisabled();
  });

  it('bloqueia execução e mostra erros quando há nó órfão', () => {
    render(<App />);
    // Adiciona um reservatório órfão (sem conexão) → validação deve falhar.
    adicionar('Reservatório');
    fireEvent.click(screen.getByText('▶ Executar'));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('edicao')).toBeInTheDocument(); // permaneceu em edição
  });

  it('exige pause antes de voltar à edição', () => {
    render(<App />);
    fireEvent.click(screen.getByText('▶ Executar'));
    fireEvent.click(screen.getByText('▶ Play'));
    const editar = screen.getByText('✎ Editar');
    expect(editar).toBeDisabled(); // rodando → não pode editar
    fireEvent.click(screen.getByText('⏸ Pausar'));
    expect(screen.getByText('✎ Editar')).not.toBeDisabled();
  });
});

describe('persistência — salvar (Sprint 5)', () => {
  it('dispara o download ao clicar em Salvar', () => {
    // jsdom não implementa URL.createObjectURL/anchor.click totalmente.
    const createUrl = vi.fn(() => 'blob:x');
    const revoke = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createUrl, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revoke, configurable: true });
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    render(<App />);
    fireEvent.click(screen.getByText('💾 Salvar'));
    expect(createUrl).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});

describe('acessibilidade básica', () => {
  it('o inspetor sem seleção instrui o usuário', () => {
    render(<App />);
    const inspetor = screen.getByText('Inspetor').closest('.panel')!;
    expect(within(inspetor as HTMLElement).getByText(/Selecione uma peça/)).toBeInTheDocument();
  });
});
