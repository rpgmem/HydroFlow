/**
 * Componente raiz do HydroFlow. Junta paleta, canvas, inspetor e barra de
 * ferramentas em torno do reducer central (Sprints 3–5).
 */
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import '../i18n'; // inicializa o i18next antes de qualquer useTranslation()
import { reducer, estadoInicial } from '../state/store';
import { projetoExemplo } from '../domain/exemplo';
import { serializarProjeto, type ErroValidacao } from '../domain/schema';
import { carregarAutosave, limparAutosave, salvarAutosave } from '../persistence/autosave';
import { useSimulationLoop } from './useSimulationLoop';
import { Toolbar } from './Toolbar';
import type { FormatoTempo } from './Opcoes';
import { Palette } from './Palette';
import { Canvas } from './Canvas';
import { Inspector } from './Inspector';
import { Legenda } from './Legenda';

/** Chave de persistência do tema (preferência do dispositivo, mesma família das outras). */
const CHAVE_TEMA = 'hydroflow:tema';
/** Lê o tema salvo no localStorage; padrão 'escuro'. Robusto a storage indisponível. */
function carregarTema(): 'escuro' | 'claro' {
  try {
    return localStorage.getItem(CHAVE_TEMA) === 'claro' ? 'claro' : 'escuro';
  } catch {
    return 'escuro';
  }
}

/** Formato do tempo na barra (preferência do dispositivo, como o tema/idioma). */
const CHAVE_FORMATO_TEMPO = 'hydroflow:formatoTempo';
function carregarFormatoTempo(): FormatoTempo {
  try {
    const v = localStorage.getItem(CHAVE_FORMATO_TEMPO);
    return v === 'segundos' || v === 'horario' || v === 'ambos' ? v : 'ambos';
  } catch {
    return 'ambos';
  }
}

export function App() {
  const { t } = useTranslation();
  // Restaura o autosave se houver; senão abre no exemplo. `exemploSerial` é a
  // referência do exemplo INTOCADO — enquanto o projeto for igual a ela, nada é
  // persistido (quem só abre e não mexe recarrega no exemplo).
  const exemploSerial = useRef(serializarProjeto(projetoExemplo()));
  const [estado, dispatch] = useReducer(reducer, carregarAutosave() ?? projetoExemplo(), estadoInicial);
  const [erroImport, setErroImport] = useState<string | null>(null);
  const [tamanho, setTamanho] = useState({ largura: 800, altura: 600 });
  // Mobile: o inspetor é uma gaveta; abre ao selecionar uma peça (no desktop a
  // classe não tem efeito visual, então o estado é inofensivo lá).
  const [inspetorAberto, setInspetorAberto] = useState(false);
  const [avisoVisivel, setAvisoVisivel] = useState(true);
  const [logAberto, setLogAberto] = useState(false);
  const [legendaAberta, setLegendaAberta] = useState(false);
  // Tema de exibição: escuro é o padrão; claro é opcional e usado na impressão.
  // Preferência do DISPOSITIVO — persistida no localStorage (como o idioma), não
  // no arquivo do projeto. Sobrevive à recarga.
  const [tema, setTema] = useState<'escuro' | 'claro'>(carregarTema);
  const [imprimindo, setImprimindo] = useState(false);
  const temaClaro = imprimindo || tema === 'claro';
  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_TEMA, tema);
    } catch {
      /* localStorage indisponível (modo privado/cota) — ignora. */
    }
  }, [tema]);
  // Formato do tempo na barra (segundos / horário 24 h / ambos) — preferência do
  // dispositivo, persistida como o tema.
  const [formatoTempo, setFormatoTempo] = useState<FormatoTempo>(carregarFormatoTempo);
  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_FORMATO_TEMPO, formatoTempo);
    } catch {
      /* localStorage indisponível — ignora. */
    }
  }, [formatoTempo]);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Aviso "edição só no desktop": some sozinho após ~8 s (não fica atrapalhando)
  // e assim que a simulação começa (ENTRAR_EXECUCAO/Play) — ver render abaixo.
  useEffect(() => {
    if (!avisoVisivel) return;
    const id = window.setTimeout(() => setAvisoVisivel(false), 8000);
    return () => window.clearTimeout(id);
  }, [avisoVisivel]);
  useEffect(() => {
    if (estado.modo === 'execucao') setAvisoVisivel(false);
  }, [estado.modo]);

  useSimulationLoop(estado.rodando, dispatch);

  // Selecionar uma peça abre a gaveta do inspetor (relevante só no mobile).
  useEffect(() => {
    if (estado.selecionada) setInspetorAberto(true);
  }, [estado.selecionada]);

  // Atalhos de desfazer/refazer (só em edição). Ignora quando o foco está num
  // campo de texto (aí o Ctrl+Z é o "desfazer" nativo do input).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (estado.modo !== 'edicao' || !(e.ctrlKey || e.metaKey)) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ tipo: 'UNDO' });
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault();
        dispatch({ tipo: 'REDO' });
      } else if (k === 'd' && estado.selecionada) {
        e.preventDefault(); // duplica a peça selecionada
        dispatch({ tipo: 'DUPLICAR_PECA', id: estado.selecionada });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [estado.modo, estado.selecionada]);

  // Autosave: em EDIÇÃO, persiste quando o projeto deixa de ser o exemplo
  // intocado; se voltar a ser o exemplo ("Restaurar exemplo"), limpa o storage.
  // Durante a execução o nível é transitório — não salva.
  useEffect(() => {
    if (estado.modo !== 'edicao') return;
    const atual = serializarProjeto(estado.projeto);
    if (atual === exemploSerial.current) limparAutosave();
    else salvarAutosave(estado.projeto);
  }, [estado.projeto, estado.modo]);

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

  // Impressão: usa o tema CLARO (rótulos escuros), o Canvas enquadra tudo, e
  // então window.print() (o CSS @media print esconde a interface). Ao terminar,
  // volta ao normal. Um pequeno atraso dá tempo do enquadramento/re-render.
  useEffect(() => {
    if (!imprimindo) return;
    const fim = (): void => setImprimindo(false);
    window.addEventListener('afterprint', fim);
    const t = setTimeout(() => window.print(), 120);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', fim);
    };
  }, [imprimindo]);

  const selecionada = estado.projeto.pecas.find((p) => p.id === estado.selecionada);
  const emExecucao = estado.modo === 'execucao';
  // "Alterado" = o projeto difere do exemplo intocado. Em execução tratamos como
  // alterado (o nível/estado é transitório). Guia a exibição de Salvar/Restaurar:
  // não faz sentido salvar nem "restaurar o exemplo" quando já se está nele.
  const alterado = useMemo(
    () => emExecucao || serializarProjeto(estado.projeto) !== exemploSerial.current,
    [estado.projeto, emExecucao],
  );
  // Erro de validação: usa a chave i18n quando houver (resolvendo o tipo da peça
  // em `pecas.<tipo>`); senão cai na mensagem em Português (ex.: erros de schema
  // no import, ainda não internacionalizados).
  const traduzErro = (e: ErroValidacao): string => {
    if (!e.chave) return e.mensagem;
    const p: Record<string, string | number> = { ...(e.params ?? {}) };
    if (typeof p.tipoKey === 'string') p.tipo = t(`pecas.${p.tipoKey}`);
    return t(e.chave, p);
  };

  return (
    <div
      className={`app${temaClaro ? ' tema-claro' : ''}${inspetorAberto ? ' inspetor-aberto' : ''}`}
    >
      <Toolbar
        estado={estado}
        dispatch={dispatch}
        onErroImport={setErroImport}
        onImprimir={() => setImprimindo(true)}
        tema={tema}
        onAlternarTema={() => setTema((t) => (t === 'claro' ? 'escuro' : 'claro'))}
        onAlternarLegenda={() => setLegendaAberta((v) => !v)}
        legendaAberta={legendaAberta}
        alterado={alterado}
        formatoTempo={formatoTempo}
        onFormatoTempo={setFormatoTempo}
      />
      <div className="body">
        <Palette dispatch={dispatch} desabilitado={emExecucao} pecas={estado.projeto.pecas} />

        <div ref={wrapRef} style={{ minWidth: 0, minHeight: 0, position: 'relative' }}>
          <Canvas
            estado={estado}
            dispatch={dispatch}
            largura={tamanho.largura}
            altura={tamanho.altura}
            temaClaro={temaClaro}
            imprimindo={imprimindo}
          />
          <button
            className="log-toggle"
            onClick={() => setLogAberto((v) => !v)}
            aria-label={t('app.logEventos')}
          >
            {t('app.log')}{estado.eventos.length ? ` (${estado.eventos.length})` : ''}
          </button>
          {logAberto && (
            <div className="log-panel">
              <div className="log-head">
                <strong>{t('app.logEventos')}</strong>
                <button onClick={() => setLogAberto(false)} aria-label={t('app.fecharLog')}>
                  ✕
                </button>
              </div>
              {estado.eventos.length === 0 ? (
                <p className="telemetry" style={{ margin: '6px 0 0' }}>
                  {t('app.semEventos')}
                </p>
              ) : (
                <ul className="log-lista">
                  {[...estado.eventos].reverse().map((e, i) => (
                    <li key={estado.eventos.length - i} className={`ev ev-${e.tipo}`}>
                      <span className="ev-t">{e.tempo.toFixed(1)}s</span>
                      <span>{t(e.chave, e.params)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {legendaAberta && <Legenda onFechar={() => setLegendaAberta(false)} />}
          {avisoVisivel && estado.modo !== 'execucao' && (
            <div className="aviso-desktop" role="note">
              <span>{t('app.avisoDesktop')}</span>
              <button onClick={() => setAvisoVisivel(false)} aria-label={t('app.fecharAviso')}>
                ✕
              </button>
            </div>
          )}
          {(estado.errosValidacao.length > 0 || erroImport) && (
            <div className="errors" role="alert">
              <strong>
                {erroImport ? t('app.falhaCarregar') : t('app.validacaoBloqueou')}
              </strong>
              <ul>
                {erroImport
                  ? erroImport.split('\n').map((l, i) => <li key={i}>{l}</li>)
                  : estado.errosValidacao.map((e, i) => (
                      <li key={i}>
                        <code>{e.caminho}</code> — {traduzErro(e)}
                      </li>
                    ))}
              </ul>
              <button style={{ marginTop: 8 }} onClick={() => setErroImport(null)}>
                {t('app.fechar')}
              </button>
            </div>
          )}
        </div>

        <Inspector
          peca={selecionada}
          projeto={estado.projeto}
          emExecucao={emExecucao}
          vazao={selecionada ? estado.vazoes[selecionada.id] : undefined}
          historico={selecionada ? estado.historico[selecionada.id] : undefined}
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
        aria-label={t('app.abrirInspetor')}
      >
        ⚙
      </button>

      <footer className="rodape">
        <span>
          <Trans i18nKey="app.rodape" components={{ 0: <strong /> }} />
        </span>
        <a
          href="https://github.com/rpgmem/HydroFlow"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('app.codigoGithub')}
        </a>
      </footer>
    </div>
  );
}
