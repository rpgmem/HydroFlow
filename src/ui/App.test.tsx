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
  it('NÃO conecta ao apenas clicar em duas peças (conexão é deliberada)', () => {
    render(<App />);
    const arestasAntes = screen.queryAllByTestId('arrow').length;
    const a = adicionar('Fonte');
    const b = adicionar('Reservatório');
    fireEvent.click(screen.getByTestId(`peca-${a}`));
    fireEvent.click(screen.getByTestId(`peca-${b}`));
    expect(screen.queryAllByTestId('arrow').length).toBe(arestasAntes); // sem auto-conexão
  });

  it('conecta arrastando da alça de saída até a peça de destino', () => {
    render(<App />);
    const arestasAntes = screen.queryAllByTestId('arrow').length;
    const a = adicionar('Fonte');
    const b = adicionar('Reservatório');
    fireEvent.mouseDown(screen.getByTestId(`port-out-${a}`));
    fireEvent.mouseUp(screen.getByTestId(`peca-${b}`));
    expect(screen.queryAllByTestId('arrow').length).toBe(arestasAntes + 1);
  });

  it('seleciona e exclui uma conexão', () => {
    render(<App />);
    const a = adicionar('Fonte');
    const b = adicionar('Reservatório');
    fireEvent.mouseDown(screen.getByTestId(`port-out-${a}`));
    fireEvent.mouseUp(screen.getByTestId(`peca-${b}`));
    const arestas = screen.queryAllByTestId('arrow');
    const antes = arestas.length;
    fireEvent.click(arestas[arestas.length - 1]!); // seleciona a nova conexão
    fireEvent.click(screen.getByText(/Excluir conexão/));
    expect(screen.queryAllByTestId('arrow').length).toBe(antes - 1);
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

  it('renomeia a peça e o rótulo passa a aparecer', () => {
    render(<App />);
    const id = adicionar('Bomba');
    fireEvent.click(screen.getByTestId(`peca-${id}`));
    const nome = screen.getByLabelText('Nome') as HTMLInputElement;
    fireEvent.change(nome, { target: { value: 'Bomba do poço' } });
    expect((screen.getByLabelText('Nome') as HTMLInputElement).value).toBe('Bomba do poço');
  });

  it('adiciona um ponto de consumo com vazão de saída configurável', () => {
    render(<App />);
    const id = adicionar('Consumo');
    fireEvent.click(screen.getByTestId(`peca-${id}`));
    const vazao = screen.getByLabelText('Vazão de saída') as HTMLInputElement;
    expect(vazao).toBeInTheDocument();
    fireEvent.change(vazao, { target: { value: '4.5' } });
    expect((screen.getByLabelText('Vazão de saída') as HTMLInputElement).value).toBe('4.5');
  });

  it('permite configurar a proteção contra bomba a seco', () => {
    render(<App />);
    const id = adicionar('Bomba');
    fireEvent.click(screen.getByTestId(`peca-${id}`));
    const prot = screen.getByLabelText(/Proteção a seco/) as HTMLInputElement;
    fireEvent.change(prot, { target: { value: '0.2' } });
    expect((screen.getByLabelText(/Proteção a seco/) as HTMLInputElement).value).toBe('0.2');
  });

  it('permite inserir uma boia (válvula de nível) no tubo', () => {
    render(<App />);
    const id = adicionar('Tubo');
    fireEvent.click(screen.getByTestId(`peca-${id}`));
    // Antes de ativar, os campos de nível da boia não existem.
    expect(screen.queryByLabelText(/Boia: fecha/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Boia (válvula de nível)'));
    // Ativada → aparecem os limiares.
    expect(screen.getByLabelText(/Boia: abre/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Boia: fecha/)).toBeInTheDocument();
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

  it('campos do inspetor ficam somente-leitura em execução', () => {
    render(<App />);
    // Seleciona uma peça e confirma que o campo Nome é editável em edição.
    const id = adicionar('Reservatório');
    fireEvent.click(screen.getByTestId(`peca-${id}`));
    expect(screen.getByLabelText('Nome')).not.toBeDisabled();
    // Conecta a peça para o grafo ser válido e entra em execução.
    const f = adicionar('Fonte');
    fireEvent.mouseDown(screen.getByTestId(`port-out-${f}`));
    fireEvent.mouseUp(screen.getByTestId(`peca-${id}`));
    fireEvent.click(screen.getByTestId(`peca-${id}`));
    fireEvent.click(screen.getByText('▶ Executar'));
    // Em execução o campo fica desabilitado (fieldset disabled).
    expect(screen.getByLabelText('Altura máxima')).toBeDisabled();
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

describe('unidades e novo projeto', () => {
  it('exibe a unidade de comprimento no rótulo dos campos', () => {
    render(<App />);
    const id = adicionar('Reservatório');
    fireEvent.click(screen.getByTestId(`peca-${id}`));
    // O rótulo visível de "Altura máxima" traz o sufixo de unidade (m por padrão).
    const label = screen.getByText('Altura máxima').closest('label')!;
    expect(label.textContent).toContain('(m)');
  });

  it('troca a unidade de comprimento e o sufixo acompanha', () => {
    render(<App />);
    const id = adicionar('Reservatório');
    fireEvent.click(screen.getByTestId(`peca-${id}`));
    fireEvent.change(screen.getByLabelText('Unidade de comprimento'), { target: { value: 'cm' } });
    const label = screen.getByText('Altura máxima').closest('label')!;
    expect(label.textContent).toContain('(cm)');
  });

  it('mostra vazão em volume/tempo (L/s) na fonte', () => {
    render(<App />);
    const id = adicionar('Fonte');
    fireEvent.click(screen.getByTestId(`peca-${id}`));
    const label = screen.getByText('Vazão fixa').closest('label')!;
    expect(label.textContent).toContain('(L/s)');
  });

  it('o botão Novo limpa o projeto (após confirmar)', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);
    expect(idsPecas().length).toBeGreaterThan(0); // exemplo carregado
    fireEvent.click(screen.getByText('✨ Novo'));
    expect(idsPecas().length).toBe(0);
    confirmSpy.mockRestore();
  });

  it('Novo não limpa se o usuário cancelar', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<App />);
    const antes = idsPecas().length;
    fireEvent.click(screen.getByText('✨ Novo'));
    expect(idsPecas().length).toBe(antes);
    confirmSpy.mockRestore();
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
