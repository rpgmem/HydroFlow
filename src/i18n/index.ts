/**
 * Inicialização do i18next (react-i18next) para o HydroFlow.
 *
 * Idiomas: Português (pt, padrão/origem) e Inglês (en). A escolha é DETECTADA do navegador na primeira visita e PERSISTIDA em localStorage — o usuário pode
 * trocar manualmente nas ⚙ Opções (`i18n.changeLanguage`, que também persiste).
 *
 * `fallbackLng: 'pt'` garante que qualquer chave faltante caia no texto de origem. Sob teste (jsdom), o `src/test/setup.ts` força o idioma para `pt` para
 * as asserções em português permanecerem determinísticas.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { pt } from './pt';
import { en } from './en';

export const IDIOMAS = ['pt', 'en'] as const;
export type Idioma = (typeof IDIOMAS)[number];

/** Chave usada para persistir o idioma escolhido (mesma família das outras). */
export const CHAVE_IDIOMA = 'hydroflow:lang';

// Sob teste (Vitest, MODE='test') fixamos 'pt' e dispensamos o detector — as asserções em português ficam determinísticas independentes do navegador do CI.
const emTeste = import.meta.env?.MODE === 'test';

(emTeste ? i18n : i18n.use(LanguageDetector))
  .use(initReactI18next)
  .init({
    resources: {
      pt: { translation: pt },
      en: { translation: en },
    },
    fallbackLng: 'pt',
    lng: emTeste ? 'pt' : undefined,
    supportedLngs: IDIOMAS,
    // 'pt-BR'/'en-US' do navegador caem em 'pt'/'en' (sem região).
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: CHAVE_IDIOMA,
    },
    interpolation: { escapeValue: false }, // o React já escapa
  });

export default i18n;

/** Formata um número na convenção do idioma corrente (pt → pt-BR). */
export function fmtNumero(n: number, lang: string, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(lang === 'pt' ? 'pt-BR' : lang, opts).format(n);
}
