/**
 * Projeto de exemplo carregado ao abrir a aplicação (cenário montado pelo
 * usuário). Três reservatórios cilíndricos EMPILHados: a fonte enche o inferior
 * por uma boia; a bomba puxa do inferior e recalca para o superior; do superior
 * a água desce ao consumo e, por um bypass, ao meio. Cada tanque tem um tubo
 * ladrão de transbordo. Um sensor no superior controla a bomba. Há ainda um
 * sistema secundário de incêndio (bomba + hidrantes) alimentado pelo meio.
 * Diâmetros em milímetros; tomadas de tubo com altura de conexão quando aplicável.
 *
 * NOTA: o estado transitório dos sensores (`ultimaTroca`/`pedindoLigar`) NÃO é
 * incluído aqui — é bookkeeping de execução, não configuração.
 */
import type {
  ProjetoSimulacao,
  PropsBomba,
  PropsConsumo,
  PropsFonte,
  PropsReservatorio,
  PropsSensor,
  PropsTubo,
} from './types';
import { SCHEMA_VERSION } from './types';

type Peca = ProjetoSimulacao['pecas'][number];

function reservatorio(id: string, rotulo: string, x: number, y: number, props: PropsReservatorio): Peca {
  return { id, tipo: 'reservatorio', x, y, portas: ['topo', 'base'], props, rotulo };
}

function tubo(id: string, rotulo: string, x: number, y: number, props: PropsTubo): Peca {
  return { id, tipo: 'tubo', x, y, portas: ['entrada', 'saida'], props, rotulo };
}

export function projetoExemplo(): ProjetoSimulacao {
  return {
    nome: 'Reservatórios empilhados',
    versao: SCHEMA_VERSION,
    unidades: { volume: 'litros', comprimento: 'm' },
    configuracaoSimulacao: { dt: 0.1, g: 9.81 },
    // Layout em 6 colunas com espaçamento uniforme (passo 120) no eixo x:
    //   240 (bomba/fonte/boia inferior) · 360 (sucção/recalque/ladrões/boia
    //   manual) · 480 (reservatórios) · 600 (saídas, bypass, sensores e canos do
    //   incêndio) · 720 (bomba de incêndio) · 840 (consumos).
    pecas: [
      reservatorio('inferior', 'Inferior (75.000 L)', 480, 554, {
        formato: 'cilindro',
        raio: 1.6,
        alturaMaxima: 9.5,
        cotaBase: 0,
        nivel: 2,
      } as PropsReservatorio),
      reservatorio('meio', 'Meio (55.000 L)', 480, 369, {
        formato: 'cilindro',
        raio: 1.6,
        alturaMaxima: 6.8387,
        cotaBase: 9.5,
        nivel: 2,
      } as PropsReservatorio),
      reservatorio('superior', 'Superior (55.000 L)', 480, 160, {
        formato: 'cilindro',
        raio: 1.6,
        alturaMaxima: 6.8387,
        cotaBase: 16.3387,
        nivel: 2,
      } as PropsReservatorio),
      {
        id: 'fonte',
        tipo: 'fonte',
        x: 240,
        y: 577,
        portas: ['saida'],
        props: { vazaoFixa: 10 } as PropsFonte,
        rotulo: 'Fonte externa',
      },
      {
        id: 'bomba',
        tipo: 'bomba',
        x: 240,
        y: 297.51239669421494,
        portas: ['entrada', 'saida'],
        props: {
          vazaoNominal: 50,
          sensores: ['sensor_sup', 'sensor_inf'],
          ligada: false,
          revezamento: true,
        } as PropsBomba,
        rotulo: 'Bomba',
      },
      tubo('succao', 'Cano de sucção', 360, 427.6859504132231, { bitola: 'DN110', diametro: 97.8, registro: { aberto: true }, checkValve: true }),
      tubo('recalque_meio', 'Recalque → meio', 360, 339.56198347107454, { bitola: 'DN60', diametro: 53.4, registro: { aberto: false }, checkValve: true, alturaSaida: 5.5 }),
      tubo('recalque_sup', 'Recalque → superior', 360, 216.08264462809922, { bitola: 'DN60', diametro: 53.4, registro: { aberto: true }, checkValve: true, alturaSaida: 5.5 }),
      {
        id: 'consumo',
        tipo: 'consumo',
        x: 840,
        y: 273.2486851990984,
        portas: ['entrada'],
        props: {
          vazaoDemanda: 5,
          aberto: true,
          perfil: 'senoidal',
          vazaoMin: 0,
          vazaoMax: 5,
          periodo: 60,
        } as PropsConsumo,
        rotulo: 'Consumo',
      },
      tubo('saida_sup', 'Saída superior', 600, 201, { bitola: 'DN160', diametro: 147.0, registro: { aberto: true } }),
      tubo('saida_meio', 'Saída meio', 600, 301.38692712246433, { bitola: 'DN160', diametro: 147.0, registro: { aberto: false }, alturaEntrada: 2.5 }),
      {
        id: 'sensor_sup',
        tipo: 'sensor',
        x: 600,
        y: 113,
        portas: ['sonda'],
        props: { bombasAlvo: ['bomba'], nivelMinimo: 3, nivelMaximo: 5.5, histerese: true, delay: 10 } as PropsSensor,
        rotulo: 'Boia Eletrônica (superior)',
      },
      {
        // Sensor REVERSO no inferior: desliga a bomba em 2 m (protege a origem),
        // libera em 3 m. Faz o papel da antiga proteção a seco, com histerese.
        id: 'sensor_inf',
        tipo: 'sensor',
        x: 240,
        y: 430.47742640530026,
        portas: ['sonda'],
        props: { bombasAlvo: ['bomba'], nivelMinimo: 2, nivelMaximo: 3, reversa: true, histerese: false } as PropsSensor,
        rotulo: 'Boia Eletrônica (inferior)',
      },
      tubo('boia_manual', 'Boia Manual', 360, 578, { bitola: 'DN110', diametro: 97.8, registro: { aberto: true }, boia: { nivelMinimo: 6, nivelMaximo: 8.5 }, alturaSaida: 8.5 }),
      tubo('bypass', 'bypass Boia Manual', 600, 248.44477836213346, { bitola: 'DN32', diametro: 27.8, registro: { aberto: true }, boia: { nivelMinimo: 4, nivelMaximo: 5.5 }, alturaEntrada: 4, alturaSaida: 4 }),
      tubo('ladrao_sup', 'Ladrão (superior)', 360, 134, { bitola: 'DN50', diametro: 44.0, registro: { aberto: true }, ladrao: { nivel: 6.5 } }),
      tubo('ladrao_meio', 'Ladrão (meio)', 360, 278.77685950413223, { bitola: 'DN50', diametro: 44.0, registro: { aberto: true }, ladrao: { nivel: 6.5 } }),
      tubo('ladrao_inf', 'Ladrão (inferior)', 360, 522, { bitola: 'DN50', diametro: 44.0, registro: { aberto: true }, ladrao: { nivel: 9 } }),
      {
        id: 'bom_19',
        tipo: 'bomba',
        x: 720,
        y: 531.7205108940645,
        portas: ['entrada', 'saida'],
        props: { vazaoNominal: 10, sensores: ['sen_26'], ligada: true } as PropsBomba,
        rotulo: 'Bomba Incêndio',
      },
      {
        id: 'con_21',
        tipo: 'consumo',
        x: 840,
        y: 437.731029301277,
        portas: ['entrada'],
        props: { vazaoDemanda: 0, aberto: false } as PropsConsumo,
        rotulo: 'Hidrantes',
      },
      tubo('tub_23', 'Cavalete Incêndio', 600, 426.91209616829417, { bitola: 'DN60', diametro: 53.4, registro: { aberto: true } }),
      {
        // Sensor REVERSO no meio: desliga a bomba de incêndio em 4 m (protege o
        // meio de esvaziar), libera em 5 m.
        id: 'sen_26',
        tipo: 'sensor',
        x: 600,
        y: 351.55522163786617,
        portas: ['sonda'],
        props: { bombasAlvo: ['bom_19'], nivelMinimo: 4, nivelMaximo: 5, reversa: true } as PropsSensor,
        rotulo: 'Boia Eletrônica (meio)',
      },
      // Linha de limpeza/interligação: cavalete de incêndio → interligação
      // (registro fechado) → cavalete de recalque → volta ao inferior.
      tubo('tub_29', 'Interligação de Limpeza', 600, 490.3981968444768, { bitola: 'DN50', diametro: 44.0, registro: { aberto: false }, checkValve: false }),
      tubo('tub_34', 'Cavalete bomba recalque', 600, 555.7625845229148, { bitola: 'DN50', diametro: 44.0, registro: { aberto: true } }),
    ],
    conexoes: [
      { id: 'c_2', origem: 'inferior', destino: 'succao' },
      { id: 'c_3', origem: 'succao', destino: 'bomba' },
      { id: 'c_4', origem: 'bomba', destino: 'recalque_meio' },
      { id: 'c_5', origem: 'recalque_meio', destino: 'meio' },
      { id: 'c_6', origem: 'bomba', destino: 'recalque_sup' },
      { id: 'c_7', origem: 'recalque_sup', destino: 'superior' },
      { id: 'c_8', origem: 'superior', destino: 'saida_sup' },
      { id: 'c_9', origem: 'saida_sup', destino: 'consumo' },
      { id: 'c_10', origem: 'meio', destino: 'saida_meio' },
      { id: 'c_11', origem: 'saida_meio', destino: 'consumo' },
      { id: 'c_12', origem: 'sensor_sup', destino: 'superior' },
      { id: 'c_13', origem: 'superior', destino: 'bypass' },
      { id: 'c_14', origem: 'bypass', destino: 'meio' },
      { id: 'c_15', origem: 'fonte', destino: 'boia_manual' },
      { id: 'c_16', origem: 'boia_manual', destino: 'inferior' },
      // Ladrões (ids únicos — o projeto original tinha ids duplicados).
      { id: 'c_lad_sup', origem: 'superior', destino: 'ladrao_sup' },
      { id: 'c_lad_meio', origem: 'meio', destino: 'ladrao_meio' },
      { id: 'c_lad_inf', origem: 'inferior', destino: 'ladrao_inf' },
      // Sistema de incêndio: meio → bomba de incêndio → hidrantes.
      { id: 'c_22', origem: 'bom_19', destino: 'con_21' },
      { id: 'c_24', origem: 'meio', destino: 'tub_23' },
      { id: 'c_25', origem: 'tub_23', destino: 'bom_19' },
      { id: 'c_27', origem: 'sen_26', destino: 'meio' },
      { id: 'c_inf', origem: 'sensor_inf', destino: 'inferior' },
      // Linha de limpeza: cavalete → interligação → cavalete recalque → inferior.
      { id: 'c_30', origem: 'tub_23', destino: 'tub_29' },
      { id: 'c_36', origem: 'tub_29', destino: 'tub_34' },
      { id: 'c_35', origem: 'tub_34', destino: 'inferior' },
    ],
  };
}
