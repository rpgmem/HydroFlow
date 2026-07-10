import { describe, it, expect } from 'vitest';
import i18n from './index';
import { pt } from './pt';
import { en } from './en';

/** Todas as chaves (com ponto) de um dicionário aninhado, em ordem. */
function chaves(obj: Record<string, unknown>, prefixo = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const caminho = prefixo ? `${prefixo}.${k}` : k;
    if (v && typeof v === 'object') out.push(...chaves(v as Record<string, unknown>, caminho));
    else out.push(caminho);
  }
  return out.sort();
}

describe('i18n', () => {
  it('pt e en têm exatamente o mesmo conjunto de chaves', () => {
    expect(chaves(en)).toEqual(chaves(pt));
  });

  it('nenhuma tradução em branco', () => {
    for (const [nome, dic] of [['pt', pt], ['en', en]] as const) {
      for (const k of chaves(dic as Record<string, unknown>)) {
        const v = k.split('.').reduce<unknown>((o, part) => (o as Record<string, unknown>)[part], dic);
        expect(typeof v === 'string' && v.length > 0, `${nome}:${k}`).toBe(true);
      }
    }
  });

  it('sob teste começa em português', () => {
    expect(i18n.language).toBe('pt');
    expect(i18n.t('toolbar.salvar')).toBe(pt.toolbar.salvar);
  });

  it('troca de idioma devolve a string traduzida (e volta a pt)', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('toolbar.salvar')).toBe(en.toolbar.salvar);
    expect(i18n.t('pecas.bomba')).toBe('Pump');
    await i18n.changeLanguage('pt'); // restaura para não afetar outros testes
    expect(i18n.t('pecas.bomba')).toBe('Bomba');
  });
});
