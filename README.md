# HydroFlow

Simulador visual de **reservatórios, tubos e bombas**. O usuário monta um sistema
hidráulico estilo Lego (drag-and-drop) e simula o comportamento físico
**simplificado** do líquido entre as peças.

> Escopo explícito: simulação simplificada (**Torricelli + continuidade de
> volume**), **não** CFD/Navier-Stokes. Ver [Fora de escopo](#fora-de-escopo).

**🔗 Demo ao vivo:** <https://deeppink-dog-866880.hostingersite.com/hydroflow/>

## Stack

| Camada | Tecnologia |
| --- | --- |
| UI / canvas | React + TypeScript, [react-konva](https://konvajs.org/docs/react/) |
| Motor de simulação | TypeScript puro, desacoplado de React (testável isolado) |
| Testes | [Vitest](https://vitest.dev) + React Testing Library |
| Qualidade | ESLint + TypeScript `strict` |
| Persistência | export/import manual de `.json` (sem backend) |

## Como rodar

```bash
npm install
npm run dev        # ambiente de desenvolvimento (Vite)
npm test           # testes unitários + integração (Vitest)
npm run lint       # ESLint (0 warnings)
npm run typecheck  # tsc --noEmit
npm run build      # build de produção
```

A aplicação abre com um projeto de exemplo: três reservatórios cilíndricos
empilhados. Uma fonte enche o inferior por uma boia mecânica; uma **bomba em
revezamento** (com altura nominal de recalque) puxa do inferior e recalca para o
meio e o superior; do superior e do meio a água escoa por gravidade até um ponto
de **consumo senoidal**. Sensores eletrônicos comandam a bomba — um normal no
superior e um **reverso** no inferior (proteção contra rodar a seco) — e há ainda
um **sistema secundário de incêndio** (bomba + hidrantes) alimentado pelo
reservatório do meio. Clique em **▶ Executar** para validar o grafo e entrar em
modo de simulação; depois **▶ Play**.

**Interação no editor:** clique numa peça para selecioná-la (e editar/renomear no
inspetor); **arraste do ponto ciano (saída)** de uma peça até outra para criar uma
conexão — conexões nunca são criadas por acaso. Clique numa linha para
selecioná-la e apague com **Delete** (ou no botão flutuante). O canvas tem
**pan** (arrastar o fundo) e **zoom** (roda do mouse / pinça / botões `+`/`−`).

**Recursos da interface:**

- **Log de eventos** (📋) — histórico com acionamento de bomba, disparos de
  sensores e alertas (ladrão/transbordo, déficit, rodando a seco).
- **Tema** — escuro (padrão) ou claro, alternável na barra (`☀ Claro`/`🌙 Escuro`).
- **Imprimir** (🖨) — enquadra todo o diagrama, aplica fundo branco com rótulos
  escuros e envia para impressão, restaurando a vista ao terminar.
- **Mobile** — em telas pequenas a interface fica em modo **ver e simular** (a
  edição de grafo permanece exclusiva do desktop); as ações secundárias (Novo,
  Tema, Imprimir, Salvar, Carregar) recolhem sob um botão **⋯** para poupar
  espaço da barra.

## Arquitetura

```
src/
├── domain/         # Sprint 1 — modelo de domínio e schema
│   ├── types.ts        # todas as interfaces (ProjetoSimulacao, Peca, Conexao…)
│   ├── schema.ts       # validação e versionamento de .json (robusto a lixo)
│   ├── factory.ts      # fábricas de peças/projeto com defaults
│   └── exemplo.ts      # projeto de demonstração
├── engine/         # Sprint 2 — motor de simulação (puro, sem UI)
│   ├── geometria.ts       # relação nível↔volume (seção constante)
│   ├── arbitragem.ts      # sensores/boias e arbitragem de bombas
│   ├── simulador.ts       # tick(): cálculo de vazão e atualização de estado
│   └── validacaoGrafo.ts  # validação de grafo (seção 5)
├── state/          # Sprint 4 — reducer central (modos edição/execução)
│   └── store.ts
├── persistence/    # Sprint 5 — export/import .json
│   └── arquivo.ts
└── ui/             # Sprint 3/4/5 — componentes React + konva
    ├── App.tsx, Toolbar.tsx, Palette.tsx, Canvas.tsx, PecaView.tsx, Inspector.tsx
    └── useSimulationLoop.ts
```

O motor não depende de React nem do DOM: `tick(projeto)` recebe um
`ProjetoSimulacao` e devolve o próximo estado. Isso permite testá-lo de forma
determinística (nenhum uso de `Date.now()`/`Math.random()` no motor).

## Schema (`ProjetoSimulacao`)

Versão atual do schema: **`1.0.0`** (constante `SCHEMA_VERSION`). O carregamento
compara o componente **MAJOR** do semver: MAJOR igual é compatível (MINOR
diferente apenas emite aviso); MAJOR diferente/ausente/desconhecido é recusado.

```ts
interface ProjetoSimulacao {
  nome: string;
  versao: string;                       // versionamento de schema
  unidades: { volume: 'litros' | 'm3'; comprimento: 'cm' | 'm' };
  configuracaoSimulacao: { dt: number; g: number };  // passo (s) e gravidade
  pecas: Peca[];
  conexoes: Conexao[];
}

interface Peca {
  id: string;                           // uuid (identidade estável)
  tipo: 'reservatorio' | 'tubo' | 'bomba' | 'fonte' | 'consumo' | 'sensor' | 'juncao';
  rotulo?: string;                      // nome amigável exibido (editável); default = id
  x: number; y: number;                 // posição no canvas
  rotacao?: number;                     // tubo/bomba
  portas?: string[];                    // ex.: ['topo', 'base']
  props: PropsPorTipo;                  // ver abaixo
}

interface Conexao {
  id: string;
  origem: string;  origemPorta?: string;
  destino: string; destinoPorta?: string;
  vazaoAlocada?: number;                // obrigatório: fonte com múltiplos destinos
}

interface NivelControle {
  nivelMinimo?: number;
  nivelMaximo?: number;
  histerese?: boolean;                  // só sensor eletrônico
  delay?: number;                       // só sensor eletrônico (s)
  reversa?: boolean;                    // sensor: liga no máximo, desliga no mínimo
  aberta?: boolean;                     // boia de tubo: estado (mutável na execução)
}
```

### Props por tipo de peça

| Tipo | Campos |
| --- | --- |
| `reservatorio` | `formato` (`cilindro`\|`retangular`), `raio?`/`largura?`/`comprimento?`, `alturaMaxima`, `cotaBase`, `nivel?` |
| `tubo` | `diametro` (**mm**, interno — usado no cálculo de vazão), `bitola?` (DN pré-configurado do catálogo; grava o diâmetro interno tabelado), `checkValve?`, `registro?: {aberto}`, `boia?: NivelControle`, `ladrao?: {nivel}` (dreno de transbordo), `alturaEntrada?`/`alturaSaida?` (altura da conexão em cada ponta, relativa à base; default 0) |
| `bomba` | `vazaoNominal`, `alturaNominal?` (altura de recalque; deriva a curva — a altura reduz a vazão), `curva?: {k}` (curva explícita; legado), `sensores: string[]`, `modoControle?` (`auto`\|`ligado`\|`desligado`), `ligada?`, `revezamento?` (dupla alternada: metades "1"/"2" que se revezam a cada acionamento) |
| `fonte` | `vazaoFixa`, `boia?: NivelControle` |
| `consumo` | `vazaoDemanda`, `aberto?`, `perfil?` (`fixo`\|`senoidal`\|`intermitente`), `vazaoMin?`/`vazaoMax?`/`periodo?` (perfil variável) — ponto de saída/demanda; retira água e descarta |
| `sensor` | `NivelControle & { bombasAlvo: string[] }` — controla **uma ou mais** bombas; `reversa` inverte a lógica (liga no máximo, desliga no mínimo) |
| `juncao` | `diametro?` (mm; **estrangula** o fluxo pela junção). Nó sem volume que **divide/soma** a vazão por gravidade, conservando massa |

`cotaBase` é a elevação física da base do reservatório — permite **empilhamento**
e entra no cálculo de carga hidráulica.

## Física (motor de simulação)

Fórmulas implementadas em `src/engine/simulador.ts`:

- **Vazão por gravidade (tubo)** — Torricelli:
  `v = √(2·g·Δh)`, `A = π·(diametro/2)²`, `Q = A·v`.
- **Carga hidráulica** — `Δh = (cotaBase + nivel)origem − (cotaBase + nivel)destino`
  (sempre a carga total; **nunca** só o nível bruto).
- **Bomba** — `Q = vazaoNominal` (ideal) ou, com **altura nominal**,
  `Q = vazaoNominal·(1 − Δh_lift / alturaNominal)` — a curva é derivada e a altura
  de recalque reduz a vazão automaticamente (entrega a nominal a 0 m, zera na
  altura nominal). Um `curva.k` explícito (`Q = vazaoNominal − k·Δh_lift`) é
  mantido por compatibilidade. Sentido **forçado** pela conexão; `Q ≥ 0`.
  Com **múltiplas saídas**, a vazão nominal é dividida entre elas (por
  `vazaoAlocada` se informada, senão igualmente). A bomba pode empurrar direto
  para um **consumo**: entrega `min(vazão da bomba, demanda do consumo)` — se a
  demanda for maior que a vazão nominal, a bomba não acompanha e um **alerta de
  déficit** é emitido; se a demanda for zero, a bomba não liga por ali.
- **Fonte** — vazão fixa constante, externa ao grafo; múltiplos destinos usam
  `vazaoAlocada`.
- **Consumo** — ponto de saída/demanda: retira `vazaoDemanda` do reservatório de
  origem e descarta (externo ao grafo), **limitado pela capacidade do cano** mais
  estreito no caminho (Torricelli pelo diâmetro/Δh) e pelo volume disponível.
- **Tubo ladrão** — dreno de transbordo: só escoa o excedente acima de
  `ladrao.nivel` (a coluna acima do lábio é a carga; autolimitante).
- **Junção** — nó sem volume que **divide/soma** o fluxo por gravidade,
  conservando massa. Uma sub-rede de gravidade com junções é resolvida como rede
  de vazão (carga das junções por iteração até o fluxo líquido no nó zerar); cada
  trecho entre nós é limitado pelo cano mais estreito. Bifurcação enche os dois
  ramos; união soma as origens no destino.

### Unidades

A física roda em **SI** (metros, m³, s). Os valores das peças ficam nas unidades
escolhidas e são convertidos internamente: comprimentos pela unidade de
comprimento (m/cm), volume/vazão em litros ou m³, e **diâmetro de tubo sempre em
milímetros**. O multiplicador de velocidade (1x…120x) permite acompanhar cenários
realistas (vazões em L/s enchendo tanques de milhares de litros) em segundos.
- **Overflow** — nível > `alturaMaxima` → excedente se perde (transborda), sem
  gerar erro nem travar o tick.
- **Rodando a seco** — a bomba não desliga sozinha por nível; se a origem esvaziar
  com ela ligada, a vazão é 0 (sem fantasma) e um alerta é emitido. A proteção por
  nível baixo é feita por um **sensor reverso** monitorando a sucção.
- **Controle da bomba** — modo `auto` (segue o sensor), `ligado` ou `desligado`.
- **Alerta de dimensionamento** — cada tubo tem uma **vazão máxima recomendada**
  (área × 3 m/s, velocidade clássica de projeto). Quando a velocidade real
  (v = Q/área) passa desse limite, o cano é sinalizado (rosa) e registrado no log
  — só um aviso; não altera a física.
- **Bomba dupla em revezamento** — uma bomba marcada como `revezamento` alterna
  entre duas metades ("1"/"2") a cada acionamento (quem rodou por último
  descansa). É só rodízio de desgaste: hidraulicamente idêntica a uma bomba
  comum. Puramente visual + registro no log — não muda a física.
- **Check valve / registro / boia** — refluxo bloqueado; registro on/off manual;
  boia mecânica fecha ao encher o destino.
- **Sensor reverso** — inverte a lógica do sensor eletrônico: **liga no nível
  máximo, desliga no mínimo**. Serve para proteger a sucção (não rodar a seco) ou
  acionar uma bomba de hidrantes. Uma bomba respeita **todos** os seus sensores em
  conjunto (normal + reverso) e um sensor pode reger **várias** bombas.

### Ordem de avaliação no `tick()`

1. Sensores e boias avaliam com base no **estado do tick anterior**.
2. Arbitragem de bombas (**desligar > ligar**; entre "ligar" basta um — OR lógico).
3. Cálculo de vazão de cada aresta (tubo, bomba, fonte).
4. Atualização de volume/nível de cada reservatório.
5. Aplicação de overflow (clipping na `alturaMaxima`).

## Validação de grafo

Executada apenas na transição **edição → execução** (não incrementalmente).
Se falhar, permanece em edição e exibe os erros.

**Bloqueia:** nó órfão · aresta sem origem/destino · ciclo bomba→…→origem sem
dreno (moto-perpétuo) · fonte com `Σ vazaoAlocada > vazaoFixa`.
**Permite:** fonte com múltiplos destinos · múltiplos sensores por bomba · um
sensor regendo várias bombas.

## Modos de operação

- **`edicao`** — grafo mutável (add/remove peça, conexão, mover no canvas).
- **`execucao`** — grafo estruturalmente imutável; só valores mudam (nível, vazão,
  registro, bomba on/off, thresholds de sensor). Voltar à edição exige pause/reset.
- **Controle de velocidade** — 1x / 5x / 30x / 120x roda N ticks por frame **sem
  alterar o `dt`** da física (seção 7).

## Persistência

Export/import manual via `.json`: **Salvar** baixa `{nome}.json`; **Carregar**
valida a versão do schema e reconstrói o grafo. Um `.json` malformado ou
incompatível nunca quebra a aplicação — é recusado com mensagens de erro.

## Fora de escopo

CFD real (Navier-Stokes) · perda de carga por atrito (Darcy-Weisbach) ·
evaporação/temperatura · reservatórios de seção variável (cone, esfera) ·
prioridade manual entre sensores · backend/nuvem · app mobile/desktop nativo.

Ver [`CHANGELOG.md`](./CHANGELOG.md) para a evolução por sprint.
