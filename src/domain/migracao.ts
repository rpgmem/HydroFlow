/**
 * HydroFlow — Conversão de magnitudes para SI (armazenamento canônico)
 *
 * A partir do schema 1.2.0 todos os números do projeto são gravados em SI
 * (metros, m³, m³/s). Projetos antigos (1.0.0/1.1.0) gravavam nas unidades de
 * EXIBIÇÃO escolhidas — este módulo converte esses valores para SI usando os
 * fatores da unidade salva. É também usado pelo projeto-exemplo (autorado em
 * litros por legibilidade) para produzir o mesmo armazenamento canônico.
 *
 * Só campos de MAGNITUDE são convertidos: comprimentos (×kL) e vazões/volumes
 * (×kV). Diâmetros (sempre mm), tempos, frações, contagens, ângulos e
 * coeficientes NÃO são tocados.
 */

/** Multiplica, se finito, o campo `chave` de `obj` por `f`. */
function mult(obj: Record<string, unknown> | undefined, chave: string, f: number): void {
  if (!obj) return;
  const v = obj[chave];
  if (typeof v === 'number' && Number.isFinite(v)) obj[chave] = v * f;
}

/** Campos de amplitude de vazão do Gerador (Fonte/Consumo). Tempos/frações/contagens ficam de fora. */
const CAMPOS_VAZAO_GERADOR = [
  'vazao', 'min', 'max', 'base', 'v0', 'v1', 'amplitude', 'alvo', 'pmValor', 'pnValor',
] as const;

/** Campos de nível (comprimento) do NivelControle (sensor/boia). */
function converterNivelControle(nc: unknown, kL: number): void {
  if (typeof nc !== 'object' || nc === null) return;
  const o = nc as Record<string, unknown>;
  mult(o, 'nivelMinimo', kL);
  mult(o, 'nivelMaximo', kL);
}

/**
 * Converte todas as magnitudes de um projeto (objeto cru) das unidades de
 * EXIBIÇÃO (fatores kL/kV) para SI, in-place. `kL` = metros por comprimento,
 * `kV` = m³ por volume/vazão.
 */
export function converterMagnitudesParaSI(
  dado: Record<string, unknown>,
  kL: number,
  kV: number,
): void {
  if (kL === 1 && kV === 1) return; // já canônico
  const pecas = Array.isArray(dado.pecas) ? dado.pecas : [];
  for (const p of pecas) {
    if (typeof p !== 'object' || p === null) continue;
    const peca = p as Record<string, unknown>;
    mult(peca, 'cota', kL);
    const props = (typeof peca.props === 'object' && peca.props !== null)
      ? (peca.props as Record<string, unknown>)
      : undefined;
    if (!props) continue;
    switch (peca.tipo) {
      case 'reservatorio':
        for (const c of ['raio', 'largura', 'comprimento', 'alturaMaxima', 'nivel']) mult(props, c, kL);
        break;
      case 'tubo':
        for (const c of ['alturaEntrada', 'alturaSaida', 'comprimento']) mult(props, c, kL);
        mult(props.ladrao as Record<string, unknown> | undefined, 'nivel', kL);
        converterNivelControle(props.boia, kL);
        break;
      case 'bomba':
        mult(props, 'alturaNominal', kL);
        mult(props, 'vazaoNominal', kV);
        // curva.k tem unidade composta vazão/comprimento → fator kV/kL.
        mult(props.curva as Record<string, unknown> | undefined, 'k', kV / kL);
        break;
      case 'fonte':
        for (const c of CAMPOS_VAZAO_GERADOR) mult(props.gerador as Record<string, unknown> | undefined, c, kV);
        converterNivelControle(props.boia, kL);
        break;
      case 'consumo':
        for (const c of CAMPOS_VAZAO_GERADOR) mult(props.gerador as Record<string, unknown> | undefined, c, kV);
        break;
      case 'sensor':
        converterNivelControle(props, kL);
        break;
      // juncao: diametro em mm (não converte). quadro: sem magnitudes.
    }
  }
  const conexoes = Array.isArray(dado.conexoes) ? dado.conexoes : [];
  for (const c of conexoes) {
    if (typeof c === 'object' && c !== null) mult(c as Record<string, unknown>, 'vazaoAlocada', kV);
  }
}
