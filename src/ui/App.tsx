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
  const wrapRef = useRef<HTMLDivElement>(null);

  useSimulationLoop(estado.rodando, dispatch);

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
    <div className="app">
      <Toolbar estado={estado} dispatch={dispatch} onErroImport={setErroImport} />
      <div className="body">
        <Palette dispatch={dispatch} desabilitado={emExecucao} />

        <div ref={wrapRef} style={{ minHeight: 0, position: 'relative' }}>
          <Canvas
            estado={estado}
            dispatch={dispatch}
            largura={tamanho.largura}
            altura={tamanho.altura}
          />
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
