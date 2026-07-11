/**
 * Normalização de IDs de peças: reescreve cada `id` como um slug FIEL ao rótulo
 * (minúsculo, sem acentos, sem espaços) e atualiza TODAS as referências cruzadas
 * (conexões, canais/sensores dos quadros, `bombasAlvo` dos sensores, `sensores`
 * das bombas). Ação opt-in — o app não acopla `id` ao rótulo automaticamente
 * (renomear não mexe no id); isto só roda quando o usuário pede.
 *
 * Pré-condição de qualidade: rótulos ÚNICOS. `rotulosDuplicados` sinaliza o que
 * precisa ser resolvido antes (a UI bloqueia a ação enquanto houver duplicados).
 * Ainda assim, `normalizarIds` é defensivo: rótulos distintos que gerem o mesmo
 * slug recebem sufixo `_2`, `_3`… para manter os ids únicos.
 */
import { isBomba, isQuadro, isSensor, type Peca, type ProjetoSimulacao } from './types';

/** Slug fiel a um texto: sem acento, minúsculo, não-alfanumérico vira `_`. */
export function slugId(texto: string): string {
  const s = (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove os diacríticos (acentos)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_') // qualquer não-alfanumérico → _
    .replace(/^_+|_+$/g, ''); // apara _ das pontas
  return s || 'peca';
}

/**
 * Rótulos que se repetem entre as peças (comparação sem espaços nas pontas e sem
 * distinguir maiúsc./minúsc.). Rótulo vazio não conta. Retorna os textos duplicados.
 */
export function rotulosDuplicados(projeto: ProjetoSimulacao): string[] {
  const cont = new Map<string, { rotulo: string; n: number }>();
  for (const p of projeto.pecas) {
    const r = (p.rotulo ?? '').trim();
    if (!r) continue;
    const chave = r.toLowerCase();
    const e = cont.get(chave);
    if (e) e.n += 1;
    else cont.set(chave, { rotulo: r, n: 1 });
  }
  return [...cont.values()].filter((e) => e.n > 1).map((e) => e.rotulo);
}

/**
 * Devolve um projeto com os ids das peças normalizados (slug do rótulo, ou do id
 * quando sem rótulo), as conexões renumeradas em sequência (`c_1…c_N`, na ordem
 * da lista) e todas as referências atualizadas. Se nada mudaria, devolve a MESMA
 * referência (para não sujar histórico/estado "alterado").
 */
export function normalizarIds(projeto: ProjetoSimulacao): ProjetoSimulacao {
  const usados = new Set<string>();
  const mapa = new Map<string, string>();
  for (const p of projeto.pecas) {
    const base = slugId(p.rotulo && p.rotulo.trim() ? p.rotulo : p.id);
    let id = base;
    let i = 2;
    while (usados.has(id)) {
      id = `${base}_${i}`;
      i += 1;
    }
    usados.add(id);
    mapa.set(p.id, id);
  }

  // Muda se algum id de peça vira outro OU se alguma conexão está fora da
  // sequência `c_1…c_N` (numeração "pulando").
  const idsMudaram = [...mapa].some(([velho, novo]) => velho !== novo);
  const conexoesMudam = projeto.conexoes.some((c, i) => c.id !== `c_${i + 1}`);
  if (!idsMudaram && !conexoesMudam) return projeto;

  const rid = (id: string): string => mapa.get(id) ?? id;
  const pecas: Peca[] = projeto.pecas.map((p): Peca => {
    const id = rid(p.id);
    if (isBomba(p)) {
      return { ...p, id, props: { ...p.props, sensores: p.props.sensores.map(rid) } };
    }
    if (isSensor(p)) {
      return { ...p, id, props: { ...p.props, bombasAlvo: p.props.bombasAlvo.map(rid) } };
    }
    if (isQuadro(p)) {
      return {
        ...p,
        id,
        props: {
          ...p.props,
          sensores: p.props.sensores?.map(rid),
          canais: p.props.canais.map((c) => ({
            ...c,
            bomba: rid(c.bomba),
            sensores: c.sensores?.map(rid),
            sensor: c.sensor ? rid(c.sensor) : c.sensor,
          })),
        },
      };
    }
    return { ...p, id };
  });
  // Renumera as conexões em sequência (`c_1…c_N`) e remapeia os endpoints. A
  // conexão não é referenciada por peça alguma, então a renumeração é livre.
  const conexoes = projeto.conexoes.map((c, i) => ({
    ...c,
    id: `c_${i + 1}`,
    origem: rid(c.origem),
    destino: rid(c.destino),
  }));
  return { ...projeto, pecas, conexoes };
}
