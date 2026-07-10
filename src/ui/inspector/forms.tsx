/**
 * Formulários do inspetor por tipo de peça (reservatório, tubo, bomba, fonte,
 * consumo, sensor, junção). Extraídos de Inspector.tsx para enxugá-lo — cada um
 * edita as props do seu tipo; os blocos compartilhados vêm de `campos.tsx`.
 */
import {
  isBomba,
  type NivelControle,
  type ProjetoSimulacao,
  type PropsBomba,
  type PropsConsumo,
  type PropsFonte,
  type PropsJuncao,
  type PropsReservatorio,
  type PropsSensor,
  type PropsTubo,
  type Unidades,
} from '../../domain/types';
import { Trans, useTranslation } from 'react-i18next';
import { vazaoDeM3, vazaoMaxRecomendadaM3, volumeMaximoM3 } from '../../engine/geometria';
import { labelVolume, m3PorVolume } from '../../domain/unidades';
import { CATALOGO_TUBOS, CATEGORIAS_TUBO, bitolaPorDn, rotuloBitola } from '../../domain/tubosCatalogo';
import { fmtNumero } from '../../i18n';
import { Num, type Upd, type UniLabel } from './campos';
import { Switch } from '../Switch';

export function ReservatorioForm({
  props,
  emExecucao,
  upd,
  u,
  unidades,
}: {
  props: PropsReservatorio;
  emExecucao: boolean;
  upd: Upd;
  u: UniLabel;
  unidades: Unidades;
}) {
  const { t, i18n } = useTranslation();
  // Capacidade (litragem) derivada da geometria informada (raio/lados × altura
  // máxima), na unidade de volume do usuário. Só informativo — atualiza sozinho.
  const capacidade = volumeMaximoM3(props, unidades) / m3PorVolume(unidades);
  const nivelAtual = volumeMaximoM3({ ...props, alturaMaxima: props.nivel ?? 0 }, unidades) / m3PorVolume(unidades);
  const fmt = (n: number): string => fmtNumero(n, i18n.language, { maximumFractionDigits: 0 });
  return (
    <>
      <div className="field">
        <label>{t('form.formato')}</label>
        <select
          value={props.formato}
          disabled={emExecucao}
          aria-label={t('form.formato')}
          onChange={(e) => upd({ formato: e.target.value })}
        >
          <option value="cilindro">{t('form.cilindro')}</option>
          <option value="retangular">{t('form.retangular')}</option>
        </select>
      </div>
      {props.formato === 'cilindro' ? (
        <Num label={t('form.raio')} unidade={u.comp} value={props.raio} disabled={emExecucao} onChange={(v) => upd({ raio: v })} />
      ) : (
        <>
          <Num label={t('form.largura')} unidade={u.comp} value={props.largura} disabled={emExecucao} onChange={(v) => upd({ largura: v })} />
          <Num label={t('form.comprimento')} unidade={u.comp} value={props.comprimento} disabled={emExecucao} onChange={(v) => upd({ comprimento: v })} />
        </>
      )}
      <Num label={t('form.alturaMaxima')} unidade={u.comp} value={props.alturaMaxima} disabled={emExecucao} onChange={(v) => upd({ alturaMaxima: v })} />
      <Num label={t('form.cotaBase')} unidade={u.comp} value={props.cotaBase} disabled={emExecucao} onChange={(v) => upd({ cotaBase: v })} />
      <Num label={t('form.nivelAtual')} unidade={u.comp} value={props.nivel} onChange={(v) => upd({ nivel: v })} />
      {capacidade > 0 && (
        <p className="telemetry" style={{ marginTop: -4 }}>
          <Trans
            i18nKey="form.capacidade"
            values={{ cap: fmt(capacidade), atual: fmt(nivelAtual), unidade: labelVolume(unidades) }}
            components={{ 1: <strong /> }}
          />
        </p>
      )}
    </>
  );
}

export function TuboForm({
  props,
  emExecucao,
  upd,
  u,
  unidades,
  atrito,
  velRef,
}: {
  props: PropsTubo;
  emExecucao: boolean;
  upd: Upd;
  u: UniLabel;
  unidades: Unidades;
  atrito: boolean;
  velRef: number;
}) {
  const { t, i18n } = useTranslation();
  const temBoia = props.boia !== undefined;
  const temLadrao = props.ladrao !== undefined;
  // Vazão máxima recomendada = área × velocidade de referência (configurável em
  // ⚙ Opções, padrão 3 m/s). Acima disso o tubo é sinalizado na simulação.
  const vazaoMaxRec =
    props.diametro > 0 ? vazaoDeM3(vazaoMaxRecomendadaM3(props.diametro, velRef), unidades) : 0;
  return (
    <>
      {/* Bitola pré-configurada: seleciona o DN e grava o diâmetro INTERNO
          tabelado (usado no cálculo de vazão). "Personalizado" libera o mm. */}
      <div className="field">
        <label>{t('form.bitola')}</label>
        <select
          value={props.bitola ?? ''}
          disabled={emExecucao}
          aria-label={t('form.bitola')}
          onChange={(e) => {
            const b = bitolaPorDn(e.target.value);
            if (b) upd({ bitola: b.dn, diametro: b.internoMm });
            else upd({ bitola: undefined });
          }}
        >
          <option value="">{t('form.personalizado')}</option>
          {CATEGORIAS_TUBO.map((cat) => (
            <optgroup key={cat} label={cat}>
              {CATALOGO_TUBOS.filter((b) => b.categoria === cat).map((b) => (
                <option key={b.dn} value={b.dn}>
                  {rotuloBitola(b)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {/* Editar o diâmetro na mão limpa a bitola (vira "Personalizado"). */}
      <Num
        label={t('form.diametroInterno')}
        unidade="mm"
        value={props.diametro}
        disabled={emExecucao}
        step={0.1}
        onChange={(v) => upd({ diametro: v, bitola: undefined })}
      />
      {props.diametro > 0 && (
        <p className="telemetry" style={{ marginTop: -4 }}>
          <Trans
            i18nKey="form.vazaoMaxRec"
            values={{ vazao: vazaoMaxRec.toFixed(2), unidade: u.vazao, vel: fmtNumero(velRef, i18n.language) }}
            components={{ 1: <strong /> }}
          />
        </p>
      )}
      {/* Perda de carga (Hazen-Williams): comprimento e C só aparecem com o
          atrito ligado (ver ⚙ Opções). Defaults: 1 m e C=140 quando em branco. */}
      {atrito && (
        <>
          <Num
            label={t('form.comprimento')}
            unidade={u.comp}
            value={props.comprimento ?? 0}
            disabled={emExecucao}
            onChange={(v) => upd({ comprimento: v })}
          />
          <Num
            label={t('form.coefC')}
            value={props.coefC ?? 140}
            disabled={emExecucao}
            step={1}
            onChange={(v) => upd({ coefC: v })}
          />
        </>
      )}
      {/* Altura de conexão em cada ponta (relativa à base do reservatório).
          0 = fundo; acima disso, só escoa a água acima do bocal. */}
      <Num
        label={t('form.alturaEntrada')}
        unidade={u.comp}
        value={props.alturaEntrada ?? 0}
        disabled={emExecucao}
        onChange={(v) => upd({ alturaEntrada: v })}
      />
      <Num
        label={t('form.alturaSaida')}
        unidade={u.comp}
        value={props.alturaSaida ?? 0}
        disabled={emExecucao}
        onChange={(v) => upd({ alturaSaida: v })}
      />
      {/* Com boia, o registro manual perde o sentido (a boia governa a abertura). */}
      {!temBoia && (
        <Switch
          checked={props.registro?.aberto ?? true}
          disabled={emExecucao}
          ariaLabel={t('form.registroAberto')}
          onChange={(v) => upd({ registro: { aberto: v } })}
        >
          {t('form.registroAberto')}
        </Switch>
      )}
      <Switch
        checked={props.checkValve ?? false}
        disabled={emExecucao}
        ariaLabel={t('form.checkValve')}
        onChange={(v) => upd({ checkValve: v })}
      >
        {t('form.checkValve')}
      </Switch>
      {/* Boia e ladrão são mutuamente exclusivos (papéis de válvula distintos). */}
      {!temLadrao && (
        <BoiaFields boia={props.boia} upd={upd} unidade={u.comp} aoAtivar={{ registro: { aberto: true } }} />
      )}
      {!temBoia && (
        <>
          <Switch
            checked={temLadrao}
            disabled={emExecucao}
            ariaLabel={t('form.ladrao')}
            onChange={(v) => upd({ ladrao: v ? { nivel: 0 } : undefined })}
          >
            {t('form.ladrao')}
          </Switch>
          {temLadrao && (
            <Num
              label={t('form.ladraoNivel')}
              unidade={u.comp}
              value={props.ladrao?.nivel}
              disabled={emExecucao}
              onChange={(v) => upd({ ladrao: { nivel: v } })}
            />
          )}
        </>
      )}
    </>
  );
}

/**
 * Boia mecânica (válvula de nível embutida na aresta). Monitora o reservatório
 * de destino: fecha ao encher (nível ≥ máximo), abre ao baixar (nível ≤ mínimo).
 * Sem histerese/delay (isso é exclusivo do sensor eletrônico).
 */
export function BoiaFields({
  boia,
  upd,
  unidade,
  aoAtivar = {},
}: {
  boia: NivelControle | undefined;
  upd: Upd;
  unidade?: string;
  aoAtivar?: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const ativa = boia !== undefined;
  return (
    <>
      <Switch
        checked={ativa}
        ariaLabel={t('form.boia')}
        onChange={(v) =>
          upd(v ? { boia: { nivelMinimo: 0, nivelMaximo: 1 }, ...aoAtivar } : { boia: undefined })
        }
      >
        {t('form.boia')}
      </Switch>
      {ativa && (
        <>
          <Num
            label={t('form.boiaAbre')}
            unidade={unidade}
            value={boia.nivelMinimo}
            onChange={(v) => upd({ boia: { ...boia, nivelMinimo: v } })}
          />
          <Num
            label={t('form.boiaFecha')}
            unidade={unidade}
            value={boia.nivelMaximo}
            onChange={(v) => upd({ boia: { ...boia, nivelMaximo: v } })}
          />
        </>
      )}
    </>
  );
}

export function BombaForm({ props, emExecucao, upd, u }: { props: PropsBomba; emExecucao: boolean; upd: Upd; u: UniLabel }) {
  const { t } = useTranslation();
  return (
    <>
      <Num label={t('form.vazaoNominal')} unidade={u.vazao} value={props.vazaoNominal} disabled={emExecucao} onChange={(v) => upd({ vazaoNominal: v })} />
      {/* Altura nominal deriva a curva automaticamente; entre dois reservatórios
          a altura real da instalação reduz a vazão. Projetos antigos com `curva.k`
          aparecem aqui como a altura equivalente (vazaoNominal/k). */}
      <Num
        label={t('form.alturaNominal')}
        unidade="m"
        value={props.alturaNominal ?? (props.curva && props.curva.k > 0 ? props.vazaoNominal / props.curva.k : 0)}
        disabled={emExecucao}
        step={0.5}
        onChange={(v) => upd({ alturaNominal: v > 0 ? v : undefined, curva: undefined })}
      />
      <p className="telemetry" style={{ marginTop: -4 }}>
        {t('form.alturaNominalDica')}
      </p>
      <div className="field">
        <label>{t('form.controleBomba')}</label>
        <select
          value={props.modoControle ?? 'auto'}
          aria-label={t('form.controleBomba')}
          onChange={(e) => upd({ modoControle: e.target.value })}
        >
          <option value="auto">{t('form.controleAuto')}</option>
          <option value="ligado">{t('form.controleLigado')}</option>
          <option value="desligado">{t('form.controleDesligado')}</option>
        </select>
      </div>
      {/* Bomba dupla em revezamento: rodízio de desgaste entre duas metades
          (mesma vazão e tubulação). Padrão = bomba única. */}
      <Switch
        checked={props.revezamento ?? false}
        disabled={emExecucao}
        ariaLabel={t('form.revezamentoLabel')}
        onChange={(v) => upd({ revezamento: v })}
      >
        {t('form.revezamento')}
      </Switch>
    </>
  );
}

export function JuncaoForm({ props, emExecucao, upd }: { props: PropsJuncao; emExecucao: boolean; upd: Upd }) {
  const { t } = useTranslation();
  const temDiam = props.diametro !== undefined && props.diametro > 0;
  return (
    <>
      <Switch
        checked={temDiam}
        disabled={emExecucao}
        ariaLabel={t('form.estrangularLabel')}
        // Ao ligar, assume a bitola DN110 (mesmo default dos tubos maiores);
        // ao desligar, limpa diâmetro e bitola.
        onChange={(marcado) => {
          const b = bitolaPorDn('DN110');
          if (marcado && b) upd({ diametro: b.internoMm, bitola: b.dn });
          else if (marcado) upd({ diametro: 100, bitola: undefined });
          else upd({ diametro: undefined, bitola: undefined });
        }}
      >
        {t('form.estrangular')}
      </Switch>
      {temDiam && (
        <>
          {/* Mesma lista de bitolas dos tubos: seleciona o DN e grava o diâmetro
              INTERNO tabelado. "Personalizado" libera o mm. */}
          <div className="field">
            <label>{t('form.bitola')}</label>
            <select
              value={props.bitola ?? ''}
              disabled={emExecucao}
              aria-label={t('form.bitolaJuncao')}
              onChange={(e) => {
                const b = bitolaPorDn(e.target.value);
                if (b) upd({ bitola: b.dn, diametro: b.internoMm });
                else upd({ bitola: undefined });
              }}
            >
              <option value="">{t('form.personalizado')}</option>
              {CATEGORIAS_TUBO.map((cat) => (
                <optgroup key={cat} label={cat}>
                  {CATALOGO_TUBOS.filter((b) => b.categoria === cat).map((b) => (
                    <option key={b.dn} value={b.dn}>
                      {rotuloBitola(b)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          {/* Editar o diâmetro na mão limpa a bitola (vira "Personalizado"). */}
          <Num
            label={t('form.diametroInternoJuncao')}
            unidade="mm"
            value={props.diametro}
            disabled={emExecucao}
            step={0.1}
            onChange={(v) => upd({ diametro: v, bitola: undefined })}
          />
        </>
      )}
    </>
  );
}

export function ConsumoForm({
  props,
  emExecucao,
  upd,
  u,
}: {
  props: PropsConsumo;
  emExecucao: boolean;
  upd: Upd;
  u: UniLabel;
}) {
  const { t } = useTranslation();
  const perfil = props.perfil ?? 'fixo';
  return (
    <>
      <div className="field">
        <label>{t('form.perfilConsumo')}</label>
        <select
          value={perfil}
          disabled={emExecucao}
          aria-label={t('form.perfilConsumo')}
          onChange={(e) => upd({ perfil: e.target.value })}
        >
          <option value="fixo">{t('form.perfilFixo')}</option>
          <option value="senoidal">{t('form.perfilSenoidal')}</option>
          <option value="intermitente">{t('form.perfilIntermitente')}</option>
        </select>
      </div>

      {perfil === 'fixo' ? (
        <Num
          label={t('form.vazaoSaida')}
          unidade={u.vazao}
          value={props.vazaoDemanda}
          disabled={emExecucao}
          onChange={(v) => upd({ vazaoDemanda: v })}
        />
      ) : (
        <>
          <Num label={t('form.vazaoMin')} unidade={u.vazao} value={props.vazaoMin ?? 0} disabled={emExecucao} onChange={(v) => upd({ vazaoMin: v })} />
          <Num label={t('form.vazaoMax')} unidade={u.vazao} value={props.vazaoMax ?? props.vazaoDemanda} disabled={emExecucao} onChange={(v) => upd({ vazaoMax: v })} />
          <Num label={t('form.periodo')} value={props.periodo ?? 60} disabled={emExecucao} step={1} onChange={(v) => upd({ periodo: v })} />
          {perfil === 'intermitente' && (
            <Num label={t('form.cicloLigado')} value={props.cicloLigado ?? 0.5} disabled={emExecucao} step={0.05} onChange={(v) => upd({ cicloLigado: v })} />
          )}
        </>
      )}

      <Switch
        checked={props.aberto ?? true}
        disabled={emExecucao}
        ariaLabel={t('form.saidaAberta')}
        onChange={(v) => upd({ aberto: v })}
      >
        {t('form.saidaAberta')}
      </Switch>
    </>
  );
}

export function FonteForm({ props, emExecucao, upd, u }: { props: PropsFonte; emExecucao: boolean; upd: Upd; u: UniLabel }) {
  const { t } = useTranslation();
  // A boia é uma válvula de NÍVEL que fica no cano/entrada do tanque — por isso
  // ela é configurada no tubo, não na fonte externa (suprimento infinito). O
  // motor ainda respeita uma `fonte.boia` de projetos antigos, mas não a expomos
  // mais aqui para não confundir.
  return (
    <Num label={t('form.vazaoFixa')} unidade={u.vazao} value={props.vazaoFixa} disabled={emExecucao} onChange={(v) => upd({ vazaoFixa: v })} />
  );
}

export function SensorForm({
  props,
  projeto,
  upd,
  u,
}: {
  props: PropsSensor;
  projeto: ProjetoSimulacao;
  upd: Upd;
  u: UniLabel;
}) {
  const { t } = useTranslation();
  const bombas = projeto.pecas.filter(isBomba);
  const alvos = props.bombasAlvo;
  const alternarAlvo = (id: string, marcado: boolean): void =>
    upd({ bombasAlvo: marcado ? [...alvos, id] : alvos.filter((x) => x !== id) });
  const reversa = props.reversa ?? false;
  return (
    <>
      <div className="field">
        <label>{t('form.bombasControladas')}</label>
        {bombas.length === 0 ? (
          <p className="telemetry" style={{ margin: 0 }}>{t('form.semBombas')}</p>
        ) : (
          bombas.map((b) => {
            const nome = b.rotulo && b.rotulo.trim() ? b.rotulo : b.id;
            return (
            <label className="checkbox" key={b.id}>
              <input
                type="checkbox"
                checked={alvos.includes(b.id)}
                aria-label={t('form.controlar', { nome })}
                onChange={(e) => alternarAlvo(b.id, e.target.checked)}
              />
              {nome}
            </label>
            );
          })
        )}
      </div>
      <Switch
        checked={reversa}
        ariaLabel={t('form.reversoLabel')}
        onChange={(v) => upd({ reversa: v })}
      >
        {t('form.reverso')}
      </Switch>
      <Num
        label={reversa ? t('form.nivelMinDesliga') : t('form.nivelMinLiga')}
        unidade={u.comp}
        value={props.nivelMinimo}
        onChange={(v) => upd({ nivelMinimo: v })}
      />
      <Num
        label={reversa ? t('form.nivelMaxLiga') : t('form.nivelMaxDesliga')}
        unidade={u.comp}
        value={props.nivelMaximo}
        onChange={(v) => upd({ nivelMaximo: v })}
      />
      <Switch checked={props.histerese ?? false} ariaLabel={t('form.histerese')} onChange={(v) => upd({ histerese: v })}>
        {t('form.histerese')}
      </Switch>
      <Num label={t('form.delay')} value={props.delay} onChange={(v) => upd({ delay: v })} />
    </>
  );
}
