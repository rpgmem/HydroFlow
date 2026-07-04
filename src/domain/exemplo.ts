/**
 * Projeto de exemplo carregado ao abrir a aplicação.
 *
 * Cenário: três reservatórios cilíndricos EMPILHados (cotaBase crescente).
 *  - O inferior (≈75.000 L) recebe água de uma fonte externa e alimenta a bomba
 *    por um cano de sucção.
 *  - A bomba recalca para o reservatório do meio (≈55.000 L) e para o superior
 *    (≈55.000 L) por dois canos — a vazão nominal é dividida entre as saídas.
 *  - Dois canos (um do superior, um do meio) escoam por gravidade até um único
 *    ponto de consumo.
 *  - Um sensor no reservatório superior liga/desliga a bomba.
 *
 * Dimensões em metros → volume em m³ (1 m³ = 1.000 L). Cilindro de raio 2 m tem
 * área ≈ 12,566 m²; a alturaMaxima é escolhida para dar a capacidade desejada.
 */
import { criarConexao, criarPeca, projetoVazio } from './factory';
import type {
  Peca,
  ProjetoSimulacao,
  PropsBomba,
  PropsConsumo,
  PropsFonte,
  PropsReservatorio,
  PropsSensor,
  PropsTubo,
} from './types';

function reservatorioCilindrico(
  id: string,
  rotulo: string,
  x: number,
  y: number,
  over: Partial<PropsReservatorio>,
): Peca {
  const p = criarPeca('reservatorio', x, y, id);
  p.rotulo = rotulo;
  Object.assign(p.props as PropsReservatorio, {
    formato: 'cilindro',
    raio: 2,
    largura: undefined,
    comprimento: undefined,
    ...over,
  });
  return p;
}

function canoComRetencao(id: string, rotulo: string, x: number, y: number): Peca {
  const t = criarPeca('tubo', x, y, id);
  t.rotulo = rotulo;
  // checkValve nos canos da bomba: impede refluxo por gravidade (a bomba é quem
  // move a água contra o desnível dos reservatórios empilhados).
  Object.assign(t.props as PropsTubo, {
    diametro: 0.15,
    checkValve: true,
    registro: { aberto: true },
  });
  return t;
}

function canoGravidade(id: string, rotulo: string, x: number, y: number): Peca {
  const t = criarPeca('tubo', x, y, id);
  t.rotulo = rotulo;
  Object.assign(t.props as PropsTubo, { diametro: 0.06, registro: { aberto: true } });
  return t;
}

export function projetoExemplo(): ProjetoSimulacao {
  // Reservatórios empilhados: cotaBase cresce do inferior ao superior.
  const inferior = reservatorioCilindrico('inferior', 'Inferior (75.000 L)', 500, 560, {
    alturaMaxima: 5.97, // 12,566 · 5,97 ≈ 75,0 m³
    cotaBase: 0,
    nivel: 4,
  });
  const meio = reservatorioCilindrico('meio', 'Meio (55.000 L)', 500, 360, {
    alturaMaxima: 4.38, // ≈ 55,0 m³
    cotaBase: 6,
    nivel: 0.5,
  });
  const superior = reservatorioCilindrico('superior', 'Superior (55.000 L)', 500, 160, {
    alturaMaxima: 4.38,
    cotaBase: 10.4,
    nivel: 0.5,
  });

  const fonte = criarPeca('fonte', 260, 560, 'fonte');
  fonte.rotulo = 'Fonte externa';
  Object.assign(fonte.props as PropsFonte, { vazaoFixa: 4 });

  const bomba = criarPeca('bomba', 260, 380, 'bomba');
  bomba.rotulo = 'Bomba';
  Object.assign(bomba.props as PropsBomba, {
    vazaoNominal: 4, // dividida entre as duas saídas (≈2 para cada)
    sensores: ['sensor_sup'],
    ligada: false,
  });

  const succao = canoComRetencao('succao', 'Cano de sucção', 380, 470);
  const recalqueMeio = canoComRetencao('recalque_meio', 'Recalque → meio', 380, 370);
  const recalqueSup = canoComRetencao('recalque_sup', 'Recalque → superior', 340, 270);

  const consumo = criarPeca('consumo', 760, 300, 'consumo');
  consumo.rotulo = 'Consumo';
  // Escoamento por gravidade pelos canos de saída (Torricelli); demanda ativa 0.
  Object.assign(consumo.props as PropsConsumo, { vazaoDemanda: 0, aberto: true });

  const saidaSup = canoGravidade('saida_sup', 'Saída superior', 650, 200);
  const saidaMeio = canoGravidade('saida_meio', 'Saída meio', 650, 380);

  const sensor = criarPeca('sensor', 700, 120, 'sensor_sup');
  sensor.rotulo = 'Sensor superior';
  Object.assign(sensor.props as PropsSensor, {
    bombaAlvo: 'bomba',
    nivelMinimo: 1,
    nivelMaximo: 3.5,
  });

  return {
    ...projetoVazio('Reservatórios empilhados'),
    pecas: [
      inferior,
      meio,
      superior,
      fonte,
      bomba,
      succao,
      recalqueMeio,
      recalqueSup,
      consumo,
      saidaSup,
      saidaMeio,
      sensor,
    ],
    conexoes: [
      criarConexao('fonte', 'inferior'),
      criarConexao('inferior', 'succao'),
      criarConexao('succao', 'bomba'),
      criarConexao('bomba', 'recalque_meio'),
      criarConexao('recalque_meio', 'meio'),
      criarConexao('bomba', 'recalque_sup'),
      criarConexao('recalque_sup', 'superior'),
      criarConexao('superior', 'saida_sup'),
      criarConexao('saida_sup', 'consumo'),
      criarConexao('meio', 'saida_meio'),
      criarConexao('saida_meio', 'consumo'),
      criarConexao('sensor_sup', 'superior'),
    ],
  };
}
