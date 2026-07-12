/**
 * Autosave em localStorage: preserva o trabalho entre recarregamentos, MAS só enquanto o projeto deixou de ser o exemplo intocado (a decisão fica no App:
 * se o projeto atual == exemplo, `limparAutosave`; senão `salvarAutosave`). Assim quem só abre a página e não mexe recarrega no exemplo padrão.
 *
 * Reusa o mesmo caminho robusto do arquivo (`serializarProjeto` / `carregarProjetoDeTexto`), então dados corrompidos no storage nunca quebram a
 * inicialização — caem em `null` e o App usa o exemplo.
 */
import type { ProjetoSimulacao } from '../domain/types';
import { carregarProjetoDeTexto, serializarProjeto } from '../domain/schema';

const CHAVE = 'hydroflow:projeto';

export function salvarAutosave(projeto: ProjetoSimulacao): void {
  try {
    localStorage.setItem(CHAVE, serializarProjeto(projeto));
  } catch {
    /* localStorage indisponível/cheio (modo privado, cota) — ignora. */
  }
}

export function carregarAutosave(): ProjetoSimulacao | null {
  try {
    const texto = localStorage.getItem(CHAVE);
    if (!texto) return null;
    const r = carregarProjetoDeTexto(texto);
    return r.ok ? r.projeto : null;
  } catch {
    return null;
  }
}

export function limparAutosave(): void {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* ignora */
  }
}
