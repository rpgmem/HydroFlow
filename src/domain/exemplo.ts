/**
 * Projeto de exemplo carregado ao abrir a aplicação.
 *
 * Três reservatórios cilíndricos EMPILHados (cotaBase crescente): a fonte enche
 * o inferior através de uma boia; a bomba puxa do inferior e recalca para o
 * superior; do superior a água desce por gravidade ao consumo e, por uma boia
 * de bypass, para o meio; do meio desce ao consumo. Um sensor no superior
 * controla a bomba. (Cenário montado pelo usuário; diâmetros em milímetros.)
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

function reservatorio(
  id: string,
  rotulo: string,
  x: number,
  y: number,
  props: PropsReservatorio,
): ProjetoSimulacao['pecas'][number] {
  return { id, tipo: 'reservatorio', x, y, portas: ['topo', 'base'], props, rotulo };
}

function tubo(
  id: string,
  rotulo: string | undefined,
  x: number,
  y: number,
  props: PropsTubo,
): ProjetoSimulacao['pecas'][number] {
  return { id, tipo: 'tubo', x, y, portas: ['entrada', 'saida'], props, ...(rotulo ? { rotulo } : {}) };
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
        nivel: 0.5,
      } as PropsReservatorio),
      reservatorio('superior', 'Superior (55.000 L)', 520, 158, {
        formato: 'cilindro',
        raio: 1.6,
        alturaMaxima: 6.8387,
        cotaBase: 16.3387,
        nivel: 0.5,
      } as PropsReservatorio),
      {
        id: 'fonte',
        tipo: 'fonte',
        x: 265,
        y: 560,
        portas: ['saida'],
        props: { vazaoFixa: 4 } as PropsFonte,
        rotulo: 'Fonte externa',
      },
      {
        id: 'bomba',
        tipo: 'bomba',
        x: 260,
        y: 380,
        portas: ['entrada', 'saida'],
        props: { vazaoNominal: 4, sensores: ['sensor_sup'], ligada: false } as PropsBomba,
        rotulo: 'Bomba',
      },
      // Diâmetros convertidos de metros para MILÍMETROS (×1000).
      tubo('succao', 'Cano de sucção', 380, 470, {
        diametro: 150,
        registro: { aberto: true },
        checkValve: true,
      }),
      tubo('recalque_meio', 'Recalque → meio', 380, 370, {
        diametro: 150,
        registro: { aberto: false },
        checkValve: true,
      }),
      tubo('recalque_sup', 'Recalque → superior', 378, 268, {
        diametro: 150,
        registro: { aberto: true },
        checkValve: true,
      }),
      {
        id: 'consumo',
        tipo: 'consumo',
        x: 806,
        y: 274,
        portas: ['entrada'],
        props: { vazaoDemanda: 0.5, aberto: true } as PropsConsumo,
        rotulo: 'Consumo',
      },
      tubo('saida_sup', 'Saída superior', 660, 201, { diametro: 60, registro: { aberto: true } }),
      tubo('saida_meio', 'Saída meio', 661, 366, { diametro: 60, registro: { aberto: false } }),
      {
        id: 'sensor_sup',
        tipo: 'sensor',
        x: 660,
        y: 113,
        portas: ['sonda'],
        props: { bombaAlvo: 'bomba', nivelMinimo: 3, nivelMaximo: 5.5 } as PropsSensor,
        rotulo: 'Sensor superior',
      },
      tubo('tub_85', 'Boia Manual', 383, 559, {
        diametro: 100,
        registro: { aberto: true },
        boia: { nivelMinimo: 6, nivelMaximo: 9 },
      }),
      tubo('tub_114748', 'bypass Boia Manual', 663, 280, {
        diametro: 100,
        registro: { aberto: true },
        boia: { nivelMinimo: 4, nivelMaximo: 5.5 },
      }),
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
      { id: 'c_114773', origem: 'superior', destino: 'tub_114748' },
      { id: 'c_114810', origem: 'tub_114748', destino: 'meio' },
      { id: 'c_525691', origem: 'fonte', destino: 'tub_85' },
      { id: 'c_525716', origem: 'tub_85', destino: 'inferior' },
    ],
  };
}
