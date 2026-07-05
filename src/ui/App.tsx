/**
 * Componente raiz do HydroFlow. Junta paleta, canvas, inspetor e barra de
 * ferramentas em torno do reducer central (Sprints 3–5).
 */
import { useEffect, useReducer, useRef, useState } from 'react';
import { reducer, estadoInicial } from '../state/store';
import { projetoExemplo } from '../domain/exemplo';
import { useSimulationLoop } from './useSimulationLoop';
import { Toolbar } from './Toolbar';
import { Palette } from './Palette';
import { Canvas } from './Canvas';
import { Inspector } from './Inspector';

export function App() {
  const [estado, dispatch] = useReducer(reducer, projetoExemplo(), estadoInicial);
  const [erroImport, setErroImport] = useState<string | null>(null);
  const [tamanho, setTamanho] = useState({ largura: 800, altura: 600 });
  // Mobile: o inspetor é uma gaveta; abre ao selecionar uma peça (no desktop a
  // classe não tem efeito visual, então o estado é inofensivo lá).
  const [inspetorAberto, setInspetorAberto] = useState(false);
  const [avisoVisivel, setAvisoVisivel] = useState(true);
  const [logAberto, setLogAberto] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useSimulationLoop(estado.rodando, dispatch);

  // Selecionar uma peça abre a gaveta do inspetor (relevante só no mobile).
  useEffect(() => {
    if (estado.selecionada) setInspetorAberto(true);
  }, [estado.selecionada]);

  // Mede a área central para dimensionar o Stage do konva.
  useEffect(() => {
    const medir = (): void => {
      const el = wrapRef.current;
      if (el) setTamanho({ largura: el.clientWidth, altura: el.clientHeight });
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);

  const selecionada = estado.projeto.pecas.find((p) => p.id === estado.selecionada);
  const emExecucao = estado.modo === 'execucao';

  return (
    <div className={`app${inspetorAberto ? ' inspetor-aberto' : ''}`}>
      <Toolbar estado={estado} dispatch={dispatch} onErroImport={setErroImport} />
      <div className="body">
        <Palette dispatch={dispatch} desabilitado={emExecucao} />

        <div ref={wrapRef} style={{ minWidth: 0, minHeight: 0, position: 'relative' }}>
          <Canvas
            estado={estado}
            dispatch={dispatch}
            largura={tamanho.largura}
            altura={tamanho.altura}
          />
          <button
            className="log-toggle"
            onClick={() => setLogAberto((v) => !v)}
            aria-label="Log de eventos"
          >
            📋 Log{estado.eventos.length ? ` (${estado.eventos.length})` : ''}
          </button>
          {logAberto && (
            <div className="log-panel">
              <div className="log-head">
                <strong>Log de eventos</strong>
                <button onClick={() => setLogAberto(false)} aria-label="Fechar log">
                  ✕
                </button>
              </div>
              {estado.eventos.length === 0 ? (
                <p className="telemetry" style={{ margin: '6px 0 0' }}>
                  Sem eventos — inicie a execução (▶).
                </p>
              ) : (
                <ul className="log-lista">
                  {[...estado.eventos].reverse().map((e, i) => (
                    <li key={estado.eventos.length - i} className={`ev ev-${e.tipo}`}>
                      <span className="ev-t">{e.tempo.toFixed(1)}s</span>
                      <span>{e.mensagem}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {avisoVisivel && (
            <div className="aviso-desktop" role="note">
              <span>
                ✎ Edição (adicionar e conectar peças) disponível apenas no
                computador — aqui você pode simular e inspecionar.
              </span>
              <button onClick={() => setAvisoVisivel(false)} aria-label="Fechar aviso">
                ✕
              </button>
            </div>
          )}
          {(estado.errosValidacao.length > 0 || erroImport) && (
            <div className="errors" role="alert">
              <strong>
                {erroImport ? 'Falha ao carregar arquivo' : 'Validação bloqueou a execução'}
              </strong>
              <ul>
                {erroImport
                  ? erroImport.split('\n').map((l, i) => <li key={i}>{l}</li>)
                  : estado.errosValidacao.map((e, i) => (
                      <li key={i}>
                        <code>{e.caminho}</code> — {e.mensagem}
                      </li>
                    ))}
              </ul>
              <button style={{ marginTop: 8 }} onClick={() => setErroImport(null)}>
                Fechar
              </button>
            </div>
          )}
        </div>

        <Inspector
          peca={selecionada}
          projeto={estado.projeto}
          emExecucao={emExecucao}
          vazao={selecionada ? estado.vazoes[selecionada.id] : undefined}
          dispatch={dispatch}
        />
      </div>

      {/* Mobile: backdrop fecha a gaveta; FAB abre o inspetor. */}
      {inspetorAberto && (
        <div
          className="drawer-backdrop"
          onClick={() => setInspetorAberto(false)}
          aria-hidden
        />
      )}
      <button
        className="fab-inspetor primary"
        onClick={() => setInspetorAberto((v) => !v)}
        aria-label="Abrir inspetor de propriedades"
      >
        ⚙
      </button>

      <footer className="rodape">
        <span>
          <strong>HydroFlow</strong> — simulador hidráulico simplificado (Torricelli +
          continuidade de volume)
        </span>
        <a
          href="https://github.com/rpgmem/HydroFlow"
          target="_blank"
          rel="noopener noreferrer"
        >
          ★ Código no GitHub
        </a>
      </footer>
    </div>
  );
}
