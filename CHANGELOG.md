# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui. O formato segue
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e o versionamento é
[SemVer](https://semver.org/lang/pt-BR/). As versões espelham os sprints da
especificação técnica.

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
