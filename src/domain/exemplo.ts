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
    pecas: [
      reservatorio('inferior', 'Inferior (75.000 L)', 518, 554, {
        formato: 'cilindro',
        raio: 1.6,
        alturaMaxima: 9.5,
        cotaBase: 0,
        nivel: 2,
      } as PropsReservatorio),
      reservatorio('meio', 'Meio (55.000 L)', 520, 369, {
        formato: 'cilindro',
        raio: 1.6,
        alturaMaxima: 6.8387,
        cotaBase: 9.5,
        nivel: 2,
      } as PropsReservatorio),
      reservatorio('superior', 'Superior (55.000 L)', 521, 160, {
        formato: 'cilindro',
        raio: 1.6,
        alturaMaxima: 6.8387,
        cotaBase: 16.3387,
        nivel: 2,
      } as PropsReservatorio),
      {
        id: 'fonte',
        tipo: 'fonte',
        x: 247,
        y: 577,
        portas: ['saida'],
        props: { vazaoFixa: 10 } as PropsFonte,
        rotulo: 'Fonte externa',
      },
      {
        id: 'bomba',
        tipo: 'bomba',
        x: 200,
        y: 319,
        portas: ['entrada', 'saida'],
        props: {
          vazaoNominal: 50,
          sensores: ['sensor_sup'],
          ligada: false,
          protecaoSeco: 2,
        } as PropsBomba,
        rotulo: 'Bomba',
      },
      tubo('succao', 'Cano de sucção', 381, 450, { diametro: 110, registro: { aberto: true }, checkValve: true }),
      tubo('recalque_meio', 'Recalque → meio', 381, 347, { diametro: 60, registro: { aberto: false }, checkValve: true, alturaSaida: 5.5 }),
      tubo('recalque_sup', 'Recalque → superior', 381, 226, { diametro: 60, registro: { aberto: true }, checkValve: true, alturaSaida: 5.5 }),
      {
        id: 'consumo',
        tipo: 'consumo',
        x: 806,
        y: 274,
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
      tubo('saida_sup', 'Saída superior', 660, 201, { diametro: 150, registro: { aberto: true } }),
      tubo('saida_meio', 'Saída meio', 663, 366, { diametro: 150, registro: { aberto: false }, alturaEntrada: 2.5 }),
      {
        id: 'sensor_sup',
        tipo: 'sensor',
        x: 660,
        y: 113,
        portas: ['sonda'],
        props: { bombaAlvo: 'bomba', nivelMinimo: 3, nivelMaximo: 5.5, histerese: true, delay: 10 } as PropsSensor,
        rotulo: 'Boia Eletrônica',
      },
      tubo('boia_manual', 'Boia Manual', 383, 578, { diametro: 110, registro: { aberto: true }, boia: { nivelMinimo: 6, nivelMaximo: 8.5 }, alturaSaida: 8.5 }),
      tubo('bypass', 'bypass Boia Manual', 663, 280, { diametro: 32, registro: { aberto: true }, boia: { nivelMinimo: 4, nivelMaximo: 5.5 }, alturaEntrada: 4, alturaSaida: 4 }),
      tubo('ladrao_sup', 'Ladrão (superior)', 382, 134, { diametro: 50, registro: { aberto: true }, ladrao: { nivel: 6.5 } }),
      tubo('ladrao_meio', 'Ladrão (meio)', 382, 292, { diametro: 50, registro: { aberto: true }, ladrao: { nivel: 6.5 } }),
      tubo('ladrao_inf', 'Ladrão (inferior)', 383, 522, { diametro: 50, registro: { aberto: true }, ladrao: { nivel: 9 } }),
      {
        id: 'bom_19',
        tipo: 'bomba',
        x: 662.6446280991738,
        y: 574.5454545454545,
        portas: ['entrada', 'saida'],
        props: { vazaoNominal: 10, sensores: [], ligada: false, protecaoSeco: 4 } as PropsBomba,
        rotulo: 'Bomba Incêndio',
      },
      {
        id: 'con_21',
        tipo: 'consumo',
        x: 804.7933884297522,
        y: 573.7190082644626,
        portas: ['entrada'],
        props: { vazaoDemanda: 0, aberto: false } as PropsConsumo,
        rotulo: 'Hidrantes',
      },
      tubo('tub_23', 'Incêndio', 661.893313298272, 516.3185574755819, { diametro: 60, registro: { aberto: true } }),
      {
        id: 'sen_26',
        tipo: 'sensor',
        x: 663.5161532682188,
        y: 428.9406461307286,
        portas: ['sonda'],
        props: { bombaAlvo: 'bom_19', nivelMinimo: 1, nivelMaximo: 4 } as PropsSensor,
        rotulo: 'Boia Eletrônica',
      },
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
    ],
  };
}
