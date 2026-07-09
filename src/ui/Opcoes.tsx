/**
 * Menu ⚙ Opções: consolida configurações que não são "peças" — unidades do
 * projeto, tema de exibição e a física opcional (perda de carga por atrito).
 * Dropdown recolhível na toolbar (inline no desktop, colapsado no ⋯ no mobile).
 */
import { useState } from 'react';
import type { Acao, EstadoApp } from '../state/store';
import type { Unidades } from '../domain/types';

interface Props {
  estado: EstadoApp;
  dispatch: React.Dispatch<Acao>;
  tema: 'escuro' | 'claro';
  onAlternarTema: () => void;
}

export function Opcoes({ estado, dispatch, tema, onAlternarTema }: Props) {
  const [aberto, setAberto] = useState(false);
  const emExecucao = estado.modo === 'execucao';
  const u = estado.projeto.unidades;
  const atrito = estado.projeto.configuracaoSimulacao.atrito === true;

  return (
    <div className="opcoes">
      <button
        className={aberto ? 'ativo' : ''}
        aria-label="Opções"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
      >
        ⚙ Opções
      </button>
      {aberto && (
        <>
          <div className="opcoes-backdrop" onClick={() => setAberto(false)} aria-hidden />
          <div className="opcoes-menu" role="dialog" aria-label="Opções">
            <p className="opcoes-sec">Unidades</p>
            <div className="field">
              <label>Volume</label>
              <select
                aria-label="Unidade de volume"
                disabled={emExecucao}
                value={u.volume}
                onChange={(e) =>
                  dispatch({ tipo: 'SET_UNIDADES', unidades: { ...u, volume: e.target.value as Unidades['volume'] } })
                }
              >
                <option value="litros">litros</option>
                <option value="m3">m³</option>
              </select>
            </div>
            <div className="field">
              <label>Comprimento</label>
              <select
                aria-label="Unidade de comprimento"
                disabled={emExecucao}
                value={u.comprimento}
                onChange={(e) =>
                  dispatch({ tipo: 'SET_UNIDADES', unidades: { ...u, comprimento: e.target.value as Unidades['comprimento'] } })
                }
              >
                <option value="m">m</option>
                <option value="cm">cm</option>
              </select>
            </div>

            <p className="opcoes-sec">Exibição</p>
            <label className="checkbox">
              <input type="checkbox" checked={tema === 'claro'} onChange={onAlternarTema} />
              Tema claro
            </label>

            <p className="opcoes-sec">Física</p>
            <label className="checkbox">
              <input
                type="checkbox"
                disabled={emExecucao}
                checked={atrito}
                aria-label="Perda de carga por atrito"
                onChange={(e) => dispatch({ tipo: 'SET_ATRITO', atrito: e.target.checked })}
              />
              Perda de carga (atrito)
            </label>
            <p className="telemetry" style={{ margin: '2px 0 0' }}>
              Hazen-Williams: cada tubo usa seu <strong>comprimento</strong> e <strong>C</strong>.
              Desligado = Torricelli puro.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
