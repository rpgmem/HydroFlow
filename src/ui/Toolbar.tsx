/**
 * Barra de ferramentas (Sprint 4/5): nome do projeto, transição de modo,
 * play/pause/reset, controle de velocidade e persistência (salvar/carregar).
 */
import { useRef, useState } from 'react';
import type { Acao, EstadoApp, Velocidade } from '../state/store';
import { baixarProjeto, carregarArquivo } from '../persistence/arquivo';
import { projetoVazio } from '../domain/factory';
import type { Unidades } from '../domain/types';

interface Props {
  estado: EstadoApp;
  dispatch: React.Dispatch<Acao>;
  onErroImport: (msg: string) => void;
  onImprimir: () => void;
  tema: 'escuro' | 'claro';
  onAlternarTema: () => void;
}

const VELOCIDADES: Velocidade[] = [1, 5, 30, 120];

export function Toolbar({ estado, dispatch, onErroImport, onImprimir, tema, onAlternarTema }: Props) {
  const inputFile = useRef<HTMLInputElement>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const emExecucao = estado.modo === 'execucao';

  return (
    <div className="toolbar">
      <span className="brand">HydroFlow</span>

      <input
        type="text"
        aria-label="Nome do projeto"
        value={estado.projeto.nome}
        disabled={emExecucao}
        onChange={(e) => dispatch({ tipo: 'SET_NOME', nome: e.target.value })}
      />

      <span className={`badge ${estado.modo}`}>{estado.modo}</span>

      {!emExecucao ? (
        <button className="primary" onClick={() => dispatch({ tipo: 'ENTRAR_EXECUCAO' })}>
          ▶ Executar
        </button>
      ) : (
        <>
          {estado.rodando ? (
            <button onClick={() => dispatch({ tipo: 'PAUSE' })}>⏸ Pausar</button>
          ) : (
            <button className="primary" onClick={() => dispatch({ tipo: 'PLAY' })}>
              ▶ Play
            </button>
          )}
          <button onClick={() => dispatch({ tipo: 'RESET' })}>⟲ Reset</button>
          <button
            onClick={() => dispatch({ tipo: 'SAIR_EXECUCAO' })}
            disabled={estado.rodando}
            title={estado.rodando ? 'Pause antes de voltar à edição' : ''}
          >
            ✎ Editar
          </button>

          <span className="telemetry" style={{ marginLeft: 8 }}>
            Velocidade:
          </span>
          {VELOCIDADES.map((v) => (
            <button
              key={v}
              className={estado.velocidade === v ? 'ativo' : ''}
              onClick={() => dispatch({ tipo: 'SET_VELOCIDADE', velocidade: v })}
            >
              {v}x
            </button>
          ))}
          <span className="telemetry" style={{ marginLeft: 8 }}>
            t = <strong>{estado.tempo.toFixed(1)}s</strong>
          </span>
        </>
      )}

      {!emExecucao && (
        <span className="unidades-sel" title="Unidades do projeto">
          <select
            aria-label="Unidade de volume"
            value={estado.projeto.unidades.volume}
            onChange={(e) =>
              dispatch({
                tipo: 'SET_UNIDADES',
                unidades: { ...estado.projeto.unidades, volume: e.target.value as Unidades['volume'] },
              })
            }
          >
            <option value="litros">litros</option>
            <option value="m3">m³</option>
          </select>
          <select
            aria-label="Unidade de comprimento"
            value={estado.projeto.unidades.comprimento}
            onChange={(e) =>
              dispatch({
                tipo: 'SET_UNIDADES',
                unidades: { ...estado.projeto.unidades, comprimento: e.target.value as Unidades['comprimento'] },
              })
            }
          >
            <option value="m">m</option>
            <option value="cm">cm</option>
          </select>
        </span>
      )}

      <span className="spacer" />

      {/* No mobile, as ações secundárias recolhem sob "⋯" (o botão some no
          desktop, onde elas seguem inline via `display: contents`). */}
      <button
        className="menu-toggle"
        aria-label="Mais ações"
        aria-expanded={menuAberto}
        onClick={() => setMenuAberto((v) => !v)}
      >
        ⋯
      </button>
      <div className={`acoes-secundarias${menuAberto ? ' aberto' : ''}`}>
        {!emExecucao && (
          <button
            onClick={() => {
              setMenuAberto(false);
              if (window.confirm('Criar um projeto novo? Tudo que não foi salvo será perdido.')) {
                dispatch({ tipo: 'CARREGAR_PROJETO', projeto: projetoVazio() });
              }
            }}
          >
            ✨ Novo
          </button>
        )}
        <button
          onClick={onAlternarTema}
          title={tema === 'claro' ? 'Mudar para tema escuro' : 'Mudar para tema claro'}
        >
          {tema === 'claro' ? '🌙 Escuro' : '☀ Claro'}
        </button>
        <button
          onClick={() => {
            setMenuAberto(false);
            onImprimir();
          }}
          title="Imprimir o diagrama (fundo branco)"
        >
          🖨 Imprimir
        </button>
        <button
          onClick={() => {
            setMenuAberto(false);
            baixarProjeto(estado.projeto);
          }}
        >
          💾 Salvar
        </button>
        <button
          disabled={emExecucao}
          onClick={() => {
            setMenuAberto(false);
            inputFile.current?.click();
          }}
        >
          📂 Carregar
        </button>
        <input
          ref={inputFile}
          type="file"
          accept="application/json,.json"
          aria-label="Carregar arquivo"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = ''; // permite recarregar o mesmo arquivo
            if (!file) return;
            const r = await carregarArquivo(file);
            if (r.ok) dispatch({ tipo: 'CARREGAR_PROJETO', projeto: r.projeto });
            else onErroImport(r.erros.map((x) => `${x.caminho}: ${x.mensagem}`).join('\n'));
          }}
        />
      </div>
    </div>
  );
}
