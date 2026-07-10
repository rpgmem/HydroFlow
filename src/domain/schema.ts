/**
 * HydroFlow — Validação e versionamento de schema (Sprint 1)
 *
 * Tudo roda no cliente, então "segurança" aqui significa robustez: um `.json`
 * malformado ou malicioso nunca deve derrubar a aplicação. Toda a superfície de
 * parsing é envolvida em try/catch e retorna um `ResultadoParse` discriminado
 * em vez de lançar exceções para o chamador.
 */

import { SCHEMA_VERSION, type ProjetoSimulacao, type TipoPeca } from './types';

export interface ErroValidacao {
  caminho: string; // ex.: "pecas[2].props.alturaMaxima"
  /** Mensagem em Português — usada pelo motor/testes e como fallback na UI. */
  mensagem: string;
  /** Chave i18n opcional (a UI prefere `t(chave, params)` quando presente). */
  chave?: string;
  /** Parâmetros de interpolação da `chave`. `tipoKey` é resolvido em `pecas.<tipo>`. */
  params?: Record<string, string | number>;
}

export type ResultadoParse =
  | { ok: true; projeto: ProjetoSimulacao; avisos: ErroValidacao[] }
  | { ok: false; erros: ErroValidacao[] };

const TIPOS_VALIDOS: readonly TipoPeca[] = [
  'reservatorio',
  'tubo',
  'bomba',
  'fonte',
  'consumo',
  'sensor',
  'juncao',
  'quadro',
];

/** Compara apenas o componente MAJOR do semver (ex.: "1.x" ⇔ "1.y"). */
function majorDe(versao: string): number | null {
  const m = /^(\d+)\./.exec(versao);
  return m && m[1] !== undefined ? Number(m[1]) : null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Compatibilidade de versão de schema.
 * - MAJOR igual → compatível (avisa se MINOR difere).
 * - MAJOR desconhecido / ausente / diferente → incompatível (fallback: recusa).
 */
export function versaoCompativel(versao: string): {
  compativel: boolean;
  motivo?: string;
} {
  const atual = majorDe(SCHEMA_VERSION);
  const alvo = majorDe(versao);
  if (alvo === null) {
    return { compativel: false, motivo: `versão "${versao}" não reconhecida` };
  }
  if (alvo !== atual) {
    return {
      compativel: false,
      motivo: `versão de schema ${versao} incompatível com ${SCHEMA_VERSION}`,
    };
  }
  return { compativel: true };
}

function validarPeca(peca: unknown, idx: number, erros: ErroValidacao[]): void {
  const base = `pecas[${idx}]`;
  if (!isRecord(peca)) {
    erros.push({ caminho: base, mensagem: 'peça deve ser um objeto' });
    return;
  }
  if (typeof peca.id !== 'string' || peca.id.length === 0) {
    erros.push({ caminho: `${base}.id`, mensagem: 'id ausente ou inválido' });
  }
  if (!TIPOS_VALIDOS.includes(peca.tipo as TipoPeca)) {
    erros.push({
      caminho: `${base}.tipo`,
      mensagem: `tipo desconhecido: ${JSON.stringify(peca.tipo)}`,
    });
  }
  if (!isFiniteNumber(peca.x) || !isFiniteNumber(peca.y)) {
    erros.push({ caminho: `${base}`, mensagem: 'x/y devem ser números finitos' });
  }
  if (!isRecord(peca.props)) {
    erros.push({ caminho: `${base}.props`, mensagem: 'props ausente' });
    return;
  }
  // Validação específica dos campos obrigatórios mais críticos por tipo.
  const props = peca.props;
  if (peca.tipo === 'reservatorio') {
    if (!isFiniteNumber(props.alturaMaxima)) {
      erros.push({
        caminho: `${base}.props.alturaMaxima`,
        mensagem: 'alturaMaxima obrigatória',
      });
    }
    if (!isFiniteNumber(props.cotaBase)) {
      erros.push({
        caminho: `${base}.props.cotaBase`,
        mensagem: 'cotaBase obrigatória',
      });
    }
    if (props.formato !== 'cilindro' && props.formato !== 'retangular') {
      erros.push({
        caminho: `${base}.props.formato`,
        mensagem: "formato deve ser 'cilindro' ou 'retangular'",
      });
    }
  } else if (peca.tipo === 'tubo') {
    if (!isFiniteNumber(props.diametro) || (props.diametro as number) <= 0) {
      erros.push({
        caminho: `${base}.props.diametro`,
        mensagem: 'diametro deve ser > 0',
      });
    }
  } else if (peca.tipo === 'bomba') {
    if (!isFiniteNumber(props.vazaoNominal)) {
      erros.push({
        caminho: `${base}.props.vazaoNominal`,
        mensagem: 'vazaoNominal obrigatória',
      });
    }
    if (!Array.isArray(props.sensores)) {
      erros.push({
        caminho: `${base}.props.sensores`,
        mensagem: 'sensores deve ser um array (pode ser vazio)',
      });
    }
  } else if (peca.tipo === 'fonte') {
    if (!isFiniteNumber(props.vazaoFixa)) {
      erros.push({
        caminho: `${base}.props.vazaoFixa`,
        mensagem: 'vazaoFixa obrigatória',
      });
    }
  } else if (peca.tipo === 'consumo') {
    if (!isFiniteNumber(props.vazaoDemanda)) {
      erros.push({
        caminho: `${base}.props.vazaoDemanda`,
        mensagem: 'vazaoDemanda obrigatória',
      });
    }
  } else if (peca.tipo === 'sensor') {
    if (!Array.isArray(props.bombasAlvo) || props.bombasAlvo.some((x) => typeof x !== 'string')) {
      erros.push({
        caminho: `${base}.props.bombasAlvo`,
        mensagem: 'bombasAlvo (lista de ids de bomba) obrigatória',
      });
    }
  } else if (peca.tipo === 'quadro') {
    if (!Array.isArray(props.canais)) {
      erros.push({
        caminho: `${base}.props.canais`,
        mensagem: 'canais (lista de {bomba, modo, sensor?}) obrigatória',
      });
    }
  }
}

function validarConexao(
  conexao: unknown,
  idx: number,
  erros: ErroValidacao[],
): void {
  const base = `conexoes[${idx}]`;
  if (!isRecord(conexao)) {
    erros.push({ caminho: base, mensagem: 'conexão deve ser um objeto' });
    return;
  }
  if (typeof conexao.id !== 'string' || conexao.id.length === 0) {
    erros.push({ caminho: `${base}.id`, mensagem: 'id ausente ou inválido' });
  }
  if (typeof conexao.origem !== 'string') {
    erros.push({ caminho: `${base}.origem`, mensagem: 'origem obrigatória' });
  }
  if (typeof conexao.destino !== 'string') {
    erros.push({ caminho: `${base}.destino`, mensagem: 'destino obrigatório' });
  }
  if (
    conexao.vazaoAlocada !== undefined &&
    !isFiniteNumber(conexao.vazaoAlocada)
  ) {
    erros.push({
      caminho: `${base}.vazaoAlocada`,
      mensagem: 'vazaoAlocada, se presente, deve ser número',
    });
  }
}

/**
 * Valida a estrutura de um objeto já desserializado (não string JSON).
 * Não valida a topologia do grafo (isso é responsabilidade do motor —
 * seção 5). Aqui garantimos apenas que o formato/tipos estão sãos.
 */
export function validarProjeto(dado: unknown): ResultadoParse {
  const erros: ErroValidacao[] = [];
  const avisos: ErroValidacao[] = [];

  if (!isRecord(dado)) {
    return {
      ok: false,
      erros: [{ caminho: '', mensagem: 'raiz do projeto deve ser um objeto' }],
    };
  }

  if (typeof dado.versao !== 'string') {
    erros.push({ caminho: 'versao', mensagem: 'campo versao (string) ausente' });
  } else {
    const compat = versaoCompativel(dado.versao);
    if (!compat.compativel) {
      erros.push({ caminho: 'versao', mensagem: compat.motivo ?? 'incompatível' });
    } else if (dado.versao !== SCHEMA_VERSION) {
      avisos.push({
        caminho: 'versao',
        mensagem: `projeto salvo em ${dado.versao}; migrado para ${SCHEMA_VERSION}`,
      });
    }
  }

  if (typeof dado.nome !== 'string') {
    erros.push({ caminho: 'nome', mensagem: 'campo nome (string) ausente' });
  }

  if (!isRecord(dado.unidades)) {
    erros.push({ caminho: 'unidades', mensagem: 'campo unidades ausente' });
  }

  if (!isRecord(dado.configuracaoSimulacao)) {
    erros.push({
      caminho: 'configuracaoSimulacao',
      mensagem: 'campo configuracaoSimulacao ausente',
    });
  } else {
    const cfg = dado.configuracaoSimulacao;
    if (!isFiniteNumber(cfg.dt) || (cfg.dt as number) <= 0) {
      erros.push({
        caminho: 'configuracaoSimulacao.dt',
        mensagem: 'dt deve ser número > 0',
      });
    }
    if (!isFiniteNumber(cfg.g) || (cfg.g as number) <= 0) {
      erros.push({
        caminho: 'configuracaoSimulacao.g',
        mensagem: 'g deve ser número > 0',
      });
    }
  }

  if (!Array.isArray(dado.pecas)) {
    erros.push({ caminho: 'pecas', mensagem: 'pecas deve ser um array' });
  } else {
    dado.pecas.forEach((p, i) => validarPeca(p, i, erros));
  }

  if (!Array.isArray(dado.conexoes)) {
    erros.push({ caminho: 'conexoes', mensagem: 'conexoes deve ser um array' });
  } else {
    dado.conexoes.forEach((c, i) => validarConexao(c, i, erros));
  }

  if (erros.length > 0) {
    return { ok: false, erros };
  }
  return { ok: true, projeto: dado as unknown as ProjetoSimulacao, avisos };
}

/**
 * Ponto de entrada para carregar um `.json` cru (string). Nunca lança:
 * JSON inválido vira um `ResultadoParse` de erro. É a fronteira de robustez
 * exigida pelo DoD do Sprint 1.
 */
export function carregarProjetoDeTexto(texto: string): ResultadoParse {
  let dado: unknown;
  try {
    dado = JSON.parse(texto);
  } catch (e) {
    return {
      ok: false,
      erros: [
        {
          caminho: '',
          mensagem: `JSON inválido: ${e instanceof Error ? e.message : String(e)}`,
        },
      ],
    };
  }
  return validarProjeto(dado);
}

/**
 * Remove o estado INTERNO de execução das peças — bookkeeping que não é
 * configuração e não deve viajar no arquivo exportado (foi um `ultimaTroca`
 * salvo assim que congelou uma bomba por ~17000 s ao recarregar). Mantém o que é
 * cenário (nível dos reservatórios, bomba ligada/desligada).
 */
export function limparEstadoTransitorio(projeto: ProjetoSimulacao): ProjetoSimulacao {
  const clone = structuredClone(projeto);
  for (const p of clone.pecas) {
    const props = p.props as Record<string, unknown>;
    delete props.ultimaTroca; // sensor: instante da última troca (delay)
    delete props.pedindoLigar; // sensor: pedido corrente
    delete props.unidadeAtiva; // bomba em revezamento: metade ativa corrente
    const boia = props.boia as Record<string, unknown> | undefined;
    if (boia) delete boia.aberta; // boia de tubo: estado de histerese
  }
  return clone;
}

/** Serializa um projeto para texto `.json` pronto para download. */
export function serializarProjeto(projeto: ProjetoSimulacao): string {
  const limpo = limparEstadoTransitorio(projeto);
  return JSON.stringify({ ...limpo, versao: SCHEMA_VERSION }, null, 2);
}
