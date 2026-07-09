# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui. O formato segue
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e o versionamento é
[SemVer](https://semver.org/lang/pt-BR/). As primeiras versões (0.x–1.0) espelham
os sprints da especificação técnica; as seguintes acompanham a evolução
incremental por funcionalidade.

## [1.18.0] — Reservatório vazio não gera fluxo fantasma; bitola na junção

### Corrigido

- **Reservatório vazio na rede de junções não FORNECE mais água.** O solver
  tratava o reservatório como carga fixa `cotaBase + nível`; com o tanque vazio
  (nível 0) a carga ainda era alta pela elevação, então ele **empurrava água que
  não existe** — ex.: o `superior` já esvaziado continuava refluindo pela União
  para o `meio`, com a seta de refluxo acesa. Agora um reservatório vazio só pode
  **receber** (a aresta que o teria como fonte fica em 0), como já valia para os
  tubos lineares. O refluxo legítimo (reservatório com água e mais alto empurrando
  o mais baixo pela União) continua igual.

### Adicionado

- **Bitola na junção**: ao estrangular uma junção, a medida agora reusa o mesmo
  **catálogo de bitolas (DN)** dos tubos — seleciona o DN e grava o diâmetro
  interno tabelado, com opção **Personalizado** para digitar o mm na mão.

### Alterado

- **Projeto de exemplo atualizado** com as junções **Divisor** (na saída da
  bomba) e **União** (antes do consumo), mantendo o alinhamento das peças nas 6
  colunas (passo uniforme de 120 no eixo x). A saída do meio passa a ficar aberta.

## [1.17.0] — Terminais na rede de junções e refluxo sinalizado

### Adicionado

- **Consumo, fonte e bomba entram na rede de junções** como **nós de vazão**.
  Antes cada um resolvia o próprio caminho isolado: um consumo puxando de uma
  **união** escolhia só um dos ramos e o outro ficava intocado — sem o refluxo
  esperado. Agora o terminal injeta/retira vazão no nó em que se liga e a rede é
  resolvida em conjunto (conservando massa). Assim, se um consumo puxa de uma
  união e o ramo mais alto entrega **mais** que a demanda, o excedente **reflui**
  para o ramo mais baixo, enchendo-o — o comportamento físico correto.
- **Refluxo sinalizado**: um tubo com fluxo **contrário à sua seta** aparece na
  cor **violeta** (as "formigas" já marchavam no sentido real) e gera uma
  **entrada no log** (`refluxo: fluxo contrário à seta`). O refluxo é inesperado
  na maioria dos projetos, então fica evidente na tela e no histórico.

## [1.16.0] — Diâmetro na junção e setas de sensor

### Adicionado

- **Junção com diâmetro** (opcional): a junção pode **estrangular** o fluxo que
  passa por ela, como um cano estreito no nó. Cada trecho ligado à junção é
  limitado também pela área desse diâmetro (o gargalo passa a considerar o nó).
  Configurável no inspetor.

### Alterado

- **Conexões de sensor sem ponta de seta**: o sensor só monitora (não conduz),
  então a linha até o reservatório sai como **linha simples**, sem seta — o
  sentido não faz sentido ali. As conexões de fluxo seguem com a ponta visível.

## [1.15.0] — Junção divide e soma a vazão (rede de gravidade)

### Adicionado

- **Junções agora bifurcam e unem de verdade**, conservando massa no nó. Antes a
  junção era só passagem: numa bifurcação só um ramo recebia água (o outro ficava
  seco) e numa união só uma origem esvaziava. Agora uma sub-rede de gravidade com
  junções é resolvida como uma pequena **rede de vazão**: reservatórios têm carga
  fixa (a superfície), junções têm carga **incógnita** resolvida por iteração
  (Gauss-Seidel + bisseção) até o fluxo líquido no nó zerar. Cada trecho de tubos
  em série entre dois nós vira uma aresta limitada pelo **gargalo** (menor
  diâmetro). Resultado: numa **bifurcação** os dois ramos enchem (proporcional à
  área de cada um) e numa **união** as duas origens esvaziam e somam no destino.
- Cadeias **sem** junção e o fluxo **dirigido** por bomba/fonte seguem no caminho
  rápido de sempre; o solver entra só quando há junção.
- Limitações (v1): não modela check valve/altura de conexão **dentro** de um
  trecho entre junções (uma boia fechada, sim, bloqueia o trecho). Para esses
  casos, use um **reservatório** no ponto de divisão.

## [1.14.0] — Setas de conexão com sentido visível

### Adicionado

- **Ponta da seta visível**: as conexões passam a parar na **borda** das peças,
  deixando a cabeça da seta à vista — dá para ver de onde a linha **parte**
  (saída/origem) e onde **chega** (entrada/destino). Antes a seta ia de centro a
  centro e a ponta ficava escondida sob a peça de destino.
- **Formigas no sentido real do fluxo**: a animação de fluxo (traço marchando)
  segue o **sinal da vazão** — quando há **refluxo**, a marcha inverte, mostrando
  a água voltando (ex.: um tubo sem válvula de retenção com o destino mais alto).

## [1.13.2] — Correção: tubos em série drenavam em dobro

### Corrigido

- **Tubos em série por gravidade eram tratados como paralelos**: cada tubo de uma
  cadeia resolvia os mesmos reservatórios de origem/destino e empurrava o próprio
  fluxo, então a origem drenava **N×** (N = nº de tubos na cadeia). Agora uma
  cadeia de tubos entre dois reservatórios carrega **um único fluxo, limitado
  pelo cano mais estreito** (o gargalo), independente da ordem; todos os tubos da
  cadeia mostram essa vazão. Descarga ao ambiente, sucção de bomba, ladrão e
  registro fechado seguem inalterados (um registro fechado no meio quebra a
  cadeia). O fluxo **dirigido** por bomba/fonte já resolvia a série corretamente.

### Verificado (sem mudança)

- Um tubo entre reservatórios drena a origem e enche o destino corretamente
  (volume conservado).
- A **gravidade atua como barreira ao recalque**: com altura nominal/curva, a
  altura reduz a vazão da bomba e a zera acima da altura de shutoff; um tubo
  passivo nunca empurra água morro acima.

## [1.13.1] — Menu recolhido no mobile

### Alterado

- No **mobile**, as ações secundárias (Novo, Claro/Escuro, Imprimir, Salvar,
  Carregar) recolhem sob um botão **"⋯"**, ocupando bem menos a barra. No
  desktop seguem inline, sem mudança.

## [1.13.0] — Altura de recalque na vazão da bomba (curva automática)

### Adicionado

- **Altura nominal de recalque** na bomba: informando a "plaquinha" (ex.: 40 m),
  a **curva é derivada automaticamente** — a bomba entrega a `vazaoNominal` a 0 m
  e zera nessa altura (`Q = vazaoNominal·(1 − Δh/alturaNominal)`). Assim, entre
  dois reservatórios, a **altura real da instalação reduz a vazão sozinha**, sem
  precisar do coeficiente `k`. Tem precedência sobre `curva.k` (mantido para
  compatibilidade); ausente = bomba ideal (ignora a altura).
- Inspetor: campo "Altura nominal de recalque" (substitui o "Curva k"), com
  explicação; projetos antigos com `curva.k` aparecem como a altura equivalente.

### Alterado

- **Bomba do exemplo** ganhou altura nominal de 40 m — a vazão cai dos 50 L/s
  nominais para ~24–30 L/s conforme o recalque, deixando o cenário mais realista
  (os recalques DN60 seguem sinalizados por velocidade).
- **Bypass do exemplo**: alturas de conexão ajustadas (entrada 2 m, saída 6 m).

## [1.12.0] — Alerta de tubo subdimensionado (velocidade)

### Adicionado

- **Vazão máxima recomendada** por tubo, exibida no inspetor (ex.: `DN110 → 22,5
  L/s a 3 m/s`). Calculada como **área × velocidade recomendada (3 m/s)** — a
  regra clássica de projeto — então vale também para diâmetros "Personalizado".
- **Alerta de dimensionamento na simulação**: quando a velocidade real de um cano
  (v = Q/área) passa dos 3 m/s, ele é pintado de **rosa** no canvas e um evento é
  registrado no log (*"velocidade acima do recomendado (> 3 m/s)"*). Útil para
  perceber, por exemplo, uma bomba potente empurrando por um cano estreito.
- Helpers `velocidadeTuboMs`, `vazaoMaxRecomendadaM3` e a constante
  `VELOCIDADE_MAX_RECOMENDADA_MS` em `geometria.ts`.

## [1.11.0] — Bitolas de tubo pré-configuradas (catálogo)

### Adicionado

- **Catálogo de bitolas** de tubo (DN20 a DN250) em `tubosCatalogo.ts`: o usuário
  seleciona a bitola no inspetor (agrupada por *Soldável Fria* e *Junta Elástica*,
  ex.: `DN110 (4") — Ø 97,8 mm`) e a aplicação grava o **diâmetro interno
  tabelado** — usado no cálculo de vazão (Torricelli). Mais realista do que
  digitar o nominal, e mais rápido de configurar.
- Campo `bitola` no tubo: apenas o rótulo do preset; `diametro` (mm) continua
  sendo o interno que a física usa. Selecionar um preset grava `diametro`;
  editar o mm na mão vira **"Personalizado"** (diâmetros arbitrários seguem
  possíveis). Projetos sem `bitola` continuam válidos.
- Os internos da *Junta Elástica* (DN125–250) são aproximados (variam com a
  classe de pressão), sinalizados com `~` no seletor.

### Alterado

- **Projeto de exemplo** migrado para as bitolas padrão: os canos passaram a
  usar o diâmetro interno real (ex.: sucção 110 mm → **DN110 Ø97,8**; saídas
  150 mm → **DN160 Ø147**), deixando as vazões mais realistas.

## [1.10.1] — Layout do exemplo em 6 colunas

### Alterado

- **Projeto de exemplo** reorganizado: peças alinhadas no eixo x em **6 colunas
  com espaçamento uniforme** (passo 120) — bomba (240), ladrões/recalques (360),
  reservatórios (480), boias eletrônicas/saídas/incêndio (600), bomba de
  incêndio (720) e consumos (840).
- Adicionada a **linha de limpeza/interligação** (cavalete de incêndio →
  interligação com registro fechado → cavalete de recalque → inferior) e o
  rótulo do cavalete de incêndio. Sem mudança de comportamento na simulação
  (posições e novas conexões não alteram o cenário inicial; níveis iniciais
  mantidos em 2 m).

## [1.10.0] — Bomba dupla em revezamento

### Adicionado

- **Bomba dupla em revezamento**: uma única bomba pode ser marcada como dupla
  alternada (checkbox no inspetor). Ela é desenhada como um **círculo dividido
  ao meio** ("1" e "2"); a cada **acionamento** (borda de subida do liga) a
  metade ativa alterna — quem rodou por último descansa no ciclo seguinte, e a
  metade que assumiu **acende** enquanto a outra fica apagada. Hidraulicamente
  equivale a uma bomba comum (mesmos sensores, mesma vazão, mesma tubulação);
  é só rodízio de desgaste. Padrão ao inserir uma bomba = **única**.
- O **log de eventos** indica qual unidade assumiu (ex.: "Bomba ligou (unidade 2)").
- No **projeto de exemplo**, a "Bomba" passou a ser dupla em revezamento.

### Interno

- Estado `unidadeAtiva` é transitório: limpo no export e no reset (como os
  demais estados internos de execução).

## [1.9.0] — Tema claro e impressão do diagrama

### Adicionado

- **Tema claro** (opcional; o escuro segue como padrão), alternável pelo botão
  ☀/🌙 na barra. Ajusta a interface e os rótulos do canvas para fundo claro.
- **Botão Imprimir** (🖨): imprime só o diagrama com **fundo branco** e cores
  preservadas. Antes de imprimir, **enquadra todo o diagrama** (nada fica
  cortado) e usa o tema claro (rótulos escuros, legíveis); a vista do usuário é
  restaurada ao terminar. Via `window.print()` + CSS `@media print` (esconde a
  interface, deixa só o canvas).

## [1.8.1] — Ajuste de layout do exemplo

### Alterado

- **Projeto de exemplo**: reposicionamento das peças (bomba, sucção, recalques,
  sensores) e rótulos dos sensores padronizados como "Boia Eletrônica
  (superior/inferior/meio)". Sem mudança de comportamento na simulação.

## [1.8.0] — Sensor reverso, sensor multi-bomba e histerese por sensor

### Adicionado

- **Sensor reverso** (corte por nível baixo): em vez de LIGAR no mínimo e DESLIGAR
  no máximo, DESLIGA a bomba no mínimo e a libera no máximo. Aplicado a um
  reservatório de origem, protege-o de esvaziar / desliga a bomba de um
  reservatório para hidrantes quando ele baixa. Substitui a boia reversa (a lógica
  virou do sensor, que já tem min/máx/histerese/delay).
- **Um sensor pode controlar VÁRIAS bombas** ao mesmo tempo (`bombasAlvo`). A
  bomba respeita todos os seus sensores (normais e reversos) simultaneamente — e,
  no empate, **desligar sempre vence**.
- **Histerese real por sensor**: na banda morta o sensor mantém a SUA intenção
  persistida (não o estado da bomba), então um sensor reverso segura a bomba
  desligada mesmo com outro sensor pedindo para ligar — sem chatter.

### Removido

- **Boia reversa** no tubo (substituída pelo sensor reverso). A histerese das
  boias normais (mecânicas, no destino) continua.

### Alterado

- O **exemplo padrão** usa sensores reversos (no inferior e no meio) para proteger
  as origens, no lugar das boias reversas nas sucções.

## [1.7.0] — Boia reversa, histerese e fim da proteção a seco configurável

### Adicionado

- **Boia reversa** no tubo: em vez de monitorar o destino e fechar quando cheio,
  monitora o reservatório de **origem** e **fecha no nível mínimo** (reabre no
  máximo). Protege um reservatório de esvaziar e serve para ligar/desligar a
  bomba de um reservatório para hidrantes quando ele baixa. Ativável pelo campo
  "Reversa" nas propriedades da boia do tubo.
- **Histerese real nas boias mecânicas**: o estado aberta/fechada é mantido entre
  o mínimo e o máximo (persistido entre ticks), eliminando o chaveamento rápido
  (chatter). Vale para boias normais e reversas.
- **Export limpa o estado interno de execução**: ao salvar, o bookkeeping das
  peças (`ultimaTroca`/`pedindoLigar` do sensor, `aberta` da boia) é removido do
  arquivo — era o tipo de estado que congelava uma bomba por ~17000 s ao
  recarregar. O cenário (níveis, bomba ligada/desligada) é preservado.

### Alterado / Removido

- **Removida a proteção a seco configurável** (`protecaoSeco`) da bomba. A bomba
  não desliga mais sozinha por nível; a proteção passa a ser feita por uma **boia
  reversa** na sucção (com histerese, sem o chatter que o limiar causava). Se
  mesmo assim a origem esvaziar com a bomba ligada, ela **roda a seco**: vazão 0
  (sem fantasma) e um **alerta/log** é emitido. O exemplo padrão passou a usar
  boias reversas nas sucções no lugar da proteção a seco.

## [1.6.0] — Bomba para consumo, alerta de déficit e log de eventos

### Adicionado

- **Controle da bomba** com modo **Automático / Ligado / Desligado** (seletor nas
  propriedades da bomba): Automático segue o sensor; Ligado força a bomba a
  funcionar (ainda respeitando a proteção a seco); Desligado a mantém parada. É o
  "botão" liga/desliga/automático — substitui o antigo checkbox manual.

- **Bomba pode empurrar para um ponto de consumo** (ex.: bomba de incêndio →
  hidrantes). A bomba entrega a MENOR entre a sua vazão e a demanda do consumo:
  se a demanda é menor, entrega a demanda; se é maior, entrega a sua vazão (não
  acompanha) e o **consumo acende em alerta de déficit** (laranja). Consumo com
  demanda 0 (ou fechado) → a bomba não empurra nada por ali.
- **Log de eventos** da execução: lista com acionamentos de bomba (liga/desliga),
  decisões de sensor (ligar/desligar) e alertas (proteção a seco, ladrão em
  transbordo, déficit de consumo, transbordo de reservatório), com o instante de
  cada evento. Abre pelo botão **📋 Log** no canvas.

### Corrigido

- Um cano que leva a uma bomba/consumo não é mais tratado como dreno ao ambiente:
  a sucção de uma bomba ociosa não drena mais a origem à toa.

## [1.5.1] — Correção: sensor congelado por estado exportado

### Corrigido

- **Bomba só ligava após ~17000 s** ao recarregar um projeto exportado durante a
  execução. O sensor guarda `ultimaTroca` (instante da última troca) para o
  `delay`; ao exportar no meio de um run, esse valor (ex.: 16696 s) ia junto no
  JSON. Recarregado com o tempo zerado, a checagem `tempoAtual − ultimaTroca <
  delay` ficava verdadeira até o relógio alcançar aquele instante, congelando o
  sensor. Agora um `ultimaTroca` no **futuro** relativo ao tempo atual é tratado
  como obsoleto e ignorado — o sensor decide normalmente pelo nível.

### Alterado

- **Novo projeto de exemplo padrão** (revisão do usuário): tomadas de tubo com
  **altura de conexão** (recalques e bypass em altura), bomba sem curva com
  `protecaoSeco` 2, e um **sistema secundário de incêndio** (bomba + hidrantes)
  alimentado pelo reservatório do meio. O estado transitório dos sensores
  (`ultimaTroca`/`pedindoLigar`) não é embutido no exemplo.

## [1.5.0] — Altura de conexão do tubo

### Adicionado

- **Altura de conexão em cada ponta do tubo** (`alturaEntrada` / `alturaSaida`,
  na unidade de comprimento, relativa à base do reservatório; default 0 = fundo,
  editável por peça no inspetor). Uma tomada em altura só escoa a água **acima**
  do bocal: dá para modelar saídas laterais (que não esvaziam o tanque todo) e
  bocais elevados no destino, que exigem mais carga para serem vencidos (não se
  empurra água acima da própria superfície da origem).

### Corrigido

- **Tubo/consumo saindo de um reservatório vazio mostrava vazão "fantasma"**. A
  carga hidráulica usa `cotaBase + nível`; num tanque **vazio mas elevado** a
  carga continua positiva pela cota, então o motor calculava vazão pela gravidade
  mesmo sem água para escoar (a telemetria/animação indicava consumo, embora o
  volume real não se movesse). Agora, sem coluna d'água na origem (acima do bocal
  do tubo), não há fluxo — nem no tubo (ida e refluxo) nem no ponto de consumo.

## [1.4.1] — Correção: consumo em 0 drenava o reservatório

### Corrigido

- **Cano que alimenta um ponto de consumo virava "ralo para o ambiente"** quando
  a demanda do consumo era 0 (ou o consumo estava fechado): o tubo drenava o
  reservatório na vazão cheia da gravidade, ignorando a demanda. Como o nível
  caía, o sensor religava a bomba e o fluxo nunca parava. Agora o consumo
  **reivindica os canos do seu caminho mesmo com demanda 0**, então nada sai além
  do que ele realmente consome. Empurrar água para um **reservatório** cheio
  segue permitido (transborda, com alerta do ladrão) — a restrição é só para o
  consumo em 0.

## [1.4.0] — Navegação do canvas (pan e zoom)

### Adicionado

- **Pan e zoom no canvas**: arrastar o fundo para deslocar a vista, **pinça**
  (dois dedos) no mobile e **rolagem do mouse** no desktop para ampliar/reduzir,
  além de botões **＋ / － / ⤢ (ajustar à tela)**. Resolve o caso em que o
  diagrama não cabe na tela do celular e parte das peças ficava inalcançável.
- **Enquadramento automático** ao abrir: se o diagrama não couber na área
  visível (típico no mobile), a vista já entra ajustada mostrando tudo; no
  desktop, onde cabe, a escala 1× é preservada. O reenquadramento cessa assim
  que o usuário mexe no zoom/pan.

### Corrigido

- A linha temporária de criação de conexão passa a usar coordenadas do conteúdo
  (respeita zoom/pan) e o arraste de conexão não desloca mais o fundo junto.

## [1.3.0] — Uso no celular (ver e simular)

### Adicionado

- **Layout responsivo para telas pequenas** (≤ 820 px): o canvas passa a ocupar
  toda a área; a paleta de peças (edição) fica oculta; o inspetor vira uma
  **gaveta deslizante** aberta por um botão flutuante ou ao tocar numa peça, com
  fundo escurecido que fecha ao toque. Correção do overflow horizontal que
  travava o canvas em largura fixa (`min-width: 0` no contêiner do Stage).
- **Aviso no celular** de que a edição (adicionar e conectar peças) está
  disponível apenas no computador — no mobile o foco é simular e inspecionar.

### Alterado

- **Projeto de exemplo**: os três reservatórios agora iniciam em **nível 2 m** e
  o ponto de consumo usa **perfil senoidal** (0..5 L, período 60 s). Com o
  inferior abaixo da proteção a seco, a bomba parte protegida e a fonte enche o
  reservatório antes de a bomba operar.

## [1.2.0] — Ajustes de simulação e realismo

### Adicionado

- **Perfis de consumo** no ponto de saída: além da vazão **fixa**, agora há
  **senoidal** (variação suave entre mínimo/máximo por período) e
  **intermitente** (liga/desliga por ciclo de trabalho), modelando demanda
  irregular de forma determinística no tempo.
- **Detecção de ids duplicados** (peças e conexões) na validação de grafo: a
  entrada em execução é bloqueada com mensagem clara se houver colisão.
- Novo **projeto de exemplo padrão** do usuário: três reservatórios cilíndricos
  empilhados, bomba com **curva** (`vazaoNominal − k·Δh`) e **proteção a seco**,
  três **tubos ladrão** (superior/meio/inferior), **boia manual** e **bypass**,
  todos com diâmetros em milímetros e ids de conexão únicos.

### Corrigido

- **Sucção da bomba não esvaziava a origem**: a vazão nominal era dividida entre
  **todas** as saídas (desperdiçando a parte destinada a ramos fechados). Agora a
  divisão considera **apenas as saídas abertas**, então o cano de sucção puxa a
  vazão cheia e o reservatório de origem realmente esvazia.
- **Ids duplicados após carregar um projeto**: `sincronizarContador` alinha o
  contador de ids aos sufixos já presentes ao iniciar/carregar, evitando que
  peças/conexões criadas depois colidam com as existentes.

### Removido

- Opção de **boia / válvula de nível das propriedades da Fonte externa** — esse
  controle pertence ao **cano**, não à fonte, e gerava configuração ambígua.

## [1.1.0] — Feedback pós-uso

### Adicionado

- **Sistema de unidades coerente**: física em SI (m, m³, s); diâmetro de tubo em
  **milímetros**; volume/vazão em litros ou m³; comprimentos em m/cm. Isso torna
  a escala de tempo realista (L/s enchendo tanques de milhares de litros).
- **Multiplicadores de velocidade** ampliados (1x/5x/30x/120x) para acompanhar
  cenários realistas em segundos.
- **Tubo ladrão** (`ladrao.nivel`): dreno de transbordo que só escoa o excedente
  acima do nível de acionamento, com alerta laranja quando ativo.
- **Vazão de saída limitada pela capacidade do cano** (Torricelli pelo diâmetro),
  então canos finos estrangulam de verdade.
- **Vazão atual do tubo** exibida no inspetor (na unidade de vazão).
- **Rodapé** com créditos e link para o GitHub.
- Cores de estado: sensor (verde liga / vermelho desliga / amarelo espera) e
  válvulas; fluxo animado; campos read-only em execução.
- **Unidades exibidas** nos rótulos do inspetor e seletor de unidades na barra.
- Botão **✨ Novo** para começar um projeto em branco (com confirmação).
- **Cores de válvula** nos tubos: registro (quadrado) e boia (círculo) —
  verde = aberto, vermelho = fechado; boia mostra o estado ao vivo na execução.
- Novo tipo de peça **`consumo`**: ponto de saída/demanda com vazão de saída
  configurável (retira água do reservatório de origem e descarta).
- Campo **`rotulo`** em `Peca` — renomear peças pela UI (o `id` permanece estável).
- **Divisão de vazão da bomba** entre múltiplas saídas (por `vazaoAlocada` ou
  igualmente), permitindo uma bomba alimentar vários reservatórios.
- **Proteção contra bomba a seco configurável** (`protecaoSeco`): desliga a bomba
  quando a origem cai a/abaixo de um nível ajustável.
- Novo projeto de exemplo padrão: três reservatórios cilíndricos empilhados com
  bomba de saída dividida e ponto de consumo por gravidade.

### Alterado

- **Conexões agora são deliberadas** (estilo N8N): arrastar da alça de saída de
  uma peça até outra, em vez de conexão automática ao clicar. Corrige criação
  acidental de linhas.
- Conexões podem ser **selecionadas e excluídas** (clique + Delete ou botão).

## [1.0.0] — Sprint 5: Persistência e Polimento

### Adicionado

- Export/import manual de projetos `.json` (`src/persistence/arquivo.ts`), com
  nome de arquivo saneado a partir do nome do projeto.
- Tratamento de versão incompatível no import (recusa MAJOR diferente/ausente).
- Campo de nome do projeto e feedback visual de erros de validação/import na UI.
- Testes de round-trip export/import e de versão incompatível.
- README completo (schema + fórmulas físicas) e este changelog.

## [0.4.0] — Sprint 4: Modo Execução e Controles

### Adicionado

- Reducer central (`src/state/store.ts`) com modos `edicao`/`execucao`.
- Transição `edicao → execucao` roda a validação de grafo; falha mantém edição.
- Transição `execucao → edicao` exige pause; `RESET` restaura o snapshot.
- Loop de simulação via `requestAnimationFrame` (`useSimulationLoop`).
- Controle de velocidade (1x/2x/5x) rodando N ticks por frame sem alterar o `dt`.
- Controles de UI: play/pause/reset, registro, bomba manual, thresholds de sensor.
- Testes de integração: bloqueio de mutação estrutural em execução, validação
  impedindo execução com erro, controles refletindo o estado do motor.

## [0.3.0] — Sprint 3: Editor Visual (modo edição)

### Adicionado

- Canvas com react-konva: peças arrastáveis, criação de conexões por clique,
  visualização de nível de líquido e vazão.
- Paleta de peças e inspetor de propriedades por tipo.
- Testes de componente (React Testing Library) para criação, movimentação e
  conexão de peças (react-konva mockado em jsdom).

## [0.2.0] — Sprint 2: Motor de Simulação (puro, sem UI)

### Adicionado

- Motor `tick()` com cálculo de vazão por tipo de aresta (Torricelli, bomba com/
  sem curva, fonte com múltiplos destinos), overflow, proteção contra bomba a
  seco e arbitragem multi-sensor.
- Validação de grafo (seção 5): nó órfão, aresta sem origem/destino, ciclo
  moto-perpétuo (via componentes fortemente conexos), fonte acima da vazão fixa.
- Geometria nível↔volume para seção constante (cilindro/retangular).
- Cobertura de testes Vitest para todas as regras físicas e de validação.

## [0.1.0] — Sprint 1: Modelo de Domínio e Schema

### Adicionado

- Interfaces TypeScript de todas as entidades (`src/domain/types.ts`).
- Validação e versionamento de schema robustos a `.json` malformado/malicioso
  (`src/domain/schema.ts`), sem lançar exceções para o chamador.
- Fábricas de peças/projeto com defaults (`src/domain/factory.ts`).
- Testes de parsing de schema válido, rejeição de malformado e fallback de versão.
- Scaffolding do projeto (Vite, TypeScript strict, ESLint, Vitest).
