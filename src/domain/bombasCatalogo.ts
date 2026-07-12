/**
 * HydroFlow — Catálogo de modelos de bomba (presets).
 *
 * Como o catálogo de bitolas dos tubos ou os presets de material: escolher um
 * MODELO preenche as specs da bomba (`vazaoNominal`, `alturaNominal`,
 * `npshRequerido`). O motor lê só essas props — o modelo é rótulo/UI.
 *
 * Valores JÁ EM SI (unidade canônica): a vazão está em m³/s (a fonte mantém o
 * m³/h legível como `X / 3600`); altura e NPSH em metros. Dados de placa típicos
 * (ordem de grandeza) para dois grupos: bombas de SUPERFÍCIE e SUBMERGÍVEIS.
 *
 * Simplificação: o par (vazão nominal, altura nominal) alimenta a curva LINEAR
 * do modelo (entrega a vazão a 0 m, zera na altura nominal) — os datasheets
 * trazem uma curva Q–H completa; aqui usamos o ponto nominal como âncora.
 */

export type GrupoBomba = 'superficie' | 'submergivel';

export interface ModeloBomba {
  /** Id estável (slug) — gravado em `PropsBomba.modeloBomba`. */
  id: string;
  /** Rótulo exibido: "{Tipo} {Potência} CV". */
  nome: string;
  grupo: GrupoBomba;
  /** Potência (CV) — só rótulo/readout. */
  potenciaCV: string;
  /** Tipo construtivo (Centrífuga, Submersa…) — só rótulo/readout. */
  tipo: string;
  /** Vazão nominal em m³/s (SI). Fonte: m³/h ÷ 3600. */
  vazaoNominal: number;
  /** Altura nominal de recalque (m). */
  alturaNominal: number;
  /** NPSH requerido (m). Ausente = não aplicável (ex.: injetora). */
  npshRequerido?: number;
  /** Fase elétrica — só readout. */
  fase: string;
  /** Aplicação típica — só readout. */
  aplicacao: string;
  /** Faixa de operação (vazão @ altura) — só readout. */
  faixa: string;
}

/**
 * Catálogo. `vazaoNominal` mantém a fonte legível como `m³/h / 3600`.
 * NPSH: bombas de superfície pelo dado de placa; submergíveis = 0,30 m (garante
 * que sejam operadas afogadas); injetora = N/A (undefined).
 */
export const CATALOGO_BOMBAS: ModeloBomba[] = [
  // ---- Superfície -------------------------------------------------------
  { id: 'sup-perif-0-25', nome: 'Periférica 0,25 CV', grupo: 'superficie', potenciaCV: '0,25', tipo: 'Periférica', vazaoNominal: 1.5 / 3600, alturaNominal: 15, npshRequerido: 1.8, fase: 'Monofásica', aplicacao: 'Pequenas residências / Cisternas', faixa: '1,0 a 2,4 m³/h @ 25 a 2 m' },
  { id: 'sup-centr-0-5', nome: 'Centrífuga 0,5 CV', grupo: 'superficie', potenciaCV: '0,5', tipo: 'Centrífuga', vazaoNominal: 4.0 / 3600, alturaNominal: 12, npshRequerido: 2.0, fase: 'Monofásica', aplicacao: 'Abastecimento predial leve', faixa: '2,5 a 5,5 m³/h @ 19 a 1 m' },
  { id: 'sup-centr-0-75', nome: 'Centrífuga 0,75 CV', grupo: 'superficie', potenciaCV: '0,75', tipo: 'Centrífuga', vazaoNominal: 5.5 / 3600, alturaNominal: 15, npshRequerido: 2.2, fase: 'Monofásica', aplicacao: 'Sistemas residenciais médios', faixa: '3,0 a 8,0 m³/h @ 22 a 4 m' },
  { id: 'sup-injet-1-0', nome: 'Injetora 1,0 CV', grupo: 'superficie', potenciaCV: '1,0', tipo: 'Injetora', vazaoNominal: 1.2 / 3600, alturaNominal: 25, npshRequerido: undefined, fase: 'Monofásica', aplicacao: 'Poços profundos (sucção > 9m)', faixa: '0,6 a 2,0 m³/h @ 40 a 15 m' },
  { id: 'sup-centr-1-0', nome: 'Centrífuga 1,0 CV', grupo: 'superficie', potenciaCV: '1,0', tipo: 'Centrífuga', vazaoNominal: 8.0 / 3600, alturaNominal: 18, npshRequerido: 2.5, fase: 'Mono/Trifásica', aplicacao: 'Recalque residencial de alto fluxo', faixa: '4,0 a 12,0 m³/h @ 28 a 5 m' },
  { id: 'sup-centr-1-5', nome: 'Centrífuga 1,5 CV', grupo: 'superficie', potenciaCV: '1,5', tipo: 'Centrífuga', vazaoNominal: 12.0 / 3600, alturaNominal: 18, npshRequerido: 2.8, fase: 'Mono/Trifásica', aplicacao: 'Prédios médios / Irrigação', faixa: '6,0 a 18,0 m³/h @ 26 a 10 m' },
  { id: 'sup-centr-2-0', nome: 'Centrífuga 2,0 CV', grupo: 'superficie', potenciaCV: '2,0', tipo: 'Centrífuga', vazaoNominal: 16.0 / 3600, alturaNominal: 22, npshRequerido: 3.0, fase: 'Mono/Trifásica', aplicacao: 'Distribuição condominial', faixa: '10,0 a 24,0 m³/h @ 31 a 12 m' },
  { id: 'sup-centr-3-0', nome: 'Centrífuga 3,0 CV', grupo: 'superficie', potenciaCV: '3,0', tipo: 'Centrífuga', vazaoNominal: 18.0 / 3600, alturaNominal: 28, npshRequerido: 3.2, fase: 'Mono/Trifásica', aplicacao: 'Sistemas industriais / Incêndio', faixa: '8,0 a 28,0 m³/h @ 38 a 15 m' },
  { id: 'sup-centr-4-0', nome: 'Centrífuga 4,0 CV', grupo: 'superficie', potenciaCV: '4,0', tipo: 'Centrífuga', vazaoNominal: 24.0 / 3600, alturaNominal: 30, npshRequerido: 3.5, fase: 'Trifásica', aplicacao: 'Recalque predial grande', faixa: '12,0 a 35,0 m³/h @ 45 a 15 m' },
  { id: 'sup-multi-5-0', nome: 'Multiestágio 5,0 CV', grupo: 'superficie', potenciaCV: '5,0', tipo: 'Multiestágio', vazaoNominal: 15.0 / 3600, alturaNominal: 55, npshRequerido: 2.8, fase: 'Trifásica', aplicacao: 'Prédios muito altos', faixa: '8,0 a 22,0 m³/h @ 75 a 35 m' },
  { id: 'sup-centr-7-5', nome: 'Centrífuga 7,5 CV', grupo: 'superficie', potenciaCV: '7,5', tipo: 'Centrífuga', vazaoNominal: 35.0 / 3600, alturaNominal: 38, npshRequerido: 4.2, fase: 'Trifásica', aplicacao: 'Grandes condomínios / Indústria', faixa: '20,0 a 50,0 m³/h @ 52 a 18 m' },
  { id: 'sup-centr-10', nome: 'Centrífuga 10,0 CV', grupo: 'superficie', potenciaCV: '10,0', tipo: 'Centrífuga', vazaoNominal: 45.0 / 3600, alturaNominal: 42, npshRequerido: 4.8, fase: 'Trifásica', aplicacao: 'Redes municipais / Robusta', faixa: '25,0 a 65,0 m³/h @ 60 a 20 m' },
  // ---- Submergíveis (NPSH 0,30 m: devem operar afogadas) ----------------
  { id: 'sub-subm-0-33', nome: 'Submersível 0,33 CV', grupo: 'submergivel', potenciaCV: '0,33', tipo: 'Submersível', vazaoNominal: 6.0 / 3600, alturaNominal: 4, npshRequerido: 0.3, fase: 'Monofásica', aplicacao: 'Esgotamento de poço de elevador', faixa: '3,0 a 9,0 m³/h @ 7 a 1 m' },
  { id: 'sub-suba-0-5', nome: 'Submersa 0,5 CV', grupo: 'submergivel', potenciaCV: '0,5', tipo: 'Submersa', vazaoNominal: 2.0 / 3600, alturaNominal: 28, npshRequerido: 0.3, fase: 'Monofásica', aplicacao: 'Poços artesianos residenciais', faixa: '1,0 a 3,2 m³/h @ 45 a 10 m' },
  { id: 'sub-suba-1-0', nome: 'Submersa 1,0 CV', grupo: 'submergivel', potenciaCV: '1,0', tipo: 'Submersa', vazaoNominal: 2.5 / 3600, alturaNominal: 60, npshRequerido: 0.3, fase: 'Mono/Trifásica', aplicacao: 'Poços artesianos profundos', faixa: '1,5 a 4,0 m³/h @ 90 a 14 m' },
  { id: 'sub-suba-2-0', nome: 'Submersa 2,0 CV', grupo: 'submergivel', potenciaCV: '2,0', tipo: 'Submersa', vazaoNominal: 5.5 / 3600, alturaNominal: 80, npshRequerido: 0.3, fase: 'Mono/Trifásica', aplicacao: 'Abastecimento rural e condomínios', faixa: '3,0 a 8,5 m³/h @ 120 a 30 m' },
  { id: 'sub-subm-3-0', nome: 'Submersível 3,0 CV', grupo: 'submergivel', potenciaCV: '3,0', tipo: 'Submersível', vazaoNominal: 26.0 / 3600, alturaNominal: 11, npshRequerido: 0.3, fase: 'Mono/Trifásica', aplicacao: 'Drenagem pluvial / Efluentes', faixa: '15,0 a 40,0 m³/h @ 18 a 3 m' },
  { id: 'sub-suba-5-0', nome: 'Submersa 5,0 CV', grupo: 'submergivel', potenciaCV: '5,0', tipo: 'Submersa', vazaoNominal: 8.5 / 3600, alturaNominal: 110, npshRequerido: 0.3, fase: 'Trifásica', aplicacao: 'Saneamento / Altas elevações', faixa: '5,0 a 12,0 m³/h @ 160 a 50 m' },
  { id: 'sub-suba-6-0', nome: 'Submersa 6,0 CV', grupo: 'submergivel', potenciaCV: '6,0', tipo: 'Submersa', vazaoNominal: 10.0 / 3600, alturaNominal: 85, npshRequerido: 0.3, fase: 'Trifásica', aplicacao: 'Abastecimento urbano / Poços', faixa: '6,0 a 15,0 m³/h @ 110 a 40 m' },
  { id: 'sub-suba-7-5', nome: 'Submersa 7,5 CV', grupo: 'submergivel', potenciaCV: '7,5', tipo: 'Submersa', vazaoNominal: 18.0 / 3600, alturaNominal: 95, npshRequerido: 0.3, fase: 'Trifásica', aplicacao: 'Captação profunda / Indústria', faixa: '10,0 a 28,0 m³/h @ 140 a 45 m' },
  { id: 'sub-subm-10', nome: 'Submersível 10,0 CV', grupo: 'submergivel', potenciaCV: '10,0', tipo: 'Submersível', vazaoNominal: 75.0 / 3600, alturaNominal: 22, npshRequerido: 0.3, fase: 'Trifásica', aplicacao: 'Mineração / Tratamento pesado', faixa: '40,0 a 110,0 m³/h @ 35 a 10 m' },
];

/** Grupos na ordem de exibição (para os `optgroup` do seletor). */
export const GRUPOS_BOMBA: GrupoBomba[] = ['superficie', 'submergivel'];

/** Busca um modelo pelo id. */
export function modeloBombaPorId(id: string | undefined): ModeloBomba | undefined {
  return id ? CATALOGO_BOMBAS.find((m) => m.id === id) : undefined;
}
