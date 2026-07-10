/**
 * Projeto de exemplo carregado ao abrir a aplicação (cenário montado pelo
 * usuário). Três reservatórios cilíndricos EMPILHados: a fonte enche o inferior
 * por uma boia; a bomba puxa do inferior e recalca — por uma junção DIVISORA —
 * para o superior (e, com o registro fechado, poderia também para o meio); do
 * superior e do meio a água desce, por uma junção de UNIÃO, ao consumo, e do
 * superior por um bypass ao meio. Cada tanque tem um tubo ladrão de transbordo.
 * Um sensor no superior controla a bomba. Há ainda um sistema secundário de
 * incêndio (bomba + hidrantes) alimentado pelo meio. Diâmetros em milímetros;
 * tomadas de tubo com altura de conexão quando aplicável.
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

export function projetoExemplo(): ProjetoSimulacao {
  return {
    nome: 'Reservatórios empilhados',
    versao: SCHEMA_VERSION,
    unidades: { volume: 'litros', comprimento: 'm' },
    // O exemplo já demonstra a perda de carga por atrito LIGADA (projetos novos
    // nascem com ela desligada). Assim o cenário mostra o efeito de sucção/
    // recalque no ponto de operação da bomba de saída.
    configuracaoSimulacao: { dt: 0.1, g: 9.81, atrito: true },
    // Layout em 6 colunas com espaçamento uniforme (passo 120) no eixo x:
    //   240 (bomba/fonte/boia inferior/junção divisora) · 360 (sucção/recalque/
    //   ladrões/boia manual) · 480 (reservatórios) · 600 (saídas, bypass,
    //   sensores e canos do incêndio) · 720 (bomba de incêndio/junção união) ·
    //   840 (consumos).
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
        y: 339.8592309268492,
        portas: ['entrada', 'saida'],
        props: {
          vazaoNominal: 50,
          // Altura nominal de recalque 25 m: a curva é derivada e a altura real
          // da instalação (~16–21 m até o superior) reduz bastante a vazão; com o
          // atrito ligado, a perda de sucção/recalque reduz ainda mais (ponto de
          // operação). Mostra o efeito da altura e do atrito juntos.
          alturaNominal: 25,
          sensores: ['sensor_sup', 'sensor_inf'],
          ligada: false,
          revezamento: true,
        } as PropsBomba,
        rotulo: 'Bomba',
      },
      tubo('succao', 'Cano de sucção', 360, 435.1990984222388, { bitola: 'DN110', diametro: 97.8, registro: { aberto: true }, checkValve: true }),
      tubo('recalque_meio', 'Recalque → meio', 360, 341.61102383716974, { bitola: 'DN60', diametro: 53.4, registro: { aberto: false }, checkValve: true, alturaSaida: 5.5 }),
      tubo('recalque_sup', 'Recalque → superior', 360, 205.15442934225808, { bitola: 'DN60', diametro: 53.4, registro: { aberto: true }, checkValve: true, alturaSaida: 5.5 }),
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
          vazaoMax: 10,
          periodo: 90,
        } as PropsConsumo,
        rotulo: 'Consumo',
      },
      tubo('saida_sup', 'Saída superior', 600, 191.43781162488904, { bitola: 'DN160', diametro: 147.0, registro: { aberto: true } }),
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
      tubo('bypass', 'bypass Boia Manual', 600, 248.44477836213346, { bitola: 'DN32', diametro: 27.8, registro: { aberto: true }, boia: { nivelMinimo: 4, nivelMaximo: 5.5 }, alturaEntrada: 2, alturaSaida: 6 }),
      tubo('ladrao_sup', 'Ladrão (superior)', 360, 134, { bitola: 'DN50', diametro: 44.0, registro: { aberto: true }, ladrao: { nivel: 6.5 } }),
      tubo('ladrao_meio', 'Ladrão (meio)', 360, 265.7996038521959, { bitola: 'DN50', diametro: 44.0, registro: { aberto: true }, ladrao: { nivel: 6.5 } }),
      tubo('ladrao_inf', 'Ladrão (inferior)', 360, 522, { bitola: 'DN50', diametro: 44.0, registro: { aberto: true }, ladrao: { nivel: 9 } }),
      {
        id: 'bomba_incendio',
        tipo: 'bomba',
        x: 720,
        y: 531.7205108940645,
        portas: ['entrada', 'saida'],
        props: { vazaoNominal: 10, sensores: ['sensor_meio'], ligada: true } as PropsBomba,
        rotulo: 'Bomba Incêndio',
      },
      {
        id: 'hidrantes',
        tipo: 'consumo',
        x: 840,
        y: 437.731029301277,
        portas: ['entrada'],
        props: { vazaoDemanda: 0, aberto: false } as PropsConsumo,
        rotulo: 'Hidrantes',
      },
      tubo('cavalete_incendio', 'Cavalete Incêndio', 600, 426.91209616829417, { bitola: 'DN60', diametro: 53.4, registro: { aberto: true } }),
      {
        // Sensor REVERSO no meio: desliga a bomba de incêndio em 4 m (protege o
        // meio de esvaziar), libera em 5 m.
        id: 'sensor_meio',
        tipo: 'sensor',
        x: 600,
        y: 351.55522163786617,
        portas: ['sonda'],
        props: { bombasAlvo: ['bomba_incendio'], nivelMinimo: 4, nivelMaximo: 5, reversa: true } as PropsSensor,
        rotulo: 'Boia Eletrônica (meio)',
      },
      // Linha de limpeza/interligação: cavalete de incêndio → interligação
      // (registro fechado) → cavalete de recalque → volta ao inferior.
      tubo('interligacao_limpeza', 'Interligação de Limpeza', 600, 490.3981968444768, { bitola: 'DN50', diametro: 44.0, registro: { aberto: false }, checkValve: false }),
      tubo('cavalete_recalque', 'Cavalete Bomba Recalque', 600, 555.7625845229148, { bitola: 'DN50', diametro: 44.0, registro: { aberto: true } }),
      // Divisor: a bomba recalca por aqui, dividindo para o superior e o meio (o
      // recalque do meio está com o registro fechado). União: as saídas do
      // superior e do meio se juntam antes do consumo.
      juncao('divisor', 'Divisor', 240, 253.18762379618877, { bitola: 'DN60', diametro: 53.4 }),
      juncao('uniao', 'União', 720, 272.99501400177576, { bitola: 'DN160', diametro: 147.0 }),
    ],
    conexoes: [
      { id: 'c_2', origem: 'inferior', destino: 'succao' },
      { id: 'c_3', origem: 'succao', destino: 'bomba' },
      // Recalque pela junção DIVISORA: bomba → divisor → superior / meio.
      { id: 'c_38', origem: 'bomba', destino: 'divisor' },
      { id: 'c_39', origem: 'divisor', destino: 'recalque_sup' },
      { id: 'c_40', origem: 'divisor', destino: 'recalque_meio' },
      { id: 'c_5', origem: 'recalque_meio', destino: 'meio' },
      { id: 'c_7', origem: 'recalque_sup', destino: 'superior' },
      // Saídas pela junção de UNIÃO: superior / meio → união → consumo.
      { id: 'c_8', origem: 'superior', destino: 'saida_sup' },
      { id: 'c_10', origem: 'meio', destino: 'saida_meio' },
      { id: 'c_42', origem: 'saida_sup', destino: 'uniao' },
      { id: 'c_43', origem: 'saida_meio', destino: 'uniao' },
      { id: 'c_44', origem: 'uniao', destino: 'consumo' },
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
      { id: 'c_22', origem: 'bomba_incendio', destino: 'hidrantes' },
      { id: 'c_24', origem: 'meio', destino: 'cavalete_incendio' },
      { id: 'c_25', origem: 'cavalete_incendio', destino: 'bomba_incendio' },
      { id: 'c_27', origem: 'sensor_meio', destino: 'meio' },
      { id: 'c_inf', origem: 'sensor_inf', destino: 'inferior' },
      // Linha de limpeza: cavalete → interligação → cavalete recalque → inferior.
      { id: 'c_30', origem: 'cavalete_incendio', destino: 'interligacao_limpeza' },
      { id: 'c_36', origem: 'interligacao_limpeza', destino: 'cavalete_recalque' },
      { id: 'c_35', origem: 'cavalete_recalque', destino: 'inferior' },
    ],
  };
}
