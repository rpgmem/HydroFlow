/**
 * HydroFlow — Validação de grafo
 *
 * Executada na transição edição→execução. Se falhar, o sistema permanece em modo edição e exibe os erros. Não roda incrementalmente durante a edição.
 *
 * Bloqueia:
 *  - Nó órfão (peça sem nenhuma conexão; sensor é exceção se aponta p/ bomba)
 *  - Aresta sem origem ou sem destino (id inexistente)
 *  - Ciclo bomba → … → própria origem sem dreno/saída (moto-perpétuo)
 *  - Fonte com soma de vazaoAlocada > vazaoFixa
 *
 * Permite:
 *  - Fonte conectada a múltiplos destinos
 *  - Múltiplos sensores controlando a mesma bomba
 */

import { vazaoRef } from '../domain/geradorVazao';
import {
  isBomba,
  isFonte,
  isQuadro,
  isSensor,
  type ProjetoSimulacao,
} from '../domain/types';
import type { ErroValidacao } from '../domain/schema';

export type ResultadoValidacaoGrafo =
  | { ok: true }
  | { ok: false; erros: ErroValidacao[] };

/**
 * Componentes fortemente conexos (Tarjan). Cada SCC com mais de um nó — ou um nó com auto-laço — representa um ciclo direcionado no grafo de conexões.
 */
function componentesFortementeConexos(
  nos: string[],
  adjacencia: Map<string, string[]>,
): string[][] {
  let indice = 0;
  const indices = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const naPilha = new Set<string>();
  const pilha: string[] = [];
  const sccs: string[][] = [];

  const forte = (v: string): void => {
    indices.set(v, indice);
    lowlink.set(v, indice);
    indice++;
    pilha.push(v);
    naPilha.add(v);

    for (const w of adjacencia.get(v) ?? []) {
      if (!indices.has(w)) {
        forte(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (naPilha.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, indices.get(w)!));
      }
    }

    if (lowlink.get(v) === indices.get(v)) {
      const comp: string[] = [];
      let w: string;
      do {
        w = pilha.pop()!;
        naPilha.delete(w);
        comp.push(w);
      } while (w !== v);
      sccs.push(comp);
    }
  };

  for (const v of nos) {
    if (!indices.has(v)) forte(v);
  }
  return sccs;
}

export function validarGrafo(
  projeto: ProjetoSimulacao,
): ResultadoValidacaoGrafo {
  const erros: ErroValidacao[] = [];
  const pecasPorId = new Map(projeto.pecas.map((p) => [p.id, p]));

  // ---- Ids duplicados (peças e conexões) -------------------------------
  const duplicados = (ids: string[]): string[] => {
    const vistos = new Set<string>();
    const dups = new Set<string>();
    for (const id of ids) {
      if (vistos.has(id)) dups.add(id);
      else vistos.add(id);
    }
    return [...dups];
  };
  for (const id of duplicados(projeto.pecas.map((p) => p.id))) {
    erros.push({ caminho: `pecas[${id}]`, mensagem: `id de peça duplicado: "${id}"`, chave: 'validacao.pecaDuplicada', params: { id } });
  }
  for (const id of duplicados(projeto.conexoes.map((c) => c.id))) {
    erros.push({ caminho: `conexoes[${id}]`, mensagem: `id de conexão duplicado: "${id}"`, chave: 'validacao.conexaoDuplicada', params: { id } });
  }

  // ---- Arestas com origem/destino inexistentes -------------------------
  for (const c of projeto.conexoes) {
    if (!pecasPorId.has(c.origem)) {
      erros.push({
        caminho: `conexoes[${c.id}].origem`,
        mensagem: `origem "${c.origem}" não corresponde a nenhuma peça`,
        chave: 'validacao.origemInexistente',
        params: { origem: c.origem },
      });
    }
    if (!pecasPorId.has(c.destino)) {
      erros.push({
        caminho: `conexoes[${c.id}].destino`,
        mensagem: `destino "${c.destino}" não corresponde a nenhuma peça`,
        chave: 'validacao.destinoInexistente',
        params: { destino: c.destino },
      });
    }
  }

  // ---- Nós órfãos ------------------------------------------------------
  const conectados = new Set<string>();
  for (const c of projeto.conexoes) {
    conectados.add(c.origem);
    conectados.add(c.destino);
  }
  for (const p of projeto.pecas) {
    if (conectados.has(p.id)) continue;
    // Sensor eletrônico se liga à(s) bomba(s) via props, não via conexão.
    if (isSensor(p) && p.props.bombasAlvo.some((id) => pecasPorId.has(id))) continue;
    // Quadro de comandos liga por props (bombas nos canais e/ou sensores-membro),
    // sem conexão física — não é órfão se referencia alguma peça existente.
    if (
      isQuadro(p) &&
      (p.props.canais.some((c) => pecasPorId.has(c.bomba)) ||
        (p.props.sensores ?? []).some((id) => pecasPorId.has(id)))
    )
      continue;
    erros.push({
      caminho: `pecas[${p.id}]`,
      mensagem: `peça "${p.id}" (${p.tipo}) está órfã — sem nenhuma conexão`,
      chave: 'validacao.orfa',
      params: { id: p.id, tipoKey: p.tipo },
    });
  }

  // ---- Quadro sem efeito (não comanda nenhuma bomba) ------------------
  // Um quadro só faz sentido se algum canal reger uma BOMBA existente. Um quadro vazio (ou só com sensores-membro, ou apontando para bombas inexistentes) não
  // tem efeito nenhum — sinaliza para o usuário completar ou remover.
  for (const p of projeto.pecas) {
    if (!isQuadro(p)) continue;
    const comandaBomba = p.props.canais.some((c) => {
      const b = pecasPorId.get(c.bomba);
      return b !== undefined && isBomba(b);
    });
    if (!comandaBomba) {
      erros.push({
        caminho: `pecas[${p.id}].canais`,
        mensagem: `quadro "${p.id}" não comanda nenhuma bomba (sem efeito)`,
        chave: 'validacao.quadroSemEfeito',
        params: { id: p.id },
      });
    }
  }

  // ---- Fonte: soma de vazaoAlocada > vazão da fonte --------------------
  // A fonte pode ter perfil no tempo; usamos a vazão de referência (máx/valor) como teto para a checagem de alocação entre múltiplos destinos.
  for (const p of projeto.pecas) {
    if (!isFonte(p)) continue;
    const saidas = projeto.conexoes.filter((c) => c.origem === p.id);
    if (saidas.length <= 1) continue; // destino único não exige alocação
    const soma = saidas.reduce((acc, c) => acc + (c.vazaoAlocada ?? 0), 0);
    const teto = vazaoRef(p.props.gerador);
    if (soma > teto + 1e-9) {
      erros.push({
        caminho: `pecas[${p.id}].vazaoAlocada`,
        mensagem: `soma de vazaoAlocada (${soma}) excede a vazão da fonte (${teto})`,
        chave: 'validacao.vazaoAlocada',
        params: { soma, vazaoFixa: teto },
      });
    }
  }

  // ---- Ciclo moto-perpétuo (bomba sem dreno) ---------------------------
  const nos = projeto.pecas.map((p) => p.id);
  const adjacencia = new Map<string, string[]>();
  for (const id of nos) adjacencia.set(id, []);
  for (const c of projeto.conexoes) {
    if (pecasPorId.has(c.origem) && pecasPorId.has(c.destino)) {
      adjacencia.get(c.origem)!.push(c.destino);
    }
  }

  for (const scc of componentesFortementeConexos(nos, adjacencia)) {
    const ehCiclo =
      scc.length > 1 ||
      (scc.length === 1 && (adjacencia.get(scc[0]!) ?? []).includes(scc[0]!));
    if (!ehCiclo) continue;

    const contémBomba = scc.some((id) => {
      const peca = pecasPorId.get(id);
      return peca !== undefined && isBomba(peca);
    });
    if (!contémBomba) continue; // ciclo sem bomba não é moto-perpétuo

    // Dreno = alguma aresta que sai do ciclo para fora dele.
    const conjunto = new Set(scc);
    const temDreno = scc.some((id) =>
      (adjacencia.get(id) ?? []).some((destino) => !conjunto.has(destino)),
    );
    if (!temDreno) {
      erros.push({
        caminho: `ciclo[${scc.join('→')}]`,
        mensagem:
          'ciclo fechado com bomba e sem dreno/saída (moto-perpétuo não é permitido)',
        chave: 'validacao.motoPerpetuo',
        params: {},
      });
    }
  }

  return erros.length > 0 ? { ok: false, erros } : { ok: true };
}
