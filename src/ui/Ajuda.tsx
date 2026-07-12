/**
 * Página de Ajuda: como usar o simulador, as regras principais das peças, a
 * física simplificada e os dados técnicos relevantes. Modal centralizado com
 * backdrop e conteúdo rolável — todo o texto vem do i18n (pt/en).
 *
 * Termos físicos ganham LINK (Wikipedia). O `href` é por idioma (vem do i18n:
 * pt → pt.wikipedia, en → en.wikipedia); o texto do link fica marcado com
 * `<0>…</0>`/`<1>…</1>` no i18n e casado aqui pela ordem em LINKS.
 */
import { Trans, useTranslation } from 'react-i18next';

// Cada seção é um título + uma lista de itens (chaves i18n). Manter a ORDEM das
// chaves em sincronia com pt.ts/en.ts.
const SECOES: { titulo: string; itens: string[] }[] = [
  {
    titulo: 'ajuda.secComoUsar',
    itens: ['ajuda.usar1', 'ajuda.usar2', 'ajuda.usar3', 'ajuda.usar4', 'ajuda.usar5'],
  },
  {
    titulo: 'ajuda.secInterface',
    itens: ['ajuda.iface1', 'ajuda.iface2', 'ajuda.iface3', 'ajuda.iface4', 'ajuda.iface5', 'ajuda.iface6'],
  },
  {
    titulo: 'ajuda.secPecas',
    itens: [
      'ajuda.pecaReservatorio',
      'ajuda.pecaTubo',
      'ajuda.pecaBomba',
      'ajuda.pecaFonteConsumo',
      'ajuda.pecaSensor',
      'ajuda.pecaJuncao',
      'ajuda.pecaQuadro',
      'ajuda.pecaAlivio',
    ],
  },
  {
    titulo: 'ajuda.secFisica',
    itens: [
      'ajuda.fisica1',
      'ajuda.fisica2',
      'ajuda.fisicaStevin',
      'ajuda.fisicaVasos',
      'ajuda.fisicaJuncao',
      'ajuda.fisicaBomba',
      'ajuda.fisicaTransbordo',
      'ajuda.fisicaTomada',
      'ajuda.fisicaReynolds',
      'ajuda.fisica3',
      'ajuda.fisica4',
      'ajuda.fisicaGolpe',
      'ajuda.fisicaNPSH',
      'ajuda.fisicaAlivio',
      'ajuda.fisica5',
      'ajuda.fisica6',
    ],
  },
  {
    titulo: 'ajuda.secOpcoes',
    itens: ['ajuda.opc1', 'ajuda.opc2', 'ajuda.opc3', 'ajuda.opc4', 'ajuda.opc5', 'ajuda.opc6'],
  },
  {
    titulo: 'ajuda.secDados',
    itens: ['ajuda.dados1', 'ajuda.dados2', 'ajuda.dados3', 'ajuda.dados4'],
  },
];

// Itens que contêm links: chave → chaves i18n dos `href` (na ordem dos <0>,<1>…).
const LINKS: Record<string, string[]> = {
  'ajuda.fisica1': ['ajuda.linkVazao', 'ajuda.linkTorricelli', 'ajuda.linkCargaHidraulica'],
  'ajuda.fisica2': ['ajuda.linkContinuidade'],
  'ajuda.fisicaStevin': ['ajuda.linkStevin'],
  'ajuda.fisicaReynolds': ['ajuda.linkReynolds'],
  'ajuda.fisicaVasos': ['ajuda.linkVasos'],
  'ajuda.fisicaJuncao': ['ajuda.linkGaussSeidel', 'ajuda.linkConservacaoMassa'],
  'ajuda.fisicaBomba': ['ajuda.linkBomba'],
  'ajuda.fisica3': ['ajuda.linkPerdaCarga', 'ajuda.linkHazenWilliams', 'ajuda.linkDarcy'],
  'ajuda.fisica4': ['ajuda.linkValvulaRetencao'],
  'ajuda.fisicaGolpe': ['ajuda.linkGolpe', 'ajuda.linkJoukowsky'],
  'ajuda.fisicaNPSH': ['ajuda.linkNPSH', 'ajuda.linkPressaoVapor'],
  'ajuda.fisicaAlivio': ['ajuda.linkAlivio'],
  'ajuda.fisica6': ['ajuda.linkG'],
};

export function Ajuda({ onFechar }: { onFechar: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="ajuda-backdrop" onClick={onFechar} aria-hidden />
      <div className="ajuda-modal" role="dialog" aria-modal="true" aria-label={t('ajuda.titulo')}>
        <div className="ajuda-head">
          <strong>{t('ajuda.titulo')}</strong>
          <button onClick={onFechar} aria-label={t('ajuda.fechar')}>
            ✕
          </button>
        </div>
        <div className="ajuda-corpo">
          <p className="ajuda-intro">
            <Trans
              i18nKey="ajuda.intro"
              components={[<a key="cfd" href={t('ajuda.linkCFD')} target="_blank" rel="noreferrer" />]}
            />
          </p>
          {SECOES.map((s) => (
            <section key={s.titulo}>
              <h3>{t(s.titulo)}</h3>
              <ul>
                {s.itens.map((k) => (
                  <li key={k}>
                    {LINKS[k] ? (
                      <Trans
                        i18nKey={k}
                        components={LINKS[k].map((lk, i) => (
                          <a key={i} href={t(lk)} target="_blank" rel="noreferrer" />
                        ))}
                      />
                    ) : (
                      t(k)
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
