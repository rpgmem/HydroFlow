/**
 * HydroFlow — Persistência via arquivo `.json`
 *
 * Sem backend e sem banco de dados: o projeto é serializado e baixado como arquivo, e recarregado por upload. A validação de schema/versão é reaplicada no import.
 */

import {
  carregarProjetoDeTexto,
  serializarProjeto,
  type ResultadoParse,
} from '../domain/schema';
import type { ProjetoSimulacao } from '../domain/types';

/** Nome de arquivo sugerido a partir do nome do projeto. */
export function nomeArquivo(projeto: ProjetoSimulacao): string {
  const base = projeto.nome.trim().replace(/[^\w\-À-ÿ ]+/g, '').replace(/\s+/g, '_');
  return `${base || 'projeto'}.json`;
}

/**
 * Dispara o download do projeto como `.json`. Isolado do DOM real via injeção do documento para permitir teste (jsdom) sem navegador.
 */
export function baixarProjeto(
  projeto: ProjetoSimulacao,
  doc: Document = document,
): void {
  const texto = serializarProjeto(projeto);
  const blob = new Blob([texto], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = nomeArquivo(projeto);
  doc.body.appendChild(a);
  a.click();
  doc.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Lê o conteúdo de um arquivo selecionado e o valida. */
export async function carregarArquivo(file: File): Promise<ResultadoParse> {
  try {
    const texto = await file.text();
    return carregarProjetoDeTexto(texto);
  } catch (e) {
    return {
      ok: false,
      erros: [
        {
          caminho: '',
          mensagem: `falha ao ler arquivo: ${e instanceof Error ? e.message : String(e)}`,
        },
      ],
    };
  }
}

export { serializarProjeto, carregarProjetoDeTexto };
