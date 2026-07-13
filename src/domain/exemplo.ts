/**
 * Projeto de exemplo carregado ao abrir a aplicação (cenário montado pelo usuário). Três reservatórios cilíndricos EMPILHADOS (Inferior · C2 Meio · C1 
 * Superior): a concessionária enche o inferior passando por um REGISTRO DE HIDRÔMETRO e uma boia; a Bomba Recalque puxa do inferior e recalca — por uma
 * junção DIVISORA — para o superior (e, com o registro fechado, poderia também para o meio). Do superior e do meio a água desce, por uma junção de UNIÃO e um
 * REGISTRO DE CONSUMO, até o consumo; do superior um bypass alimenta o meio. Cada tanque tem um tubo LADRÃO de transbordo e um registro de LIMPEZA (dreno, normal-
 * mente fechado). Dois QUADROS DE COMANDOS centralizam o controle: o "Quadro Recalque" comanda a Bomba Recalque (auto: nível-baixo do superior E origem-com-
 * água pela boia reversa do inferior, com revezamento) e o "Quadro Incêndio" comanda a Bomba Incêndio do sistema secundário (bomba + hidrantes) alimentado
 * pelo meio. Diâmetros em milímetros; tomadas de tubo com altura quando aplicável.
 *
 * Layout em 6 COLUNAS no eixo x, com espaçamento uniforme (passo 120): 240 · 360 · 480 · 600 · 720 · 840.
 *
 * Os IDs das peças já são os slugs FIÉIS aos rótulos (a mesma saída da ação "Normalizar IDs pelos nomes" das Opções). Editar um rótulo aqui pede atualizar
 * o id e as referências (ou rodar a ação de novo).
 *
 * NOTA: o estado transitório dos sensores (`ultimaTroca`/`pedindoLigar`) NÃO é incluído aqui — é bookkeeping de execução, não configuração.
 */
import type {
  ProjetoSimulacao,
  PropsBomba,
  PropsConsumo,
  PropsFonte,
  PropsQuadro,
  PropsReservatorio,
  PropsSensor,
  PropsTubo,
} from './types';
import { SCHEMA_VERSION } from './types';
import { converterMagnitudesParaSI } from './migracao';
import { metrosPorComprimento, m3PorVolume } from './unidades';

type Peca = ProjetoSimulacao['pecas'][number];

function reservatorio(id: string, rotulo: string, x: number, y: number, cota: number, props: PropsReservatorio): Peca {
  return { id, tipo: 'reservatorio', x, y, cota, portas: ['topo', 'base'], props, rotulo };
}

function tubo(id: string, rotulo: string, x: number, y: number, props: PropsTubo, cota?: number): Peca {
  const base: Peca = { id, tipo: 'tubo', x, y, portas: ['entrada', 'saida'], props, rotulo };
  return cota !== undefined ? { ...base, cota } : base;
}

function juncao(
  id: string,
  rotulo: string,
  x: number,
  y: number,
  estrangula?: { bitola: string; diametro: number },
): Peca {
  const props = estrangula ? { bitola: estrangula.bitola, diametro: estrangula.diametro } : {};
  return { id, tipo: 'juncao', x, y, portas: ['a', 'b', 'c'], props, rotulo };
}

function quadro(id: string, rotulo: string, x: number, y: number, props: PropsQuadro): Peca {
  return { id, tipo: 'quadro', x, y, portas: [], props, rotulo };
}

export function projetoExemplo(): ProjetoSimulacao {
  // Autorado em LITROS (por legibilidade das vazões); o armazenamento é
  // canônico em SI — a conversão abaixo grava m³/s mantendo `unidades` como
  // preferência de EXIBIÇÃO (litros).
  const proj: ProjetoSimulacao = {
    nome: 'Reservatórios empilhados',
    versao: SCHEMA_VERSION,
    unidades: { volume: 'litros', comprimento: 'm' },
    // O exemplo já demonstra a perda de carga por atrito LIGADA (projetos novos
    // nascem com ela desligada). Assim o cenário mostra o efeito de sucção/
    // recalque no ponto de operação da bomba de saída.
    configuracaoSimulacao: { dt: 0.1, g: 9.81, atrito: true },
    pecas: [
      // ---- Reservatórios empilhados (coluna x=480) --------------------------
      reservatorio('inferior_75_000_l', 'Inferior (75.000 L)', 480, 560, 0, {
        formato: 'cilindro',
        raio: 1.6,
        alturaMaxima: 9.5,
        nivel: 2.5,
      } as PropsReservatorio),
      reservatorio('c2_meio_55_000_l', 'C2 Meio (55.000 L)', 480, 320, 9.5, {
        formato: 'cilindro',
        raio: 1.6,
        alturaMaxima: 6.8387,
        nivel: 2.5,
      } as PropsReservatorio),
      reservatorio('c1_superior_55_000_l', 'C1 Superior (55.000 L)', 480, 100, 16.3387, {
        formato: 'cilindro',
        raio: 1.6,
        alturaMaxima: 6.8387,
        nivel: 2.5,
      } as PropsReservatorio),
      // ---- Abastecimento e recalque -----------------------------------------
      {
        id: 'concessionaria',
        tipo: 'fonte',
        x: 240,
        y: 660,
        portas: ['saida'],
        props: { gerador: { perfil: 'senoidal', min: 2, max: 10, periodo: 60 } } as PropsFonte,
        rotulo: 'Concessionária',
        cota: -0.6,
      },
      {
        id: 'bomba_recalque',
        tipo: 'bomba',
        x: 240,
        y: 320,
        portas: ['entrada', 'saida'],
        props: {
          // Modelo do catálogo: Centrífuga 10 CV (45 m³/h @ 42 m, NPSHr 4,8 m).
          modeloBomba: 'sup-centr-10',
          vazaoNominal: 12.5, // 45 m³/h ÷ 3,6 (autorado em L/s → SI)
          // Altura nominal de recalque 42 m: a curva é derivada e a altura real
          // da instalação (~16–21 m até o superior) reduz bastante a vazão; com o
          // atrito ligado, a perda de sucção/recalque reduz ainda mais (ponto de
          // operação). Mostra o efeito da altura e do atrito juntos.
          alturaNominal: 42,
          npshRequerido: 4.8,
          sensores: ['boia_eletronica_c1', 'boia_eletronica_inferior'],
          ligada: false,
          revezamento: true,
        } as PropsBomba,
        rotulo: 'Bomba Recalque',
      },
      tubo('cano_de_succao', 'Cano de sucção', 240, 440, { bitola: 'DN110', diametro: 97.8, registro: { aberto: true }, checkValve: true, comprimento: 4 }),
      tubo('recalque_c2', 'Recalque → C2', 360, 320, { bitola: 'DN60', diametro: 53.4, registro: { aberto: false }, checkValve: true, alturaSaida: 5.5, comprimento: 16 }),
      tubo('recalque_c1', 'Recalque → C1', 360, 140, { bitola: 'DN60', diametro: 53.4, registro: { aberto: true }, checkValve: true, alturaSaida: 5.5, comprimento: 23 }),
      // ---- Consumo (saída principal) ----------------------------------------
      {
        id: 'consumo',
        tipo: 'consumo',
        x: 840,
        y: 140,
        portas: ['entrada'],
        props: {
          // Vitrine do perfil "demanda diária": 2 picos num dia real (madrugada
          // baixa, pico de manhã e de noite). Use a velocidade x120 para ver o dia.
          gerador: {
            perfil: 'diaria',
            base: 2,
            pmHora: 7, pmValor: 5.5, pmSubida: 1, pmPatamar: 1, pmDescida: 1.5,
            pnHora: 19, pnValor: 7, pnSubida: 2, pnPatamar: 3, pnDescida: 1.2,
          },
          aberto: true,
        } as PropsConsumo,
        rotulo: 'Consumo',
      },
      tubo('consumo_c1', 'Consumo C1', 600, 160, { bitola: 'DN160', diametro: 147.0, registro: { aberto: true }, comprimento: 18 }),
      tubo('consumo_c2', 'Consumo C2', 600, 280, { bitola: 'DN160', diametro: 147.0, registro: { aberto: false }, alturaEntrada: 3.12, comprimento: 14 }),
      // ---- Boias eletrônicas (sensores) -------------------------------------
      {
        id: 'boia_eletronica_c1',
        tipo: 'sensor',
        x: 600,
        y: 80,
        portas: ['sonda'],
        props: { bombasAlvo: ['bomba_recalque'], nivelMinimo: 4.5, nivelMaximo: 5.5, histerese: true, delay: 10 } as PropsSensor,
        rotulo: 'Boia Eletrônica (C1)',
      },
      {
        // Sensor REVERSO no inferior: desliga a bomba em 2 m (protege a origem),
        // libera em 3 m. Faz o papel da antiga proteção a seco, com histerese.
        id: 'boia_eletronica_inferior',
        tipo: 'sensor',
        x: 600,
        y: 500,
        portas: ['sonda'],
        props: { bombasAlvo: ['bomba_recalque'], nivelMinimo: 2, nivelMaximo: 3, reversa: true, histerese: false } as PropsSensor,
        rotulo: 'Boia Eletrônica (inferior)',
      },
      // ---- Boia manual + bypass + ladrões -----------------------------------
      tubo('boia_manual', 'Boia Manual', 360, 520, { bitola: 'DN110', diametro: 97.8, registro: { aberto: true }, boia: { nivelMinimo: 7, nivelMaximo: 8.5 }, alturaSaida: 8.5, comprimento: 8.5 }),
      tubo('bypass_boia_manual', 'bypass Boia Manual', 600, 220, { bitola: 'DN32', diametro: 27.8, registro: { aberto: true }, boia: { nivelMinimo: 5, nivelMaximo: 5.5 }, alturaEntrada: 2, alturaSaida: 6, comprimento: 5 }),
      tubo('ladrao_c1', 'Ladrão (C1)', 360, 80, { bitola: 'DN50', diametro: 44.0, registro: { aberto: true }, ladrao: { nivel: 6.5 } }),
      tubo('ladrao_c2', 'Ladrão (C2)', 360, 260, { bitola: 'DN50', diametro: 44.0, registro: { aberto: true }, ladrao: { nivel: 6.5 } }),
      tubo('ladrao_inferior', 'Ladrão (inferior)', 360, 440, { bitola: 'DN50', diametro: 44.0, registro: { aberto: true }, ladrao: { nivel: 9 } }),
      // ---- Sistema de incêndio (bomba + hidrantes, alimentado pelo meio) -----
      {
        id: 'bomba_incendio',
        tipo: 'bomba',
        x: 840,
        y: 400,
        portas: ['entrada', 'saida'],
        props: {
          // Modelo do catálogo: Centrífuga 7,5 CV (35 m³/h @ 38 m, NPSHr 4,2 m).
          modeloBomba: 'sup-centr-7-5',
          vazaoNominal: 35 / 3.6, // 35 m³/h ÷ 3,6 (autorado em L/s → SI)
          alturaNominal: 38,
          npshRequerido: 4.2,
          sensores: ['boia_eletronica_c2'],
          ligada: false,
        } as PropsBomba,
        rotulo: 'Bomba Incêndio',
      },
      {
        id: 'hidrantes',
        tipo: 'consumo',
        x: 840,
        y: 320,
        portas: ['entrada'],
        props: { gerador: { perfil: 'fixo', vazao: 5 }, aberto: false } as PropsConsumo,
        rotulo: 'Hidrantes',
      },
      // Sucção da bomba de incêndio: puxa do C2 Meio (base na cota 9,5). O
      // comprimento desenvolvido = ~4 m (como a sucção do recalque) + os 9,5 m
      // de subida até a base do reservatório → 13,5 m (coerente com o desnível).
      tubo('cavalete_incendio', 'Cavalete Incêndio', 720, 400, { bitola: 'DN60', diametro: 53.4, registro: { aberto: true }, comprimento: 13.5, material: 'cobre' }),
      {
        // Boia NORMAL no meio (igual à do C1): pede LIGAR quando baixa (≤ 4,6 m) e
        // DESLIGAR quando cheia (≥ 5,5 m).
        id: 'boia_eletronica_c2',
        tipo: 'sensor',
        x: 600,
        y: 380,
        portas: ['sonda'],
        props: { bombasAlvo: ['bomba_incendio'], nivelMinimo: 4.6, nivelMaximo: 5.5 } as PropsSensor,
        rotulo: 'Boia Eletrônica (C2)',
      },
      // Linha de limpeza/interligação: cavalete de incêndio → interligação
      // (registro fechado) → cavalete de recalque → volta ao inferior.
      tubo('interligacao_de_limpeza', 'Interligação de Limpeza', 720, 480, { bitola: 'DN50', diametro: 44.0, registro: { aberto: false }, checkValve: false }),
      tubo('cavalete_bomba_recalque', 'Cavalete Bomba Recalque', 720, 560, { bitola: 'DN50', diametro: 44.0, registro: { aberto: true } }),
      // ---- Junções: divisor do recalque e união das saídas ------------------
      juncao('divisor', 'Divisor', 240, 220, { bitola: 'DN60', diametro: 53.4 }),
      juncao('uniao', 'União', 720, 220, { bitola: 'DN160', diametro: 147.0 }),
      // ---- Quadros de comandos (MCC) ----------------------------------------
      quadro('quadro_recalque', 'Quadro Recalque', 240, 80, {
        // «nível-do-superior-baixo (boia C1) E origem-com-água (boia inferior reversa)»
        // — o operador E deixa a boia reversa PROTEGER a origem (desligar vence só
        // atrás de um E, pois a avaliação é expressão pura).
        canais: [{ bomba: 'bomba_recalque', modo: 'auto', sensores: ['boia_eletronica_c1', 'boia_eletronica_inferior'], operadores: ['E'], revezamento: true }],
        sensores: ['boia_eletronica_c1', 'boia_eletronica_inferior', 'boia_eletronica_c2'],
      } as PropsQuadro),
      quadro('quadro_incendio', 'Quadro Incêndio', 840, 560, {
        canais: [{ bomba: 'bomba_incendio', modo: 'auto' }],
      } as PropsQuadro),
      // ---- Registros de linha (hidrômetro na entrada; consumo na saída) ------
      tubo('registro_hidrometro', 'Registro Hidrômetro', 240, 560, { bitola: 'DN110', diametro: 97.8, registro: { aberto: true } }, 0.6),
      tubo('registro_consumo', 'Registro Consumo', 720, 140, { bitola: 'DN160', diametro: 147.0, registro: { aberto: true } }),
      // ---- Drenos de limpeza por reservatório (registro fechado) ------------
      tubo('limpeza_c1', 'Limpeza (C1)', 360, 200, { bitola: 'DN110', diametro: 97.8, registro: { aberto: false } }),
      tubo('limpeza_c2', 'Limpeza (C2)', 360, 380, { bitola: 'DN110', diametro: 97.8, registro: { aberto: false } }),
      tubo('limpeza_c3', 'Limpeza (C3)', 360, 580, { bitola: 'DN110', diametro: 97.8, registro: { aberto: false } }),
    ],
    // IDs de conexão sequenciais (c_1…c_N) — só estética; conexão não é referenciada
    // por peça alguma, então a numeração é livre.
    conexoes: [
      { id: 'c_1', origem: 'inferior_75_000_l', destino: 'cano_de_succao' },
      { id: 'c_2', origem: 'cano_de_succao', destino: 'bomba_recalque' },
      // Recalque pela junção DIVISORA: bomba → divisor → superior / meio.
      { id: 'c_3', origem: 'bomba_recalque', destino: 'divisor' },
      { id: 'c_4', origem: 'divisor', destino: 'recalque_c1' },
      { id: 'c_5', origem: 'divisor', destino: 'recalque_c2' },
      { id: 'c_6', origem: 'recalque_c2', destino: 'c2_meio_55_000_l' },
      { id: 'c_7', origem: 'recalque_c1', destino: 'c1_superior_55_000_l' },
      // Saídas pela junção de UNIÃO → registro de consumo → consumo.
      { id: 'c_8', origem: 'c1_superior_55_000_l', destino: 'consumo_c1' },
      { id: 'c_9', origem: 'c2_meio_55_000_l', destino: 'consumo_c2' },
      { id: 'c_10', origem: 'consumo_c1', destino: 'uniao' },
      { id: 'c_11', origem: 'consumo_c2', destino: 'uniao' },
      { id: 'c_12', origem: 'uniao', destino: 'registro_consumo' },
      { id: 'c_13', origem: 'registro_consumo', destino: 'consumo' },
      { id: 'c_14', origem: 'boia_eletronica_c1', destino: 'c1_superior_55_000_l' },
      { id: 'c_15', origem: 'c1_superior_55_000_l', destino: 'bypass_boia_manual' },
      { id: 'c_16', origem: 'bypass_boia_manual', destino: 'c2_meio_55_000_l' },
      // Abastecimento: concessionária → registro do hidrômetro → boia manual → inferior.
      { id: 'c_17', origem: 'concessionaria', destino: 'registro_hidrometro' },
      { id: 'c_18', origem: 'registro_hidrometro', destino: 'boia_manual' },
      { id: 'c_19', origem: 'boia_manual', destino: 'inferior_75_000_l' },
      // Ladrões (dreno de transbordo por reservatório).
      { id: 'c_20', origem: 'c1_superior_55_000_l', destino: 'ladrao_c1' },
      { id: 'c_21', origem: 'c2_meio_55_000_l', destino: 'ladrao_c2' },
      { id: 'c_22', origem: 'inferior_75_000_l', destino: 'ladrao_inferior' },
      // Drenos de limpeza (registro fechado): cada reservatório tem o seu.
      { id: 'c_23', origem: 'c1_superior_55_000_l', destino: 'limpeza_c1' },
      { id: 'c_24', origem: 'c2_meio_55_000_l', destino: 'limpeza_c2' },
      { id: 'c_25', origem: 'inferior_75_000_l', destino: 'limpeza_c3' },
      // Sistema de incêndio: meio → bomba de incêndio → hidrantes.
      { id: 'c_26', origem: 'bomba_incendio', destino: 'hidrantes' },
      { id: 'c_27', origem: 'c2_meio_55_000_l', destino: 'cavalete_incendio' },
      { id: 'c_28', origem: 'cavalete_incendio', destino: 'bomba_incendio' },
      { id: 'c_29', origem: 'boia_eletronica_c2', destino: 'c2_meio_55_000_l' },
      { id: 'c_30', origem: 'boia_eletronica_inferior', destino: 'inferior_75_000_l' },
      // Linha de limpeza: cavalete → interligação → cavalete recalque → inferior.
      { id: 'c_31', origem: 'cavalete_incendio', destino: 'interligacao_de_limpeza' },
      { id: 'c_32', origem: 'interligacao_de_limpeza', destino: 'cavalete_bomba_recalque' },
      { id: 'c_33', origem: 'cavalete_bomba_recalque', destino: 'inferior_75_000_l' },
    ],
  };
  converterMagnitudesParaSI(
    proj as unknown as Record<string, unknown>,
    metrosPorComprimento(proj.unidades),
    m3PorVolume(proj.unidades),
  );
  return proj;
}
