# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui. O formato segue
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e o versionamento é
[SemVer](https://semver.org/lang/pt-BR/). As versões espelham os sprints da
especificação técnica.

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
