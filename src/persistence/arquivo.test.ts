import { describe, it, expect, beforeEach } from 'vitest';
import { serializarProjeto, carregarProjetoDeTexto, nomeArquivo } from './arquivo';
import { criarConexao, criarPeca, projetoVazio, _resetContadorIds } from '../domain/factory';
import type { ProjetoSimulacao } from '../domain/types';

beforeEach(() => _resetContadorIds());

function projetoRico(): ProjetoSimulacao {
  const f = criarPeca('fonte', 0, 0, 'F');
  const r = criarPeca('reservatorio', 100, 0, 'R');
  const b = criarPeca('bomba', 200, 0, 'B');
  return {
    ...projetoVazio('Meu Sistema'),
    pecas: [f, r, b],
    conexoes: [criarConexao('F', 'R'), criarConexao('R', 'B')],
  };
}

describe('round-trip export/import', () => {
  it('preserva o projeto ao serializar e recarregar', () => {
    const original = projetoRico();
    const r = carregarProjetoDeTexto(serializarProjeto(original));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.projeto.nome).toBe('Meu Sistema');
      expect(r.projeto.pecas).toHaveLength(3);
      expect(r.projeto.conexoes).toHaveLength(2);
      expect(r.projeto.pecas.map((p) => p.id)).toEqual(['F', 'R', 'B']);
    }
  });
});

describe('limpeza de estado transitório no export', () => {
  it('remove ultimaTroca/pedindoLigar do sensor e aberta da boia', () => {
    const s = criarPeca('sensor', 0, 0, 'S');
    (s.props as Record<string, unknown>).ultimaTroca = 16696;
    (s.props as Record<string, unknown>).pedindoLigar = false;
    const t = criarPeca('tubo', 0, 0, 'T');
    (t.props as Record<string, unknown>).boia = { nivelMinimo: 1, nivelMaximo: 2, aberta: false };
    const proj = { ...projetoVazio('X'), pecas: [s, t], conexoes: [] };

    const texto = serializarProjeto(proj);
    expect(texto).not.toContain('ultimaTroca');
    expect(texto).not.toContain('pedindoLigar');
    expect(texto).not.toContain('aberta');
    // O objeto original não é mutado (a limpeza clona).
    expect((s.props as Record<string, unknown>).ultimaTroca).toBe(16696);
  });
});

describe('tratamento de versão incompatível no import', () => {
  it('recusa MAJOR incompatível', () => {
    const proj = { ...projetoRico(), versao: '2.0.0' };
    const r = carregarProjetoDeTexto(JSON.stringify(proj));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.some((e) => e.caminho === 'versao')).toBe(true);
  });

  it('recusa versão ausente sem lançar', () => {
    const { versao: _omit, ...semVersao } = projetoRico();
    void _omit;
    const r = carregarProjetoDeTexto(JSON.stringify(semVersao));
    expect(r.ok).toBe(false);
  });
});

describe('nomeArquivo', () => {
  it('gera nome saneado com extensão .json', () => {
    expect(nomeArquivo(projetoVazio('Sistema de Água #1'))).toBe('Sistema_de_Água_1.json');
  });
  it('cai para "projeto" quando o nome fica vazio', () => {
    expect(nomeArquivo(projetoVazio('***'))).toBe('projeto.json');
  });
});
