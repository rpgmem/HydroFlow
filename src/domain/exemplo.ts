/**
 * Projeto de exemplo carregado ao abrir a aplicação: uma caixa d'água elevada
 * abastecida por uma bomba (controlada por um sensor de nível) que puxa de uma
 * cisterna, e um tubo por gravidade que leva a água da caixa a um ponto de uso.
 */
import { criarConexao, criarPeca, projetoVazio } from './factory';
import type {
  ProjetoSimulacao,
  PropsBomba,
  PropsReservatorio,
  PropsSensor,
  PropsTubo,
} from './types';

export function projetoExemplo(): ProjetoSimulacao {
  const cisterna = criarPeca('reservatorio', 140, 380, 'cisterna');
  Object.assign(cisterna.props as PropsReservatorio, {
    formato: 'retangular',
    largura: 2,
    comprimento: 2,
    alturaMaxima: 2,
    cotaBase: 0,
    nivel: 1.5,
    raio: undefined,
  });

  const bomba = criarPeca('bomba', 320, 300, 'bomba');
  Object.assign(bomba.props as PropsBomba, { vazaoNominal: 8, sensores: ['sensor'], ligada: false });

  const caixa = criarPeca('reservatorio', 500, 140, 'caixa');
  Object.assign(caixa.props as PropsReservatorio, {
    formato: 'cilindro',
    raio: 0.8,
    alturaMaxima: 1.2,
    cotaBase: 8,
    nivel: 0.2,
  });

  const sensor = criarPeca('sensor', 620, 120, 'sensor');
  Object.assign(sensor.props as PropsSensor, {
    bombaAlvo: 'bomba',
    nivelMinimo: 0.3,
    nivelMaximo: 1.0,
  });

  const tubo = criarPeca('tubo', 500, 340, 'descida');
  Object.assign(tubo.props as PropsTubo, { diametro: 0.05, registro: { aberto: true } });

  const uso = criarPeca('reservatorio', 500, 500, 'ponto_uso');
  Object.assign(uso.props as PropsReservatorio, {
    formato: 'retangular',
    largura: 1,
    comprimento: 1,
    alturaMaxima: 1,
    cotaBase: 0,
    nivel: 0,
  });

  return {
    ...projetoVazio('Caixa d’água elevada'),
    pecas: [cisterna, bomba, caixa, sensor, tubo, uso],
    conexoes: [
      criarConexao('cisterna', 'bomba'),
      criarConexao('bomba', 'caixa'),
      criarConexao('sensor', 'caixa'),
      criarConexao('caixa', 'descida'),
      criarConexao('descida', 'ponto_uso'),
    ],
  };
}
