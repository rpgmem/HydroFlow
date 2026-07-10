/**
 * Menu ⚙ Opções: consolida configurações que não são "peças" — unidades do
 * projeto, tema de exibição e a física opcional (perda de carga por atrito).
 * Dropdown recolhível na toolbar (inline no desktop, colapsado no ⋯ no mobile).
 */
import { useState } from 'react';
import type { Acao, EstadoApp } from '../state/store';
import type { Unidades } from '../domain/types';
import { Switch } from './Switch';

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
  const velRef = estado.projeto.configuracaoSimulacao.velocidadeRef ?? 3;

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
            <Switch checked={tema === 'claro'} onChange={onAlternarTema} ariaLabel="Tema claro">
              Tema claro
            </Switch>

            <p className="opcoes-sec">Física</p>
            <Switch
              checked={atrito}
              disabled={emExecucao}
              ariaLabel="Perda de carga por atrito"
              onChange={(v) => dispatch({ tipo: 'SET_ATRITO', atrito: v })}
            >
              Perda de carga (atrito)
            </Switch>
            <p className="telemetry" style={{ margin: '2px 0 0' }}>
              Hazen-Williams: cada tubo usa seu <strong>comprimento</strong> e <strong>C</strong>.
              Desligado = Torricelli puro.
            </p>

            <div className="field" style={{ marginTop: 8 }}>
              <label>Velocidade de referência (m/s)</label>
              <input
                type="number"
                step={0.1}
                min={0.1}
                disabled={emExecucao}
                aria-label="Velocidade de referência"
                value={velRef}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v > 0) dispatch({ tipo: 'SET_VELOCIDADE_REF', velocidadeRef: v });
                }}
              />
            </div>
            <p className="telemetry" style={{ margin: '2px 0 0' }}>
              Limite de dimensionamento (padrão <strong>3 m/s</strong>): acima dela o tubo é
              sinalizado e define a vazão máx. recomendada.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
