# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui. O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e o versionamento é [SemVer](https://semver.org/lang/pt-BR/). As primeiras versões (0.x–1.0) espelham as especificações técnicas; as seguintes acompanham a evolução incremental por funcionalidade.

## [1.46.0] — Ícone da Ajuda, velocidade no mobile e mais física na Ajuda

### Adicionado

- **Física na Ajuda**: novos itens sobre **junções** (carga do nó por Gauss-Seidel,
  conservação de massa), **bomba** (ponto de operação Q = Qₙ·(1 − Δh/Hₙ), acoplado
  ao atrito da rede), **transbordo + proteção a seco** e **tomada em altura**.

### Alterado

- **Botão de Ajuda** ganhou ícone (❓).
- **Velocidade no mobile**: os botões 1×/5×/30×/120× viram um **seletor** compacto
  (poupa espaço); no desktop seguem inline.

## [1.45.1] — TypeScript 6

### Alterado

- **TypeScript atualizado para 6.0.x** (`^6.0.3`). `typecheck`, `lint`, testes (237)
  e `build` seguem verdes. O **7.x** ainda não entra porque o `@typescript-eslint`
  8.x exige `typescript < 6.1.0` (o parser não suporta o port nativo) — quando o
  typescript-eslint liberar o 7, a subida deve ser direta.

## [1.45.0] — Página de Ajuda

### Adicionado

- **Ajuda** (botão na barra, só na edição e no desktop) — modal com **como usar**,
  **interface e conexões** (portas/ponto ciano, referência de sensor/quadro,
  navegação, log/legenda, mobile), **peças e regras**, **física simplificada**
  (fórmulas + constantes do código), **opções** e **dados técnicos/persistência**.
  i18n pt/en.

## [1.44.0] — Números na bomba + revezamento só no quadro

### Alterado

- **Bombas mostram o número da unidade no editor**: a bomba única exibe **"1"** e a
  dupla exibe **"1" / "2"** já no modo edição (antes a única não mostrava número).
- **Revezamento no canvas segue a fonte da verdade real**: quando a bomba é regida
  por um quadro, o desenho (círculo simples × dividido) usa o revezamento do
  **canal do quadro**, não o `props.revezamento` congelado da bomba.
- **Inspetor da bomba**: o switch **"Bomba dupla (revezamento)"** some quando a bomba
  é regida por um quadro — o controle fica **só no quadro** (fonte da verdade),
  evitando um toggle que não tinha efeito.

## [1.43.0] — Correção do sinal de fluxo + normalizar renumera conexões

### Corrigido

- **Sinal de vazão em tubo entre junção e terminal**: a telemetria dos "runs de terminais" invertia o sinal, então um tubo **entre uma junção e um consumo** (água indo para o consumo, sentido normal) aparecia como **refluxo** (seta violeta) sem ser. Agora o sinal segue o sentido da seta. A detecção de refluxo REAL (tubos e junções da rede) segue intacta — coberto por teste.

### Alterado

- **Normalizar IDs** (⚙ Opções › Projeto) agora também **renumera as conexões em sequência** (`c_1…c_N`), corrigindo a numeração "pulando". Continua desfazível.

## [1.42.0] — Projeto exemplo: registros de linha e drenos de limpeza

### Alterado

- **Projeto exemplo** re-desenhado pelo usuário, mantendo o layout em **6 colunas** (240·360·480·600·720·840): abastecimento agora passa por um **Registro Hidrômetro** (Concessionária → registro → boia → inferior) e a saída por um **Registro Consumo** (União → registro → consumo). Cada reservatório ganhou um **dreno de Limpeza** (registro fechado). IDs das conexões renumerados em sequência (`c_1…c_33`, só estética).

## [1.41.0] — Normalizar IDs pelos nomes (⚙ Opções)

### Adicionado

- **⚙ Opções › Projeto › "Normalizar IDs pelos nomes"**: ação opt-in que reescreve o `id` de cada peça como um **slug fiel ao rótulo** (minúsculo, sem acento/espaço) e atualiza **todas as referências** (conexões, canais/sensores dos quadros, `bombasAlvo`, `sensores`). É **desfazível** e só roda em edição. O `id` continua **desacoplado** do nome (renomear não mexe no id) — a normalização é sob demanda.
- **Validação de nomes repetidos**: enquanto houver rótulos idênticos, a ação fica **bloqueada** e o menu lista os duplicados a resolver (ids precisam ser únicos).

### Alterado

- **Projeto exemplo**: passa a nascer com os IDs já normalizados pelos nomes (ex.: `bomba` → `bomba_recalque`, `sensor_sup` → `boia_eletronica_c1`), dogfooding a nova ação.

## [1.40.0] — Formato do tempo configurável em ⚙ Opções

### Adicionado

- **⚙ Opções › Exibição › "Formato do tempo"**: escolhe como o tempo aparece na barra durante a simulação — **Segundos** (`t = …s`), **Horário (24 h)** (`HH:MM:SS`) ou **Ambos**. Preferência do dispositivo, **persistida** no localStorage (como tema/idioma). Padrão: **Ambos**.

## [1.39.0] — Relógio de 24 h na simulação

### Adicionado

- **Horário (24 h)** na barra durante a execução, ao lado do contador em segundos: `HH:MM:SS` derivado do tempo de simulação (`tempo % 86400`), começando em **00:00:00** e dando a volta a cada 24 h — casa com o dia real do perfil "diária". Visível no desktop e no mobile.

## [1.38.1] — Quadro: remove o seletor de "lógica padrão"

### Alterado

- **Inspetor do quadro**: removido o bloco **"Lógica padrão entre sensores"** — redundante agora que cada gap da sequência tem seu próprio operador **E/OU**. A `logica` global permanece só como padrão interno de novos gaps e fallback do canal sem seleção.

## [1.38.0] — Mobile: barra enxuta e aviso que se recolhe

Terceira melhoria do lote do quadro/mobile (issue #49, PR 3).

### Alterado

- **⚙ Opções no mobile** migra para o menu **⋯** (junto de Legenda/Novo/Imprimir/Carregar); no desktop segue inline.
- **Barra do mobile mais limpa**: o status **edição/execução**, os botões **desfazer/refazer** e **voltar à edição** ficam ocultos no celular (superfície de simular/inspecionar). No desktop, tudo permanece.
- **Aviso "edição só no desktop"** some sozinho após **~8 s** e **ao iniciar a simulação** (Executar/Play) — não fica mais atrapalhando.

## [1.37.0] — Quadro: lógica ordenada por sensor (E/OU por gap)

Segunda melhoria do quadro de comandos (issue #49, PR 2).

### Adicionado

- **Sequência ordenada de sensores por bomba**: no automático, os sensores de um canal viram uma **lista ordenada**, avaliada **de cima para baixo** (=esquerda→direita). Entre cada par consecutivo há um **operador E/OU independente** (`CanalQuadro.operadores`), permitindo qualquer combinação sequencial — ex.: «S1 OU S2 E S3» = ((S1 OU S2) E S3).
- **Reordenar**: **arrastar-e-soltar** (desktop) e botões **▲▼** (reserva acessível/mobile); adicionar/retirar sensores da sequência pelo inspetor.

### Alterado

- **Avaliação é expressão PURA**: não há mais precedência automática de `desligar`. Uma boia **reversa** de proteção só corta a bomba se estiver ligada por um **E** (ex.: «nível-baixo E origem-com-água»). Sensores em **banda morta (manter)** são **neutros** — não interferem na expressão.
- A **lógica global** do quadro passa a ser o **operador padrão** de novos gaps.
- **Projeto exemplo**: o Quadro Recalque agora usa explicitamente `sensor_sup **E** sensor_inf(reverso)` — a proteção da origem segue funcionando sob a nova semântica.

## [1.36.0] — Inspetor do quadro: cores, accordion e rótulos do modo

Primeira das melhorias do inspetor do quadro de comandos (issue #49).

### Adicionado

- **Cor por membro**: cada boia/sensor e cada bomba do quadro ganha um tom distinto (borda esquerda + etiqueta colorida). A mesma cor reaparece ao lado da caixa de seleção do sensor no canal da bomba, ligando visualmente quem segue quem.
- **Blocos recolhíveis (accordion)**: cada membro vira um `<details>` recolhido por padrão, com um resumo (cor + nome + estado atual) — o inspetor fica bem mais curto.

### Alterado

- **Rótulos do modo da bomba**: `Automático (segue a lógica acima)`, `Manual (ligada)` e `Manual (desligada)`.

## [1.35.2] — Exemplo: níveis iniciais em 2,5

### Alterado

- **Projeto exemplo**: os três reservatórios abrem com **nível inicial 2,5 m**.

## [1.35.1] — Ajuste do projeto exemplo

### Alterado

- **Projeto exemplo** re-tunado (cenário do usuário): **Concessionária** agora é uma fonte **senoidal** (2–10 L/s); **Consumo** com demanda diária re-ajustada; níveis iniciais de operação (inferior 7,2 · C2 5,5 · C1 5,19); limiares das boias C1/C2 e da boia manual revistos; `Recalque → C1` com 23 m; Bomba Incêndio inicia desligada. O exemplo abre com a Bomba Recalque **em operação**.

## [1.35.0] — Perfis de vazão (vitrine + aleatória)

Conclusão do plano de perfis de vazão (issue #42).

### Adicionado

- **Aleatória (semente fixa)**: parece ruído, mas é **reproduzível** — um valor por `granularidade` de tempo, via PRNG **semeado** (determinístico, sem `Math.random`). Grupo "Outros" no seletor.

### Alterado

- **Projeto exemplo (vitrine)**: o Consumo principal passou a usar o perfil **demanda diária (2 picos)** — madrugada baixa, pico de manhã e de noite. Use a velocidade **x120** para ver o dia inteiro. Demonstra os perfis novos no cenário padrão.

### Técnico

- `valorNoTempo` ganhou `aleatoria` (hash inteiro determinístico); `janelaPreview`/ `vazaoRef`/defaults atualizados; parâmetros `semente`/`granularidade`. +1 teste.

## [1.34.0] — Perfis de vazão (escalonada + amortecida)

Continuação do plano de perfis de vazão (issue #42).

### Adicionado

- **Retangular escalonada** (periódico): escada crescente de N degraus (mín→máx) por período; depois reseta.
- **Senoidal amortecida** (transiente): senoidal que decai ao longo do tempo, com constante de tempo τ (clampada em ≥ 0).

### Técnico

- `valorNoTempo` ganhou `escalonada`/`amortecida`; `janelaPreview`/`vazaoRef`/ defaults atualizados; novo parâmetro `degraus`. +2 testes de unidade.

## [1.33.0] — Perfis de vazão (transientes + demanda diária)

Continuação do plano de perfis de vazão (issue #42).

### Adicionado

- **Perfis transientes/eventos** (Fonte e Consumo), com preview e ajuda:
  - **Degrau** (com rampa opcional): muda de nível num instante e permanece.
  - **Pulso**: um único disparo por uma largura de tempo.
  - **Exponencial**: aproxima o alvo (partida suave) ou decai à base, com τ.
  - **Demanda diária (2 picos)**: curva de um dia **real (24 h = 86.400 s)** com pico de manhã e de noite (horários, valores e durações de subida/patamar/descida em horas configuráveis). Use a velocidade x120 para ver o dia todo.
- O **preview** ajusta a janela de tempo ao perfil (evento, τ, 1 dia, etc.).

### Técnico

- `valorNoTempo` ganhou os casos `degrau`/`pulso`/`exponencial`/`diaria`; novo `janelaPreview(gerador)`; defaults ancorados em `V`. +4 testes de unidade.

## [1.32.0] — Perfis de vazão no tempo (gerador + preview)

Início do plano de **perfis de vazão** (issue #42). Fonte e Consumo passam a compartilhar um **gerador de vazão** com preview ao vivo.

### Adicionado

- **Gerador de vazão compartilhado** (Fonte e Consumo): seletor de **perfil** agrupado (Padrão / Periódicos), **preview ao vivo** da onda (SVG), campos contextuais (só os do perfil) e uma linha de ajuda por perfil.
- **Perfis**: `fixo` (constante), `trapezoidal` (com presets **Quadrada, Retangular, Triangular, Dente de serra ↑/↓, Trapézio** + frações avançadas) e `senoidal`. Todos determinísticos e clampados em ≥ 0.
- **Fonte** ganhou perfis no tempo (antes só vazão fixa).

### Alterado

- **Modelo**: `PropsFonte`/`PropsConsumo` agora guardam um `gerador { perfil, params }` no lugar de `vazaoFixa`/`vazaoDemanda`/`perfil`/`vazaoMin`… Sem camada de compatibilidade (decisão do plano). O exemplo foi ajustado ao novo formato (comportamento idêntico); a **vitrine** dos perfis serão aplicados ao final.

### Técnico

- Novo `domain/geradorVazao.ts` com `valorNoTempo(gerador, t)` puro, usado pelo motor (`vazaoPecas`/`redeJuncoes`) e pela UI (preview). +8 testes de unidade.

## [1.31.0] — Polimentos: nome automático, indicador de unidade e avisos

### Adicionado

- **Nome automático ao criar** uma peça: nasce como "«Tipo» «n»" (ex.: "Sensor 3", "Quadro de comandos 2") em vez de mostrar o id cru.
- **Indicador da unidade ativa** na bomba dupla (revezamento): o número da metade em operação fica em branco vivo e maior; a inativa apaga — deixa claro qual unidade está rodando, além da cor.
- **Aviso de "boia solta"** no inspetor do sensor: quando a boia é membro de um quadro mas nenhuma bomba (canal automático) a segue — e o vínculo direto está inativo —, um alerta avisa que ela não tem efeito.
- **Validação de "quadro sem efeito"**: a execução é bloqueada se um quadro não comanda nenhuma bomba (canais vazios ou apontando para bombas inexistentes).

### Alterado

- **Projeto exemplo**: a Boia Eletrônica (C2) passou a ser NORMAL (reverso desligado), igual à do C1.

## [1.30.0] — Tema persistente e projeto exemplo com quadros

### Adicionado

- **Tema (claro/escuro) persistente**: a preferência agora é salva no `localStorage` (chave `hydroflow:tema`, como o idioma) e **sobrevive à recarga**. Continua sendo preferência do **dispositivo** — não vai no arquivo `.json` do projeto (unidades, atrito e velocidade de referência é que viajam no arquivo).

### Alterado

- **Projeto exemplo** atualizado para o cenário novo: nomes revistos (Inferior / C2 Meio / C1 Superior, Concessionária, Bomba Recalque, Consumo C1/C2, Boias Eletrônicas C1/C2/inferior…) e **dois quadros de comandos** — "Quadro Recalque" (comanda a Bomba Recalque em automático, seguindo as boias do superior e do inferior, com revezamento) e "Quadro Incêndio" (comanda a Bomba Incêndio). Layout mantido em **6 colunas** alinhadas no eixo x (passo 120).

## [1.29.1] — Correção: boia-membro do quadro ignorada

### Corrigido

- **Boia/sensor membro do quadro era ignorada quando o canal não marcava sensor nenhum**: nesse caso a bomba caía no acionamento por **demanda** e o `desligar` de uma boia-membro (em especial uma **reversa de proteção**) era silenciosamente descartado — a bomba não desligava. Agora um canal em automático **sem seleção segue TODOS os sensores-membro** do quadro (o `desligar` volta a ter precedência); o acionamento por demanda só vale quando o quadro **não tem sensor-membro algum**. O inspetor do quadro sinaliza "nenhum marcado → segue todos".

## [1.29.0] — Comandos de operação durante a simulação

### Adicionado

- **Operar a simulação em tempo real**: em execução, os **comandos de operação** ficam ativos enquanto o resto (estrutura e dimensionamento) permanece travado:
  - **Registro** de tubo — abrir/fechar;
  - **Bomba** — modo Automático/Ligada/Desligada;
  - **Quadro** — modo de cada bomba (Automático/Manual/Desligado);
  - **Consumo** — saída aberta/fechada;
  - **Sensor** — habilitar/desabilitar (um sensor desabilitado não emite decisão).
- **Comandos no log**: cada comando feito **durante a simulação** entra no log de eventos (marcado com 🎛️). Comandos **não** geram histórico de desfazer/refazer.
- **Persistência dos comandos**: os comandos viram o novo estado-base — persistem ao voltar para a edição e sobrevivem ao **RESET** (que zera só os níveis/tempo).

### Técnico

- `PropsSensor` ganhou `ativo?` (habilitado; ausente = true). O motor ignora um sensor inativo.
- O inspetor deixou de desabilitar o `fieldset` inteiro em execução — cada campo decide (`disabled={emExecucao}`); os comandos ficam ativos.
- Reducer: `ATUALIZAR_PROPS` em execução também atualiza o `snapshotEdicao` e emite um `EventoLog` de `tipo: 'comando'` (via `eventoDeComando`).

## [1.28.0] — Quadro de comandos: lógica, revezamento e demanda

### Adicionado

- **Lógica E/OU entre sensores** (por quadro): no automático, cada bomba segue **vários** sensores-membro (multi-seleção) combinados pela lógica escolhida — **OU** (basta um pedir) ou **E** (todos precisam pedir).
- **Revezamento pelo quadro**: uma bomba dupla regida delega o **revezamento** ao quadro, que pode **alternar** a cada acionamento ou **forçar** só a unidade 1 ou só a unidade 2.
- **Acionamento por demanda**: um canal em **automático sem sensor** liga a bomba apenas quando há **consumo (demanda > 0) à jusante** na linha.

### Alterado

- **Ajustes do sensor migram para o quadro**: quando um sensor é membro de um quadro, todos os seus parâmetros (níveis, reverso, histerese, delay) passam a ser editados **no inspetor do quadro** — o inspetor do sensor mostra só o vínculo. Fonte única da verdade continua nas props do sensor.
- **Quadro liga só por associação**: o quadro **não usa setas** — não tem alça de conexão e soltar uma seta sobre ele não cria aresta.

### Técnico

- `CanalQuadro` ganhou `sensores?: string[]` (multi, substitui o `sensor?` único, que segue lido dos saves antigos), `revezamento?` e `unidade?`. `PropsQuadro` ganhou `logica?: 'E' | 'OU'`.
- Motor: `combinarSensores` (E/OU) e demanda à jusante (`demandaJusante`) para o automático sem sensor; o revezamento passa a respeitar o canal do quadro.

## [1.27.1] — Quadro: seleção pelo lado da boia/sensor

### Alterado

- **Boia/sensor também "seleciona o quadro"** (simétrico à bomba): no inspetor do sensor, o seletor **"Quadro de comandos"** define a qual quadro ele pertence. Ao entrar num quadro, o sensor deixa de acionar bombas pelo `bombasAlvo` direto (esse vínculo fica inativo enquanto for membro).
- **Quadro**: a lista de boias disponíveis no automático de cada bomba passa a ser filtrada pelos **sensores-membro** do quadro (escolhidos no inspetor de cada sensor). Ao remover um sensor do quadro, os canais que o referenciavam são limpos automaticamente.

### Técnico

- `PropsQuadro` ganhou `sensores?: string[]` (ids das boias-membro). O motor ignora o roteamento direto de um sensor que seja membro de um quadro.

## [1.27.0] — Quadro de comandos (MCC)

### Adicionado

- **Quadro de comandos** (nova peça): centraliza o controle das bombas. Por bomba, define-se o **modo** — **Automático** (seguindo uma **boia/sensor** escolhida), **Manual** (ligada) ou **Desligado**.
  - **Associação pelo lado da bomba**: no inspetor da bomba, um seletor **"Quadro de comandos"** escolhe a qual quadro ela obedece (ou "nenhum"). A bomba pertence a no máximo um quadro. No inspetor do quadro ajusta-se o modo e a boia de cada bomba que lhe pertence.
  - **Precedência**: uma bomba/sensor regidos por um quadro **perdem as opções diretas** (o `modoControle` da bomba e o `bombasAlvo` do sensor ficam inativos). Sem quadro, o controle direto de sempre continua.
  - Liga por `props` (por id), sem conexão física. Motor puro: a arbitragem consulta os quadros no início do tick.

## [1.26.2] — Comprimentos de tubo no projeto exemplo

### Alterado

- **Projeto exemplo**: comprimentos reais nos tubos da bomba de saída — sucção **4 m**, recalque → superior **25 m**, recalque → meio **16 m**. Com o atrito ligado (padrão do exemplo), a perda de carga passa a reduzir visivelmente a vazão da bomba (ponto de operação), demonstrando melhor o efeito.

## [1.26.1] — i18n do log de eventos e da validação de grafo

### Adicionado

- **Log de eventos** e **mensagens da validação de grafo** agora são traduzidos (Português/Inglês). Os **nomes das peças** (rótulos do projeto) e os **ids/caminhos** permanecem como estão — só o texto da mensagem muda de idioma. O **tipo** da peça (ex.: Bomba/Pump) é traduzido.
  - O motor e o reducer continuam **puros**: emitem `chave` i18n + `params` (nome/valores) e a **UI traduz na renderização** (assim re-traduz ao trocar de idioma). `ErroValidacao` mantém a `mensagem` em Português como fallback e para os testes do motor (que rodam sem i18n).

### Notas

- As mensagens de validação do **schema no import** (`.json` malformado) seguem em Português por ora — caminho raro; a UI cai no fallback `mensagem`.

## [1.26.0] — Internacionalização (i18n): Português e Inglês

### Adicionado

- **i18n com react-i18next**: toda a interface passa a ser traduzível. Idiomas **Português** (padrão/origem) e **Inglês**.
  - **Detecção automática** do idioma do navegador na primeira visita e **troca manual** em **⚙ Opções → Idioma**; a escolha é **persistida** em localStorage.
  - Dicionários em `src/i18n/pt.ts` e `en.ts` (mesmas chaves, garantido por teste de paridade); `fmtNumero` formata números na convenção do idioma.
  - Migrados: toolbar, paleta, ⚙ Opções, inspetor e formulários, legenda, dicas e tooltip do canvas, avisos, rodapé e sparkline.

### Notas

- As **mensagens do motor** (log de eventos e validação de grafo) e os **rótulos do projeto exemplo** seguem em Português por ora — o motor permanece puro (sem dependência de i18n) e os rótulos do exemplo são dados do projeto, não textos da interface. Podem ser internacionalizados num passo futuro.

## [1.25.0] — Polimentos de UI e do projeto exemplo

### Adicionado

- **Interruptores (on/off)** no lugar de checkboxes para as opções booleanas: tema claro e perda de carga (⚙ Opções), e no tubo (registro, check valve, boia, ladrão) — além de revezamento da bomba, saída do consumo e reverso/histerese do sensor. Componente reutilizável `Switch`.
- **Capacidade (litragem)** no inspetor do reservatório: mostra o volume máximo calculado da geometria (raio/lados × altura) e o volume atual, na unidade do usuário.
- **Centralização automática** do diagrama ao carregar/trocar de projeto (o exemplo abre centralizado, não só quando não cabe).

### Alterado

- **Cores das peças**: bomba (violeta) e junção (teal) ganham cores próprias para se distinguir à primeira vista, além da forma.
- **Boia aberta agora é verde** (antes amarela) — alinha com "aberto = verde" do registro; o ladrão em espera segue âmbar.
- **Tamanho uniforme** dos nós/componentes (bomba, fonte, consumo, sensor, junção): mesma pegada; a forma e a cor distinguem.
- **Reservatório cilíndrico × retangular** com silhuetas distintas (cilindro com cantos arredondados e boca elíptica; caixa angulosa).
- **Salvar** e **Restaurar exemplo** só aparecem quando o projeto difere do exemplo intocado (não há o que salvar/restaurar no exemplo padrão).
- **Projeto exemplo**: perda de carga por atrito **ligada** por padrão (projetos novos seguem desligados); consumo com vazão máx. 10 e período 90 s; bomba de saída com altura nominal de recalque 25 m; ids internos das peças renomeados para nomes semânticos (`divisor`, `uniao`, `bomba_incendio`, `hidrantes`, `cavalete_incendio`, `sensor_meio`, `interligacao_limpeza`, `cavalete_recalque`).

## [1.24.1] — Desempenho do atrito e divisão do motor

### Desempenho

- **Modo atrito ~6× mais rápido.** As leis com perda de carga (sem forma fechada) eram resolvidas por bisseção de 50 iterações, aninhada no Gauss-Seidel da rede e no ponto de operação da bomba — cada `tick` do exemplo custava ~10,8 ms (contra ~0,34 ms sem atrito). Trocadas por **Newton salvaguardado** (Newton quando o passo cai no intervalo; bisseção como rede de segurança), que converge em ~5–8 iterações: o `tick` com atrito cai para ~1,7 ms (razão atrito/sem-atrito de ~32× para ~5×). O resultado é idêntico ao da bisseção (erro relativo ~1e-12). Assim a linha do tempo deixa de "andar devagar" ao ligar o atrito.

### Interno

- **`simulador.ts` dividido** (903 → 385 linhas) numa arquitetura em camadas, sem ciclos de import:
  - `engine/grafo.ts` — índice de grafo e travessias (`GrafoIndex`, `cargaM`, `reservatorioVazio`, `FluxoResolvido`); camada estrutural, sem física.
  - `engine/vazaoPecas.ts` — vazão por peça (tubo/bomba/fonte/consumo + helpers).
  - `engine/simulador.ts` — passa a só orquestrar o `tick` e aplicar volumes.
- Novos testes de `hidraulica.ts` (resíduo das raízes ~0, propriedades físicas).
- **README** revisado: interface (⚙ Opções, undo/redo, duplicar, autosave, snap, minimapa, tooltip, legenda, sparkline), árvore de arquivos, schema (`configuracaoSimulacao.atrito`/`velocidadeRef`), props de tubo (`comprimento`/`coefC`) e consumo (`cicloLigado`), e a seção de Física (ponto de operação, rede).

## [1.24.0] — Ponto de operação da bomba (curva ∩ sistema)

### Adicionado

- **Ponto de operação da bomba** (com o **atrito** ligado): a vazão da bomba deixa de depender só da altura estática e passa a ser o encontro da **curva da bomba** com a **curva do sistema** (altura estática + perda de carga). Assim, um cano de **recalque** (saída) **ou de sucção** (entrada) mais restritivo — mais longo, mais estreito — agora **reduz a vazão** que a bomba entrega, como na realidade. Antes, o atrito dos canos da bomba era ignorado no cálculo da entrega.
  - Vale tanto para a bomba que descarrega **direto num reservatório** quanto para a que descarrega numa **junção** (resolvida acoplada à rede: a vazão depende da carga do nó, que já embute o atrito a jusante, mais o atrito da sucção).
  - Com o atrito **desligado**, nada muda (só a altura estática conta).
  - Resolvido por bisseção em `vazaoBombaOperacao` (`src/engine/hidraulica.ts`).

## [1.23.1] — Correção: vazão na sucção da bomba

### Corrigido

- **Cano de sucção zerado com a bomba ligada** (projeto exemplo). Quando a bomba descarrega numa **junção** (o Divisor), ela é resolvida como terminal da rede; os canos de **sucção** ficam fora da rede e não recebiam telemetria. Agora o solver anota neles a vazão entregue pela bomba (a sucção deixa de aparecer zerada). Só afeta a exibição/animação — a física de volume já estava correta.

## [1.23.0] — Produtividade de edição e opções

### Adicionado

- **Menu ⚙ Opções** consolidando **unidades** (volume/comprimento), **tema** claro/escuro e a **física opcional** (atrito). Limpa a toolbar.
- **Velocidade de referência configurável** (⚙ Opções, padrão **3 m/s**): define o alerta de tubo subdimensionado e a "vazão máx. recomendada". Todos os consumidores usam a opção.
- **Autosave local** (localStorage): o trabalho é preservado entre recarregamentos, mas **só** quando o projeto deixa de ser o exemplo intocado — quem só abre a página e não mexe recarrega no exemplo. **♻ Restaurar exemplo** (menu ⋯) volta ao exemplo e limpa o autosave.
- **Desfazer/refazer** (Ctrl+Z / Ctrl+Shift+Z e botões ↶/↷ na edição).
- **Duplicar peça** (Ctrl+D / ⧉ no inspetor): cópia deslocada, solta para religar.

### Interno

- **Inspector dividido**: formulários por tipo em `src/ui/inspector/forms.tsx` e blocos compartilhados em `inspector/campos.tsx` (Inspector.tsx ~670 → ~126 linhas). Novos testes de UI (Sparkline, legenda, Opções/atrito, duplicar, undo).

## [1.22.0] — Correções e opções de física

### Corrigido

- **Tomada em altura na rede de junções**: um reservatório só fornece água **acima da tomada** por onde o trecho o conecta (antes podia "fornecer" por um bocal alto mesmo com o nível abaixo dele). Generaliza o clamp de "reservatório vazio não fornece" — fecha a última ponta solta de correção física da rede.

### Adicionado

- **Perda de carga por atrito (Hazen-Williams)** como **opção ligável** (`configuracaoSimulacao.atrito`, padrão **desligado** → Torricelli puro, como antes). Cada tubo ganha **comprimento** e **coefC** (coeficiente C), com padrões (1 m, C=140) quando ausentes. A lei de vazão fica num módulo próprio (`src/engine/hidraulica.ts`) e é aplicada em tubos, cadeias (comprimento somado), consumo e na rede de junções. O atrito só **reduz** a vazão e a massa segue conservada.

## [1.21.0] — Melhorias de usabilidade no canvas e inspetor

### Adicionado

- **Snap à grade**: ao arrastar uma peça, o centro encaixa na grade de 20px, facilitando o alinhamento em colunas/linhas.
- **Legenda**: cartão recolhível com as formas das peças, os indicadores de válvula do tubo e as cores de fluxo/estado. O botão fica nas ações da toolbar — inline no desktop, dentro do menu **⋯** no mobile.
- **Tooltip** ao passar o mouse numa peça: dados por tipo (diâmetro/bitola, cota, nível, carga, vazão nominal…) e, em execução, os valores correntes (vazão, com aviso de refluxo).
- **Minimapa** para projetos grandes (maiores que o exemplo): visão geral com um retângulo de viewport que segue zoom/pan; clicar recentraliza a vista.
- **Sparkline** no inspetor: série temporal de nível (reservatório) ou vazão (condutor) acumulada durante a execução, com valor atual e faixa mín–máx.

### Interno

- **`simulador.ts` dividido**: o solver de rede de junções foi extraído para `src/engine/redeJuncoes.ts` (1138 → 842 linhas), sem mudar a API nem o comportamento.

## [1.20.0] — Formas distintas para bomba, sensor e junção

### Alterado

- **Bomba, sensor e junção deixam de ser todos círculos** (eram ambíguos, só a cor mudava). Agora: **bomba = círculo** (símbolo consagrado de bomba), **sensor = losango** (instrumento/medição) e **junção = hexágono** (evoca uma luva/porca de tubo — peça de conexão). As cores de estado (verde/vermelho/amarelo) seguem iguais. A pegada da junção é compacta para as setas encostarem na peça.

## [1.19.0] — Conservação de massa na rede de junções (fim do refluxo fantasma)

### Corrigido

- **A rede de junções não cria mais água ao aplicar o volume.** As trocas de um reservatório eram lançadas como dois fluxos **desacoplados** — dreno (reservatório → ambiente) e enchimento (ambiente → destino). Quando o dreno de um reservatório **quase vazio** era limitado pelo volume disponível, o enchimento do destino **não** era limitado junto — então o destino ganhava água do nada (o "está indo mais para o meio do que saiu do superior" da União no fim do esvaziamento). Agora cada **fonte real** (reservatório que perde, fonte, bomba pela sucção) é casada diretamente com cada **sorvedouro real** (reservatório que ganha, consumo) na proporção de cada um: o limite de volume propaga aos destinos e a massa **conserva** (verificado no exemplo: o pior desbalanço caiu de ~6,6 L para o nível do resíduo numérico do solver).

### Alterado

- **Projeto de exemplo**: registro de **"Saída meio" fechado**; **"Cavalete Bomba Recalque"** com a inicial maiúscula; junção **"Divisor" em DN60** e **"União" em DN160** (estrangulamento pela bitola).

## [1.18.0] — Reservatório vazio não gera fluxo fantasma; bitola na junção

### Corrigido

- **Reservatório vazio na rede de junções não FORNECE mais água.** O solver tratava o reservatório como carga fixa `cotaBase + nível`; com o tanque vazio (nível 0) a carga ainda era alta pela elevação, então ele **empurrava água que não existe** — ex.: o `superior` já esvaziado continuava refluindo pela União para o `meio`, com a seta de refluxo acesa. Agora um reservatório vazio só pode **receber** (a aresta que o teria como fonte fica em 0), como já valia para os tubos lineares. O refluxo legítimo (reservatório com água e mais alto empurrando o mais baixo pela União) continua igual.

### Adicionado

- **Bitola na junção**: ao estrangular uma junção, a medida agora reusa o mesmo **catálogo de bitolas (DN)** dos tubos — seleciona o DN e grava o diâmetro interno tabelado, com opção **Personalizado** para digitar o mm na mão.

### Alterado

- **Projeto de exemplo atualizado** com as junções **Divisor** (na saída da bomba) e **União** (antes do consumo), mantendo o alinhamento das peças nas 6 colunas (passo uniforme de 120 no eixo x). A saída do meio passa a ficar aberta.

## [1.17.0] — Terminais na rede de junções e refluxo sinalizado

### Adicionado

- **Consumo, fonte e bomba entram na rede de junções** como **nós de vazão**. Antes cada um resolvia o próprio caminho isolado: um consumo puxando de uma **união** escolhia só um dos ramos e o outro ficava intocado — sem o refluxo esperado. Agora o terminal injeta/retira vazão no nó em que se liga e a rede é resolvida em conjunto (conservando massa). Assim, se um consumo puxa de uma união e o ramo mais alto entrega **mais** que a demanda, o excedente **reflui** para o ramo mais baixo, enchendo-o — o comportamento físico correto.
- **Refluxo sinalizado**: um tubo com fluxo **contrário à sua seta** aparece na cor **violeta** (as "formigas" já marchavam no sentido real) e gera uma **entrada no log** (`refluxo: fluxo contrário à seta`). O refluxo é inesperado na maioria dos projetos, então fica evidente na tela e no histórico.

## [1.16.0] — Diâmetro na junção e setas de sensor

### Adicionado

- **Junção com diâmetro** (opcional): a junção pode **estrangular** o fluxo que passa por ela, como um cano estreito no nó. Cada trecho ligado à junção é limitado também pela área desse diâmetro (o gargalo passa a considerar o nó). Configurável no inspetor.

### Alterado

- **Conexões de sensor sem ponta de seta**: o sensor só monitora (não conduz), então a linha até o reservatório sai como **linha simples**, sem seta — o sentido não faz sentido ali. As conexões de fluxo seguem com a ponta visível.

## [1.15.0] — Junção divide e soma a vazão (rede de gravidade)

### Adicionado

- **Junções agora bifurcam e unem de verdade**, conservando massa no nó. Antes a junção era só passagem: numa bifurcação só um ramo recebia água (o outro ficava seco) e numa união só uma origem esvaziava. Agora uma sub-rede de gravidade com junções é resolvida como uma pequena **rede de vazão**: reservatórios têm carga fixa (a superfície), junções têm carga **incógnita** resolvida por iteração (Gauss-Seidel + bisseção) até o fluxo líquido no nó zerar. Cada trecho de tubos em série entre dois nós vira uma aresta limitada pelo **gargalo** (menor diâmetro). Resultado: numa **bifurcação** os dois ramos enchem (proporcional à área de cada um) e numa **união** as duas origens esvaziam e somam no destino.
- Cadeias **sem** junção e o fluxo **dirigido** por bomba/fonte seguem no caminho rápido de sempre; o solver entra só quando há junção.
- Limitações (v1): não modela check valve/altura de conexão **dentro** de um trecho entre junções (uma boia fechada, sim, bloqueia o trecho). Para esses casos, use um **reservatório** no ponto de divisão.

## [1.14.0] — Setas de conexão com sentido visível

### Adicionado

- **Ponta da seta visível**: as conexões passam a parar na **borda** das peças, deixando a cabeça da seta à vista — dá para ver de onde a linha **parte** (saída/origem) e onde **chega** (entrada/destino). Antes a seta ia de centro a centro e a ponta ficava escondida sob a peça de destino.
- **Formigas no sentido real do fluxo**: a animação de fluxo (traço marchando) segue o **sinal da vazão** — quando há **refluxo**, a marcha inverte, mostrando a água voltando (ex.: um tubo sem válvula de retenção com o destino mais alto).

## [1.13.2] — Correção: tubos em série drenavam em dobro

### Corrigido

- **Tubos em série por gravidade eram tratados como paralelos**: cada tubo de uma cadeia resolvia os mesmos reservatórios de origem/destino e empurrava o próprio fluxo, então a origem drenava **N×** (N = nº de tubos na cadeia). Agora uma cadeia de tubos entre dois reservatórios carrega **um único fluxo, limitado pelo cano mais estreito** (o gargalo), independente da ordem; todos os tubos da cadeia mostram essa vazão. Descarga ao ambiente, sucção de bomba, ladrão e registro fechado seguem inalterados (um registro fechado no meio quebra a cadeia). O fluxo **dirigido** por bomba/fonte já resolvia a série corretamente.

### Verificado (sem mudança)

- Um tubo entre reservatórios drena a origem e enche o destino corretamente (volume conservado).
- A **gravidade atua como barreira ao recalque**: com altura nominal/curva, a altura reduz a vazão da bomba e a zera acima da altura de shutoff; um tubo passivo nunca empurra água morro acima.

## [1.13.1] — Menu recolhido no mobile

### Alterado

- No **mobile**, as ações secundárias (Novo, Claro/Escuro, Imprimir, Salvar, Carregar) recolhem sob um botão **"⋯"**, ocupando bem menos a barra. No desktop seguem inline, sem mudança.

## [1.13.0] — Altura de recalque na vazão da bomba (curva automática)

### Adicionado

- **Altura nominal de recalque** na bomba: informando a "plaquinha" (ex.: 40 m), a **curva é derivada automaticamente** — a bomba entrega a `vazaoNominal` a 0 m e zera nessa altura (`Q = vazaoNominal·(1 − Δh/alturaNominal)`). Assim, entre dois reservatórios, a **altura real da instalação reduz a vazão sozinha**, sem precisar do coeficiente `k`. Tem precedência sobre `curva.k` (mantido para compatibilidade); ausente = bomba ideal (ignora a altura).
- Inspetor: campo "Altura nominal de recalque" (substitui o "Curva k"), com explicação; projetos antigos com `curva.k` aparecem como a altura equivalente.

### Alterado

- **Bomba do exemplo** ganhou altura nominal de 40 m — a vazão cai dos 50 L/s nominais para ~24–30 L/s conforme o recalque, deixando o cenário mais realista (os recalques DN60 seguem sinalizados por velocidade).
- **Bypass do exemplo**: alturas de conexão ajustadas (entrada 2 m, saída 6 m).

## [1.12.0] — Alerta de tubo subdimensionado (velocidade)

### Adicionado

- **Vazão máxima recomendada** por tubo, exibida no inspetor (ex.: `DN110 → 22,5 L/s a 3 m/s`). Calculada como **área × velocidade recomendada (3 m/s)** — a regra clássica de projeto — então vale também para diâmetros "Personalizado".
- **Alerta de dimensionamento na simulação**: quando a velocidade real de um cano (v = Q/área) passa dos 3 m/s, ele é pintado de **rosa** no canvas e um evento é registrado no log (*"velocidade acima do recomendado (> 3 m/s)"*). Útil para perceber, por exemplo, uma bomba potente empurrando por um cano estreito.
- Helpers `velocidadeTuboMs`, `vazaoMaxRecomendadaM3` e a constante `VELOCIDADE_MAX_RECOMENDADA_MS` em `geometria.ts`.

## [1.11.0] — Bitolas de tubo pré-configuradas (catálogo)

### Adicionado

- **Catálogo de bitolas** de tubo (DN20 a DN250) em `tubosCatalogo.ts`: o usuário seleciona a bitola no inspetor (agrupada por *Soldável Fria* e *Junta Elástica*, ex.: `DN110 (4") — Ø 97,8 mm`) e a aplicação grava o **diâmetro interno tabelado** — usado no cálculo de vazão (Torricelli). Mais realista do que digitar o nominal, e mais rápido de configurar.
- Campo `bitola` no tubo: apenas o rótulo do preset; `diametro` (mm) continua sendo o interno que a física usa. Selecionar um preset grava `diametro`; editar o mm na mão vira **"Personalizado"** (diâmetros arbitrários seguem possíveis). Projetos sem `bitola` continuam válidos.
- Os internos da *Junta Elástica* (DN125–250) são aproximados (variam com a classe de pressão), sinalizados com `~` no seletor.

### Alterado

- **Projeto de exemplo** migrado para as bitolas padrão: os canos passaram a usar o diâmetro interno real (ex.: sucção 110 mm → **DN110 Ø97,8**; saídas 150 mm → **DN160 Ø147**), deixando as vazões mais realistas.

## [1.10.1] — Layout do exemplo em 6 colunas

### Alterado

- **Projeto de exemplo** reorganizado: peças alinhadas no eixo x em **6 colunas com espaçamento uniforme** (passo 120) — bomba (240), ladrões/recalques (360), reservatórios (480), boias eletrônicas/saídas/incêndio (600), bomba de incêndio (720) e consumos (840).
- Adicionada a **linha de limpeza/interligação** (cavalete de incêndio → interligação com registro fechado → cavalete de recalque → inferior) e o rótulo do cavalete de incêndio. Sem mudança de comportamento na simulação (posições e novas conexões não alteram o cenário inicial; níveis iniciais mantidos em 2 m).

## [1.10.0] — Bomba dupla em revezamento

### Adicionado

- **Bomba dupla em revezamento**: uma única bomba pode ser marcada como dupla alternada (checkbox no inspetor). Ela é desenhada como um **círculo dividido ao meio** ("1" e "2"); a cada **acionamento** (borda de subida do liga) a metade ativa alterna — quem rodou por último descansa no ciclo seguinte, e a metade que assumiu **acende** enquanto a outra fica apagada. Hidraulicamente equivale a uma bomba comum (mesmos sensores, mesma vazão, mesma tubulação); é só rodízio de desgaste. Padrão ao inserir uma bomba = **única**.
- O **log de eventos** indica qual unidade assumiu (ex.: "Bomba ligou (unidade 2)").
- No **projeto de exemplo**, a "Bomba" passou a ser dupla em revezamento.

### Interno

- Estado `unidadeAtiva` é transitório: limpo no export e no reset (como os demais estados internos de execução).

## [1.9.0] — Tema claro e impressão do diagrama

### Adicionado

- **Tema claro** (opcional; o escuro segue como padrão), alternável pelo botão ☀/🌙 na barra. Ajusta a interface e os rótulos do canvas para fundo claro.
- **Botão Imprimir** (🖨): imprime só o diagrama com **fundo branco** e cores preservadas. Antes de imprimir, **enquadra todo o diagrama** (nada fica cortado) e usa o tema claro (rótulos escuros, legíveis); a vista do usuário é restaurada ao terminar. Via `window.print()` + CSS `@media print` (esconde a interface, deixa só o canvas).

## [1.8.1] — Ajuste de layout do exemplo

### Alterado

- **Projeto de exemplo**: reposicionamento das peças (bomba, sucção, recalques, sensores) e rótulos dos sensores padronizados como "Boia Eletrônica (superior/inferior/meio)". Sem mudança de comportamento na simulação.

## [1.8.0] — Sensor reverso, sensor multi-bomba e histerese por sensor

### Adicionado

- **Sensor reverso** (corte por nível baixo): em vez de LIGAR no mínimo e DESLIGAR no máximo, DESLIGA a bomba no mínimo e a libera no máximo. Aplicado a um reservatório de origem, protege-o de esvaziar / desliga a bomba de um reservatório para hidrantes quando ele baixa. Substitui a boia reversa (a lógica virou do sensor, que já tem min/máx/histerese/delay).
- **Um sensor pode controlar VÁRIAS bombas** ao mesmo tempo (`bombasAlvo`). A bomba respeita todos os seus sensores (normais e reversos) simultaneamente — e, no empate, **desligar sempre vence**.
- **Histerese real por sensor**: na banda morta o sensor mantém a SUA intenção persistida (não o estado da bomba), então um sensor reverso segura a bomba desligada mesmo com outro sensor pedindo para ligar — sem chatter.

### Removido

- **Boia reversa** no tubo (substituída pelo sensor reverso). A histerese das boias normais (mecânicas, no destino) continua.

### Alterado

- O **exemplo padrão** usa sensores reversos (no inferior e no meio) para proteger as origens, no lugar das boias reversas nas sucções.

## [1.7.0] — Boia reversa, histerese e fim da proteção a seco configurável

### Adicionado

- **Boia reversa** no tubo: em vez de monitorar o destino e fechar quando cheio, monitora o reservatório de **origem** e **fecha no nível mínimo** (reabre no máximo). Protege um reservatório de esvaziar e serve para ligar/desligar a bomba de um reservatório para hidrantes quando ele baixa. Ativável pelo campo "Reversa" nas propriedades da boia do tubo.
- **Histerese real nas boias mecânicas**: o estado aberta/fechada é mantido entre o mínimo e o máximo (persistido entre ticks), eliminando o chaveamento rápido (chatter). Vale para boias normais e reversas.
- **Export limpa o estado interno de execução**: ao salvar, o bookkeeping das peças (`ultimaTroca`/`pedindoLigar` do sensor, `aberta` da boia) é removido do arquivo — era o tipo de estado que congelava uma bomba por ~17000 s ao recarregar. O cenário (níveis, bomba ligada/desligada) é preservado.

### Alterado / Removido

- **Removida a proteção a seco configurável** (`protecaoSeco`) da bomba. A bomba não desliga mais sozinha por nível; a proteção passa a ser feita por uma **boia reversa** na sucção (com histerese, sem o chatter que o limiar causava). Se mesmo assim a origem esvaziar com a bomba ligada, ela **roda a seco**: vazão 0 (sem fantasma) e um **alerta/log** é emitido. O exemplo padrão passou a usar boias reversas nas sucções no lugar da proteção a seco.

## [1.6.0] — Bomba para consumo, alerta de déficit e log de eventos

### Adicionado

- **Controle da bomba** com modo **Automático / Ligado / Desligado** (seletor nas propriedades da bomba): Automático segue o sensor; Ligado força a bomba a funcionar (ainda respeitando a proteção a seco); Desligado a mantém parada. É o "botão" liga/desliga/automático — substitui o antigo checkbox manual.

- **Bomba pode empurrar para um ponto de consumo** (ex.: bomba de incêndio → hidrantes). A bomba entrega a MENOR entre a sua vazão e a demanda do consumo: se a demanda é menor, entrega a demanda; se é maior, entrega a sua vazão (não acompanha) e o **consumo acende em alerta de déficit** (laranja). Consumo com demanda 0 (ou fechado) → a bomba não empurra nada por ali.
- **Log de eventos** da execução: lista com acionamentos de bomba (liga/desliga), decisões de sensor (ligar/desligar) e alertas (proteção a seco, ladrão em transbordo, déficit de consumo, transbordo de reservatório), com o instante de cada evento. Abre pelo botão **📋 Log** no canvas.

### Corrigido

- Um cano que leva a uma bomba/consumo não é mais tratado como dreno ao ambiente: a sucção de uma bomba ociosa não drena mais a origem à toa.

## [1.5.1] — Correção: sensor congelado por estado exportado

### Corrigido

- **Bomba só ligava após ~17000 s** ao recarregar um projeto exportado durante a execução. O sensor guarda `ultimaTroca` (instante da última troca) para o `delay`; ao exportar no meio de um run, esse valor (ex.: 16696 s) ia junto no JSON. Recarregado com o tempo zerado, a checagem `tempoAtual − ultimaTroca < delay` ficava verdadeira até o relógio alcançar aquele instante, congelando o sensor. Agora um `ultimaTroca` no **futuro** relativo ao tempo atual é tratado como obsoleto e ignorado — o sensor decide normalmente pelo nível.

### Alterado

- **Novo projeto de exemplo padrão** (revisão do usuário): tomadas de tubo com **altura de conexão** (recalques e bypass em altura), bomba sem curva com `protecaoSeco` 2, e um **sistema secundário de incêndio** (bomba + hidrantes) alimentado pelo reservatório do meio. O estado transitório dos sensores (`ultimaTroca`/`pedindoLigar`) não é embutido no exemplo.

## [1.5.0] — Altura de conexão do tubo

### Adicionado

- **Altura de conexão em cada ponta do tubo** (`alturaEntrada` / `alturaSaida`, na unidade de comprimento, relativa à base do reservatório; default 0 = fundo, editável por peça no inspetor). Uma tomada em altura só escoa a água **acima** do bocal: dá para modelar saídas laterais (que não esvaziam o tanque todo) e bocais elevados no destino, que exigem mais carga para serem vencidos (não se empurra água acima da própria superfície da origem).

### Corrigido

- **Tubo/consumo saindo de um reservatório vazio mostrava vazão "fantasma"**. A carga hidráulica usa `cotaBase + nível`; num tanque **vazio mas elevado** a carga continua positiva pela cota, então o motor calculava vazão pela gravidade mesmo sem água para escoar (a telemetria/animação indicava consumo, embora o volume real não se movesse). Agora, sem coluna d'água na origem (acima do bocal do tubo), não há fluxo — nem no tubo (ida e refluxo) nem no ponto de consumo.

## [1.4.1] — Correção: consumo em 0 drenava o reservatório

### Corrigido

- **Cano que alimenta um ponto de consumo virava "ralo para o ambiente"** quando a demanda do consumo era 0 (ou o consumo estava fechado): o tubo drenava o reservatório na vazão cheia da gravidade, ignorando a demanda. Como o nível caía, o sensor religava a bomba e o fluxo nunca parava. Agora o consumo **reivindica os canos do seu caminho mesmo com demanda 0**, então nada sai além do que ele realmente consome. Empurrar água para um **reservatório** cheio segue permitido (transborda, com alerta do ladrão) — a restrição é só para o consumo em 0.

## [1.4.0] — Navegação do canvas (pan e zoom)

### Adicionado

- **Pan e zoom no canvas**: arrastar o fundo para deslocar a vista, **pinça** (dois dedos) no mobile e **rolagem do mouse** no desktop para ampliar/reduzir, além de botões **＋ / － / ⤢ (ajustar à tela)**. Resolve o caso em que o diagrama não cabe na tela do celular e parte das peças ficava inalcançável.
- **Enquadramento automático** ao abrir: se o diagrama não couber na área visível (típico no mobile), a vista já entra ajustada mostrando tudo; no desktop, onde cabe, a escala 1× é preservada. O reenquadramento cessa assim que o usuário mexe no zoom/pan.

### Corrigido

- A linha temporária de criação de conexão passa a usar coordenadas do conteúdo (respeita zoom/pan) e o arraste de conexão não desloca mais o fundo junto.

## [1.3.0] — Uso no celular (ver e simular)

### Adicionado

- **Layout responsivo para telas pequenas** (≤ 820 px): o canvas passa a ocupar toda a área; a paleta de peças (edição) fica oculta; o inspetor vira uma **gaveta deslizante** aberta por um botão flutuante ou ao tocar numa peça, com fundo escurecido que fecha ao toque. Correção do overflow horizontal que travava o canvas em largura fixa (`min-width: 0` no contêiner do Stage).
- **Aviso no celular** de que a edição (adicionar e conectar peças) está disponível apenas no computador — no mobile o foco é simular e inspecionar.

### Alterado

- **Projeto de exemplo**: os três reservatórios agora iniciam em **nível 2 m** e o ponto de consumo usa **perfil senoidal** (0..5 L, período 60 s). Com o inferior abaixo da proteção a seco, a bomba parte protegida e a fonte enche o reservatório antes de a bomba operar.

## [1.2.0] — Ajustes de simulação e realismo

### Adicionado

- **Perfis de consumo** no ponto de saída: além da vazão **fixa**, agora há **senoidal** (variação suave entre mínimo/máximo por período) e **intermitente** (liga/desliga por ciclo de trabalho), modelando demanda irregular de forma determinística no tempo.
- **Detecção de ids duplicados** (peças e conexões) na validação de grafo: a entrada em execução é bloqueada com mensagem clara se houver colisão.
- Novo **projeto de exemplo padrão** do usuário: três reservatórios cilíndricos empilhados, bomba com **curva** (`vazaoNominal − k·Δh`) e **proteção a seco**, três **tubos ladrão** (superior/meio/inferior), **boia manual** e **bypass**, todos com diâmetros em milímetros e ids de conexão únicos.

### Corrigido

- **Sucção da bomba não esvaziava a origem**: a vazão nominal era dividida entre **todas** as saídas (desperdiçando a parte destinada a ramos fechados). Agora a divisão considera **apenas as saídas abertas**, então o cano de sucção puxa a vazão cheia e o reservatório de origem realmente esvazia.
- **Ids duplicados após carregar um projeto**: `sincronizarContador` alinha o contador de ids aos sufixos já presentes ao iniciar/carregar, evitando que peças/conexões criadas depois colidam com as existentes.

### Removido

- Opção de **boia / válvula de nível das propriedades da Fonte externa** — esse controle pertence ao **cano**, não à fonte, e gerava configuração ambígua.

## [1.1.0] — Feedback pós-uso

### Adicionado

- **Sistema de unidades coerente**: física em SI (m, m³, s); diâmetro de tubo em **milímetros**; volume/vazão em litros ou m³; comprimentos em m/cm. Isso torna a escala de tempo realista (L/s enchendo tanques de milhares de litros).
- **Multiplicadores de velocidade** ampliados (1x/5x/30x/120x) para acompanhar cenários realistas em segundos.
- **Tubo ladrão** (`ladrao.nivel`): dreno de transbordo que só escoa o excedente acima do nível de acionamento, com alerta laranja quando ativo.
- **Vazão de saída limitada pela capacidade do cano** (Torricelli pelo diâmetro), então canos finos estrangulam de verdade.
- **Vazão atual do tubo** exibida no inspetor (na unidade de vazão).
- **Rodapé** com créditos e link para o GitHub.
- Cores de estado: sensor (verde liga / vermelho desliga / amarelo espera) e válvulas; fluxo animado; campos read-only em execução.
- **Unidades exibidas** nos rótulos do inspetor e seletor de unidades na barra.
- Botão **✨ Novo** para começar um projeto em branco (com confirmação).
- **Cores de válvula** nos tubos: registro (quadrado) e boia (círculo) — verde = aberto, vermelho = fechado; boia mostra o estado ao vivo na execução.
- Novo tipo de peça **`consumo`**: ponto de saída/demanda com vazão de saída configurável (retira água do reservatório de origem e descarta).
- Campo **`rotulo`** em `Peca` — renomear peças pela UI (o `id` permanece estável).
- **Divisão de vazão da bomba** entre múltiplas saídas (por `vazaoAlocada` ou igualmente), permitindo uma bomba alimentar vários reservatórios.
- **Proteção contra bomba a seco configurável** (`protecaoSeco`): desliga a bomba quando a origem cai a/abaixo de um nível ajustável.
- Novo projeto de exemplo padrão: três reservatórios cilíndricos empilhados com bomba de saída dividida e ponto de consumo por gravidade.

### Alterado

- **Conexões agora são deliberadas** (estilo N8N): arrastar da alça de saída de uma peça até outra, em vez de conexão automática ao clicar. Corrige criação acidental de linhas.
- Conexões podem ser **selecionadas e excluídas** (clique + Delete ou botão).

## [1.0.0] — Persistência e Polimento

### Adicionado

- Export/import manual de projetos `.json` (`src/persistence/arquivo.ts`), com nome de arquivo saneado a partir do nome do projeto.
- Tratamento de versão incompatível no import (recusa MAJOR diferente/ausente).
- Campo de nome do projeto e feedback visual de erros de validação/import na UI.
- Testes de round-trip export/import e de versão incompatível.
- README completo (schema + fórmulas físicas) e este changelog.

## [0.4.0] — Modo Execução e Controles

### Adicionado

- Reducer central (`src/state/store.ts`) com modos `edicao`/`execucao`.
- Transição `edicao → execucao` roda a validação de grafo; falha mantém edição.
- Transição `execucao → edicao` exige pause; `RESET` restaura o snapshot.
- Loop de simulação via `requestAnimationFrame` (`useSimulationLoop`).
- Controle de velocidade (1x/2x/5x) rodando N ticks por frame sem alterar o `dt`.
- Controles de UI: play/pause/reset, registro, bomba manual, thresholds de sensor.
- Testes de integração: bloqueio de mutação estrutural em execução, validação impedindo execução com erro, controles refletindo o estado do motor.

## [0.3.0] — Editor Visual (modo edição)

### Adicionado

- Canvas com react-konva: peças arrastáveis, criação de conexões por clique, visualização de nível de líquido e vazão.
- Paleta de peças e inspetor de propriedades por tipo.
- Testes de componente (React Testing Library) para criação, movimentação e conexão de peças (react-konva mockado em jsdom).

## [0.2.0] — Motor de Simulação (puro, sem UI)

### Adicionado

- Motor `tick()` com cálculo de vazão por tipo de aresta (Torricelli, bomba com/sem curva, fonte com múltiplos destinos), overflow, proteção contra bomba a seco e arbitragem multi-sensor.
- Validação de grafo (seção 5): nó órfão, aresta sem origem/destino, ciclo moto-perpétuo (via componentes fortemente conexos), fonte acima da vazão fixa.
- Geometria nível↔volume para seção constante (cilindro/retangular).
- Cobertura de testes Vitest para todas as regras físicas e de validação.

## [0.1.0] — Modelo de Domínio e Schema

### Adicionado

- Interfaces TypeScript de todas as entidades (`src/domain/types.ts`).
- Validação e versionamento de schema robustos a `.json` malformado/malicioso (`src/domain/schema.ts`), sem lançar exceções para o chamador.
- Fábricas de peças/projeto com defaults (`src/domain/factory.ts`).
- Testes de parsing de schema válido, rejeição de malformado e fallback de versão.
- Scaffolding do projeto (Vite, TypeScript strict, ESLint, Vitest).