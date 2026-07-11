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
| Persistência | export/import manual de `.json` + autosave local (sem backend) |

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
- **⚙ Opções** — menu com **idioma** (Português/Inglês), **unidades**
  (volume/comprimento), **tema** claro/escuro, a **física opcional** (perda de carga
  por atrito) e a **velocidade de referência** do alerta de dimensionamento (padrão
  3 m/s).
- **Idiomas (i18n)** — interface em **Português** (padrão) e **Inglês**, com
  detecção automática do navegador e troca manual em ⚙ Opções (a escolha é
  lembrada). As leis de física e os rótulos do projeto exemplo seguem em Português.
- **Desfazer/refazer** (`Ctrl+Z` / `Ctrl+Shift+Z` e botões ↶/↷) e **duplicar peça**
  (`Ctrl+D` / ⧉ no inspetor).
- **Autosave local** (localStorage) — preserva o trabalho entre recarregamentos;
  **♻ Restaurar exemplo** volta ao projeto de demonstração e limpa o autosave.
- **Ajudas de edição** — **snap à grade** ao arrastar, **tooltip** ao passar o
  cursor sobre uma peça e **minimapa** (aparece só em diagramas grandes).
- **Legenda** (formas/cores das peças) e **sparkline** de histórico do nível no
  inspetor do reservatório.
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
│   ├── unidades.ts     # conversões de unidade (m³/L, m/cm…)
│   ├── tubosCatalogo.ts # catálogo de bitolas comerciais (DN → diâmetro)
│   └── exemplo.ts      # projeto de demonstração
├── engine/         # Sprint 2 — motor de simulação (puro, sem UI)
│   ├── geometria.ts       # relação nível↔volume (seção constante)
│   ├── hidraulica.ts      # leis de vazão (Torricelli / Hazen-Williams / bomba)
│   ├── grafo.ts           # índice de grafo e travessias (camada estrutural)
│   ├── vazaoPecas.ts      # vazão por peça (tubo/bomba/fonte/consumo)
│   ├── arbitragem.ts      # sensores/boias e arbitragem de bombas
│   ├── simulador.ts       # tick(): orquestra o passo e atualiza o estado
│   ├── redeJuncoes.ts     # solver da rede de junções (divide/soma, conserva massa)
│   └── validacaoGrafo.ts  # validação de grafo (seção 5)
├── state/          # Sprint 4 — reducer central (modos edição/execução)
│   └── store.ts
├── i18n/           # traduções (react-i18next): pt.ts, en.ts + init
├── persistence/    # Sprint 5 — export/import .json + autosave
│   ├── arquivo.ts      # export/import manual .json
│   └── autosave.ts     # persistência automática em localStorage
└── ui/             # Sprint 3/4/5 — componentes React + konva
    ├── App.tsx, Toolbar.tsx, Palette.tsx, Canvas.tsx, PecaView.tsx, Inspector.tsx
    ├── Opcoes.tsx, Legenda.tsx, Sparkline.tsx  # menu de opções, legenda, sparkline
    ├── pecaGeom.ts # geometria das peças + snap à grade (GRADE)
    ├── inspector/  # formulários por tipo (forms.tsx) + campos compartilhados
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
  configuracaoSimulacao: {              // passo (s), gravidade e física opcional
    dt: number; g: number;
    atrito?: boolean;                   // liga a perda de carga (Hazen-Williams)
    velocidadeRef?: number;             // m/s do alerta de dimensionamento (padrão 3)
  };
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
| `tubo` | `diametro` (**mm**, interno — usado no cálculo de vazão), `bitola?` (DN pré-configurado do catálogo; grava o diâmetro interno tabelado), `checkValve?`, `registro?: {aberto}`, `boia?: NivelControle`, `ladrao?: {nivel}` (dreno de transbordo), `alturaEntrada?`/`alturaSaida?` (altura da conexão em cada ponta, relativa à base; default 0), `comprimento?` (m; usado só com atrito, default 1), `coefC?` (coeficiente C de Hazen-Williams; default 140) |
| `bomba` | `vazaoNominal`, `alturaNominal?` (altura de recalque; deriva a curva — a altura reduz a vazão), `curva?: {k}` (curva explícita; legado), `sensores: string[]`, `modoControle?` (`auto`\|`ligado`\|`desligado`), `ligada?`, `revezamento?` (dupla alternada: metades "1"/"2" que se revezam a cada acionamento) |
| `fonte` | `gerador: Gerador` (perfil de vazão de abastecimento no tempo), `boia?: NivelControle` |
| `consumo` | `gerador: Gerador` (perfil de demanda no tempo), `aberto?` — ponto de saída/demanda; retira água e descarta |
| `sensor` | `NivelControle & { bombasAlvo: string[], ativo?: boolean }` — controla **uma ou mais** bombas; `reversa` inverte a lógica (liga no máximo, desliga no mínimo); `ativo` (ausente = true) habilita/desabilita o sensor em operação |
| `juncao` | `diametro?`/`bitola?` (mm; **estrangula** o fluxo pela junção — reusa o catálogo de bitolas dos tubos). Nó sem volume que **divide/soma** a vazão por gravidade, conservando massa |
| `quadro` | `canais: {bomba, modo, sensores?, revezamento?, unidade?}[]`, `sensores?: string[]` (boias-membro), `logica?` (`E`\|`OU`) — quadro de comandos (MCC): por bomba, `modo` (`auto`\|`manual`\|`desligado`); no `auto`, quais `sensores` seguir (combinados pela `logica`) e o `revezamento`/`unidade` da bomba dupla. Liga por id (sem conexão física). Uma bomba/sensor regidos por um quadro perdem o controle direto |

`Gerador` = perfil de vazão no tempo (Fonte/Consumo): `perfil` + parâmetros do perfil. Perfis: `fixo` (`vazao`); **periódicos** `trapezoidal` (`min`/`max`/`periodo` + frações `subida`/`alto`/`descida`/`baixo` — presets: quadrada, retangular, triangular, dente de serra ↑/↓, trapézio) e `senoidal` (`min`/`max`/`periodo`); **transientes/eventos** `degrau` (`v0`/`v1`/`instante`/`rampa`), `pulso` (`base`/`amplitude`/`inicio`/`largura`), `exponencial` (`base`/`alvo`/`tau`/`sentido`), `diaria` (2 picos num dia real de 86.400 s: `base` + `pm*`/`pn*` com hora/valor/subida/patamar/descida), `escalonada` (`min`/`max`/`periodo`/`degraus`), `amortecida` (`base`/`amplitude`/`periodo`/`tau`) e `aleatoria` (`min`/`max`/`semente`/`granularidade` — PRNG semeado, reproduzível). A função pura `valorNoTempo(gerador, t)` é determinística e clampa em ≥ 0.

`cotaBase` é a elevação física da base do reservatório — permite **empilhamento**
e entra no cálculo de carga hidráulica.

## Física (motor de simulação)

As leis de vazão ficam em `src/engine/hidraulica.ts`; a rede que bifurca/une em
junções em `redeJuncoes.ts`; a vazão por peça em `vazaoPecas.ts`; e o `simulador.ts`
orquestra o passo. As raízes das leis com atrito (sem forma fechada) usam Newton
salvaguardado (converge em ~5–8 iterações — o caminho quente do modo atrito).

- **Vazão por gravidade (tubo)** — Torricelli:
  `v = √(2·g·Δh)`, `A = π·(diametro/2)²`, `Q = A·v`.
- **Perda de carga por atrito** (opcional, `configuracaoSimulacao.atrito`) —
  Hazen-Williams: resolve `Δh = v²/2g + hf(Q)` com
  `hf = 10,67·L·Q^1,85 / (C^1,85·D^4,87)` (usa o `comprimento` e o `coefC` do
  tubo). Desligado por padrão (Torricelli puro).
- **Carga hidráulica** — `Δh = (cotaBase + nivel)origem − (cotaBase + nivel)destino`
  (sempre a carga total; **nunca** só o nível bruto).
- **Bomba** — `Q = vazaoNominal` (ideal) ou, com **altura nominal**,
  `Q = vazaoNominal·(1 − Δh_lift / alturaNominal)` — a curva é derivada e a altura
  de recalque reduz a vazão automaticamente (entrega a nominal a 0 m, zera na
  altura nominal). Um `curva.k` explícito (`Q = vazaoNominal − k·Δh_lift`) é
  mantido por compatibilidade. Sentido **forçado** pela conexão; `Q ≥ 0`.
  Com o **atrito** ligado, a vazão é o **ponto de operação** (curva da bomba ∩
  curva do sistema): resolve `Q = vazaoNominal − k·(Δh_lift + hf_sucção(Q) +
  hf_recalque(Q))` — os canos de sucção e de recalque mais restritivos reduzem a
  entrega (vale também quando a bomba descarrega numa junção, acoplada à rede).
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
  ramos; união soma as origens no destino. **Consumo, fonte e bomba** ligados a
  uma junção entram na rede como **nós de vazão** — assim um consumo puxando de
  uma união pode forçar o **refluxo** do ramo mais alto para o mais baixo.

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
- **Quadro de comandos (MCC)** — a peça `quadro` centraliza o controle: por bomba,
  modo Automático / Manual / Desligado. A associação de **bombas** e de
  **boias/sensores** é escolhida no inspetor de cada peça (seletor "Quadro");
  cada uma pertence a no máximo um quadro e, enquanto regida, seu controle direto
  (o `modoControle` da bomba, o `bombasAlvo` do sensor) fica inativo. Liga por id,
  sem conexão física — o quadro **não usa setas**. Recursos do automático:
  - **Vários sensores por bomba** (multi-seleção), combinados pela **lógica** do
    quadro: **OU** (basta um pedir) ou **E** (todos precisam pedir).
  - Os **ajustes do sensor** (níveis, reverso, histerese, delay) são editados **no
    quadro** enquanto ele for membro.
  - **Revezamento** de bomba dupla delegado ao quadro: alterna a cada acionamento
    ou força só a **unidade 1** ou só a **unidade 2**.
  - **Sem sensor**, o automático vira acionamento por **demanda**: liga só quando
    há consumo (demanda > 0) à jusante na linha.
- **Alerta de dimensionamento** — cada tubo tem uma **vazão máxima recomendada**
  (área × velocidade de referência, configurável em ⚙ Opções; padrão 3 m/s, a
  velocidade clássica de projeto). Quando a velocidade real
  (v = Q/área) passa desse limite, o cano é sinalizado (rosa) e registrado no log
  — só um aviso; não altera a física.
- **Bomba dupla em revezamento** — uma bomba marcada como `revezamento` alterna
  entre duas metades ("1"/"2") a cada acionamento (quem rodou por último
  descansa). É só rodízio de desgaste: hidraulicamente idêntica a uma bomba
  comum. Puramente visual + registro no log — não muda a física.
- **Check valve / registro / boia** — refluxo bloqueado; registro on/off manual;
  boia mecânica fecha ao encher o destino.
- **Refluxo sinalizado** — um tubo com fluxo **contrário à sua seta** aparece em
  **violeta** (as "formigas" marcham no sentido real) e é registrado no log. Serve
  para deixar evidente um sentido inesperado (ex.: refluxo numa união).
- **Sensor reverso** — inverte a lógica do sensor eletrônico: **liga no nível
  máximo, desliga no mínimo**. Serve para proteger a sucção (não rodar a seco) ou
  acionar uma bomba de hidrantes. Uma bomba respeita **todos** os seus sensores em
  conjunto (normal + reverso) e um sensor pode reger **várias** bombas.

### Ordem de avaliação no `tick()`

1. Sensores e boias avaliam com base no **estado do tick anterior**.
2. Arbitragem de bombas (**desligar > ligar**; entre "ligar" basta um — OR lógico).
3. Cálculo de vazão de cada aresta (rede de junções, bomba, fonte, consumo, tubo).
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
- **`execucao`** — grafo estruturalmente imutável; a estrutura e o dimensionamento
  ficam travados. Voltar à edição exige pause/reset.
- **Comandos de operação em execução** — como num supervisório, alguns controles
  ficam ativos durante a simulação: **registro** (abrir/fechar), **modo da bomba**
  (auto/ligada/desligada), **modo de cada bomba no quadro**, **saída do consumo** e
  **habilitar/desabilitar sensor**. Cada comando **entra no log** (🎛️), **não** gera
  desfazer/refazer e **persiste** ao voltar para a edição (o RESET zera só os
  níveis/tempo, mantendo os comandos).
- **Controle de velocidade** — 1x / 5x / 30x / 120x roda N ticks por frame **sem
  alterar o `dt`** da física (seção 7).

## Persistência

Export/import manual via `.json`: **Salvar** baixa `{nome}.json`; **Carregar**
valida a versão do schema e reconstrói o grafo. Um `.json` malformado ou
incompatível nunca quebra a aplicação — é recusado com mensagens de erro. Além
disso, um **autosave** automático em `localStorage` preserva o trabalho entre
recarregamentos (restaurado ao reabrir; só ativo depois que o projeto deixa de
ser o exemplo intocado — **♻ Restaurar exemplo** volta ao demo e limpa o autosave).

## Fora de escopo

CFD real (Navier-Stokes) · perda de carga por atrito de **Darcy-Weisbach** (há um
modelo **opcional** de Hazen-Williams; ver a seção de Física) · evaporação/
temperatura · reservatórios de seção variável (cone, esfera) · prioridade manual
entre sensores · backend/nuvem · app mobile/desktop nativo.

Ver [`CHANGELOG.md`](./CHANGELOG.md) para a evolução por sprint.
