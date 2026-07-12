/**
 * Página de Ajuda: como usar o simulador, as regras principais das peças, a
 * física simplificada e os dados técnicos relevantes. Modal centralizado com
 * backdrop e conteúdo rolável — todo o texto vem do i18n (pt/en).
 */
import { useTranslation } from 'react-i18next';

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
    ],
  },
  {
    titulo: 'ajuda.secFisica',
    itens: ['ajuda.fisica1', 'ajuda.fisica2', 'ajuda.fisica3', 'ajuda.fisica4', 'ajuda.fisica5', 'ajuda.fisica6'],
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
          <p className="ajuda-intro">{t('ajuda.intro')}</p>
          {SECOES.map((s) => (
            <section key={s.titulo}>
              <h3>{t(s.titulo)}</h3>
              <ul>
                {s.itens.map((k) => (
                  <li key={k}>{t(k)}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
