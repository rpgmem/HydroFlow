/**
 * Barra de ferramentas: nome do projeto, transição de modo, play/pause/reset, controle de velocidade e persistência (salvar/carregar).
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Acao, EstadoApp, Velocidade } from '../state/store';
import { baixarProjeto, carregarArquivo } from '../persistence/arquivo';
import { projetoVazio } from '../domain/factory';
import { projetoExemplo } from '../domain/exemplo';
import { Opcoes, type FormatoTempo } from './Opcoes';

interface Props {
  estado: EstadoApp;
  dispatch: React.Dispatch<Acao>;
  onErroImport: (msg: string) => void;
  onImprimir: () => void;
  tema: 'escuro' | 'claro';
  onAlternarTema: () => void;
  onAlternarLegenda: () => void;
  legendaAberta: boolean;
  onAbrirAjuda: () => void;
  /** Projeto difere do exemplo intocado — revela Salvar e Restaurar exemplo. */
  alterado: boolean;
  formatoTempo: FormatoTempo;
  onFormatoTempo: (f: FormatoTempo) => void;
}

const VELOCIDADES: Velocidade[] = [1, 5, 30, 120];

const DIA_SEGUNDOS = 86400; // segundos de um dia real (o perfil "diária" usa isso)

/**
 * Formata o tempo de simulação (segundos) como um relógio de 24 h (HH:MM:SS), começando em 00:00:00 e dando a volta a cada 24 h. O contador em segundos segue
 * acumulando à parte; este é só o "horário do dia" correspondente.
 */
function relogio24h(segundos: number): string {
  const s = Math.floor(((segundos % DIA_SEGUNDOS) + DIA_SEGUNDOS) % DIA_SEGUNDOS);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

export function Toolbar({ estado, dispatch, onErroImport, onImprimir, tema, onAlternarTema, onAlternarLegenda, legendaAberta, onAbrirAjuda, alterado, formatoTempo, onFormatoTempo }: Props) {
  const { t } = useTranslation();
  const inputFile = useRef<HTMLInputElement>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const emExecucao = estado.modo === 'execucao';

  return (
    <div className="toolbar">
      <span className="brand">HydroFlow</span>

      <input
        type="text"
        aria-label={t('toolbar.nomeProjeto')}
        value={estado.projeto.nome}
        disabled={emExecucao}
        onChange={(e) => dispatch({ tipo: 'SET_NOME', nome: e.target.value })}
      />

      {/* Status edição/execução: oculto no mobile (barra enxuta) — ver so-desktop. */}
      <span className={`badge ${estado.modo} so-desktop`}>{t(`modo.${estado.modo}`)}</span>

      {!emExecucao ? (
        <>
          <button className="primary" onClick={() => dispatch({ tipo: 'ENTRAR_EXECUCAO' })}>
            {t('toolbar.executar')}
          </button>
          {/* Desfazer/refazer: só no desktop (o mobile não edita — paleta oculta). */}
          <button
            className="so-desktop"
            aria-label={t('toolbar.desfazer')}
            title={t('toolbar.desfazerTitulo')}
            disabled={estado.undoStack.length === 0}
            onClick={() => dispatch({ tipo: 'UNDO' })}
          >
            ↶
          </button>
          <button
            className="so-desktop"
            aria-label={t('toolbar.refazer')}
            title={t('toolbar.refazerTitulo')}
            disabled={estado.redoStack.length === 0}
            onClick={() => dispatch({ tipo: 'REDO' })}
          >
            ↷
          </button>
        </>
      ) : (
        <>
          {estado.rodando ? (
            <button onClick={() => dispatch({ tipo: 'PAUSE' })}>{t('toolbar.pausar')}</button>
          ) : (
            <button className="primary" onClick={() => dispatch({ tipo: 'PLAY' })}>
              {t('toolbar.play')}
            </button>
          )}
          <button onClick={() => dispatch({ tipo: 'RESET' })}>{t('toolbar.reset')}</button>
          {/* Voltar à edição: só no desktop (o mobile é superfície de simular/inspecionar). */}
          <button
            className="so-desktop"
            onClick={() => dispatch({ tipo: 'SAIR_EXECUCAO' })}
            disabled={estado.rodando}
            title={estado.rodando ? t('toolbar.pauseAntes') : ''}
          >
            {t('toolbar.editar')}
          </button>

          <span className="telemetry" style={{ marginLeft: 8 }}>
            {t('toolbar.velocidade')}
          </span>
          {/* Desktop: botões inline. Mobile: um seletor compacto (poupa espaço). */}
          <span className="vel-botoes so-desktop">
            {VELOCIDADES.map((v) => (
              <button
                key={v}
                className={estado.velocidade === v ? 'ativo' : ''}
                onClick={() => dispatch({ tipo: 'SET_VELOCIDADE', velocidade: v })}
              >
                {v}x
              </button>
            ))}
          </span>
          <select
            className="vel-select so-mobile"
            value={estado.velocidade}
            aria-label={t('toolbar.velocidade')}
            onChange={(e) => dispatch({ tipo: 'SET_VELOCIDADE', velocidade: Number(e.target.value) as Velocidade })}
          >
            {VELOCIDADES.map((v) => (
              <option key={v} value={v}>{v}x</option>
            ))}
          </select>
          {formatoTempo !== 'horario' && (
            <span className="telemetry" style={{ marginLeft: 8 }}>
              {t('toolbar.tempo')}<strong>{estado.tempo.toFixed(1)}s</strong>
            </span>
          )}
          {formatoTempo !== 'segundos' && (
            <span className="telemetry" style={{ marginLeft: 8 }}>
              {t('toolbar.horario')}<strong>{relogio24h(estado.tempo)}</strong>
            </span>
          )}
        </>
      )}

      <span className="spacer" />

      {/* No mobile, as ações secundárias (⚙ Opções incluído) recolhem sob "⋯"
          (o botão some no desktop, onde elas seguem inline via `display: contents`). */}
      <button
        className="menu-toggle"
        aria-label={t('toolbar.maisAcoes')}
        aria-expanded={menuAberto}
        onClick={() => setMenuAberto((v) => !v)}
      >
        ⋯
      </button>
      <div className={`acoes-secundarias${menuAberto ? ' aberto' : ''}`}>
        <Opcoes estado={estado} dispatch={dispatch} tema={tema} onAlternarTema={onAlternarTema} formatoTempo={formatoTempo} onFormatoTempo={onFormatoTempo} />
        <button
          className={legendaAberta ? 'ativo' : ''}
          aria-pressed={legendaAberta}
          onClick={() => {
            setMenuAberto(false);
            onAlternarLegenda();
          }}
          title={t('toolbar.legendaTitulo')}
        >
          {t('toolbar.legenda')}
        </button>
        {/* Ajuda: só na edição e só no desktop (barra enxuta no mobile). */}
        {!emExecucao && (
          <button
            className="so-desktop"
            onClick={() => {
              setMenuAberto(false);
              onAbrirAjuda();
            }}
          >
            {t('ajuda.botao')}
          </button>
        )}
        {!emExecucao && (
          <button
            onClick={() => {
              setMenuAberto(false);
              if (window.confirm(t('toolbar.novoConfirm'))) {
                dispatch({ tipo: 'CARREGAR_PROJETO', projeto: projetoVazio() });
              }
            }}
          >
            {t('toolbar.novo')}
          </button>
        )}
        {/* "Restaurar exemplo" só quando já se saiu do exemplo (senão nada a
            restaurar); só em edição. */}
        {!emExecucao && alterado && (
          <button
            onClick={() => {
              setMenuAberto(false);
              if (window.confirm(t('toolbar.restaurarConfirm'))) {
                dispatch({ tipo: 'CARREGAR_PROJETO', projeto: projetoExemplo() });
              }
            }}
            title={t('toolbar.restaurarTitulo')}
          >
            {t('toolbar.restaurar')}
          </button>
        )}
        <button
          onClick={() => {
            setMenuAberto(false);
            onImprimir();
          }}
          title={t('toolbar.imprimirTitulo')}
        >
          {t('toolbar.imprimir')}
        </button>
        {/* "Salvar" só quando há algo diferente do exemplo intocado. */}
        {alterado && (
          <button
            onClick={() => {
              setMenuAberto(false);
              baixarProjeto(estado.projeto);
            }}
          >
            {t('toolbar.salvar')}
          </button>
        )}
        <button
          disabled={emExecucao}
          onClick={() => {
            setMenuAberto(false);
            inputFile.current?.click();
          }}
        >
          {t('toolbar.carregar')}
        </button>
        <input
          ref={inputFile}
          type="file"
          accept="application/json,.json"
          aria-label={t('toolbar.carregarArquivo')}
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
